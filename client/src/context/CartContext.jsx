// frontend/src/context/CartContext.jsx
// Full cart implementation:
//   ✅ Logged-in users: synced with DB via /api/cart
//   ✅ Guests: stored in localStorage (key: 'guestCart')
//   ✅ On login: merges guest cart into DB cart
//   ✅ Exposes: items, cartCount, cartTotal, addItem, removeItem, updateQty, clearCart

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'
import { toast } from 'react-toastify'

const CartContext = createContext()

const GUEST_CART_KEY = 'guestCart'

const loadGuestCart = () => {
  try {
    return JSON.parse(localStorage.getItem(GUEST_CART_KEY)) || []
  } catch {
    return []
  }
}

const saveGuestCart = (items) => {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
}

export const getCartItemDetails = (item) => {
  if (!item) return { price: 0, weight: '', stock: 0, image: '/matka.png', name: '', category: '', variant: null }
  
  const product = item.product || {}
  const variantId = item.variant?._id?.toString() || item.variant?.toString() || (typeof item.variant === 'string' ? item.variant : null)
  
  let variant = null
  if (variantId && Array.isArray(product.variants)) {
    variant = product.variants.find(v => (v._id?.toString() || v._id) === variantId)
  }
  if (!variant && Array.isArray(product.variants) && product.variants.length > 0 && (product.price === null || product.price === undefined || product.price === 0)) {
    variant = product.variants[0]
  }

  const price = variant?.price ?? product.price ?? item.price ?? 0
  const weight = variant?.weight || product.weight || ''
  const stock = variant?.stock ?? product.stock ?? 0
  const image = item.image || product.image || product.images?.[0] || '/matka.png'
  const name = product.name || item.name || 'Pure Vedic Product'
  const category = product.category || ''

  return { price: Number(price) || 0, weight, stock, image, name, category, variant }
}

export const CartProvider = ({ children }) => {
  const { user } = useAuth()

  const [items, setItems]       = useState([])   // [{ product: {...}, quantity, _id? }]
  const [loading, setLoading]   = useState(false)
  const [syncing, setSyncing]   = useState(false)

  // ── Derived values ──────────────────────────────────────────────────────────
  const cartCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const cartTotal = items.reduce((sum, item) => {
    const { price } = getCartItemDetails(item)
    return sum + price * (item.quantity || 0)
  }, 0)

  // ── Fetch DB cart (logged-in users) ─────────────────────────────────────────
  const fetchCart = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const res = await api.get('/api/cart')
      setItems(res.data.items || [])
    } catch (err) {
      console.error('Cart fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  // ── Merge guest cart into DB on login ───────────────────────────────────────
  const mergeGuestCart = useCallback(async () => {
    const guestItems = loadGuestCart()
    if (!guestItems.length) return

    setSyncing(true)
    try {
      // Add each guest item to the DB cart
      for (const item of guestItems) {
        const productId = item.product?._id || item.product || item.productId
        if (!productId) continue
        await api.post('/api/cart/items', {
          productId,
          quantity: item.quantity || 1,
          variantId: item.variant || null
        }).catch(() => { /* ignore individual item errors */ })
      }
      localStorage.removeItem(GUEST_CART_KEY)
      await fetchCart() // Refresh from DB
    } catch (err) {
      console.error('Cart merge error:', err)
    } finally {
      setSyncing(false)
    }
  }, [fetchCart])

  // ── Effect: load cart when auth state changes ───────────────────────────────
  useEffect(() => {
    if (user) {
      // First merge any guest cart, then fetch
      mergeGuestCart().then(() => fetchCart())
    } else {
      // Load from localStorage for guests
      setItems(loadGuestCart())
    }
  }, [user?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── ADD ITEM ────────────────────────────────────────────────────────────────
  const addItem = async (product, quantity = 1, variantId = null) => {
    const productId = product._id || product

    if (user) {
      // DB cart
      try {
        const res = await api.post('/api/cart/items', { productId, quantity, variantId })
        setItems(res.data.items || [])
        return true
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to add to cart'
        toast.error(msg)
        return false
      }
    } else {
      // Guest cart (localStorage)
      const currentItems = loadGuestCart()
      const existingIdx  = currentItems.findIndex(
        i => (i.product?._id || i.product) === String(productId) && i.variant === variantId
      )

      if (existingIdx > -1) {
        currentItems[existingIdx].quantity = Math.min(
          (currentItems[existingIdx].quantity || 1) + quantity,
          10
        )
      } else {
        currentItems.push({
          product:  typeof product === 'object' ? product : { _id: productId },
          quantity: Math.min(quantity, 10),
          variant:  variantId,
          _id:      Date.now().toString(), // temp id for guest
        })
      }

      saveGuestCart(currentItems)
      setItems(currentItems)
      return true
    }
  }

  // ── REMOVE ITEM ─────────────────────────────────────────────────────────────
  const removeItem = async (itemId) => {
    if (user) {
      try {
        const res = await api.delete(`/api/cart/items/${itemId}`)
        setItems(res.data.items || [])
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to remove item')
      }
    } else {
      const currentItems = loadGuestCart()
      const newItems = currentItems.filter(
        i => (i._id || i.product?._id || i.product) !== itemId
      )
      saveGuestCart(newItems)
      setItems(newItems)
    }
  }

  // ── UPDATE QUANTITY ─────────────────────────────────────────────────────────
  const updateQty = async (itemId, quantity) => {
    if (quantity < 1) {
      return removeItem(itemId)
    }

    if (user) {
      try {
        const res = await api.put(`/api/cart/items/${itemId}`, { quantity })
        setItems(res.data.items || [])
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to update quantity')
      }
    } else {
      const currentItems = loadGuestCart()
      const idx = currentItems.findIndex(
        i => (i._id || i.product?._id || i.product) === itemId
      )
      if (idx > -1) {
        currentItems[idx].quantity = Math.min(quantity, 10)
        saveGuestCart(currentItems)
        setItems([...currentItems])
      }
    }
  }

  // ── CLEAR CART ──────────────────────────────────────────────────────────────
  const clearCart = async () => {
    if (user) {
      try {
        await api.delete('/api/cart')
        setItems([])
      } catch (err) {
        console.error('Clear cart error:', err)
      }
    } else {
      localStorage.removeItem(GUEST_CART_KEY)
      setItems([])
    }
  }

  // ── Check if product is in cart ─────────────────────────────────────────────
  const isInCart = (productId, variantId = null) => {
    return items.some(i => (i.product?._id || i.product) === String(productId) && i.variant === variantId)
  }

  const getItemQty = (productId, variantId = null) => {
    const item = items.find(i => (i.product?._id || i.product) === String(productId) && i.variant === variantId)
    return item?.quantity || 0
  }

  return (
    <CartContext.Provider value={{
      items,
      cartCount,
      cartTotal,
      loading,
      syncing,
      addItem,
      removeItem,
      updateQty,
      clearCart,
      fetchCart,
      fetchCartCount: fetchCart,
      isInCart,
      getItemQty,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
