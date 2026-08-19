import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import {
  FiHeart,
  FiShoppingCart,
  FiTrash2,
  FiArrowRight,
  FiStar,
  FiPackage,
  FiCheck,
  FiShield,
  FiZap,
  FiShoppingBag,
  FiLayers
} from 'react-icons/fi'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SKELETON LOADER                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="rounded-[1.75rem] overflow-hidden bg-white border border-brand-primary/10 shadow-sm p-4 space-y-4 animate-pulse">
    <div className="aspect-square rounded-2xl bg-brand-primary/5" />
    <div className="space-y-2">
      <div className="h-4 bg-brand-primary/10 rounded w-3/4" />
      <div className="h-3 bg-brand-primary/5 rounded w-1/2" />
      <div className="h-5 bg-brand-primary/10 rounded w-1/3 pt-2" />
    </div>
    <div className="h-11 bg-brand-primary/10 rounded-xl mt-4" />
  </div>
)

/* ─────────────────────────────────────────────────────────────────────────── */
/*  WISHLIST CARD COMPONENT                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */
const WishlistCard = ({ product, onRemove, onAddToCart }) => {
  const [adding, setAdding] = useState(false)
  const [addedSuccess, setAddedSuccess] = useState(false)

  // Resolve Price and MRP safely from product or first variant
  const activeVariant = product.variants?.[0] || null
  const displayPrice = Number(activeVariant?.price ?? product.price ?? 0)
  const displayMrp   = Number(activeVariant?.mrp ?? product.mrp ?? 0)
  const displayWeight = activeVariant?.weight || product.weight || ''
  const displayImage  = product.image || (product.images && product.images[0]) || '/placeholder.png'

  const discountPct = (displayMrp > displayPrice && displayPrice > 0)
    ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
    : 0

  const isOutOfStock = product.stock === 0

  const handleAddToCart = async () => {
    if (isOutOfStock || adding) return
    setAdding(true)
    try {
      await onAddToCart(product._id)
      setAddedSuccess(true)
      setTimeout(() => setAddedSuccess(false), 2000)
    } finally {
      setAdding(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.25 } }}
      className="group relative flex flex-col justify-between rounded-[1.75rem] overflow-hidden bg-white border border-brand-primary/10 hover:border-brand-secondary/40 shadow-sm hover:shadow-xl transition-all duration-300"
    >
      {/* ── Top Image Container ── */}
      <div className="relative aspect-square overflow-hidden bg-[var(--ivory)] p-4 flex items-center justify-center">
        <Link to={`/products/${product._id}`} className="w-full h-full flex items-center justify-center">
          <img
            src={displayImage}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
          />
        </Link>

        {/* Discount Badge */}
        {discountPct > 0 && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 uppercase tracking-wider">
            <FiZap size={11} /> {discountPct}% OFF
          </div>
        )}

        {/* Out of Stock Ribbon */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-white/95 text-brand-primary text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-lg border border-brand-primary/20">
              Out of Stock
            </span>
          </div>
        )}

        {/* Remove from Wishlist Button */}
        <button
          onClick={() => onRemove(product._id)}
          title="Remove from Wishlist"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 hover:bg-red-50 border border-brand-primary/10 hover:border-red-200 text-red-500 flex items-center justify-center shadow-sm hover:shadow transition-all duration-200 hover:scale-110 active:scale-95 group/btn"
        >
          <FiTrash2 size={15} className="group-hover/btn:rotate-12 transition-transform" />
        </button>

        {/* Rating Badge */}
        {product.rating > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-md text-brand-primary shadow-sm border border-brand-primary/5">
            <FiStar size={12} className="text-amber-500 fill-amber-500" />
            <span>{Number(product.rating).toFixed(1)}</span>
            {product.numReviews > 0 && (
              <span className="text-brand-text/50 text-[10px] font-normal">({product.numReviews})</span>
            )}
          </div>
        )}
      </div>

      {/* ── Product Details Content ── */}
      <div className="p-5 flex flex-col flex-1 justify-between gap-4">
        <div>
          {/* Category & Weight Tags */}
          <div className="flex items-center justify-between text-xs text-brand-text/60 mb-1.5">
            <span className="uppercase tracking-wider font-semibold text-[10px] text-brand-secondary">
              {product.category || 'Vedic Ghee'}
            </span>
            {displayWeight && (
              <span className="bg-[var(--ivory)] text-brand-primary px-2 py-0.5 rounded-md font-semibold text-[11px] border border-brand-primary/5">
                {displayWeight}
              </span>
            )}
          </div>

          {/* Product Title */}
          <Link to={`/products/${product._id}`}>
            <h3 className="text-base font-bold font-display text-brand-primary hover:text-brand-secondary transition-colors line-clamp-2 leading-snug">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* Pricing & Stock Section */}
        <div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-xl font-black font-display text-brand-primary">
              ₹{displayPrice.toLocaleString('en-IN')}
            </span>
            {displayMrp > displayPrice && (
              <span className="text-xs text-brand-text/40 line-through font-semibold">
                ₹{displayMrp.toLocaleString('en-IN')}
              </span>
            )}
            {discountPct > 0 && (
              <span className="text-[11px] font-bold text-emerald-600 ml-auto">
                Save ₹{(displayMrp - displayPrice).toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Stock Alert */}
          {product.stock > 0 && product.stock <= 5 && (
            <p className="text-[11px] font-bold text-amber-600 mb-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              Only {product.stock} left in stock!
            </p>
          )}

          {/* Action Button: Add to Cart */}
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || adding}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] ${
              isOutOfStock
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                : addedSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-200'
                  : 'bg-brand-primary text-white hover:bg-brand-primary/90 hover:shadow-md'
            }`}
          >
            {adding ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : addedSuccess ? (
              <>
                <FiCheck size={16} /> Added to Cart!
              </>
            ) : isOutOfStock ? (
              'Out of Stock'
            ) : (
              <>
                <FiShoppingCart size={15} /> Move to Cart
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  MAIN WISHLIST PAGE                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */
const Wishlist = () => {
  const { user, toggleWishlist } = useAuth()
  const { fetchCartCount } = useCart()
  const navigate = useNavigate()

  const [wishlistProducts, setWishlistProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'in-stock', 'on-sale'
  const [movingAll, setMovingAll] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/wishlist' } })
      return
    }
    fetchWishlist()
  }, [user])

  const fetchWishlist = async () => {
    setLoading(true)
    try {
      // Direct backend populated endpoint for 100% accuracy & zero data drops
      const res = await api.get('/api/auth/wishlist')
      setWishlistProducts(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Wishlist fetch error:', err)
      // Fallback: fetch products list if endpoint isn't ready
      try {
        const prodRes = await api.get('/api/products?limit=100')
        const items = prodRes.data?.products || (Array.isArray(prodRes.data) ? prodRes.data : [])
        const filtered = items.filter(p => (user?.wishlist || []).some(id => String(id?._id || id) === String(p._id)))
        setWishlistProducts(filtered)
      } catch (fallbackErr) {
        toast.error('Failed to load wishlist items')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (productId) => {
    try {
      await toggleWishlist(productId)
      setWishlistProducts(prev => prev.filter(p => String(p._id) !== String(productId)))
      toast.success('Removed from wishlist')
    } catch {
      toast.error('Failed to update wishlist')
    }
  }

  const handleAddToCart = async (productId) => {
    try {
      await api.post('/api/cart/items', { productId, quantity: 1 })
      await fetchCartCount()
      toast.success('Item added to your cart!')
    } catch (err) {
      // Axios interceptor will show specific error if any
    }
  }

  const handleMoveAllToCart = async () => {
    const available = wishlistProducts.filter(p => p.stock > 0)
    if (available.length === 0) {
      toast.info('No in-stock items to move')
      return
    }
    setMovingAll(true)
    let movedCount = 0
    try {
      for (const p of available) {
        try {
          await api.post('/api/cart/items', { productId: p._id, quantity: 1 })
          await toggleWishlist(p._id)
          movedCount++
        } catch {}
      }
      await fetchCartCount()
      fetchWishlist()
      toast.success(`Moved ${movedCount} item${movedCount > 1 ? 's' : ''} to your cart!`)
      navigate('/cart')
    } catch {
      toast.error('Failed to move items to cart')
    } finally {
      setMovingAll(false)
    }
  }

  // Filtered Products
  const filteredProducts = wishlistProducts.filter(p => {
    if (filter === 'in-stock') return p.stock > 0
    if (filter === 'on-sale') {
      const price = Number(p.variants?.[0]?.price ?? p.price ?? 0)
      const mrp = Number(p.variants?.[0]?.mrp ?? p.mrp ?? 0)
      return mrp > price
    }
    return true
  })

  return (
    <div className="min-h-screen bg-[var(--ivory)] font-sans">
      <Helmet>
        <title>My Wishlist — Daatasa Vedic Ghee</title>
        <meta name="description" content="Manage your saved Daatasa Vedic Bilona Ghee products. Add to cart with one click." />
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* ── Luxury Royal Header Banner ── */}
      <div className="relative bg-brand-primary text-white overflow-hidden py-10 sm:py-14 border-b border-brand-secondary/20">
        {/* Background glow & accents */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 rounded-full bg-brand-secondary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-10 w-64 h-64 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Title & Stats */}
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-brand-secondary font-bold mb-2">
                <Link to="/" className="hover:underline text-white/70">Home</Link>
                <span>/</span>
                <span>Wishlist</span>
              </div>
              
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-brand-secondary/20 border border-brand-secondary/30 flex items-center justify-center shadow-inner text-brand-secondary">
                  <FiHeart size={22} className="fill-brand-secondary" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-display text-white tracking-tight">
                    My Wishlist
                  </h1>
                  <p className="text-xs sm:text-sm text-white/70 mt-0.5">
                    {loading ? (
                      'Loading your saved items...'
                    ) : wishlistProducts.length === 0 ? (
                      'Your wishlist is currently empty'
                    ) : (
                      `You have saved ${wishlistProducts.length} premium product${wishlistProducts.length !== 1 ? 's' : ''}`
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Bar (Only if items exist) */}
            {wishlistProducts.length > 0 && !loading && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleMoveAllToCart}
                  disabled={movingAll}
                  className="px-5 py-3 rounded-xl font-bold text-sm bg-brand-secondary text-brand-primary hover:bg-brand-secondary/90 shadow-md transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {movingAll ? (
                    <div className="w-4 h-4 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
                  ) : (
                    <>
                      <FiShoppingBag size={16} /> Move All to Cart
                    </>
                  )}
                </button>
                <Link
                  to="/products"
                  className="px-5 py-3 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center gap-2"
                >
                  Continue Shopping <FiArrowRight size={15} />
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

        {/* ── Filter Tabs (When items exist) ── */}
        {wishlistProducts.length > 0 && !loading && (
          <div className="flex items-center justify-between flex-wrap gap-4 mb-8 pb-4 border-b border-brand-primary/10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  filter === 'all'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-white text-brand-primary border border-brand-primary/10 hover:bg-brand-primary/5'
                }`}
              >
                All Items ({wishlistProducts.length})
              </button>
              <button
                onClick={() => setFilter('in-stock')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  filter === 'in-stock'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-white text-brand-primary border border-brand-primary/10 hover:bg-brand-primary/5'
                }`}
              >
                In Stock ({wishlistProducts.filter(p => p.stock > 0).length})
              </button>
              <button
                onClick={() => setFilter('on-sale')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  filter === 'on-sale'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-white text-brand-primary border border-brand-primary/10 hover:bg-brand-primary/5'
                }`}
              >
                On Sale ({wishlistProducts.filter(p => {
                  const pPrice = Number(p.variants?.[0]?.price ?? p.price ?? 0)
                  const pMrp = Number(p.variants?.[0]?.mrp ?? p.mrp ?? 0)
                  return pMrp > pPrice
                }).length})
              </button>
            </div>

            <div className="text-xs font-semibold text-brand-text/60">
              Showing {filteredProducts.length} of {wishlistProducts.length} items
            </div>
          </div>
        )}

        {/* ── Loading Skeleton ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : wishlistProducts.length === 0 ? (
          
          /* ── Premium Luxury Empty State ── */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="py-16 sm:py-24 px-6 sm:px-12 rounded-[2.5rem] bg-white border border-brand-primary/10 shadow-sm flex flex-col items-center text-center max-w-2xl mx-auto"
          >
            {/* Pulsing Animated Heart Badge */}
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative mb-6"
            >
              <div className="w-24 h-24 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center shadow-lg shadow-red-500/10">
                <FiHeart size={44} className="text-red-500 fill-red-500" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-secondary text-brand-primary font-black text-xs flex items-center justify-center shadow-md">
                0
              </div>
            </motion.div>

            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-brand-primary mb-3">
              Your Wishlist is Empty
            </h2>
            <p className="text-sm sm:text-base text-brand-text/60 max-w-md mb-8 leading-relaxed">
              Explore our pure Vedic Bilona Ghee collection and save your favorite jars to buy them whenever you are ready.
            </p>

            {/* Quick Category Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
              {[
                { name: 'A2 Gir Cow Ghee', link: '/category/cow-ghee' },
                { name: 'Tharparkar Bilona Ghee', link: '/category/tharparkar-ghee' },
                { name: 'Buffalo Bilona Ghee', link: '/category/buffalo-ghee' },
                { name: 'Best Sellers', link: '/products?featured=true' }
              ].map((item) => (
                <Link
                  key={item.name}
                  to={item.link}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-[var(--ivory)] hover:bg-brand-primary hover:text-white border border-brand-primary/10 text-brand-primary transition-all duration-200 shadow-sm"
                >
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Explore Button */}
            <Link
              to="/products"
              className="px-8 py-3.5 rounded-xl font-bold text-sm bg-brand-primary text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 transition-all flex items-center gap-2 hover:gap-3"
            >
              Explore Collection <FiArrowRight size={16} />
            </Link>
          </motion.div>

        ) : filteredProducts.length === 0 ? (
          
          /* Empty Filter State */
          <div className="py-16 text-center bg-white rounded-3xl border border-brand-primary/10 p-8">
            <FiLayers size={36} className="mx-auto text-brand-text/30 mb-3" />
            <p className="text-base font-bold text-brand-primary mb-1">No items match this filter</p>
            <p className="text-xs text-brand-text/50 mb-4">Try switching back to all wishlist items</p>
            <button
              onClick={() => setFilter('all')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-primary text-white"
            >
              Show All Items
            </button>
          </div>

        ) : (

          /* ── Wishlist Product Grid ── */
          <AnimatePresence mode="popLayout">
            <motion.div
              layout
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
            >
              {filteredProducts.map(product => (
                <WishlistCard
                  key={product._id}
                  product={product}
                  onRemove={handleRemove}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </motion.div>
          </AnimatePresence>

        )}

      </div>
    </div>
  )
}

export default Wishlist
