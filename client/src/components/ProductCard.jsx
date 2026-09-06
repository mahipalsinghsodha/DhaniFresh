import { Link, useNavigate, useLocation } from 'react-router-dom'
import { FiStar, FiShoppingCart, FiHeart, FiMinus, FiPlus } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { toast } from 'react-toastify'
import api from '../api/axios'
import { useState } from 'react'

// Cloudinary optimized images for cards
const clImg = (url, w = 360) => {
  if (!url || !url.includes('cloudinary.com')) return url
  return url.replace('/upload/', `/upload/c_fill,w_${w},f_auto,q_auto/`)
}

const ProductCard = ({ product, categories = [], rank }) => {
  const { user, toggleWishlist } = useAuth()
  const { addItem, updateQty, removeItem, items } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [addingToCart, setAddingToCart] = useState(false)
  const [updatingCart, setUpdatingCart] = useState(false)

  const catObj  = categories.find(c => c.slug === product.category)
  const catName = catObj ? catObj.name : product.category
  const showCart = !user || (user.role !== 'admin' && user.role !== 'superadmin')
  const isWishlisted = user?.wishlist?.some(id => String(id?._id || id) === String(product._id))
  const stars = Math.round(product.rating || 0)

  // Use base product properties (matching ProductDetail page) with fallback to first variant if needed
  const displayWeight = product.weight || product.variants?.[0]?.weight || '';
  let displayPrice = Number(product.price ?? product.variants?.[0]?.price ?? 0);
  if (user && user.role === 'b2b_customer' && user.b2bDiscountPercentage > 0) {
    displayPrice = displayPrice - (displayPrice * user.b2bDiscountPercentage) / 100;
  }

  const displayMrp = Number(product.mrp ?? product.variants?.[0]?.mrp ?? 0);
  const displayStock = product.stock ?? product.variants?.[0]?.stock ?? 0;
  const inStock = displayStock > 0;

  const discount = displayMrp && displayMrp > displayPrice
    ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
    : 0;
  const isComingSoon = product.launchDate && new Date(product.launchDate) > new Date();

  let variantId = null;
  if ((product.price == null || product.price === 0) && product.variants?.length > 0) {
    variantId = product.variants[0]._id;
  }

  // Find if this product is already in the cart
  const cartItem = items?.find(i =>
    String(i.product?._id || i.product) === String(product._id) &&
    (variantId ? String(i.variant?._id || i.variant || '') === String(variantId) : !i.variant)
  )
  const cartQty = cartItem?.quantity || 0

  const handleWishlist = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return }
    try {
      const added = await toggleWishlist(product._id)
      toast.success(added ? 'Added to wishlist ♥' : 'Removed from wishlist')
    } catch { toast.error('Failed to update wishlist') }
  }

  const handleQuickAdd = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!inStock || isComingSoon || addingToCart) return
    setAddingToCart(true)
    try {
      let qtyToAdd = 1;
      if (user?.role === 'b2b_customer' && product.b2bMinQty > 0) {
        qtyToAdd = product.b2bMinQty;
      }
      
      const success = await addItem(product, qtyToAdd, variantId)
      if (success) {
        toast.success('Added to cart!')
      }
    } finally {
      setAddingToCart(false)
    }
  }

  const handleDecrement = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!cartItem || updatingCart) return
    setUpdatingCart(true)
    try {
      if (cartQty <= 1) {
        await removeItem(cartItem._id)
      } else {
        await updateQty(cartItem._id, cartQty - 1)
      }
    } finally {
      setUpdatingCart(false)
    }
  }

  const handleIncrement = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!cartItem || updatingCart) return
    const maxAllowed = Math.min(displayStock || 10, 10)
    if (cartQty >= maxAllowed) {
      toast.error(`Max ${maxAllowed} allowed in cart`)
      return
    }
    setUpdatingCart(true)
    try {
      await updateQty(cartItem._id, cartQty + 1)
    } finally {
      setUpdatingCart(false)
    }
  }

  return (
    <Link
      to={`/products/${product._id}`}
      className="group flex flex-col h-full rounded-2xl sm:rounded-3xl overflow-hidden hover:-translate-y-1 transition-all duration-300 will-change-transform bg-white border border-brand-primary/5 shadow-xs hover:shadow-md"
    >
      {/* ── Image ── */}
      <div className="relative aspect-square overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        <img
          src={clImg(product.image)}
          alt={`${product.name} — Daatasa`}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Top-left: rank / discount / category badge */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {rank && (
            <span className="px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black rounded-full uppercase tracking-wider shadow-sm text-white"
              style={{ background: 'linear-gradient(135deg, var(--brand-secondary), #f59e0b)' }}>
              #{rank}
            </span>
          )}
          {isComingSoon ? (
            <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full uppercase tracking-wider bg-brand-primary text-white shadow-xs">
              Coming Soon
            </span>
          ) : discount > 0 ? (
            <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full uppercase tracking-wider bg-brand-secondary text-brand-primary shadow-xs">
              -{discount}% OFF
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded-full uppercase tracking-wider bg-white text-brand-primary border border-brand-primary/10 shadow-xs">
              {catName}
            </span>
          )}
        </div>

        {/* Top-right: Top Pick + Wishlist */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {product.featured && (
            <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full uppercase tracking-wider bg-brand-primary text-white shadow-xs">
              ✦ Top Pick
            </span>
          )}
          {showCart && (
            <button
              onClick={handleWishlist}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-xs bg-white border border-brand-primary/10 ${isWishlisted ? 'text-red-500' : 'text-brand-primary/40 hover:text-red-500'}`}
            >
              <FiHeart size={12} className={isWishlisted ? 'fill-red-500' : ''} />
            </button>
          )}
        </div>

        {/* Coming Soon / Out of stock overlay */}
        {isComingSoon ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}>
             <span className="px-3 py-1 text-white text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-wider"
              style={{ background: 'rgba(245,166,35,0.9)' }}>
              Coming Soon
            </span>
            <span className="text-white text-[10px] sm:text-xs font-bold tracking-wider">
               {new Date(product.launchDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        ) : !inStock ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}>
            <span className="px-3 py-1 text-white text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-wider"
              style={{ background: 'rgba(0,0,0,0.7)' }}>
              Out of Stock
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Content ── */}
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        {/* Rating */}
        <div className="flex items-center gap-1 mb-1.5">
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(i => (
              <FiStar
                key={i}
                size={11}
                className={i <= stars ? 'text-amber-400 fill-amber-400' : ''}
                style={i > stars ? { color: 'var(--border-color)', fill: 'var(--border-color)' } : {}}
              />
            ))}
          </div>
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {product.rating ? product.rating.toFixed(1) : '—'}
            <span className="ml-0.5" style={{ color: 'var(--border-color)' }}>({product.numReviews || 0})</span>
          </span>
        </div>

        {/* Name */}
        <h3
          className="text-sm sm:text-[15px] font-display font-bold mb-1 line-clamp-1 leading-snug transition-colors duration-200 text-brand-primary group-hover:text-brand-secondary"
        >
          {product.name}
        </h3>

        {/* Description */}
        <p className="text-[11px] line-clamp-1 leading-normal mb-2 text-brand-text/60 font-light">
          {product.description || 'Pure Vedic handcrafted premium product.'}
        </p>

        {/* Pricing & Action (Inline) */}
        <div className="pt-2.5 mt-auto border-t border-brand-primary/5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            {displayWeight && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary leading-none mb-1">{displayWeight}</div>
            )}
            {displayMrp && displayMrp > displayPrice ? (
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-base sm:text-lg font-bold text-brand-primary leading-none">
                  ₹{displayPrice?.toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] sm:text-xs line-through text-brand-text/40 leading-none">
                  ₹{displayMrp?.toLocaleString('en-IN')}
                </span>
              </div>
            ) : (
              <span className="text-base sm:text-lg font-bold text-brand-primary leading-none">
                ₹{displayPrice?.toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Right Side: Small Inline Button / Stepper */}
          {isComingSoon ? (
            <span className="px-2.5 py-1 text-[10px] sm:text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0">
              Soon
            </span>
          ) : showCart && inStock ? (
            cartQty > 0 ? (
              <div
                onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                className="h-8 sm:h-9 px-1.5 flex items-center justify-between gap-1 bg-brand-primary text-white rounded-full shadow-xs shrink-0"
              >
                <button
                  onClick={handleDecrement}
                  disabled={updatingCart}
                  aria-label="Decrease quantity"
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 active:scale-90 transition-all text-white"
                >
                  <FiMinus size={11} />
                </button>
                <span className="text-xs font-bold font-display px-1 min-w-[14px] text-center text-white">
                  {updatingCart ? (
                    <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    cartQty
                  )}
                </span>
                <button
                  onClick={handleIncrement}
                  disabled={updatingCart || cartQty >= displayStock}
                  aria-label="Increase quantity"
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 active:scale-90 transition-all text-white disabled:opacity-40"
                >
                  <FiPlus size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleQuickAdd}
                disabled={addingToCart}
                aria-label="Add to cart"
                className="h-8 sm:h-9 px-3 sm:px-3.5 flex items-center justify-center gap-1.5 text-xs font-bold rounded-full transition-all duration-300 disabled:opacity-50 btn btn-primary shadow-xs hover:shadow-md hover:scale-105 active:scale-95 shrink-0"
              >
                {addingToCart ? (
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiShoppingCart size={13} />
                )}
                <span>{addingToCart ? 'Adding…' : 'Add'}</span>
              </button>
            )
          ) : !inStock ? (
            <span className="px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold rounded-full bg-slate-100 text-slate-400 border border-slate-200 shrink-0">
              Sold Out
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
