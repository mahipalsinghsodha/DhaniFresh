// frontend/src/context/CartContext.jsx
// ═══════════════════════════════════════════════════════════════════
// RULES:
//  • Login required   → Cart works ONLY for logged-in users.
//  • Guest users      → Cannot add to cart. Redirected to /login.
//  • Logged-in users  → DB only. localStorage is NEVER used.
//  • On logout        → cart reset to [].
// ═══════════════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'
import { toast } from 'react-toastify'

const CartContext = createContext()

// ── Item detail extractor (exported for Cart / Checkout pages) ───────────────
export const getCartItemDetails = (item) => {
  if (!item) return { price: 0, weight: '', stock: 0, image: '', name: '', category: '', variant: null }
  const product = item.product || {}
  const variantId =
    item.variant?._id?.toString() ||
    item.variant?.toString() ||
    (typeof item.variant === 'string' ? item.variant : null)

  let variant = null
  if (variantId && Array.isArray(product.variants)) {
    variant = product.variants.find(v => (v._id?.toString() || v._id) === variantId)
  }
  // Auto-pick first variant when product has no base price
  if (!variant && Array.isArray(product.variants) && product.variants.length > 0 &&
    (product.price == null || product.price === 0)) {
    variant = product.variants[0]
  }

  return {
    price: Number(variant?.price ?? product.price ?? item.price ?? 0) || 0,
    weight: variant?.weight || product.weight || '',
    stock: variant?.stock ?? product.stock ?? 0,
    image: item.image || product.image || product.images?.[0] || '',
    name: product.name || item.name || 'Pure Vedic Product',
    category: product.category || '',
    variant,
  }
}

// ════════════════════════════════════════════════════════════════════════
export const CartProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const userId = user?._id || user?.id || null

  // ── Reusable DB Cart Fetcher ──────────────────────────────────────────────
  const fetchCart = useCallback(async () => {
    if (!userId) {
      setItems([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await api.get('/api/cart')
      setItems(res.data?.items || [])
    } catch (err) {
      console.error('[Cart] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // ── CORE EFFECT: fetch DB cart when user logs in / page reloads, clear on logout ──
  useEffect(() => {
    if (authLoading) return

    if (!userId) {
      setItems([])
      setLoading(false)
      return
    }

    fetchCart()
  }, [userId, authLoading, fetchCart])

  // ── ADD ITEM ──────────────────────────────────────────────────────────────
  const addItem = async (product, quantity = 1, variantId = null) => {
    // Guest blocked — must login first
    if (!user) {
      toast.info('Please login to add items to your cart', { toastId: 'login-required' })
      window.location.href = '/login'
      return false
    }

    const productId = String(product._id || product)
    try {
      const res = await api.post('/api/cart/items', { productId, quantity, variantId })
      setItems(res.data.items || [])
      return true
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add to cart')
      return false
    }
  }

  // ── REMOVE ITEM ───────────────────────────────────────────────────────────
  const removeItem = async (itemId) => {
    if (!user) return
    try {
      const res = await api.delete(`/api/cart/items/${itemId}`)
      setItems(res.data.items || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove item')
    }
  }

  // ── UPDATE QUANTITY ───────────────────────────────────────────────────────
  const updateQty = async (itemId, quantity) => {
    if (!user) return
    if (quantity < 1) return removeItem(itemId)
    try {
      const res = await api.put(`/api/cart/items/${itemId}`, { quantity })
      setItems(res.data.items || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update quantity')
    }
  }

  // ── CLEAR CART ────────────────────────────────────────────────────────────
  const clearCart = async () => {
    if (!user) { setItems([]); return }
    try {
      await api.delete('/api/cart')
      setItems([])
    } catch (err) {
      console.error('[Cart] clear error:', err)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isInCart = (productId, variantId = null) =>
    items.some(i =>
      (i.product?._id || i.product) === String(productId) &&
      (variantId
        ? String(i.variant?._id || i.variant || '') === String(variantId)
        : !i.variant)
    )

  const getItemQty = (productId, variantId = null) => {
    const found = items.find(i =>
      (i.product?._id || i.product) === String(productId) &&
      (variantId
        ? String(i.variant?._id || i.variant || '') === String(variantId)
        : !i.variant)
    )
    return found?.quantity || 0
  }

  // ── Derived totals ───────────────────────────────────────────────────────
  const cartCount = items.length

  const totalUnits = useMemo(
    () => items.reduce((sum, i) => sum + (i.quantity || 0), 0),
    [items]
  )

  const cartTotal = useMemo(
    () => items.reduce((sum, i) => {
      const { price } = getCartItemDetails(i)
      return sum + price * (i.quantity || 0)
    }, 0),
    [items]
  )

  return (
    <CartContext.Provider value={{
      items,
      cartCount,
      totalUnits,
      cartTotal,
      loading,
      syncing: loading,
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