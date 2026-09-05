import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import {
  FiTrash2, FiMinus, FiPlus, FiShoppingCart, FiArrowRight,
  FiShield, FiTruck, FiTag, FiChevronRight
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart, getCartItemDetails } from '../context/CartContext'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'

const MAX_CART_QTY = 10

const Cart = () => {
  const { t } = useTranslation()
  const { user }           = useAuth()
  const navigate           = useNavigate()
  const { items: cartItems, loading: cartLoading, removeItem: removeContextItem, updateQty: updateContextQty, clearCart: clearContextCart, fetchCart } = useCart()
  const [updatingId,     setUpdatingId]     = useState(null)
  const [preview,        setPreview]        = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [couponCode,     setCouponCode]     = useState('')
  const [appliedCoupon,  setAppliedCoupon]  = useState(null)
  const [couponLoading,  setCouponLoading]  = useState(false)

  // Fetch fresh cart from DB every time this page opens
  useEffect(() => {
    if (user) fetchCart()
  }, [user?.id, user?._id, fetchCart])

  useEffect(() => {
    if (cartItems && cartItems.length > 0) {
      fetchPreview()
    } else {
      setPreview(null)
    }
  }, [user, cartItems])

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    try {
      const res = await api.post('/api/orders/verify-coupon', { couponCode: couponCode.trim() })
      const coupon = res.data.coupon
      const bd = res.data.breakdown
      setAppliedCoupon(coupon)
      setPreview(prev => ({
        ...prev,
        discount: coupon.discountAmount,
        taxPrice: bd.taxPrice,
        shippingPrice: bd.shippingPrice,
        totalPrice: bd.totalPrice
      }))
      toast.success('Coupon applied!')
    } catch {
      setAppliedCoupon(null)
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    fetchPreview()
    toast.info('Coupon removed')
  }

  const fetchPreview = async () => {
    setPreviewLoading(true)
    try {
      const res = await api.post('/api/orders/price-preview')
      setPreview(res.data)
    } catch (e) { console.error('Price preview error:', e) }
    finally { setPreviewLoading(false) }
  }

  const updateQty = async (itemId, newQty, stock, isB2BUser, b2bMinQty, b2bSetQty) => {
    if (isB2BUser && b2bMinQty > 0) {
      if (newQty < b2bMinQty) return;
    } else {
      if (newQty < 1) return;
    }
    const maxAllowed = isB2BUser ? (stock || 0) : Math.min(stock || 0, MAX_CART_QTY)
    if (newQty > maxAllowed) { toast.error(`Max ${maxAllowed} of this item allowed`); return }
    setUpdatingId(itemId)
    try {
      await updateContextQty(itemId, newQty)
      fetchPreview()
    } catch (err) { toast.error('Failed to update quantity') }
    finally { setUpdatingId(null) }
  }

  const removeItem = async (itemId) => {
    try {
      await removeContextItem(itemId)
      toast.success('Item removed from cart')
      fetchPreview()
    } catch { toast.error('Failed to remove item') }
  }

  const handleClearCart = async () => {
    if (!window.confirm('Remove all items from cart?')) return
    try {
      await clearContextCart()
      toast.success('Cart cleared')
      setPreview(null)
    } catch { toast.error('Failed to clear cart') }
  }

  // Show spinner while CartContext is fetching from DB (on login / page reload)
  if (cartLoading) return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[var(--ivory)]">
      <div className="w-12 h-12 border-4 rounded-full animate-spin border-brand-secondary border-t-transparent" />
    </div>
  )

  const hasItems = cartItems?.length > 0
  const subtotal = cartItems?.reduce((acc, item) => {
    const { price } = getCartItemDetails(item)
    return acc + price * (item.quantity || 1)
  }, 0) || 0

  return (
    <div className="min-h-screen pb-24 page-enter bg-[var(--ivory)] font-sans text-brand-text">
      <Helmet>
        <title>Shopping Cart | Daatasa - Pure Vedic Bilona Ghee</title>
        <meta name="description" content="Review your shopping cart items and proceed to secure checkout for pure Vedic Bilona A2 Ghee." />
      </Helmet>

      {/* ── Page Header ── */}
      <div className="relative overflow-hidden bg-white text-brand-primary border-b border-brand-primary/5">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none bg-brand-secondary/10" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, var(--brand-primary) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="max-w-[1280px] mx-auto px-6 py-8 relative z-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="inline-block px-3 py-1 text-[10px] font-bold rounded-full bg-brand-primary/5 text-brand-primary border border-brand-primary/10 mb-2 uppercase tracking-widest">
                {t('cart.heroTag', 'Your Cart')}
              </span>
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-brand-primary">{t('cart.heroTitle', 'Shopping Cart')}</h1>
            </div>
            {hasItems && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-sm font-bold px-4 py-2 rounded-full shadow-sm bg-brand-primary/5 text-brand-primary border border-brand-primary/10">
                  {cartItems.length} {cartItems.length > 1 ? t('cart.itemsCountPlural', 'items') : t('cart.itemsCount', 'item')}
                </span>
                <button
                  onClick={handleClearCart}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full text-red-500 border border-red-200 hover:bg-red-50 active:scale-95 transition-all"
                >
                  <FiTrash2 size={11} /> Clear All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {!hasItems ? (

          /* ── Empty State ── */
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-32 rounded-[2rem] flex flex-col items-center text-center p-10 bg-white border-2 border-dashed border-brand-primary/10"
          >
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-[var(--ivory)] text-brand-primary/40">
              <FiShoppingCart size={32} />
            </div>
            <h2 className="text-3xl font-display font-bold mb-4 text-brand-primary">
              Your cart is empty
            </h2>
            <p className="text-base max-w-sm mb-8 text-brand-text/60 font-light">Add some premium ghee products to your cart and come back here.</p>
            <Link
              to="/products"
              className="btn btn-primary px-8 h-12 rounded-full inline-flex items-center justify-center"
            >
              Browse Products
            </Link>
          </motion.div>

        ) : (
          <div className="grid lg:grid-cols-3 gap-8 items-start">

            {/* ── Cart Items ── */}
            <div className="lg:col-span-2 space-y-4">
              <AnimatePresence>
                {cartItems.map((item, idx) => {
                  const details = getCartItemDetails(item)
                  const stock = details.stock
                  const displayPrice = details.price
                  const displayWeight = details.weight
                  const displayImage = details.image
                  const displayName = details.name
                  const displayCategory = details.category
                  
                  const isB2BUser = user?.role === 'b2b_customer';
                  let b2bMinQty = item.product?.b2bMinQty || 0;
                  let b2bSetQty = item.product?.b2bSetQty || 0;
                  if (details.variant) {
                    if (details.variant.b2bMinQty > 0) b2bMinQty = details.variant.b2bMinQty;
                    if (details.variant.b2bSetQty > 0) b2bSetQty = details.variant.b2bSetQty;
                  }
                  const minAllowed = (isB2BUser && b2bMinQty > 0) ? b2bMinQty : 1;
                  const qtyStep = (isB2BUser && b2bSetQty > 0) ? b2bSetQty : 1;
                  const maxQty      = isB2BUser ? stock : Math.min(stock, MAX_CART_QTY)
                  
                  const isOut       = stock === 0
                  const atMax       = item.quantity >= maxQty

                  return (
                    <motion.div
                      key={item._id || idx}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, scale: 0.96 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 flex items-start sm:items-center gap-3 sm:gap-5 transition-all duration-300 bg-white border ${isOut ? 'border-red-500/30' : 'border-brand-primary/5'} shadow-sm hover:shadow-md ${isOut ? 'opacity-75' : ''}`}
                    >
                      {/* Image */}
                      <Link
                        to={`/products/${item.product?._id || item.product}`}
                        className="w-20 h-20 sm:w-28 sm:h-28 shrink-0 rounded-2xl sm:rounded-[1.5rem] overflow-hidden hover:opacity-90 transition-opacity bg-[var(--ivory)] border border-brand-primary/5"
                      >
                        <img src={displayImage} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
                      </Link>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold font-display text-brand-primary truncate leading-tight">
                              {displayName}
                            </h3>
                            <p className="text-sm mt-1 capitalize flex items-center gap-2 font-medium text-brand-text/60">
                              {displayCategory && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-brand-primary/5 text-brand-primary">{displayCategory}</span>}
                              {displayWeight && <span>{displayWeight}</span>}
                            </p>
                            {isOut && <p className="text-xs font-bold mt-2 uppercase tracking-wide text-red-500">Currently Unavailable</p>}
                            {!isOut && atMax && <p className="text-xs font-bold mt-2 uppercase tracking-wide text-amber-500">Max {maxQty} per order</p>}
                            {!isOut && isB2BUser && b2bMinQty > 0 && <p className="text-xs font-bold mt-2 text-brand-secondary">B2B Min Qty: {b2bMinQty} (Sets of {qtyStep})</p>}
                          </div>

                          <button
                            onClick={() => removeItem(item._id || item.product?._id || item.product)}
                            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 text-brand-text/30 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors -mt-1 sm:mt-0"
                            title="Remove item"
                          >
                            <FiTrash2 size={15} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-3">
                          {/* Qty Controls */}
                          <div className={`flex items-center p-0.5 sm:p-1 rounded-full border ${isOut ? 'border-red-500/30 bg-red-50' : 'border-brand-primary/10 bg-white'}`}>
                            <button
                              disabled={updatingId === item._id || item.quantity <= minAllowed}
                              onClick={() => updateQty(item._id || item.product?._id || item.product, item.quantity - qtyStep, stock, isB2BUser, b2bMinQty, b2bSetQty)}
                              className="w-8 h-8 flex items-center justify-center transition-colors disabled:opacity-40 rounded-full text-brand-primary hover:bg-brand-primary/5"
                            >
                              <FiMinus size={14} />
                            </button>
                            <span className="w-10 text-center text-sm font-bold font-display text-brand-primary">
                              {updatingId === item._id ? <span className="text-brand-text/30">·</span> : item.quantity}
                            </span>
                            <button
                              disabled={updatingId === item._id || atMax || isOut}
                              onClick={() => updateQty(item._id || item.product?._id || item.product, item.quantity + qtyStep, stock, isB2BUser, b2bMinQty, b2bSetQty)}
                              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center transition-colors disabled:opacity-40 rounded-full text-brand-primary hover:bg-brand-primary/5"
                            >
                              <FiPlus size={13} className="sm:w-3.5 sm:h-3.5" />
                            </button>
                          </div>

                          {/* Price */}
                          <div className="text-right flex flex-col items-end">
                            <div className={`text-base sm:text-xl font-bold font-display leading-none ${isOut ? 'text-brand-text/40 line-through' : 'text-brand-primary'}`}>
                              ₹{(displayPrice * item.quantity).toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] sm:text-xs font-medium mt-0.5 text-brand-text/50">₹{displayPrice?.toLocaleString('en-IN')} each</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              <Link
                to="/products"
                className="inline-flex items-center gap-2 text-sm font-bold px-2 py-1 mt-4 transition-all duration-200 text-brand-secondary hover:text-brand-primary"
              >
                <FiArrowRight size={14} className="rotate-180" /> Continue Shopping
              </Link>
            </div>

            {/* ── Order Summary ── */}
            <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-28">
              <div className="rounded-[2rem] border border-brand-primary/10 shadow-sm bg-white overflow-hidden">
                <div className="px-8 py-6 border-b border-brand-primary/5">
                  <h2 className="text-xl font-bold font-display text-brand-primary">Order Summary</h2>
                </div>

                <div className="p-8">
                  {/* Shipping Progress Bar */}
                  {preview && preview.freeShippingThreshold > 0 && (
                    <div className="mb-6 p-5 rounded-2xl border border-brand-primary/10 bg-[var(--ivory)]">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-3">
                        <span className={`uppercase tracking-wider ${subtotal >= preview.freeShippingThreshold ? 'text-green-600' : 'text-brand-text/60'}`}>
                          {subtotal >= preview.freeShippingThreshold ? '🎉 Free Shipping Unlocked!' : 'Shipping Progress'}
                        </span>
                        <span className="font-bold text-brand-text/60">
                          ₹{subtotal.toLocaleString('en-IN')} / ₹{Number(preview.freeShippingThreshold).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden mb-3 bg-brand-primary/10">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${subtotal >= preview.freeShippingThreshold ? 'animate-pulse bg-green-500' : 'bg-brand-primary'}`}
                          style={{ width: `${Math.min((subtotal / preview.freeShippingThreshold) * 100, 100)}%` }}
                        />
                      </div>
                      {subtotal < preview.freeShippingThreshold ? (
                        <p className="text-[11px] font-medium text-brand-text/60">
                          Add <span className="font-bold text-brand-secondary">₹{(preview.freeShippingThreshold - subtotal).toLocaleString('en-IN')}</span> more for free delivery
                        </p>
                      ) : (
                        <p className="text-[11px] font-bold text-green-600">
                          Your order qualifies for free shipping!
                        </p>
                      )}
                    </div>
                  )}

                  {previewLoading ? (
                    <div className="space-y-3 mb-5">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex justify-between">
                          <div className="h-4 w-20 skeleton rounded" />
                          <div className="h-4 w-16 skeleton rounded" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-brand-text/60">MRP (incl. of all taxes)</span>
                        <span className="font-bold text-brand-primary">₹{(preview?.itemsPrice && preview.itemsPrice > 0 ? preview.itemsPrice : subtotal).toLocaleString('en-IN')}</span>
                      </div>
                      {preview?.discount > 0 && (
                        <div className="flex justify-between text-sm font-bold text-green-600">
                          <span>Discount on MRP</span>
                          <span>-₹{Math.round(preview.discount).toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-brand-text/60">Shipping</span>
                        <span className={`font-bold ${(preview?.shippingPrice ?? (subtotal > 500 ? 0 : 50)) === 0 ? 'text-green-600' : 'text-brand-primary'}`}>
                          {(preview?.shippingPrice ?? (subtotal > 500 ? 0 : 50)) === 0
                            ? <span className="flex items-center gap-1 font-bold"><FiTruck size={14} /> FREE</span>
                            : `₹${preview?.shippingPrice ?? (subtotal > 500 ? 0 : 50)}`
                          }
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Coupon Input */}
                  <div className="pt-5 border-t border-brand-primary/10 mb-5">
                    <label className="block text-[10px] font-bold uppercase mb-3 tracking-widest text-brand-text/60">Have a Coupon?</label>
                    <div className="flex gap-2 items-stretch h-12">
                      <div className="relative flex-1 h-full">
                        <FiTag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-text/40" />
                        <input
                          type="text"
                          placeholder="ENTER CODE"
                          value={couponCode}
                          disabled={!!appliedCoupon || couponLoading}
                          onChange={e => setCouponCode(e.target.value.toUpperCase())}
                          className={`w-full pl-11 pr-4 h-full text-xs font-bold uppercase rounded-full outline-none border transition-colors ${
                            appliedCoupon ? 'bg-brand-primary/5 border-brand-primary/10 text-brand-primary' : 'bg-white border-brand-primary/20 text-brand-primary focus:border-brand-secondary'
                          }`}
                        />
                      </div>
                      {appliedCoupon ? (
                        <button
                          onClick={removeCoupon}
                          className="px-5 rounded-full bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100 transition-colors"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={applyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="px-6 rounded-full btn btn-primary text-xs"
                        >
                          {couponLoading ? '...' : 'Apply'}
                        </button>
                      )}
                    </div>
                    {appliedCoupon && (
                      <p className="text-[11px] font-bold mt-3 flex items-center gap-1.5 text-green-600">
                        ✓ Coupon '{appliedCoupon.code}' applied (Saved ₹{Number(appliedCoupon.discountAmount).toLocaleString('en-IN')})
                      </p>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center py-5 border-t border-brand-primary/10">
                    <span className="font-extrabold text-lg text-brand-primary">Total Amount</span>
                    <span className="text-3xl font-extrabold font-display text-brand-primary">
                      {previewLoading
                        ? <span className="inline-block w-24 h-8 bg-brand-primary/5 rounded-full animate-pulse" />
                        : `₹${Math.round(Number(preview?.totalPrice && preview.totalPrice > 50 ? preview.totalPrice : (subtotal + (subtotal > 500 ? 0 : 50)))).toLocaleString('en-IN')}`
                      }
                    </span>
                  </div>

                  {preview?.discount > 0 && (
                    <div className="bg-[#e6fcf5] text-[#0ca678] text-sm font-bold text-center p-3 rounded-xl mb-6">
                      You will save ₹{Math.round(preview.discount).toLocaleString('en-IN')} on this order
                    </div>
                  )}

                  <button
                    onClick={() => navigate('/checkout', { state: { couponCode: appliedCoupon?.code } })}
                    className="btn btn-primary w-full h-14 rounded-full flex items-center justify-center gap-2 text-base"
                  >
                    <span>Proceed to Checkout</span> <FiArrowRight size={18} />
                  </button>

                  {/* Trust Strip */}
                  <div className="mt-8 pt-5 border-t border-brand-primary/10">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider rounded-xl px-3 py-2.5 bg-brand-primary/5 text-brand-primary/70">
                        <span className="text-sm">🔒</span> Secure Pay
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider rounded-xl px-3 py-2.5 bg-brand-primary/5 text-brand-primary/70">
                        <span className="text-sm">🔬</span> Lab Tested
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider rounded-xl px-3 py-2.5 bg-brand-primary/5 text-brand-primary/70">
                        <span className="text-sm">🚚</span> Fast Ship
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider rounded-xl px-3 py-2.5 bg-brand-primary/5 text-brand-primary/70">
                        <span className="text-sm">↩️</span> Easy Return
                      </div>
                    </div>
                    <p className="text-center text-[10px] font-bold uppercase tracking-widest mt-5 text-brand-text/40">
                      100% Pure · FSSAI Certified · Pan India Delivery
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Cart
