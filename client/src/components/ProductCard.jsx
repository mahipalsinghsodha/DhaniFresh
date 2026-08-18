import { Link, useNavigate, useLocation } from 'react-router-dom'
import { FiStar, FiShoppingCart, FiHeart } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { toast } from 'react-toastify'
import api from '../api/axios'
import { useState } from 'react'

// Cloudinary optimized images for cards
const clImg = (url, w = 400) => {
  if (!url || !url.includes('cloudinary.com')) return url
  return url.replace('/upload/', `/upload/c_fill,w_${w},f_auto,q_auto/`)
}

const ProductCard = ({ product, categories = [], rank }) => {
  const { user, toggleWishlist } = useAuth()
  const { addItem } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [addingToCart, setAddingToCart] = useState(false)

  const catObj  = categories.find(c => c.slug === product.category)
  const catName = catObj ? catObj.name : product.category
  const showCart = !user || (user.role !== 'admin' && user.role !== 'superadmin')
  const isWishlisted = user?.wishlist?.some(id => String(id?._id || id) === String(product._id))
  const stars = Math.round(product.rating || 0)
  const inStock = product.stock > 0

  let displayPrice = product.price;
  if (user && user.role === 'b2b_customer' && user.b2bDiscountPercentage > 0) {
    displayPrice = displayPrice - (displayPrice * user.b2bDiscountPercentage) / 100;
  }

  const discount = product.mrp && product.mrp > displayPrice
    ? Math.round(((product.mrp - displayPrice) / product.mrp) * 100)
    : 0
  const isComingSoon = product.launchDate && new Date(product.launchDate) > new Date()

  const handleWishlist = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return }
    try {
      const added = await toggleWishlist(product._id)
      toast.success(added ? 'Added to wishlist ♥' : 'Removed from wishlist')
    } catch { toast.error('Failed to update wishlist') }
  }

  const handleQuickAdd = async (e) => {
    e.preventDefault(); e.stopPropagation() // prevent navigating to product detail
    if (!inStock || isComingSoon) return
    setAddingToCart(true)
    
    let qtyToAdd = 1;
    if (user?.role === 'b2b_customer') {
      qtyToAdd = product.b2bMinQty > 0 ? product.b2bMinQty : 1;
      if (product.variants && product.variants.length > 0) {
         if (product.variants[0].b2bMinQty > 0) qtyToAdd = product.variants[0].b2bMinQty;
      }
    }
    
    const success = await addItem(product, qtyToAdd)
    if (success) {
      toast.success('Added to cart!')
    }
    setAddingToCart(false)
  }

  return (
    <Link
      to={`/products/${product._id}`}
      className="group flex flex-col h-full rounded-[2rem] overflow-hidden hover:-translate-y-2 transition-all duration-300 will-change-transform bg-white border border-brand-primary/5 shadow-sm hover:shadow-lg"
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
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {rank && (
            <span className="px-3 py-1 text-[11px] font-black rounded-full uppercase tracking-widest shadow-md text-white"
              style={{ background: 'linear-gradient(135deg, var(--brand-secondary), #f59e0b)' }}>
              #{rank}
            </span>
          )}
          {isComingSoon ? (
            <span className="px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest bg-brand-primary text-white shadow-sm">
              Coming Soon
            </span>
          ) : discount > 0 ? (
            <span className="px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest bg-brand-secondary text-brand-primary shadow-sm">
              -{discount}% OFF
            </span>
          ) : (
            <span className="px-3 py-1 text-[10px] font-semibold rounded-full uppercase tracking-widest bg-white text-brand-primary border border-brand-primary/10 shadow-sm">
              {catName}
            </span>
          )}
        </div>

        {/* Top-right: Top Pick + Wishlist */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 items-end">
          {product.featured && (
            <span className="px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest bg-brand-primary text-white shadow-sm">
              ✦ Top Pick
            </span>
          )}
          {showCart && (
            <button
              onClick={handleWishlist}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-sm bg-white border border-brand-primary/10 ${isWishlisted ? 'text-red-500' : 'text-brand-primary/40 hover:text-red-500'}`}
            >
              <FiHeart size={13} className={isWishlisted ? 'fill-red-500' : ''} />
            </button>
          )}
        </div>

        {/* Desktop hover: Quick Add overlay */}
        {!isComingSoon && (
          <div className="absolute bottom-0 inset-x-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 p-3 hidden sm:block">
            <button
              onClick={handleQuickAdd}
              disabled={!inStock || addingToCart}
              className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-full transition-all duration-300 disabled:opacity-50 btn btn-primary shadow-lg"
            >
              {addingToCart
                ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <FiShoppingCart size={13} />
              }
              {inStock ? (addingToCart ? 'Adding…' : 'Add to Cart') : 'Out of Stock'}
            </button>
          </div>
        )}

        {/* Coming Soon / Out of stock overlay */}
        {isComingSoon ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}>
             <span className="px-4 py-2 text-white text-xs font-bold rounded-full uppercase tracking-widest"
              style={{ background: 'rgba(245,166,35,0.9)' }}>
              Coming Soon
            </span>
            <span className="text-white text-xs font-bold tracking-widest">
               {new Date(product.launchDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        ) : !inStock ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}>
            <span className="px-4 py-2 text-white text-xs font-bold rounded-full uppercase tracking-widest"
              style={{ background: 'rgba(0,0,0,0.7)' }}>
              Out of Stock
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Content ── */}
      <div className="p-2.5 xs:p-3 sm:p-5 flex flex-col flex-1">
        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-2">
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
          className="text-base font-display font-bold mb-1 line-clamp-2 leading-snug transition-colors duration-200 text-brand-primary group-hover:text-brand-secondary"
        >
          {product.name}
        </h3>

        {/* Description */}
        <p className="text-[11px] sm:text-xs line-clamp-2 leading-relaxed mb-3 min-h-[2rem] text-brand-text/60 font-light hidden sm:block">
          {product.description}
        </p>

        {/* Footer */}
        <div className="pt-3 sm:pt-4 mt-auto border-t border-brand-primary/5">
          <div className="flex items-center justify-between">
            <div>
              {product.weight && (
                <div className="text-[10px] font-bold mb-1 uppercase tracking-widest text-brand-secondary">{product.weight}</div>
              )}
              {product.mrp && product.mrp > displayPrice ? (
                <div className="flex flex-col xs:flex-row xs:items-center gap-0 sm:gap-1.5 flex-wrap mt-0.5 sm:mt-0">
                  <span className="text-base sm:text-lg font-bold text-brand-primary leading-none">
                    ₹{displayPrice?.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs sm:text-sm line-through text-brand-text/40">
                    ₹{product.mrp?.toLocaleString('en-IN')}
                  </span>
                </div>
              ) : (
                <span className="text-lg font-bold text-brand-primary">
                  ₹{displayPrice?.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {/* Stock indicator */}
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-red-400'}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${inStock ? 'text-emerald-600' : 'text-red-500'}`}>
                {inStock ? 'In Stock' : 'Sold Out'}
              </span>
            </div>
          </div>

          {/* Mobile-only Add to Cart */}
          {showCart && inStock && (
            <button
              onClick={handleQuickAdd}
              disabled={addingToCart}
              className="sm:hidden mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 xs:py-2.5 text-[11px] xs:text-xs font-bold rounded-full transition-all duration-300 disabled:opacity-50 btn btn-primary"
            >
              {addingToCart
                ? <div className="w-3 h-3 xs:w-3.5 xs:h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <FiShoppingCart size={12} className="xs:w-[13px] xs:h-[13px]" />
              }
              {addingToCart ? 'Adding…' : 'Add to Cart'}
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
