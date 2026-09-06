import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { toast } from 'react-toastify'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPackage, FiPrinter, FiChevronDown, FiMapPin, FiCalendar,
  FiCreditCard, FiCheckCircle, FiCheck, FiTruck, FiClock, FiShoppingBag,
  FiX, FiAlertCircle, FiRefreshCw, FiArrowRight, FiStar, FiHelpCircle, FiRotateCcw
} from 'react-icons/fi'
import api from '../api/axios'
import { useCart } from '../context/CartContext'
import OrderTimeline from '../components/OrderTimeline'
import { useSocket } from '../hooks/useSocket'
import { useSupportStore } from '../store/support'
import { formatOrderId } from '../utils/formatOrderId'

const getStatus = (order) => {
  if (order.orderStatus === 'CANCELLED' || order.paymentStatus === 'CANCELLED') {
    return { label: 'Cancelled', cls: 'badge-muted', icon: FiX }
  }
  if (order.orderStatus === 'RETURNED' || (order.returnRequest?.requestedAt && ['RETURN_APPROVED', 'APPROVED'].includes(order.returnRequest?.status))) {
    return { label: 'Returned', cls: 'badge-muted', icon: FiRotateCcw }
  }
  if (order.paymentStatus === 'FAILED') {
    return { label: 'Failed', cls: 'badge-danger', icon: FiAlertCircle }
  }
  if (order.paymentStatus === 'EXPIRED') {
    return { label: 'Expired', cls: 'badge-muted', icon: FiClock }
  }
  if (order.orderStatus === 'DELIVERED' || order.isDelivered) {
    return { label: 'Delivered', cls: 'badge-success', icon: FiCheckCircle }
  }
  if (order.orderStatus === 'OUT_FOR_DELIVERY') {
    return { label: 'Out for Delivery', cls: 'badge-info', icon: FiTruck }
  }
  if (['SHIPPED', 'ASSIGNED_TO_COURIER', 'PICKED_UP'].includes(order.orderStatus) || !!order.trackingNumber) {
    return { label: 'In Transit', cls: 'badge-info', icon: FiTruck }
  }
  if (order.orderStatus === 'ACCEPTED' || order.acceptedAt) {
    return { label: 'Confirmed', cls: 'badge-info', icon: FiCheck }
  }
  return { label: 'Pending Acceptance', cls: 'badge-warning', icon: FiClock }
}

const StatusBadge = ({ order }) => {
  const s = getStatus(order)
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

// ── Star picker (interactive) ────────────────────────────────────────────────
const StarPicker = ({ value, onChange }) => (
  <div className="flex gap-1.5">
    {[1,2,3,4,5].map(n => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        className="transition-transform hover:scale-110 focus:outline-none"
      >
        <FiStar
          size={28}
          style={{
            color: n <= value ? 'var(--gold)' : '#E2E8F0',
            fill: n <= value ? 'var(--gold)' : 'none',
            transition: 'all 0.15s ease'
          }}
        />
      </button>
    ))}
  </div>
)

// ── Review Modal ──────────────────────────────────────────────────────────────
const ReviewModal = ({ item, onClose, onSubmitted }) => {
  const [rating,      setRating]      = useState(0)
  const [comment,     setComment]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (rating === 0)        { toast.error('Please select a star rating'); return }
    if (!comment.trim())     { toast.error('Please write your review'); return }
    setSubmitting(true)
    try {
      await api.post(`/api/products/${item.productId}/reviews`, { rating, comment })
      toast.success('🎉 Review submitted! Thank you.')
      onSubmitted(item.productId)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

  return (
    <div className="modal-overlay">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 40 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.96, opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="modal-box sm:rounded-3xl rounded-t-3xl w-full sm:max-w-md overflow-hidden bg-white border border-slate-100 shadow-[0_20px_50px_rgba(27,47,110,0.18)]"
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 sm:pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-slate-100 bg-slate-50">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold leading-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>
                Rate Your Purchase
              </h2>
              <p className="text-xs truncate max-w-[180px] mt-0.5 text-slate-500">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <FiX size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Star Rating */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-3 text-slate-400" style={{ fontFamily: 'var(--font-display)' }}>Your Rating</label>
            <StarPicker value={rating} onChange={setRating} />
            {rating > 0 && (
              <motion.p
                key={rating}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm font-bold mt-2 text-[var(--gold)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {LABELS[rating]} ✦
              </motion.p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-slate-400" style={{ fontFamily: 'var(--font-display)' }}>Your Review</label>
            <textarea
              required
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="What did you think? Quality, taste, packaging..."
              className="w-full p-4 rounded-xl border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-all resize-none bg-white text-sm outline-none"
            />
            <p className="text-[11px] mt-1 text-slate-400">{comment.length}/500 characters</p>
          </div>

          {/* Verified badge note */}
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <FiCheckCircle size={14} className="shrink-0 text-emerald-600" />
            <p className="text-xs text-emerald-700">Your review will be marked as <strong>Verified Purchase ✓</strong></p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-slate-700 border border-slate-200 hover:border-slate-350 font-bold rounded-xl text-sm transition-all bg-white hover:bg-slate-50 active:scale-[0.98]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 active:scale-[0.98]"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'var(--brand-gradient)',
                boxShadow: 'var(--shadow-brand)'
              }}
            >
              {submitting
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <FiStar size={14} />
              }
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

const CancelModal = ({ order, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState('Changed my mind')
  const [customReason, setCustomReason] = useState('')
  const REASONS = [
    'Changed my mind',
    'Ordered by mistake',
    'Found a better price / deal',
    'Delivery time is too long',
    'Other'
  ]

  // Accurate multi-source refund calculations
  const walletRefund = Number(order.walletUsed || 0) > 0
    ? Number(order.walletUsed)
    : (order.paymentMethod === 'Wallet' && order.isPaid ? Number(order.totalPrice || 0) : 0)

  const netPayable = Math.max(0, Number(order.totalPrice || 0) - Number(order.walletUsed || 0) - Number(order.giftCard?.amountUsed || 0))
  const onlineRefund = (order.paymentMethod === 'Online' && order.isPaid && netPayable > 0)
    ? netPayable
    : 0

  const giftCardRefund = Number(order.giftCard?.amountUsed || 0)
  const isCOD = order.paymentMethod === 'COD'

  const handleSubmit = () => {
    if (loading) return
    const finalReason = reason === 'Other' ? (customReason.trim() || 'Other reason') : reason
    onConfirm(finalReason)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-lg overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 my-8"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-rose-50 text-rose-600 border border-rose-100/80 shadow-xs shrink-0">
              <FiX size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 font-display">Cancel Order?</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600">
                  #{formatOrderId(order)}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Please review your refund summary before cancelling.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-40"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Refund Information Cards */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
              Refund & Settlement Details
            </label>

            {walletRefund > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/60 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FiRotateCcw size={15} className="stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">Daatasa Wallet Credit</span>
                    <span className="text-xs font-extrabold text-emerald-700 font-mono">₹{walletRefund.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700/90 mt-0.5">
                    Will be credited <strong className="font-bold underline decoration-emerald-400">instantly</strong> back to your Daatasa Wallet.
                  </p>
                </div>
              </div>
            )}

            {onlineRefund > 0 && (
              <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/60 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FiCreditCard size={15} className="stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900">Original Payment Method (Online)</span>
                    <span className="text-xs font-extrabold text-blue-700 font-mono">₹{onlineRefund.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-blue-700/90 mt-0.5">
                    Refund initiated to your bank/UPI. Usually reflects in <strong className="font-bold">5–7 business days</strong>.
                  </p>
                </div>
              </div>
            )}

            {giftCardRefund > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/60 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FiRefreshCw size={15} className="stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">Gift Card Restored</span>
                    <span className="text-xs font-extrabold text-amber-800 font-mono">₹{giftCardRefund.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-amber-700/90 mt-0.5">
                    Amount restored to Gift Card balance ({order.giftCard?.code}).
                  </p>
                </div>
              </div>
            )}

            {isCOD && walletRefund === 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FiTruck size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-900 block">Cash on Delivery</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    No payment was collected yet, so no monetary refund is necessary. Product stock will be restored automatically.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
              Why are you cancelling? <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {REASONS.map(r => {
                const isSelected = reason === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`w-full p-3 rounded-xl text-left text-xs sm:text-sm font-semibold transition-all flex items-center justify-between border ${
                      isSelected
                        ? 'bg-amber-50/50 border-amber-400 text-amber-900 shadow-xs'
                        : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{r}</span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <FiCheck size={11} className="stroke-[3]" />}
                    </div>
                  </button>
                )
              })}
            </div>

            {reason === 'Other' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Please describe your reason for cancellation..."
                  rows={2}
                  maxLength={200}
                  className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all bg-slate-50 text-slate-800 resize-none"
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-3 bg-slate-50/80 border-t border-slate-100 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="w-full py-3 px-4 text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 active:scale-[0.98]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Nevermind, Keep
          </button>
          <button
            type="button"
            disabled={loading || (reason === 'Other' && !customReason.trim())}
            onClick={handleSubmit}
            className="w-full py-3 px-4 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            style={{
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.25)'
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Confirm Cancel</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const ReturnModal = ({ order, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState('')
  const REASONS = ['Defective/Damaged product', 'Quality not as expected', 'Received wrong item', 'Item arrived too late', 'Other']

  return (
    <div className="modal-overlay">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="modal-box sm:rounded-3xl rounded-t-3xl w-full sm:max-w-md overflow-hidden bg-white border border-slate-100 shadow-[0_20px_50px_rgba(27,47,110,0.18)]"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600">
                <FiRefreshCw size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Request Return</h2>
                <p className="text-xs text-slate-400">#{formatOrderId(order)}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <FiX size={18} />
            </button>
          </div>

          <div className="mb-4 p-3.5 rounded-xl flex items-start gap-2.5 bg-amber-50 border border-amber-100">
            <FiAlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
            <p className="text-xs text-amber-800">Return requests must be submitted within 7 days of delivery. Once approved, our delivery executive will pick up the item.</p>
          </div>

          <div className="space-y-2 mb-5">
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400" style={{ fontFamily: 'var(--font-display)' }}>Reason for Return</label>
            {REASONS.map(r => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className="w-full p-3 rounded-xl text-left text-sm font-semibold transition-all border outline-none"
                style={reason === r
                  ? { background: 'rgba(245,166,35,0.08)', color: 'var(--gold-deep)', borderColor: 'var(--gold)' }
                  : { background: '#F8FAFC', color: 'var(--text-secondary)', borderColor: '#E2E8F0' }
                }
              >
                {r}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-slate-700 border border-slate-200 hover:border-slate-350 font-bold rounded-xl text-sm transition-all bg-white hover:bg-slate-50 active:scale-[0.98]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Cancel
            </button>
            <button
              disabled={loading || !reason}
              onClick={() => onConfirm(reason)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 active:scale-[0.98]"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'var(--brand-gradient)',
                boxShadow: 'var(--shadow-brand)'
              }}
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}


const Orders = () => {
  const { user } = useAuth()
  const openSupport = useSupportStore(state => state.openSupport)
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const { socket } = useSocket()
  const listRef = useRef(null)
  const navigate = useNavigate()
  const { fetchCartCount } = useCart()
  const [orders,        setOrders]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [expanded,      setExpanded]      = useState(null)
  const [printing,      setPrinting]      = useState(null)
  const [reordering,    setReordering]    = useState(null)
  const [filter,        setFilter]        = useState('all')
  const [cancelModal,   setCancelModal]   = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [returnModal,   setReturnModal]   = useState(null)
  const [returnLoading, setReturnLoading] = useState(false)
  const [reviewModal,   setReviewModal]   = useState(null)
  const [reviewedIds,   setReviewedIds]   = useState(new Set())
  const [supportDrawerOrder, setSupportDrawerOrder] = useState(null)

  useEffect(() => { if (user) fetchOrders() }, [user])

  useEffect(() => {
    if (highlightId && !loading && orders.length > 0) {
      const el = document.getElementById(`order-${highlightId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setExpanded(highlightId)
      }
    }
  }, [highlightId, loading, orders.length])

  useEffect(() => {
    if (!socket || !orders.length) return
    
    // Join all order rooms
    orders.forEach(o => {
      socket.emit('joinOrderRoom', o._id)
    })

    const handleStatusUpdate = (updatedOrder) => {
      if (updatedOrder?._id) {
        setOrders(prev => prev.map(o => o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o))
        toast.info(`Order #${formatOrderId(updatedOrder)} status updated!`)
      } else {
        fetchOrders()
      }
    }

    socket.on('orderStatusUpdated', handleStatusUpdate)

    return () => {
      socket.off('orderStatusUpdated', handleStatusUpdate)
    }
  }, [socket, orders.length])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/orders/myorders')
      setOrders(res.data)
    } catch { toast.error('Failed to load orders') }
    finally { setLoading(false) }
  }

  const printInvoice = async (order) => {
    setPrinting(order._id)
    try {
      const res = await api.get(`/api/invoices/${order._id}/download`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `INV-${formatOrderId(order)}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch { toast.error('Could not download invoice. Make sure order is confirmed.') }
    finally { setPrinting(null) }
  }

  const handleCancelOrder = async (reason) => {
    if (cancelLoading || !cancelModal) return
    setCancelLoading(true)
    try {
      const res = await api.post(`/api/orders/${cancelModal._id}/cancel`, { reason })
      toast.success(res.data?.message || 'Order cancelled successfully')
      setCancelModal(null)
      fetchOrders()
    } catch (err) {
      const msg = err.response?.data?.message || ''
      if (msg.toLowerCase().includes('already cancelled')) {
        toast.info('Order was already cancelled.')
        setCancelModal(null)
        fetchOrders()
      } else {
        toast.error(msg || 'Cancellation failed. Please try again.')
      }
    } finally {
      setCancelLoading(false)
    }
  }

  const handleReturnRequest = async (reason) => {
    setReturnLoading(true)
    try {
      await api.post(`/api/orders/${returnModal._id}/return-request`, { reason })
      toast.success('Return request submitted')
      setReturnModal(null)
      fetchOrders()
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to submit return request') }
    finally { setReturnLoading(false) }
  }

  // ✅ P1: Reorder — add all items back to cart in one click
  const handleReorder = async (order) => {
    setReordering(order._id)
    let added = 0
    try {
      for (const item of order.orderItems) {
        const productId = String(item.product?._id || item.product)
        try {
          await api.post('/api/cart/items', { productId, quantity: item.quantity })
          added++
        } catch {} // skip unavailable items silently
      }
      await fetchCartCount()
      if (added > 0) {
        toast.success(`${added} item${added !== 1 ? 's' : ''} added to cart!`)
        navigate('/cart')
      } else {
        toast.error('Could not reorder — some items may be out of stock')
      }
    } catch {
      toast.error('Reorder failed. Please try again.')
    } finally {
      setReordering(null)
    }
  }

  const canCancel = (o) =>
    !['CANCELLED', 'FAILED'].includes(o.paymentStatus) &&
    !['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'].includes(o.orderStatus) &&
    !o.isDelivered
  const canReturn = (o) => o.isDelivered && !o.returnRequest?.requestedAt && (Date.now() - new Date(o.deliveredAt).getTime()) / (1000 * 60 * 60 * 24) <= 7

  const visible = orders.filter(o => {
    if (filter === 'all') return true
    if (filter === 'pending') return !o.isPaid && !o.isDelivered && !['CANCELLED', 'FAILED'].includes(o.paymentStatus)
    if (filter === 'paid') return o.isPaid && !o.isDelivered
    if (filter === 'delivered') return o.isDelivered
    if (filter === 'cancelled') return ['CANCELLED', 'FAILED'].includes(o.paymentStatus)
    return true
  })

  // Guard: redirect unauthenticated users BEFORE any early returns (React hooks rule)
  if (!user && !loading) return (navigate('/login', { state: { from: '/orders' } }) || null)

  if (loading) return (
    <div className="min-h-screen pb-20 bg-[var(--ivory)] font-sans">
      <div className="bg-white border-b border-brand-primary/10 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 py-12 text-center">
          <div className="h-5 w-24 bg-brand-primary/10 animate-pulse rounded-full mx-auto mb-3" />
          <div className="h-9 w-56 bg-brand-primary/10 animate-pulse rounded-lg mx-auto" />
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-[2rem] p-6 bg-white border border-brand-primary/10 shadow-sm animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-32 bg-brand-primary/5 rounded" />
              <div className="h-6 w-20 bg-brand-primary/5 rounded-full" />
            </div>
            <div className="flex gap-4">
              <div className="w-16 h-16 bg-brand-primary/5 rounded-[1rem] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-brand-primary/5 rounded w-2/3" />
                <div className="h-3 bg-brand-primary/5 rounded w-1/3" />
              </div>
              <div className="h-5 w-20 bg-brand-primary/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-20 bg-[var(--ivory)] font-sans text-brand-text">
      <Helmet>
        <title>My Orders — Daatasa</title>
        <meta name="description" content="Track and manage your Daatasa orders. View order history, cancel, return, or reorder with one click." />
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Header */}
      <div className="bg-white border-b border-brand-primary/10 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 py-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 text-center sm:text-left">
            <div>
              <span className="inline-block px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase rounded-full mb-4 bg-brand-primary/5 text-brand-primary">My Orders</span>
              <h1 className="text-4xl font-bold font-display text-brand-primary">Order History</h1>
              <p className="text-base mt-2 text-brand-text/60 font-medium">Track and manage your purchases</p>
            </div>
            <div className="text-center sm:text-right p-5 rounded-[1.5rem] bg-[var(--ivory)] border border-brand-primary/5">
              <p className="text-[10px] mb-1 text-brand-text/40 uppercase tracking-widest font-bold">Total Spent</p>
              <p className="text-3xl font-bold font-display text-brand-primary">
                ₹{orders.reduce((acc, o) => acc + (o.paymentStatus !== 'CANCELLED' ? o.totalPrice : 0), 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar pt-2 sm:justify-center">
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'pending', label: 'Pending' },
              { id: 'paid', label: 'Processing' },
              { id: 'delivered', label: 'Delivered' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                  filter === f.id
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-white text-brand-text/60 border border-brand-primary/10 hover:border-brand-primary/30 hover:text-brand-primary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Order List */}
      <div className="max-w-[1280px] mx-auto px-6 py-12">
        {visible.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-24 rounded-[2rem] flex flex-col items-center text-center p-10 bg-white border border-brand-primary/10 shadow-sm"
          >
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-brand-primary/5 text-brand-primary/40">
              <FiPackage size={32} />
            </div>
            <h2 className="text-2xl font-bold font-display text-brand-primary mb-3">No orders found</h2>
            <p className="text-base max-w-sm mb-8 text-brand-text/60 font-medium">You haven't placed any orders yet. Start shopping to see your orders here.</p>
            <Link to="/products" className="btn btn-primary px-8 h-12 rounded-full flex items-center justify-center gap-2 text-sm">
              Browse Products <FiArrowRight size={16} />
            </Link>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-6">
            {visible.map((o, i) => {
              const isExp = expanded === o._id
              return (
                <motion.div
                  key={o._id}
                  id={`order-${o._id}`}
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`rounded-[2rem] transition-all duration-300 overflow-hidden bg-white hover:border-brand-primary/30 border shadow-sm ${highlightId === o._id ? 'animate-[pulse_2s_ease-in-out_3]' : ''}`}
                  style={{
                    borderColor: isExp ? 'var(--brand-primary)' : (highlightId === o._id ? 'var(--brand-primary)' : 'rgba(27,47,110,0.1)'),
                  }}
                >
                  {/* Order Row */}
                  <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 cursor-pointer" onClick={() => setExpanded(isExp ? null : o._id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="text-lg font-bold font-display text-brand-primary">#{formatOrderId(o)}</span>
                        <StatusBadge order={o} />
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-brand-primary/5 text-brand-primary">{o.paymentMethod}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-5 text-sm text-brand-text/60 font-medium">
                        <span className="flex items-center gap-2">
                          <FiCalendar size={14} className="text-brand-text/40" />
                          {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-2">
                          <FiPackage size={14} className="text-brand-text/40" />
                          {o.orderItems.length} item{o.orderItems.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-5">
                      {['COD_CONFIRMED', 'PAID'].includes(o.paymentStatus) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReorder(o) }}
                          disabled={reordering === o._id}
                          className="hidden sm:flex items-center gap-2 px-5 py-2.5 border border-brand-primary/20 hover:bg-brand-primary/5 text-brand-primary rounded-full text-xs font-bold uppercase tracking-widest transition-all"
                        >
                          {reordering === o._id ? (
                            <div className="w-3.5 h-3.5 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
                          ) : (
                            <FiRotateCcw size={14} />
                          )}
                          Buy Again
                        </button>
                      )}
                      <div className="text-right">
                        {o.walletUsed > 0 || o.giftCard?.amountUsed > 0 ? (
                          <>
                            <p className="text-[10px] mb-1 text-brand-text/40 font-bold uppercase tracking-widest">
                              {o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID' ? 'To Pay (COD)' : 'Net Amount'}
                            </p>
                            <p className="text-xl font-bold font-display" style={{
                              color: o.paymentStatus === 'CANCELLED' ? 'var(--text-muted)' : 'var(--brand-primary)',
                              textDecoration: o.paymentStatus === 'CANCELLED' ? 'line-through' : 'none'
                            }}>
                              ₹{Number((o.payableAmount !== undefined && o.payableAmount !== null) ? o.payableAmount : Math.max(0, o.totalPrice - (o.walletUsed || 0) - (o.giftCard?.amountUsed || 0))).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-emerald-600 font-semibold">
                              Total ₹{Number(o.totalPrice).toLocaleString('en-IN')} (Wallet: -₹{Number(o.walletUsed || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] mb-1 text-brand-text/40 font-bold uppercase tracking-widest">Total</p>
                            <p className="text-xl font-bold font-display" style={{
                              color: o.paymentStatus === 'CANCELLED' ? 'var(--text-muted)' : 'var(--brand-primary)',
                              textDecoration: o.paymentStatus === 'CANCELLED' ? 'line-through' : 'none'
                            }}>
                              ₹{Number(o.totalPrice).toLocaleString('en-IN')}
                            </p>
                          </>
                        )}
                      </div>
                      <button
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--ivory)] text-brand-primary transition-all shrink-0 border border-brand-primary/5 hover:border-brand-primary/20 hover:bg-brand-primary/5"
                        style={isExp ? { background: 'var(--brand-primary)', color: '#FFFFFF', borderColor: 'transparent' } : {}}
                      >
                        <motion.div animate={{ rotate: isExp ? 180 : 0 }}><FiChevronDown size={20} /></motion.div>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExp && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 sm:p-8 bg-[var(--ivory)] border-t border-brand-primary/5">
                          <div className="grid lg:grid-cols-2 gap-8">
                            {/* Items */}
                            <div>
                              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 text-brand-text/40">Order Items</h3>
                              <div className="space-y-3">
                                {o.orderItems.map(item => {
                                  const productId = String(item.product?._id || item.product || '')
                                  const alreadyReviewed = reviewedIds.has(productId)
                                  return (
                                    <div key={item._id} className="flex items-start gap-4 p-4 bg-white border border-brand-primary/5 rounded-[1.5rem] shadow-sm hover:border-brand-primary/10 transition-all">
                                      <div className="w-16 h-16 rounded-[1rem] overflow-hidden shrink-0 bg-white border border-brand-primary/5 p-2">
                                        <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-base font-bold font-display truncate text-brand-primary">{item.name}</p>
                                        <p className="text-sm mb-2 text-brand-text/60 font-medium">{item.quantity} × ₹{item.price.toLocaleString('en-IN')}</p>
                                        {o.isDelivered && (
                                          alreadyReviewed ? (
                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                              <FiCheckCircle size={12} /> Reviewed
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => setReviewModal({ productId, name: item.name, image: item.image })}
                                              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-secondary hover:text-brand-primary transition-all uppercase tracking-widest"
                                            >
                                              <FiStar size={12} /> Rate product
                                            </button>
                                          )
                                        )}
                                      </div>
                                      <span className="text-base font-bold font-display shrink-0 text-brand-primary">₹{(item.quantity * item.price).toLocaleString('en-IN')}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-5">
                              {/* Tracking Timeline */}
                              <div className="p-6 bg-white border border-brand-primary/5 rounded-[1.5rem] shadow-sm">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest mb-5 flex items-center gap-2 text-brand-text/40">
                                  <FiTruck size={14} className="text-brand-secondary" /> Order Tracking
                                </h4>

                                <OrderTimeline order={o} />
                              </div>

                              {/* Delivery Address */}
                              <div className="p-6 bg-white border border-brand-primary/5 rounded-[1.5rem] shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                  <FiMapPin size={14} className="text-brand-secondary" />
                                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-text/40">Delivery Address</h4>
                                </div>
                                <p className="text-sm leading-relaxed text-brand-text/60 font-medium">
                                  {o.shippingAddress.name && <strong className="block text-brand-primary font-bold mb-1 font-display">{o.shippingAddress.name}</strong>}
                                  {o.shippingAddress.street}, {o.shippingAddress.city}<br />
                                  {o.shippingAddress.state} – {o.shippingAddress.zipCode}
                                </p>
                              </div>

                              {/* Price Breakdown */}
                              <div className="p-6 bg-white border border-brand-primary/5 rounded-[1.5rem] shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                  <FiCreditCard size={14} className="text-brand-secondary" />
                                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-text/40">Price Details</h4>
                                </div>
                                <div className="space-y-3">
                                  <div className="flex justify-between text-sm"><span className="text-brand-text/60 font-medium">Subtotal</span><span className="text-brand-primary font-bold font-display">₹{Number(o.itemsPrice).toLocaleString('en-IN')}</span></div>
                                  {o.discount > 0 && <div className="flex justify-between text-sm"><span className="text-emerald-600 font-medium">Discount</span><span className="text-emerald-600 font-bold font-display">-₹{Number(o.discount).toLocaleString('en-IN')}</span></div>}
                                  <div className="flex justify-between text-sm"><span className="text-brand-text/60 font-medium">Shipping</span><span className="font-bold font-display" style={{ color: o.shippingPrice === 0 ? 'var(--success)' : 'var(--brand-primary)' }}>{o.shippingPrice === 0 ? 'FREE' : `₹${o.shippingPrice}`}</span></div>
                                  <div className="flex justify-between pt-3 border-t border-brand-primary/10">
                                    <span className="text-sm font-bold font-display text-brand-primary">Total Order Value</span>
                                    <span className="text-base font-bold font-display text-brand-primary">₹{Number(o.totalPrice).toLocaleString('en-IN')}</span>
                                  </div>
                                  {o.walletUsed > 0 && (
                                    <div className="flex justify-between text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                      <span>Paid via Wallet</span>
                                      <span>-₹{Number(o.walletUsed).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                    </div>
                                  )}
                                  {o.giftCard?.amountUsed > 0 && (
                                    <div className="flex justify-between text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                      <span>Paid via Gift Card</span>
                                      <span>-₹{Number(o.giftCard.amountUsed).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between pt-3 border-t border-brand-primary/10">
                                    <span className="text-base font-bold font-display text-brand-primary">
                                      {o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID' ? 'Amount to Pay (COD)' : (o.isPaid ? 'Net Paid' : 'Net Payable')}
                                    </span>
                                    <span className="text-xl font-bold font-display text-brand-primary">
                                      ₹{Number((o.payableAmount !== undefined && o.payableAmount !== null) ? o.payableAmount : Math.max(0, o.totalPrice - (o.walletUsed || 0) - (o.giftCard?.amountUsed || 0))).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="mt-8 flex flex-wrap gap-4 justify-end pt-6 border-t border-brand-primary/10">
                            {/* Reorder button */}
                            {['COD_CONFIRMED', 'PAID'].includes(o.paymentStatus) && (
                              <button
                                onClick={() => handleReorder(o)}
                                disabled={reordering === o._id}
                                className="btn btn-primary px-6 py-3 rounded-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                              >
                                {reordering === o._id
                                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  : <FiRotateCcw size={16} />}
                                {reordering === o._id ? 'Adding...' : 'Reorder'}
                              </button>
                            )}
                            <button
                              onClick={() => openSupport(o)}
                              className="px-6 py-3 bg-white text-brand-primary border border-brand-primary/20 hover:bg-brand-primary/5 font-bold rounded-full text-sm transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                            >
                              <FiHelpCircle size={16} /> Need Help?
                            </button>
                            {(!['PENDING', 'CANCELLED', 'FAILED'].includes(o.paymentStatus)) && (
                              <button
                                onClick={() => printInvoice(o)}
                                disabled={printing === o._id}
                                className="px-6 py-3 bg-white text-brand-primary border border-brand-primary/20 hover:bg-brand-primary/5 font-bold rounded-full text-sm transition-all flex items-center gap-2"
                              >
                                <FiPrinter size={16} /> {printing === o._id ? 'Preparing...' : 'Download Invoice'}
                              </button>
                            )}
                            {canReturn(o) && (
                              <button
                                onClick={() => setReturnModal(o)}
                                className="px-6 py-3 bg-white text-brand-primary border border-brand-primary/20 hover:bg-brand-primary/5 font-bold rounded-full text-sm transition-all flex items-center gap-2"
                              >
                                <FiRefreshCw size={16} /> Request Return
                              </button>
                            )}
                            {canCancel(o) && (
                              <button
                                onClick={() => setCancelModal(o)}
                                className="px-6 py-3 bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 font-bold rounded-full text-sm transition-all flex items-center gap-2"
                              >
                                <FiX size={16} /> Cancel Order
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {cancelModal && (
          <CancelModal
            order={cancelModal}
            onClose={() => setCancelModal(null)}
            onConfirm={handleCancelOrder}
            loading={cancelLoading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {returnModal && (
          <ReturnModal
            order={returnModal}
            onClose={() => setReturnModal(null)}
            onConfirm={handleReturnRequest}
            loading={returnLoading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewModal && (
          <ReviewModal
            item={reviewModal}
            onClose={() => setReviewModal(null)}
            onSubmitted={(productId) => {
              setReviewedIds(prev => new Set(prev).add(String(productId)))
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Orders
