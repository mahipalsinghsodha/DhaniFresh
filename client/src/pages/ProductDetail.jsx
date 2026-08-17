import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { toast } from 'react-toastify'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Minus, Plus, ChevronLeft, ChevronRight,
  Star, Truck, Shield, RefreshCw, MapPin, Package,
  CheckCircle, AlertCircle, Tag, User, Send, BadgeCheck, Heart
} from 'lucide-react'

// ── Cloudinary URL transform: serve optimized images ──────────────────────────
const cloudinaryTransform = (url, { width = 800, quality = 'auto', format = 'auto' } = {}) => {
  if (!url || !url.includes('cloudinary.com')) return url
  return url.replace('/upload/', `/upload/c_fill,w_${width},f_${format},q_${quality}/`)
}

// ── Star selector component ────────────────────────────────────────────────
const StarPicker = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1,2,3,4,5].map(n => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        className="transition-transform hover:scale-110"
      >
        <Star
          size={24}
          className={n <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
        />
      </button>
    ))}
  </div>
)

// ── Read-only stars ────────────────────────────────────────────────────────
const Stars = ({ rating, size = 14 }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(n => (
      <Star
        key={n}
        size={size}
        className={n <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
      />
    ))}
  </div>
)

// ── Main Page ──────────────────────────────────────────────────────────────
const ProductDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, toggleWishlist } = useAuth()
  const { fetchCartCount, addItem } = useCart()

  const [product,    setProduct]    = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [plans,      setPlans]      = useState([])
  const [related,    setRelated]    = useState([])
  const [reviews, setReviews] = useState([])
  const [addresses,  setAddresses]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [quantity,   setQuantity]   = useState(1)
  const [adding,     setAdding]     = useState(false)
  const [activeTab,  setActiveTab]  = useState('description') // description | reviews
  const [reviewRating,  setReviewRating]  = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)
  const [eligibleOrderId, setEligibleOrderId] = useState(null)
  const [estPin, setEstPin] = useState('')
  const [estLoading, setEstLoading] = useState(false)
  const [estState, setEstState] = useState(null)
  const [estError, setEstError] = useState('')

  useEffect(() => {
  const controller = new AbortController();
  window.scrollTo(0, 0);
  setQuantity(1);
  setActiveTab('description');
  fetchAll(controller);
  return () => controller.abort();
}, [id])

  const fetchAll = async (controller = new AbortController()) => {
    setLoading(true)
    try {
      const [prodRes] = await Promise.all([
        api.get(`/api/products/${id}`, { signal: controller.signal }),
      ])
      const prod = prodRes.data
      setProduct(prod)
      setSelectedImage(prod.image)

      // Check if current user already reviewed
      if (user && prod.reviews?.length) {
        setHasReviewed(prod.reviews.some(r => {
          const rUserId = r.user?._id || r.user;
          return String(rUserId) === String(user._id || user.id);
        }))
      }

      // Fetch related products, plans and reviews
      try {
        const [relRes, plansRes, revsRes] = await Promise.all([
          api.get(`/api/products?category=${prod.category}`, { signal: controller.signal }),
          api.get('/api/subscriptions/plans', { signal: controller.signal }),
          api.get(`/api/reviews/product/${prod._id}`, { signal: controller.signal })
        ])
        setRelated((relRes.data?.products || relRes.data || []).filter(p => p._id !== prod._id).slice(0, 4))
        setReviews(revsRes.data?.reviews || [])
        
        // Filter plans for this product
        if (plansRes.data?.data) {
          const productPlans = plansRes.data.data.filter(plan => 
            plan.product?._id === prod._id || plan.product === prod._id
          )
          setPlans(productPlans)
        }
      } catch (e) { console.error('Error fetching related/plans', e) }

      // Fetch saved addresses for delivery info + review eligibility
      if (user) {
        try {
          // Fetch addresses and review eligibility in parallel
          const [meRes, eligRes] = await Promise.allSettled([
            api.get('/api/auth/me', { signal: controller.signal }),
            api.get(`/api/reviews/can-review/${id}`, { signal: controller.signal })
          ])
          if (meRes.status === 'fulfilled') setAddresses(meRes.value.data.addresses || [])
          if (eligRes.status === 'fulfilled') {
            const { alreadyReviewed, orderId } = eligRes.value.data
            if (alreadyReviewed) setHasReviewed(true)
            if (orderId) setEligibleOrderId(orderId)
          }
        } catch {}
      }
    } catch (error) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      toast.error('Could not load product')
    } finally {
      setLoading(false)
    }
  }

  const handleEstPinChange = async (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6)
    setEstPin(cleaned)
    setEstError('')
    if (cleaned.length === 6) {
      setEstLoading(true)
      try {
        const res = await api.get(`/api/pincode/${cleaned}`)
        const data = res.data
        if (data[0]?.Status === 'Success' && data[0].PostOffice?.length) {
          const po = data[0].PostOffice[0]
          setEstState(po.State)
        } else {
          setEstError('PIN code not found')
        }
      } catch {
        setEstError('Could not fetch delivery details')
      } finally {
        setEstLoading(false)
      }
    } else {
      setEstState(null)
    }
  }

  const getDeliveryEstimateText = (stateName) => {
    const today = new Date()
    let daysMin = 3
    let daysMax = 5

    if (stateName) {
      const state = stateName.toLowerCase()
      if (['delhi', 'haryana', 'punjab', 'uttar pradesh', 'rajasthan'].some(s => state.includes(s))) {
        daysMin = 2
        daysMax = 3
      } else if (['kerala', 'tamil nadu', 'karnataka', 'assam', 'meghalaya', 'tripura', 'mizoram', 'nagaland', 'manipur', 'arunachal pradesh'].some(s => state.includes(s))) {
        daysMin = 4
        daysMax = 6
      }
    }

    const dateMin = new Date(today.getTime() + daysMin * 24 * 60 * 60 * 1000)
    const dateMax = new Date(today.getTime() + daysMax * 24 * 60 * 60 * 1000)

    const opt = { day: 'numeric', month: 'short', weekday: 'short' }
    return `${dateMin.toLocaleDateString('en-IN', opt)} - ${dateMax.toLocaleDateString('en-IN', opt)}`
  }

  const handleAddToCart = async ({ redirectTo } = {}) => {
    setAdding(true)
    try {
      const success = await addItem(product, quantity)
      if (success) {
        if (redirectTo) {
          navigate(redirectTo)
        } else {
          toast.success('Added to cart!')
        }
      }
    } catch {
      toast.error('Failed to add to cart')
    } finally {
      setAdding(false)
    }
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()  
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return }
    if (reviewRating === 0) { toast.error('Please select a rating'); return }
    if (!reviewComment.trim()) { toast.error('Please write a review'); return }
    if (!eligibleOrderId) { toast.error('You can only review products from delivered orders'); return }
    setSubmittingReview(true)
    try {
      await api.post(`/api/reviews`, {
        productId: id,
        orderId: eligibleOrderId,
        rating: reviewRating,
        title: product.name,
        body: reviewComment
      })
      toast.success('Thank you for your review!')
      setReviewComment('')
      setReviewRating(0)
      setHasReviewed(true)
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleWishlist = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } })
      return
    }
    try {
      const added = await toggleWishlist(product._id)
      toast.success(added ? 'Added to wishlist' : 'Removed from wishlist')
    } catch {
      toast.error('Failed to update wishlist')
    }
  }

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--ivory)]">
      <div className="w-12 h-12 border-4 border-brand-secondary/20 border-t-brand-secondary rounded-full animate-spin mb-4" />
      <p className="text-sm text-brand-text/40 font-medium">Loading product...</p>
    </div>
  )

  // ── Not found ──
  if (!product) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ivory)] p-6">
      <div className="text-center">
        <Package size={48} className="text-brand-primary/20 mx-auto mb-4" />
        <h2 className="text-2xl font-display font-bold text-brand-primary mb-2">Product Not Found</h2>
        <p className="text-brand-text/40 mb-6 text-sm">This product may have been removed from our store.</p>
        <Link to="/products" className="btn btn-primary px-8 h-12 rounded-full inline-flex items-center justify-center">
          Back to Products
        </Link>
      </div>
    </div>
  )

  const defaultAddr = addresses.find(a => a.isDefault) || addresses[0]
  const isCustomer = !user || (user.role !== 'admin' && user.role !== 'superadmin')
  const avgRating   = product.rating || 0
  const numReviews  = product.numReviews || 0

  // Rating distribution
  const dist = [5,4,3,2,1].map(n => ({
    star: n,
    count: reviews.filter(r => Math.round(r.rating) === n).length
  }))

  return (
    <div className="min-h-screen bg-[var(--ivory)] pb-20">
      {product && (
        <Helmet>
          <title>{product.name} – Daatasa | Premium Bilona Ghee</title>
          <meta name="description" content={`${product.description?.slice(0, 155)}... Buy ${product.name} online from Daatasa. FSSAI certified, lab tested, pan India delivery.`} />
          <meta property="og:title" content={`${product.name} – Daatasa`} />
          <meta property="og:description" content={product.description?.slice(0, 200)} />
          <meta property="og:image" content={product.image} />
          <meta property="og:type" content="product" />
          <meta property="og:url" content={`https://daatasa.in/products/${product._id}`} />
          <link rel="canonical" href={`https://daatasa.in/products/${product._id}`} />
          <script type="application/ld+json">{JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            image: product.image,
            description: product.description,
            brand: { '@type': 'Brand', name: 'Daatasa' },
            offers: {
              '@type': 'Offer',
              priceCurrency: 'INR',
              price: product.price,
              availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              url: `https://daatasa.in/products/${product._id}`,
            },
            ...(product.rating && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.rating.toFixed(1),
                reviewCount: product.numReviews || 0,
              },
            }),
          })}</script>
        </Helmet>
      )}


      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Main product grid ── */}
        <div className="grid lg:grid-cols-2 gap-10 items-start">

          {/* ── Left: Product image ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="min-w-0"
          >
            <div className="relative bg-white rounded-[2rem] border border-brand-primary/10 shadow-sm overflow-hidden aspect-square flex items-center justify-center p-10 group mb-6">
              {product.featured && (
                <span className="absolute top-5 left-5 px-4 py-1.5 text-white text-[10px] font-bold uppercase tracking-widest rounded-full bg-brand-primary shadow-sm">
                  ✦ Top Pick
                </span>
              )}
              {product.stock === 0 && (
                <span className="absolute top-4 right-4 px-3 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded-full border border-red-200">
                  Out of Stock
                </span>
              )}
              <img
                src={cloudinaryTransform(selectedImage || product.image, { width: 800, quality: 'auto', format: 'auto' })}
                alt={product.name}
                loading="eager"
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            {/* Thumbnail Gallery */}
            {(() => {
              const gallery = [
                { url: product.image, label: 'Main' },
                { url: product.imageLeft, label: 'Left' },
                { url: product.imageRight, label: 'Right' },
                { url: product.imageTop, label: 'Top' },
                { url: product.imagePackage, label: 'Package' }
              ].filter(img => img.url);

              if (gallery.length > 1) {
                return (
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {gallery.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImage(img.url)}
                        className={`relative w-20 h-20 shrink-0 rounded-[1rem] overflow-hidden border-2 transition-all ${
                          selectedImage === img.url ? 'border-brand-secondary scale-105 shadow-md' : 'border-brand-primary/10 hover:border-brand-secondary/50'
                        }`}
                        title={img.label}
                      >
                        <img
                          src={cloudinaryTransform(img.url, { width: 150, quality: 'auto', format: 'auto' })}
                          alt={`${product.name} - ${img.label}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                );
              }
              return null;
            })()}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mt-4">
              {[
                { icon: Truck,     title: 'Pan India', sub: 'Shipping' },
                { icon: Shield,    title: 'Lab Tested', sub: 'Pure Quality' },
                { icon: RefreshCw, title: 'Bilona',    sub: 'Traditional' },
              ].map((b, i) => (
                <div key={i} className="bg-white border border-brand-primary/10 rounded-2xl sm:rounded-[1.5rem] p-2 sm:p-4 text-center shadow-sm flex flex-col items-center justify-center">
                  <b.icon size={20} className="text-brand-secondary mb-1.5 sm:mb-2 w-4 h-4 sm:w-5 sm:h-5" />
                  <p className="text-[9px] sm:text-xs font-bold text-brand-primary uppercase tracking-wide sm:tracking-wider leading-tight">{b.title}</p>
                  <p className="text-[8px] sm:text-[10px] text-brand-text/40 mt-0.5">{b.sub}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Right: Product info + purchase ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-5 min-w-0"
          >
            {/* Category badge */}
            <div className="flex items-center gap-2 mb-2">
              <Tag size={13} className="text-brand-secondary" />
              <span className="text-xs font-bold text-brand-secondary uppercase tracking-widest">
                {product.category} Ghee
              </span>
            </div>

            {/* Name and Wishlist */}
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl sm:text-5xl font-extrabold text-brand-primary leading-tight font-display">
                {product.name}
              </h1>
              {isCustomer && (
                <button
                  onClick={handleWishlist}
                  className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full bg-white border border-brand-primary/10 shadow-sm text-brand-primary/40 hover:text-red-500 transition-all hover:scale-110"
                >
                  <Heart size={20} className={user?.wishlist?.some(id => String(id?._id || id) === String(product._id)) ? 'fill-red-500 text-red-500' : ''} />
                </button>
              )}
            </div>

            {/* Rating row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Stars rating={avgRating} size={15} />
                <span className="text-sm font-bold text-brand-primary">{avgRating.toFixed(1)}</span>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className="text-sm text-brand-secondary hover:underline"
                >
                  ({numReviews} reviews)
                </button>
              </div>
              <span className="text-gray-200">|</span>
              {/* Show availability status — hide exact stock count from customers */}
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
                <span className={`text-sm font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {product.stock > 0 ? 'In Stock' : 'Currently Not Available'}
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              {product.mrp && product.mrp > product.price ? (
                <div className="flex items-center gap-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm line-through text-gray-400" style={{ fontFamily: 'var(--font-body)' }}>
                    ₹{product.mrp.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-bold text-green-600">
                    You Save ₹{(product.mrp - product.price).toLocaleString('en-IN')}
                  </span>
                </div>
              ) : (
                <span className="text-3xl sm:text-4xl font-extrabold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
              )}
              <span className="text-sm text-gray-400">/ {product.weight || 'unit'}</span>
            </div>

            <hr className="border-brand-primary/10" />

            {/* Deliver to */}
            {user && (
              <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 bg-[var(--ivory)] border border-brand-primary/10 rounded-[1.5rem]">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-brand-primary/5 text-brand-primary mt-0.5">
                  <MapPin size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary/60 mb-1">Deliver to</p>
                  {defaultAddr ? (
                    <p className="text-sm text-brand-text truncate font-medium">
                      <span className="font-bold">{defaultAddr.name}</span>
                      {' — '}{defaultAddr.city}, {defaultAddr.state} – {defaultAddr.zipCode}
                    </p>
                  ) : (
                    <Link to="/profile" className="text-sm text-brand-secondary hover:underline font-bold">
                      + Add a delivery address
                    </Link>
                  )}
                </div>
                {defaultAddr && (
                  <Link to="/profile" className="text-xs text-brand-secondary hover:text-brand-primary font-bold shrink-0">
                    Change
                  </Link>
                )}
              </div>
            )}

            {/* ── Delivery Estimation (PIN check) ── */}
            <div className="border border-brand-primary/10 rounded-[1.5rem] p-4 sm:p-6 bg-white space-y-4 shadow-sm">
              <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest flex items-center gap-2">
                <Truck size={14} className="text-brand-secondary" /> Check Delivery
              </p>
              <div className="flex gap-2 sm:gap-3">
                <div className="relative flex-1">
                  <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/40 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={estPin}
                    onChange={e => handleEstPinChange(e.target.value)}
                    placeholder="Enter 6-digit PIN"
                    className="w-full pl-11 pr-4 h-12 border border-brand-primary/20 rounded-[1rem] text-sm font-medium outline-none focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary transition-all bg-white placeholder:text-brand-text/30"
                  />
                </div>
                {estLoading && (
                  <div className="flex items-center px-4">
                    <div className="w-5 h-5 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {estError && (
                <p className="text-xs text-red-500 flex items-center gap-1.5 font-medium">
                  <AlertCircle size={14} /> {estError}
                </p>
              )}
              {estState && !estError && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-[1rem] p-4">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold flex items-center gap-1.5 mb-1">
                    <CheckCircle size={14} /> Delivery available to {estState}
                  </p>
                  <p className="text-sm font-bold text-brand-primary">
                    Est. Delivery: {getDeliveryEstimateText(estState)}
                  </p>
                  <p className="text-xs text-emerald-600/70 mt-1 font-medium">Free shipping on orders above ₹500</p>
                </div>
              )}
              {!estPin && (
                <p className="text-xs text-brand-text/50 font-medium">We deliver across India • Usually 2-6 business days</p>
              )}
            </div>

            {/* Purchase controls — only for logged-in regular customers */}
            {product.stock > 0 && isCustomer && (() => {
              // Dynamic max: capped at 10, but never exceeds actual stock
              const maxQty = Math.min(product.stock, 10)
              return (
              <div className="bg-white border border-brand-primary/10 rounded-[2rem] p-4 sm:p-6 space-y-5 shadow-sm">

                  {/* Quantity selector */}
                  <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 xs:gap-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Quantity</p>
                      <p className="text-xs text-gray-400">Max {maxQty} per order</p>
                    </div>
                    <div className="flex items-center gap-1 border border-brand-primary/10 rounded-full p-1 bg-white">
                      <button
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-brand-primary/5 hover:bg-brand-primary hover:text-white transition-colors text-brand-primary"
                      >
                        <Minus size={14} className="sm:w-[15px] sm:h-[15px]" />
                      </button>
                      <span className="w-8 sm:w-12 text-center text-base sm:text-lg font-bold text-brand-primary font-display">{quantity}</span>
                      <button
                        onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                        className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-brand-primary/5 hover:bg-brand-primary hover:text-white transition-colors text-brand-primary"
                      >
                        <Plus size={14} className="sm:w-[15px] sm:h-[15px]" />
                      </button>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Total for {quantity} {quantity === 1 ? 'item' : 'items'}</span>
                    <span className="font-bold text-gray-900">₹{(product.price * quantity).toLocaleString('en-IN')}</span>
                  </div>

                  {/* Add to cart button */}
                  <button
                    onClick={() => handleAddToCart()}
                    disabled={adding}
                    className="w-full h-14 btn btn-primary rounded-full transition-all disabled:opacity-50 flex items-center justify-center gap-2.5 text-sm"
                  >
                    {adding
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <ShoppingCart size={17} />
                    }
                    {adding ? 'Adding to Cart...' : `Add to Cart — ₹${(product.price * quantity).toLocaleString('en-IN')}`}
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleAddToCart({ redirectTo: '/checkout' })}
                      disabled={adding}
                      className="w-full h-14 btn btn-accent rounded-full transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-gold"
                    >
                      Buy Now
                    </button>

                    <a
                      href={`https://wa.me/7665306403?text=${encodeURIComponent(
                        `Hello Daatasa! I want to place an order.\n\n` +
                        `*Product Details:*\n` +
                        `*Item:* ${product.name}\n` +
                        `*Quantity:* ${quantity}\n` +
                        (product.size || product.weight ? `*Size/Weight:* ${product.size || product.weight}\n` : '') +
                        `*Total Price:* ₹${(product.price * quantity).toLocaleString('en-IN')}\n` +
                        `*Image:* ${product.image?.startsWith('http') ? product.image : product.image}\n\n` +
                        `Please help me process this order!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-14 rounded-full transition-all flex items-center justify-center gap-2 text-sm font-bold text-white shadow-md hover:scale-[1.02]"
                      style={{ background: '#25D366' }}
                    >
                      WhatsApp Order
                    </a>
                  </div>

                  {/* ── Subscriptions ── */}
                  {plans.length > 0 && (
                    <div className="pt-5 border-t border-brand-primary/10 mt-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-4 flex items-center gap-2">
                        <RefreshCw size={14} className="text-brand-secondary" /> Subscribe & Save
                      </p>
                      <div className="space-y-3">
                        {plans.map(plan => (
                          <button
                            key={plan._id}
                            onClick={() => navigate('/checkout-subscription', { state: { planId: plan._id } })}
                            className="w-full text-left p-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-between group"
                          >
                            <div>
                              <p className="text-sm font-bold text-amber-900">{plan.name}</p>
                              <p className="text-xs font-medium text-amber-700 capitalize mt-0.5">Delivered every {plan.interval} {plan.period}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-amber-900">₹{plan.price.toLocaleString('en-IN')}</p>
                              <span className="text-[10px] bg-amber-200 text-amber-900 px-3 py-1 rounded-full font-bold opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest mt-1 inline-block">Select</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-center text-xs text-gray-400 pt-1">
                    <CheckCircle size={11} className="inline mr-1 text-green-500" />
                    Secure checkout · Free shipping above ₹500 · 100% pure ghee
                  </p>
                </div>
              )
            })()}

            {/* Out of stock — Currently Not Available */}
            {product.stock === 0 && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-center">
                <AlertCircle size={28} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-red-600 mb-1">Currently Not Available</p>
                <p className="text-xs text-red-400">This product is temporarily out of stock. Please check back later.</p>
              </div>
            )}

          </motion.div>
        </div>

        {/* ── Tabs: Description + Reviews ── */}
        <div className="mt-16">
          <div className="relative flex border-b border-brand-primary/10 mb-8">
            {[
              { key: 'description', label: 'Description' },
              { key: 'reviews',     label: `Reviews (${numReviews})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm font-bold transition-colors duration-200 uppercase tracking-wide sm:tracking-widest ${
                  activeTab === tab.key
                    ? 'text-brand-primary'
                    : 'text-brand-text/40 hover:text-brand-primary/70'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Description tab ── */}
            {activeTab === 'description' && (
              <motion.div
                key="desc"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid sm:grid-cols-2 gap-6"
              >
                <div className="bg-white rounded-[2rem] border border-brand-primary/5 shadow-sm p-8">
                  <h3 className="font-bold font-display text-brand-primary text-xl mb-4">About this product</h3>
                  <p className="text-sm text-brand-text/70 leading-relaxed font-light">{product.description}</p>
                </div>
                <div className="bg-white rounded-[2rem] border border-brand-primary/5 shadow-sm p-8 space-y-4">
                  <h3 className="font-bold font-display text-brand-primary text-xl mb-4">Product Details</h3>
                  {[
                    { label: 'Weight / Size', value: product.weight },
                    { label: 'Category',      value: product.category },
                    { label: 'Availability',  value: product.stock > 0 ? 'In Stock' : 'Out of Stock' },
                  ].map((d, i) => (
                    <div key={i} className="flex justify-between items-center py-3 border-b border-brand-primary/5 last:border-0">
                      <span className="text-sm text-brand-text/60">{d.label}</span>
                      <span className="text-sm font-bold text-brand-primary">{d.value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Reviews tab ── */}
            {activeTab === 'reviews' && (
              <motion.div
                key="reviews"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Rating summary */}
                {numReviews > 0 && (
                  <div className="bg-white rounded-[2rem] border border-brand-primary/5 shadow-sm p-8 flex flex-col sm:flex-row gap-8 items-center">
                    <div className="text-center shrink-0">
                      <p className="text-6xl font-display font-bold text-brand-primary mb-2">{avgRating.toFixed(1)}</p>
                      <Stars rating={avgRating} size={20} />
                      <p className="text-sm text-brand-text/40 mt-2">{numReviews} reviews</p>
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      {dist.map(({ star, count }) => (
                        <div key={star} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-4 shrink-0">{star}</span>
                          <Star size={11} className="text-orange-400 fill-orange-400 shrink-0" />
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full transition-all"
                              style={{ width: numReviews ? `${(count / numReviews) * 100}%` : '0%' }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-4 shrink-0">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Write a review */}
                {user && !hasReviewed && isCustomer && (
                  <div className="bg-white rounded-[2rem] border border-brand-primary/5 shadow-sm p-8">
                    <h3 className="font-bold font-display text-brand-primary mb-6 text-xl flex items-center gap-3">
                      <Star size={20} className="text-brand-secondary fill-brand-secondary" /> Write a Review
                    </h3>
                    <div className="mb-8 p-5 bg-brand-primary/5 border border-brand-primary/10 rounded-[1.5rem] text-sm text-brand-primary font-medium leading-relaxed">
                      Only customers who have <strong>received this product</strong> can submit a review.
                      You can also rate from your{' '}
                      <Link to="/orders" className="font-bold underline text-brand-secondary hover:text-brand-primary transition-colors">Orders page</Link>.
                    </div>
                    <form onSubmit={handleSubmitReview} className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-text/60 mb-3">Your Rating</label>
                        <StarPicker value={reviewRating} onChange={setReviewRating} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-text/60 mb-2">Your Review</label>
                        <textarea
                          required
                          maxLength={2000}
                          rows={4}
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          placeholder="Share your experience with this product..."
                          className="w-full px-5 py-4 rounded-[1.5rem] border border-brand-primary/20 text-sm font-medium outline-none focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary transition-all resize-none bg-white placeholder:text-brand-text/30"
                        />
                        <div className={`mt-2 text-right text-[10px] font-bold uppercase tracking-widest ${reviewComment.length >= 2000 ? 'text-red-500' : 'text-brand-text/40'}`}>
                          {reviewComment.length}/2000
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-10 h-14 btn btn-primary rounded-full transition-all disabled:opacity-50 text-sm font-bold"
                      >
                        {submittingReview
                          ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Send size={16} />
                        }
                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                    </form>
                  </div>
                )}

                {hasReviewed && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
                    <CheckCircle size={15} /> You have already reviewed this product. Thank you!
                  </div>
                )}

                {!user && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-700 font-medium">
                    <Link to="/login" className="font-bold underline text-amber-600 hover:text-amber-750">Sign in</Link> to leave a review.
                  </div>
                )}

                {/* Review list */}
                {reviews.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-[2rem] border border-brand-primary/5 shadow-sm">
                    <Star size={48} className="text-brand-primary/10 mx-auto mb-4" />
                    <p className="text-base text-brand-text/40">No reviews yet. Be the first to review!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[...reviews].reverse().map((r, i) => (
                      <div key={i} className="bg-white rounded-[2rem] border border-brand-primary/5 shadow-sm p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-primary/5 rounded-full flex items-center justify-center text-sm font-bold text-brand-primary">
                              {r.user?.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-base font-bold text-brand-primary">{r.user?.name}</p>
                                {r.verified && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                    <BadgeCheck size={12} /> Verified
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-brand-text/40 mt-0.5">
                                {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <Stars rating={r.rating} size={15} />
                        </div>
                        <p className="text-sm text-brand-text/70 leading-relaxed font-light">{r.body || r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Related products ── */}
        {related.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>You Might Also Like</h2>
              <Link to={`/products?category=${product.category}`} className="text-sm font-bold text-[var(--gold)] hover:brightness-110 transition-all">View All →</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              {related.map((p, idx) => (
                <motion.div
                  key={p._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07 }}
                >
                  <Link
                    to={`/products/${p._id}`}
                    className="group block bg-white rounded-[2rem] border border-brand-primary/5 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-2 transition-all duration-300 will-change-transform"
                  >
                    <div className="aspect-square bg-[var(--ivory)] overflow-hidden">
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-3 sm:p-5">
                      <p className="text-sm sm:text-base font-bold font-display text-brand-primary truncate mb-1 group-hover:text-brand-secondary transition-colors">{p.name}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0">
                        <p className="text-base sm:text-lg font-bold text-brand-primary">₹{p.price.toLocaleString('en-IN')}</p>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={10} className={`sm:w-[11px] sm:h-[11px] ${i <= Math.round(p.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Sticky Mobile Add to Cart Bar ── */}
      {product && product.stock > 0 && isCustomer && (
        <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100 shadow-[0_-8px_30px_rgba(27,47,110,0.08)] px-4 py-3 safe-area-inset-bottom">
          <div className="flex items-center justify-between gap-1.5 xs:gap-3 max-w-lg mx-auto">
            <div className="hidden xs:block flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">{product.name}</p>
              <p className="text-sm sm:text-base font-extrabold text-slate-900 leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                ₹{(product.price * quantity).toLocaleString('en-IN')}
              </p>
            </div>
            {/* Show only price on extra small screens */}
            <div className="xs:hidden font-extrabold text-slate-900 leading-none shrink-0" style={{ fontFamily: 'var(--font-display)' }}>
              ₹{(product.price * quantity).toLocaleString('en-IN')}
            </div>
            
            <div className="flex items-center gap-0.5 sm:gap-1 border border-slate-200 rounded-xl p-0.5 sm:p-1 shrink-0 bg-white">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700"
              >
                <Minus size={13} />
              </button>
              <span className="w-5 sm:w-8 text-center text-xs sm:text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{quantity}</span>
              <button
                onClick={() => setQuantity(q => Math.min(Math.min(product.stock, 10), q + 1))}
                aria-label="Increase quantity"
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700"
              >
                <Plus size={13} />
              </button>
            </div>
            <button
              onClick={() => handleAddToCart()}
              disabled={adding}
              className="px-3 py-2 sm:px-5 sm:py-3 text-white font-bold rounded-xl text-xs sm:text-sm transition-all disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 shrink-0 active:scale-[0.98]"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'var(--brand-gradient)',
                boxShadow: 'var(--shadow-brand)'
              }}
            >
              {adding
                ? <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <ShoppingCart size={14} className="sm:w-4 sm:h-4" />
              }
              <span>Add <span className="hidden xs:inline">to Cart</span></span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductDetail