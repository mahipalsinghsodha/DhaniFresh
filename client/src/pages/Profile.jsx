// pages/Profile.jsx — Unified Tabbed Account Dashboard
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useConfirm } from '../context/ConfirmContext'
import api from '../api/axios'
import {
  FiUser, FiMapPin, FiChevronRight, FiPackage, FiLogOut, FiAlertCircle,
  FiPhone, FiMail, FiRefreshCw, FiClock, FiLock, FiCreditCard, FiCopy,
  FiShare2, FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiChevronDown,
  FiStar, FiCheckCircle, FiPrinter, FiEye, FiEyeOff, FiArrowRight
} from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import { Helmet } from 'react-helmet-async'
import { useCart } from '../context/CartContext'
import OrderTimeline from '../components/OrderTimeline'
import { useSocket } from '../hooks/useSocket'
import { formatOrderId } from '../utils/formatOrderId'

// ── Shared Floating Input System with Luxury Focus Glow ──
const FloatingInput = ({ id, label, type = 'text', value, onChange, icon: Icon, prefix, rightElement, autoComplete, required, disabled, maxLength, inputMode, placeholder }) => {
  const [focused, setFocused] = useState(false)

  return (
    <div className="relative w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix ? (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none select-none text-brand-primary font-bold text-xs sm:text-sm border-r border-brand-primary/15 pr-2.5 z-10">
            {prefix}
          </div>
        ) : Icon ? (
          <div
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 z-10"
            style={{ color: focused ? 'var(--gold)' : 'var(--text-muted)' }}
          >
            <Icon size={16} />
          </div>
        ) : null}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          inputMode={inputMode}
          placeholder={placeholder || (label ? `Enter ${label.replace('*', '').trim().toLowerCase()}` : '')}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full rounded-[1rem] text-sm font-medium outline-none transition-all placeholder:text-brand-text/30"
          style={{
            height: '52px',
            paddingLeft: prefix ? '76px' : Icon ? '42px' : '14px',
            paddingRight: rightElement ? '44px' : '14px',
            background: disabled ? 'rgba(27,47,110,0.03)' : (focused ? '#FFFFFF' : 'var(--ivory)'),
            border: `1.5px solid ${focused ? 'var(--brand-secondary)' : 'rgba(27, 47, 110, 0.18)'}`,
            color: 'var(--brand-primary)',
            boxShadow: focused ? '0 0 0 3px rgba(217, 165, 32, 0.20), 0 2px 8px rgba(217, 165, 32, 0.10)' : 'none',
            opacity: disabled ? 0.75 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
        {rightElement && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10">{rightElement}</div>
        )}
      </div>
    </div>
  )
}

const emptyAddr = {
  label: 'Home',
  name: '',
  phone: '',
  street: '',
  city: '',
  district: '',
  state: '',
  zipCode: '',
  country: 'India',
  isDefault: false,
}

// ── Star Picker for Reviews ──
const StarPicker = ({ value, onChange }) => (
  <div className="flex gap-1.5">
    {[1, 2, 3, 4, 5].map((n) => (
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
            transition: 'all 0.15s ease',
          }}
        />
      </button>
    ))}
  </div>
)

// ── Review Modal ──
const ReviewModal = ({ item, onClose, onSubmitted }) => {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (rating === 0) { toast.error('Please select a star rating'); return }
    if (!comment.trim()) { toast.error('Please write your review'); return }
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
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 40 }}
        className="modal-box sm:rounded-3xl rounded-t-3xl w-full sm:max-w-md overflow-hidden bg-white border border-slate-100 shadow-[0_20px_50px_rgba(27,47,110,0.18)]"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-slate-100 bg-slate-50">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold leading-tight text-slate-900 font-display">Rate Your Purchase</h2>
              <p className="text-xs truncate max-w-[180px] mt-0.5 text-slate-500">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <FiX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-3 text-slate-400 font-display">Your Rating</label>
            <StarPicker value={rating} onChange={setRating} />
            {rating > 0 && (
              <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="text-sm font-bold mt-2 text-[var(--gold)] font-display">
                {LABELS[rating]} ✦
              </motion.p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-slate-400 font-display">Your Review</label>
            <textarea
              required
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="What did you think? Quality, taste, aroma, packaging..."
              className="w-full p-4 rounded-xl border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-all resize-none bg-white text-sm outline-none"
            />
          </div>

          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <FiCheckCircle size={14} className="shrink-0 text-emerald-600" />
            <p className="text-xs text-emerald-700">Your review will be marked as <strong>Verified Purchase ✓</strong></p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-700 border border-slate-200 hover:border-slate-350 font-bold rounded-xl text-sm transition-all bg-white hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
              {submitting ? <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /> : <FiStar size={14} />}
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Cancel Order Modal ──
const CancelModal = ({ order, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState('')
  const REASONS = ['Changed my mind', 'Ordered by mistake', 'Found a better deal', 'Other']
  const willRefund = order.paymentStatus === 'PAID' && order.paymentMethod === 'Online'

  return (
    <div className="modal-overlay">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-box sm:rounded-3xl rounded-t-3xl w-full sm:max-w-md overflow-hidden bg-white border border-slate-100 shadow-[0_20px_50px_rgba(27,47,110,0.18)]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 text-red-500">
                <FiX size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 font-display">Cancel Order?</h2>
                <p className="text-xs text-slate-400">#{formatOrderId(order)}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <FiX size={18} />
            </button>
          </div>

          {willRefund && (
            <div className="mb-4 p-3.5 rounded-xl flex items-start gap-2.5 bg-emerald-50 border border-emerald-100">
              <FiRefreshCw size={14} className="shrink-0 mt-0.5 text-emerald-600" />
              <div className="text-xs text-emerald-700 space-y-1">
                {order.walletUsed > 0 && (
                  <p>• <strong>₹{Number(order.walletUsed).toFixed(2)}</strong> will be credited instantly back to your Daatasa Wallet.</p>
                )}
                {((Number(order.totalPrice || 0) - Number(order.walletUsed || 0) - Number(order.giftCard?.amountUsed || 0)) > 0 && order.paymentMethod === 'Online') && (
                  <p>• <strong>₹{Number(order.totalPrice - (order.walletUsed || 0) - (order.giftCard?.amountUsed || 0)).toFixed(2)}</strong> will be refunded to your original payment method in 5–7 business days.</p>
                )}
                {order.paymentMethod === 'Wallet' && !order.walletUsed && (
                  <p>• A full refund of <strong>₹{Number(order.totalPrice).toFixed(2)}</strong> will be credited back to your Daatasa Wallet.</p>
                )}
                {order.paymentMethod === 'COD' && !order.walletUsed && (
                  <p>No payment was collected yet, so no monetary refund is necessary.</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2 mb-5">
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400 font-display">Reason for cancellation</label>
            {REASONS.map(r => (
              <button
                key={r}
                type="button"
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
            <button onClick={onClose} className="px-5 py-3 text-slate-700 border border-slate-200 hover:border-slate-350 font-bold rounded-xl text-sm transition-all bg-white hover:bg-slate-50">
              Keep Order
            </button>
            <button
              disabled={loading || !reason}
              onClick={() => onConfirm(reason)}
              className="px-5 py-3 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)'
              }}
            >
              {loading ? 'Cancelling...' : 'Yes, Cancel'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Return Order Modal ──
const ReturnModal = ({ order, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState('')
  const REASONS = ['Defective/Damaged product', 'Quality not as expected', 'Received wrong item', 'Item arrived too late', 'Other']

  return (
    <div className="modal-overlay">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-box sm:rounded-3xl rounded-t-3xl w-full sm:max-w-md overflow-hidden bg-white border border-slate-100 shadow-[0_20px_50px_rgba(27,47,110,0.18)]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600">
                <FiRefreshCw size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 font-display">Request Return</h2>
                <p className="text-xs text-slate-400">#{formatOrderId(order)}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <FiX size={18} />
            </button>
          </div>

          <div className="mb-4 p-3.5 rounded-xl flex items-start gap-2.5 bg-amber-50 border border-amber-100">
            <FiAlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
            <p className="text-xs text-amber-800">Return requests must be submitted within 7 days of delivery. Once approved, our courier will pick up the item.</p>
          </div>

          <div className="space-y-2 mb-5">
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400 font-display">Reason for Return</label>
            {REASONS.map(r => (
              <button
                key={r}
                type="button"
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
            <button onClick={onClose} className="px-5 py-3 text-slate-700 border border-slate-200 hover:border-slate-350 font-bold rounded-xl text-sm transition-all bg-white hover:bg-slate-50">
              Cancel
            </button>
            <button
              disabled={loading || !reason}
              onClick={() => onConfirm(reason)}
              className="btn btn-primary px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Top Up Wallet Modal ──
const TopupModal = ({ isOpen, onClose, onTopup, loading }) => {
  const [amt, setAmt] = useState(500);
  if (!isOpen) return null;
  const presets = [100, 200, 500, 1000, 2000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-brand-primary/10">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-brand-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold">
              <FiCreditCard size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-brand-primary">Top Up Wallet</h3>
              <p className="text-xs text-brand-text/60">Instant balance credit via Razorpay</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500">
            <FiX size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-brand-text/70 uppercase tracking-wider mb-2">Amount to Add (₹)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-brand-primary">₹</span>
              <input
                type="number"
                min="10"
                value={amt}
                onChange={e => setAmt(Number(e.target.value))}
                className="w-full h-12 pl-9 pr-4 rounded-xl border border-brand-primary/20 bg-white font-display font-bold text-xl text-brand-primary focus:border-brand-secondary outline-none"
                placeholder="500"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-brand-text/50 mb-2">Popular Amounts:</p>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmt(p)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    amt === p ? 'bg-brand-primary text-white border-brand-primary' : 'bg-gray-50 hover:bg-gray-100 text-brand-text/80 border-gray-200'
                  }`}
                >
                  +₹{p}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={loading || !amt || amt < 10}
              onClick={() => onTopup(amt)}
              className="w-full h-12 btn btn-primary rounded-full font-bold flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiArrowRight size={16} />}
              {loading ? 'Processing...' : `Pay ₹${amt || 0} via Razorpay`}
            </button>
            <p className="text-[11px] text-center text-brand-text/40 mt-2">100% Secure Payment • UPI, Cards & Netbanking</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Profile & Account Dashboard ──
const Profile = () => {
  const { user, updateUser, logout } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { fetchCartCount } = useCart()
  const { socket } = useSocket()

  // Active Tab from query param or fallback to 'profile'
  const activeTab = searchParams.get('tab') || 'profile'
  const highlightId = searchParams.get('highlight')

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true })
  }

  // ── Profile / Personal Details State ──
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [profLoading, setProfLoading] = useState(false)
  const [referrals, setReferrals] = useState([])

  // Email Update States (for guest or real email)
  const hasRealEmail = Boolean(user?.email)
  const [editEmailMode, setEditEmailMode] = useState(false)
  const [newEmail, setNewEmail]           = useState('')
  const [emailOtpMode, setEmailOtpMode]   = useState(false)
  const [emailOtp, setEmailOtp]           = useState(['', '', '', '', '', ''])
  const [emailUpdateLoading, setEUL]      = useState(false)

  // ── Addresses State ──
  const [addresses, setAddresses] = useState([])
  const [showAddrForm, setShowAddrForm] = useState(false)
  const [editAddrId, setEditAddrId] = useState(null)
  const [addrForm, setAddrForm] = useState(emptyAddr)
  const [addrLoading, setAddrLoading] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState('')

  // ── Orders State ──
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderFilter, setOrderFilter] = useState('all')
  const [expandedOrder, setExpandedOrder] = useState(null)
  const [printingInvoice, setPrintingInvoice] = useState(null)
  const [reordering, setReordering] = useState(null)
  const [cancelModal, setCancelModal] = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [returnModal, setReturnModal] = useState(null)
  const [returnLoading, setReturnLoading] = useState(false)
  const [reviewModal, setReviewModal] = useState(null)

  // ── Wallet & Subscriptions State ──
  const [walletData, setWalletData] = useState({ walletBalance: 0, rewardPoints: 0, transactions: [] })
  const [walletLoading, setWalletLoading] = useState(false)
  const [topupModal, setTopupModal] = useState(false)
  const [topupLoading, setTopupLoading] = useState(false)
  const [subscriptions, setSubscriptions] = useState([])

  // ── Change Password State ──
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Initial Data Fetch
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
      fetchSubscriptions()
      fetchWallet()
      fetchReferrals()
      fetchAddresses()
      fetchOrders()
    }
  }, [user])

  useEffect(() => {
    if (highlightId && orders.length > 0) {
      setExpandedOrder(highlightId)
    }
  }, [highlightId, orders.length])

  // Socket listener for real-time order status updates
  useEffect(() => {
    if (!socket || !orders.length) return
    orders.forEach(o => socket.emit('joinOrderRoom', o._id))

    const handleStatusUpdate = (updatedOrder) => {
      setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o))
      toast.success(`Order #${formatOrderId(updatedOrder)} status updated!`)
    }
    socket.on('orderStatusUpdated', handleStatusUpdate)
    return () => socket.off('orderStatusUpdated', handleStatusUpdate)
  }, [socket, orders.length])

  // ── API Fetchers ──
  const fetchAddresses = async () => {
    try {
      const res = await api.get('/api/auth/me')
      setAddresses(res.data.addresses || [])
    } catch (err) {
      console.error('Failed to fetch addresses', err)
    }
  }

  const fetchOrders = async () => {
    try {
      setOrdersLoading(true)
      const res = await api.get('/api/orders/myorders')
      setOrders(res.data || [])
    } catch (err) {
      console.error('Failed to load orders', err)
    } finally {
      setOrdersLoading(false)
    }
  }

  const fetchReferrals = async () => {
    try {
      const res = await api.get('/api/auth/referrals')
      setReferrals(res.data || [])
    } catch (err) {
      console.error('Failed to fetch referrals', err)
    }
  }

  const fetchSubscriptions = async () => {
    try {
      const res = await api.get('/api/subscriptions/my')
      setSubscriptions(res.data?.data || [])
    } catch (err) {
      console.error('Failed to fetch subscriptions', err)
    }
  }

  const fetchWallet = async () => {
    try {
      const res = await api.get('/api/wallet')
      setWalletData(res.data || { walletBalance: 0, rewardPoints: 0, transactions: [] })
    } catch (err) {
      console.error('Failed to fetch wallet data', err)
    }
  }

  // ── Profile Handlers ──
  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfLoading(true)
    try {
      const res = await api.put('/api/auth/profile', { name, phone })
      updateUser({ name: res.data.name, phone: res.data.phone })
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setProfLoading(false)
    }
  }

  const handleSendEmailOtp = async () => {
    if (!newEmail.includes('@')) { toast.error('Enter valid email'); return }
    setEUL(true)
    try {
      await api.post('/api/auth/profile/send-email-otp', { newEmail })
      toast.success('OTP sent to ' + newEmail)
      setEmailOtpMode(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP')
    } finally { setEUL(false) }
  }

  const handleVerifyEmailOtp = async () => {
    const code = emailOtp.join('')
    if (code.length !== 6) { toast.error('Enter 6 digit OTP'); return }
    setEUL(true)
    try {
      const res = await api.post('/api/auth/profile/verify-email-otp', { otpCode: code })
      toast.success('Email updated successfully!')
      updateUser({ email: res.data.email })
      setEditEmailMode(false)
      setEmailOtpMode(false)
      setNewEmail('')
      setEmailOtp(['', '', '', '', '', ''])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP')
    } finally { setEUL(false) }
  }

  // ── Address Handlers ──
  const handlePinChange = async (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6)
    setPinError('')
    setAddrForm(p => ({ ...p, zipCode: cleaned }))
    if (cleaned.length === 6) {
      setPinLoading(true)
      try {
        const res = await api.get(`/api/pincode/${cleaned}`)
        const data = res.data
        if (data[0]?.Status === 'Success' && data[0].PostOffice?.length) {
          const po = data[0].PostOffice[0]
          setAddrForm(p => ({
            ...p,
            zipCode: cleaned,
            state: po.State,
            district: po.District,
            city: po.Division || po.District,
          }))
          toast.success(`PIN found: ${po.District}, ${po.State}`)
        } else {
          setPinError('PIN code not found. Please fill details manually.')
        }
      } catch {
        setPinError('Could not fetch PIN data. Please fill manually.')
      } finally {
        setPinLoading(false)
      }
    }
  }

  const handleAddrSubmit = async (e) => {
    e.preventDefault()
    if (!/^[6-9][0-9]{9}$/.test(addrForm.phone)) {
      toast.error('Enter a valid 10-digit mobile number')
      return
    }
    if (!/^[0-9]{6}$/.test(addrForm.zipCode)) {
      toast.error('Enter a valid 6-digit PIN code')
      return
    }
    setAddrLoading(true)
    try {
      const res = editAddrId
        ? await api.put(`/api/auth/addresses/${editAddrId}`, addrForm)
        : await api.post('/api/auth/addresses', addrForm)
      setAddresses(res.data.addresses)
      setShowAddrForm(false)
      setEditAddrId(null)
      setAddrForm(emptyAddr)
      toast.success(editAddrId ? 'Address updated!' : 'Address saved!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save address')
    } finally {
      setAddrLoading(false)
    }
  }

  const handleDeleteAddress = async (id) => {
    if (!(await confirm('Delete this address?'))) return
    try {
      const res = await api.delete(`/api/auth/addresses/${id}`)
      setAddresses(res.data.addresses)
      toast.success('Address removed')
    } catch {
      toast.error('Could not delete address')
    }
  }

  const handleSetDefault = async (id) => {
    try {
      const res = await api.patch(`/api/auth/addresses/${id}/default`)
      setAddresses(res.data.addresses)
      toast.success('Default address updated')
    } catch {
      toast.error('Failed to set default')
    }
  }

  // ── Orders Handlers ──
  const printInvoice = async (order) => {
    setPrintingInvoice(order._id)
    try {
      const res = await api.get(`/api/invoices/${order._id}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `INV-${formatOrderId(order)}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not download invoice. Make sure order is confirmed.')
    } finally {
      setPrintingInvoice(null)
    }
  }

  const handleCancelOrder = async (reason) => {
    setCancelLoading(true)
    try {
      await api.post(`/api/orders/${cancelModal._id}/cancel`, { reason })
      toast.success('Order cancelled')
      setCancelModal(null)
      fetchOrders()
    } catch {
      toast.error('Cancellation failed')
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
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit return request')
    } finally {
      setReturnLoading(false)
    }
  }

  const handleReorder = async (order) => {
    setReordering(order._id)
    let added = 0
    try {
      for (const item of order.orderItems) {
        const productId = String(item.product?._id || item.product)
        try {
          await api.post('/api/cart/items', { productId, quantity: item.quantity })
          added++
        } catch { }
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

  // ── Password Handlers ──
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }
    setPassLoading(true)
    try {
      const res = await api.post('/api/auth/change-password', { oldPassword, newPassword })
      toast.success(res.data.message || 'Password changed successfully')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setPassLoading(false)
    }
  }

  // ── Wallet & Subscriptions Handlers ──
  const handleWalletTopup = async (amt) => {
    const amount = Number(amt);
    if (!amount || amount < 10) {
      toast.error('Minimum top-up amount is ₹10');
      return;
    }
    setTopupLoading(true);
    try {
      const { data: order } = await api.post('/api/wallet/topup', { amount });

      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_EvzmZvtG1AJQAS';
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const rzp = new window.Razorpay({
        key: razorpayKey,
        order_id: order.id,
        name: 'Daatasa',
        description: 'Wallet Top-Up',
        amount: order.amount,
        theme: { color: '#F5A623' },
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        handler: async (response) => {
          try {
            await api.post('/api/wallet/topup/verify', response);
            toast.success(`₹${amount} added to your wallet successfully!`);
            setTopupModal(false);
            fetchWallet();
          } catch (vErr) {
            toast.error(vErr.response?.data?.message || 'Top-up verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            toast.info('Top-up cancelled');
          }
        }
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate wallet top-up');
    } finally {
      setTopupLoading(false);
    }
  };

  const handleConvertPoints = async () => {
    if (walletData.rewardPoints < 10) {
      toast.error('Minimum 10 points required to convert.')
      return
    }
    if (await confirm(`Convert ${walletData.rewardPoints} points to ₹${(walletData.rewardPoints * 0.1).toFixed(2)} wallet balance?`)) {
      setWalletLoading(true)
      try {
        await api.post('/api/wallet/rewards/convert', { points: walletData.rewardPoints })
        toast.success('Points converted successfully!')
        fetchWallet()
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to convert points')
      } finally {
        setWalletLoading(false)
      }
    }
  }

  const handleCancelSubscription = async (id) => {
    try {
      await api.post('/api/subscriptions/cancel', { subscriptionId: id })
      toast.success('Subscription cancelled')
      fetchSubscriptions()
    } catch {
      toast.error('Failed to cancel')
    }
  }

  if (!user) return null

  // Filtered orders list
  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'all') return true
    if (orderFilter === 'pending') return !o.isPaid && !o.isDelivered && !['CANCELLED', 'FAILED'].includes(o.paymentStatus)
    if (orderFilter === 'paid') return o.isPaid && !o.isDelivered
    if (orderFilter === 'delivered') return o.isDelivered
    if (orderFilter === 'cancelled') return ['CANCELLED', 'FAILED'].includes(o.paymentStatus)
    return true
  })

  // Navigation Items definition
  const NAV_ITEMS = [
    { id: 'profile', label: 'Profile', icon: FiUser },
    { id: 'addresses', label: 'My Addresses', icon: FiMapPin, count: addresses.length },
    { id: 'orders', label: 'My Orders', icon: FiPackage, count: orders.length },
    { id: 'wallet', label: 'Wallet & Rewards', icon: FiCreditCard },
    { id: 'password', label: 'Change Password', icon: FiLock },
    { id: 'subscriptions', label: 'My Subscriptions', icon: FiRefreshCw, count: subscriptions.length },
    { id: 'logout', label: 'Sign Out', icon: FiLogOut, danger: true, action: () => { logout(); navigate('/') } },
  ]

  return (
    <div className="min-h-screen pb-16 bg-[var(--ivory)] font-sans text-brand-text">
      <Helmet>
        <title>
          {activeTab === 'addresses' ? 'My Addresses' : activeTab === 'orders' ? 'My Orders' : activeTab === 'wallet' ? 'Wallet & Rewards' : activeTab === 'password' ? 'Change Password' : activeTab === 'subscriptions' ? 'My Subscriptions' : 'My Profile'} — Daatasa
        </title>
      </Helmet>

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-brand-primary/10 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 py-8 sm:py-10 text-center">
          <span className="inline-block px-3.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full mb-2.5 bg-brand-primary/5 text-brand-primary">
            Account Dashboard
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-brand-primary">My Account</h1>
          <p className="text-sm sm:text-base mt-1.5 text-brand-text/60 font-medium">Manage your personal info, orders, addresses, and settings seamlessly</p>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Top Alignment for both columns */}
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 items-start">

          {/* ── Unified Left Sidebar Card (Compact Profile + Menu in ONE Card) ── */}
          <div className="rounded-[2rem] p-4 sm:p-5 shadow-sm bg-white border border-brand-primary/10 space-y-4 self-start sticky top-24">

            {/* User Mini Profile Header */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-[var(--ivory)] border border-brand-primary/5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold bg-brand-primary text-white shrink-0 shadow-sm">
                {user.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-bold font-display text-brand-primary truncate">{user.name}</p>
                <p className="text-[11px] text-brand-text/50 truncate">{hasRealEmail ? user.email : (user.phone || 'No email linked')}</p>
                <span className={`inline-block mt-0.5 px-2 py-0.2 text-[9px] font-bold rounded-full uppercase tracking-wider ${
                  user.role === 'admin' || user.role === 'superadmin'
                    ? 'bg-purple-100 text-purple-700'
                    : user.role === 'courier'
                      ? 'bg-blue-100 text-blue-700'
                    : 'bg-brand-primary/10 text-brand-primary'
                }`}>
                  {user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : user.role === 'courier' ? 'Courier' : 'Customer'}
                </span>
              </div>
            </div>

            <div className="h-px bg-brand-primary/5" />

            {/* Nav Menu List */}
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action || (() => handleTabChange(item.id))}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all text-left ${item.danger
                        ? 'text-red-500 hover:bg-red-50'
                        : isActive
                          ? 'bg-[var(--ivory)] text-brand-secondary shadow-sm border border-brand-secondary/30'
                          : 'text-brand-primary hover:bg-[var(--ivory)]/70'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        size={17}
                        className={item.danger ? 'text-red-500' : (isActive ? 'text-brand-secondary' : 'text-brand-text/40')}
                      />
                      <span>{item.label}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {typeof item.count === 'number' && item.count > 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive
                            ? 'bg-brand-secondary text-brand-primary'
                            : 'bg-brand-primary/5 text-brand-text/60'
                          }`}>
                          {item.count}
                        </span>
                      )}
                      {!isActive && !item.danger && (
                        <FiChevronRight size={15} className="text-brand-text/30" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Right Content Area (Dynamically Switches Without Page Reload) ── */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">

              {/* ═══════════════════════════════════════════════════════════
                 TAB 1: PROFILE / PERSONAL DETAILS
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'profile' && (
                <motion.div
                  key="tab-profile"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="rounded-[2rem] p-6 sm:p-8 lg:p-10 shadow-sm bg-white border border-brand-primary/10">
                    <h2 className="text-xl font-bold font-display text-brand-primary mb-8 flex items-center gap-3 border-b border-brand-primary/5 pb-4">
                      <FiUser size={20} className="text-brand-secondary" /> Personal Details
                    </h2>

                    <form onSubmit={handleProfileSubmit} className="space-y-5">
                      <div className="grid sm:grid-cols-2 gap-5">
                        <FloatingInput
                          id="name"
                          label="Full Name"
                          icon={FiUser}
                          required
                          value={name}
                          onChange={e => setName(e.target.value)}
                        />
                        <div>
                          <FloatingInput
                            id="phone"
                            label="Phone Number"
                            prefix={<span className="flex items-center gap-1"><span>🇮🇳</span><span>+91</span></span>}
                            placeholder="9876543210"
                            type="tel"
                            value={phone}
                            maxLength={10}
                            inputMode="numeric"
                            onChange={e => {
                              let val = e.target.value.replace(/\D/g, '')
                              if (val.startsWith('91') && val.length > 10) val = val.slice(2)
                              else if (val.startsWith('0') && val.length > 10) val = val.slice(1)
                              setPhone(val.slice(0, 10))
                            }}
                          />
                          {phone && !/^[6-9][0-9]{9}$/.test(phone) && phone.length === 10 && (
                            <p className="text-xs mt-1.5 flex items-center gap-1 text-red-500">
                              <FiAlertCircle size={12} /> Enter a valid 10-digit Indian mobile number
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ── Email Field & Management ── */}
                      <div>
                        {!editEmailMode ? (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                            <div className="flex-1">
                              <FloatingInput
                                id="email"
                                label={hasRealEmail ? "Email Address" : "Email Address (Not Linked)"}
                                icon={FiMail}
                                type="email"
                                disabled
                                value={hasRealEmail ? user.email : ''}
                                placeholder={hasRealEmail ? '' : 'No email linked with this account'}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditEmailMode(true)
                                setEmailOtpMode(false)
                                setNewEmail('')
                              }}
                              className="px-6 h-[52px] rounded-[1rem] font-bold text-sm bg-brand-secondary text-brand-primary hover:bg-brand-secondary/90 transition-all shadow-sm shrink-0"
                            >
                              {hasRealEmail ? 'Change Email' : 'Link Real Email'}
                            </button>
                          </div>
                        ) : !emailOtpMode ? (
                          <div className="bg-[var(--ivory)] rounded-2xl p-5 border border-brand-primary/10 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-brand-primary">
                                {hasRealEmail ? 'Update Email Address' : 'Link Your Email Address'}
                              </p>
                              <span className="text-[11px] text-brand-text/50">Verification code will be sent</span>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                              <div className="flex-1">
                                <FloatingInput
                                  id="newEmail"
                                  label="Enter Real Email Address"
                                  icon={FiMail}
                                  type="email"
                                  value={newEmail}
                                  placeholder="e.g. name@example.com"
                                  onChange={e => setNewEmail(e.target.value)}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleSendEmailOtp}
                                disabled={emailUpdateLoading || !newEmail.includes('@')}
                                className="btn btn-primary px-6 h-[52px] rounded-[1rem] font-bold text-sm flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                              >
                                {emailUpdateLoading ? 'Sending OTP...' : 'Send OTP'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditEmailMode(false)
                                  setNewEmail('')
                                }}
                                className="px-4 h-[52px] rounded-[1rem] font-bold text-sm text-brand-text/50 hover:bg-brand-primary/5 shrink-0"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-brand-primary/5 rounded-2xl p-6 border border-brand-primary/10">
                            <p className="text-sm font-bold text-brand-primary mb-4 flex items-center gap-2">
                              <FiMail /> Enter 6-digit OTP sent to <span className="underline font-mono">{newEmail}</span>
                            </p>
                            <div className="flex items-center gap-2 mb-6">
                              {[0, 1, 2, 3, 4, 5].map((_, index) => (
                                <input
                                  key={index}
                                  id={`eotp-${index}`}
                                  type="text"
                                  maxLength={1}
                                  inputMode="numeric"
                                  value={emailOtp[index]}
                                  onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '')
                                    const newOtp = [...emailOtp]
                                    newOtp[index] = val
                                    setEmailOtp(newOtp)
                                    if (val && index < 5) document.getElementById(`eotp-${index + 1}`)?.focus()
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Backspace' && !emailOtp[index] && index > 0) {
                                      document.getElementById(`eotp-${index - 1}`)?.focus()
                                    }
                                  }}
                                  className="w-11 sm:w-12 h-12 text-center rounded-xl border border-brand-primary/20 text-brand-primary font-bold outline-none focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary bg-white text-lg shadow-sm"
                                />
                              ))}
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={handleVerifyEmailOtp}
                                disabled={emailUpdateLoading || emailOtp.join('').length !== 6}
                                className="btn btn-primary px-6 h-12 rounded-xl font-bold text-sm"
                              >
                                {emailUpdateLoading ? 'Verifying...' : 'Verify & Save Email'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEmailOtpMode(false)}
                                className="px-4 h-12 rounded-xl font-bold text-sm text-brand-text/50 hover:bg-brand-primary/5"
                              >
                                Change Email
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end pt-4">
                        <button
                          type="submit"
                          disabled={profLoading}
                          className="btn btn-primary px-10 h-13 rounded-full flex items-center justify-center gap-2 font-bold shadow-lg shadow-gold/20 hover:shadow-gold/40 transition-all"
                        >
                          {profLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                 TAB 2: MY ADDRESSES
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'addresses' && (
                <motion.div
                  key="tab-addresses"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="rounded-[2rem] p-6 sm:p-8 lg:p-10 shadow-sm bg-white border border-brand-primary/10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-brand-primary/5 pb-4">
                      <div>
                        <h2 className="text-xl font-bold font-display text-brand-primary flex items-center gap-3">
                          <FiMapPin size={20} className="text-brand-secondary" /> Saved Delivery Addresses
                        </h2>
                        <p className="text-xs sm:text-sm text-brand-text/60 mt-1">Manage your home, work, and other delivery addresses</p>
                      </div>

                      {!showAddrForm && (
                        <button
                          type="button"
                          onClick={() => {
                            setAddrForm(emptyAddr)
                            setEditAddrId(null)
                            setShowAddrForm(true)
                            setPinError('')
                          }}
                          className="btn btn-primary px-6 h-11 rounded-full flex items-center justify-center gap-2 text-sm font-bold shadow-md shadow-gold/20 shrink-0"
                        >
                          <FiPlus size={16} /> Add Address
                        </button>
                      )}
                    </div>

                    {/* Address Form (Add / Edit) */}
                    <AnimatePresence>
                      {showAddrForm && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="rounded-[1.5rem] p-6 mb-8 bg-[var(--ivory)] border border-brand-primary/10 overflow-hidden"
                        >
                          <div className="flex items-center justify-between mb-6 border-b border-brand-primary/5 pb-3">
                            <h3 className="text-base font-bold text-brand-primary">
                              {editAddrId ? 'Edit Address' : 'New Address'}
                            </h3>
                            <button
                              type="button"
                              onClick={() => { setShowAddrForm(false); setEditAddrId(null) }}
                              className="text-brand-text/40 hover:text-red-500 transition-colors p-1"
                            >
                              <FiX size={20} />
                            </button>
                          </div>

                          <form onSubmit={handleAddrSubmit} className="space-y-4">
                            <div>
                              <label className="block text-sm font-semibold mb-2.5 text-brand-text/70">Address Type</label>
                              <div className="flex gap-3">
                                {['Home', 'Work', 'Other'].map(l => (
                                  <button
                                    key={l}
                                    type="button"
                                    onClick={() => setAddrForm(p => ({ ...p, label: l }))}
                                    className={`flex-1 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all ${addrForm.label === l
                                        ? 'bg-brand-primary text-white shadow-sm'
                                        : 'bg-white text-brand-text/60 border border-brand-primary/10 hover:border-brand-primary/30'
                                      }`}
                                  >
                                    {l}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                              <FloatingInput
                                id="addr_name"
                                label="Recipient Name*"
                                icon={FiUser}
                                required
                                value={addrForm.name}
                                onChange={e => setAddrForm(p => ({ ...p, name: e.target.value }))}
                              />
                              <div>
                                <FloatingInput
                                  id="addr_phone"
                                  label="Phone Number*"
                                  prefix={<span className="flex items-center gap-1"><span>🇮🇳</span><span>+91</span></span>}
                                  placeholder="9876543210"
                                  type="tel"
                                  required
                                  maxLength={10}
                                  inputMode="numeric"
                                  value={addrForm.phone}
                                  onChange={e => {
                                    let val = e.target.value.replace(/\D/g, '')
                                    if (val.startsWith('91') && val.length > 10) val = val.slice(2)
                                    else if (val.startsWith('0') && val.length > 10) val = val.slice(1)
                                    setAddrForm(p => ({ ...p, phone: val.slice(0, 10) }))
                                  }}
                                />
                                {addrForm.phone && !/^[6-9][0-9]{9}$/.test(addrForm.phone) && addrForm.phone.length === 10 && (
                                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <FiAlertCircle size={11} /> Invalid 10-digit number
                                  </p>
                                )}
                              </div>
                            </div>

                            <FloatingInput
                              id="addr_street"
                              label="Street Address (Flat, House No., Building, Area)*"
                              icon={FiMapPin}
                              required
                              value={addrForm.street}
                              onChange={e => setAddrForm(p => ({ ...p, street: e.target.value }))}
                            />

                            <div className="grid sm:grid-cols-2 gap-4">
                              <div>
                                <FloatingInput
                                  id="addr_pin"
                                  label="PIN Code (Auto-fills City & State)*"
                                  required
                                  maxLength={6}
                                  inputMode="numeric"
                                  value={addrForm.zipCode}
                                  onChange={e => handlePinChange(e.target.value)}
                                  rightElement={pinLoading ? <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /> : null}
                                />
                                {pinError && (
                                  <p className="text-xs text-amber-600 mt-1">{pinError}</p>
                                )}
                              </div>

                              <FloatingInput
                                id="addr_city"
                                label="City / Town*"
                                required
                                value={addrForm.city}
                                onChange={e => setAddrForm(p => ({ ...p, city: e.target.value }))}
                              />
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                              <FloatingInput
                                id="addr_state"
                                label="State*"
                                required
                                value={addrForm.state}
                                onChange={e => setAddrForm(p => ({ ...p, state: e.target.value }))}
                              />

                              <FloatingInput
                                id="addr_district"
                                label="District"
                                value={addrForm.district}
                                onChange={e => setAddrForm(p => ({ ...p, district: e.target.value }))}
                              />
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                              <input
                                id="addr_def"
                                type="checkbox"
                                checked={addrForm.isDefault}
                                onChange={e => setAddrForm(p => ({ ...p, isDefault: e.target.checked }))}
                                className="w-4 h-4 text-brand-secondary rounded accent-brand-secondary"
                              />
                              <label htmlFor="addr_def" className="text-xs sm:text-sm font-semibold text-brand-text/70 cursor-pointer">
                                Set as my default delivery address
                              </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-brand-primary/10">
                              <button
                                type="button"
                                onClick={() => { setShowAddrForm(false); setEditAddrId(null) }}
                                className="px-5 py-2.5 rounded-full text-sm font-bold text-brand-text/60 hover:bg-brand-primary/5"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={addrLoading}
                                className="btn btn-primary px-8 h-12 rounded-full text-sm font-bold"
                              >
                                {addrLoading ? 'Saving...' : editAddrId ? 'Update Address' : 'Save Address'}
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Saved Addresses List */}
                    {addresses.length === 0 && !showAddrForm ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-brand-primary/5 text-brand-primary/40">
                          <FiMapPin size={28} />
                        </div>
                        <h3 className="text-lg font-bold font-display text-brand-primary mb-2">No saved addresses</h3>
                        <p className="text-sm text-brand-text/50 max-w-sm mx-auto mb-6">Add a delivery address to ensure fast and smooth checkout on future orders.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setAddrForm(emptyAddr)
                            setEditAddrId(null)
                            setShowAddrForm(true)
                          }}
                          className="btn btn-primary px-6 h-11 rounded-full text-sm font-bold"
                        >
                          <FiPlus size={16} /> Add Your First Address
                        </button>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4">
                        {addresses.map((addr) => (
                          <div
                            key={addr._id}
                            className={`rounded-[1.5rem] p-5 border transition-all flex flex-col justify-between relative ${addr.isDefault
                                ? 'bg-brand-secondary/5 border-brand-secondary/40 shadow-sm'
                                : 'bg-[var(--ivory)] border-brand-primary/10 hover:border-brand-primary/30'
                              }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-brand-primary text-white">
                                  {addr.label || 'Home'}
                                </span>
                                {addr.isDefault && (
                                  <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-brand-secondary/20 text-brand-primary border border-brand-secondary/30">
                                    Default
                                  </span>
                                )}
                              </div>

                              <p className="font-bold text-brand-primary text-base mb-1">{addr.name}</p>
                              <p className="text-xs font-semibold text-brand-text/60 mb-2 flex items-center gap-1.5">
                                <FiPhone size={12} /> {addr.phone}
                              </p>
                              <p className="text-xs text-brand-text/70 leading-relaxed">
                                {addr.street}, {addr.city}, {addr.state} - <strong>{addr.zipCode}</strong>
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-4 mt-4 border-t border-brand-primary/10">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddrForm(addr)
                                    setEditAddrId(addr._id)
                                    setShowAddrForm(true)
                                    setPinError('')
                                  }}
                                  className="p-2 rounded-lg text-brand-text/60 hover:text-brand-primary hover:bg-brand-primary/5 transition-colors"
                                  title="Edit Address"
                                >
                                  <FiEdit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAddress(addr._id)}
                                  className="p-2 rounded-lg text-brand-text/60 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="Delete Address"
                                >
                                  <FiTrash2 size={15} />
                                </button>
                              </div>

                              {!addr.isDefault && (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefault(addr._id)}
                                  className="text-xs font-bold text-brand-secondary hover:underline"
                                >
                                  Set as Default
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                 TAB 3: MY ORDERS
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'orders' && (
                <motion.div
                  key="tab-orders"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="rounded-[2rem] p-6 sm:p-8 lg:p-10 shadow-sm bg-white border border-brand-primary/10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-brand-primary/5 pb-4">
                      <div>
                        <h2 className="text-xl font-bold font-display text-brand-primary flex items-center gap-3">
                          <FiPackage size={20} className="text-brand-secondary" /> My Orders History
                        </h2>
                        <p className="text-xs sm:text-sm text-brand-text/60 mt-1">Track current orders, request returns, or download invoices</p>
                      </div>

                      {/* Filter pills */}
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'all', label: 'All' },
                          { id: 'pending', label: 'Pending' },
                          { id: 'paid', label: 'Processing' },
                          { id: 'delivered', label: 'Delivered' },
                          { id: 'cancelled', label: 'Cancelled' },
                        ].map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setOrderFilter(f.id)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${orderFilter === f.id
                                ? 'bg-brand-primary text-white shadow-sm'
                                : 'bg-[var(--ivory)] text-brand-text/60 hover:text-brand-primary'
                              }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Orders Content */}
                    {ordersLoading ? (
                      <div className="py-16 text-center">
                        <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-xs font-bold text-brand-text/50">Loading orders...</p>
                      </div>
                    ) : filteredOrders.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-brand-primary/5 text-brand-primary/40">
                          <FiPackage size={28} />
                        </div>
                        <h3 className="text-lg font-bold font-display text-brand-primary mb-2">No orders found</h3>
                        <p className="text-sm text-brand-text/50 max-w-xs mx-auto mb-6">You haven't placed any orders matching this filter yet.</p>
                        <Link to="/products" className="btn btn-primary px-6 h-11 rounded-full text-sm font-bold inline-flex items-center gap-2">
                          Browse Pure Ghee <FiArrowRight size={15} />
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredOrders.map(order => {
                          const isExp = expandedOrder === order._id
                          const isDelivered = order.isDelivered
                          const isCancelled = ['CANCELLED', 'FAILED'].includes(order.paymentStatus)
                          const canCancel = !isDelivered && !isCancelled
                          const canReturn = isDelivered && !order.returnRequest && (Date.now() - new Date(order.deliveredAt).getTime()) / (1000 * 60 * 60 * 24) <= 7

                          return (
                            <div
                              key={order._id}
                              className={`rounded-[1.5rem] border transition-all overflow-hidden bg-white ${isExp ? 'border-brand-primary shadow-md' : 'border-brand-primary/10 hover:border-brand-primary/25'
                                }`}
                            >
                              {/* Order Summary Row */}
                              <div
                                onClick={() => setExpandedOrder(isExp ? null : order._id)}
                                className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer bg-[var(--ivory)]/40 hover:bg-[var(--ivory)]"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-extrabold font-mono text-brand-primary">
                                      #{formatOrderId(order)}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDelivered
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isCancelled
                                          ? 'bg-red-100 text-red-700'
                                          : (order.orderStatus === 'ACCEPTED' || order.acceptedAt)
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-amber-100 text-amber-800'
                                      }`}>
                                      {isDelivered ? 'Delivered' : isCancelled ? 'Cancelled' : (order.orderStatus === 'ACCEPTED' || order.acceptedAt) ? 'Confirmed' : 'Order Placed'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-brand-text/50">
                                    Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {order.orderItems?.length || 0} item(s)
                                  </p>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-5">
                                  <div className="text-right">
                                    <p className="text-xs text-brand-text/40 font-bold uppercase">Total</p>
                                    <p className="text-base font-extrabold font-display text-brand-primary">₹{Number(order.totalPrice).toFixed(2)}</p>
                                  </div>
                                  <FiChevronDown size={18} className={`text-brand-text/40 transition-transform duration-200 ${isExp ? 'rotate-180 text-brand-primary' : ''}`} />
                                </div>
                              </div>

                              {/* Expanded Order Details */}
                              {isExp && (
                                <div className="p-6 border-t border-brand-primary/10 space-y-6">
                                  {/* Order Timeline */}
                                  <div className="bg-white rounded-2xl p-4 border border-brand-primary/5">
                                    <OrderTimeline order={order} />
                                  </div>

                                  {/* Order Items */}
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-text/50">Items in this order</h4>
                                    <div className="divide-y divide-brand-primary/5">
                                      {order.orderItems?.map((item, idx) => (
                                        <div key={idx} className="py-3 flex items-center justify-between gap-4">
                                          <div className="flex items-center gap-3.5">
                                            <img
                                              src={item.image || '/matka.png'}
                                              alt={item.name}
                                              className="w-14 h-14 object-cover rounded-xl border border-brand-primary/10 bg-white"
                                            />
                                            <div>
                                              <p className="text-sm font-bold text-brand-primary">{item.name}</p>
                                              <p className="text-xs text-brand-text/50">Qty: {item.quantity} × ₹{item.price}</p>
                                            </div>
                                          </div>

                                          {isDelivered && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setReviewModal({
                                                  productId: item.product?._id || item.product,
                                                  name: item.name,
                                                  image: item.image,
                                                })
                                              }}
                                              className="px-3.5 py-1.5 rounded-full border border-brand-secondary/40 text-brand-secondary hover:bg-brand-secondary/10 text-xs font-bold flex items-center gap-1.5 transition-colors"
                                            >
                                              <FiStar size={13} /> Rate Product
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-brand-primary/10">
                                    <div className="flex items-center gap-2">
                                      {/* Invoice Download */}
                                      <button
                                        type="button"
                                        onClick={() => printInvoice(order)}
                                        disabled={printingInvoice === order._id}
                                        className="px-4 py-2 rounded-full border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/5 text-xs font-bold flex items-center gap-1.5 transition-colors"
                                      >
                                        <FiPrinter size={14} />
                                        {printingInvoice === order._id ? 'Downloading...' : 'Invoice'}
                                      </button>

                                      {/* Reorder */}
                                      <button
                                        type="button"
                                        onClick={() => handleReorder(order)}
                                        disabled={reordering === order._id}
                                        className="btn btn-primary px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5"
                                      >
                                        <FiRefreshCw size={13} />
                                        {reordering === order._id ? 'Adding...' : 'Reorder'}
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {/* Cancel Button */}
                                      {canCancel && (
                                        <button
                                          type="button"
                                          onClick={() => setCancelModal(order)}
                                          className="px-4 py-2 rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
                                        >
                                          Cancel Order
                                        </button>
                                      )}

                                      {/* Return Button */}
                                      {canReturn && (
                                        <button
                                          type="button"
                                          onClick={() => setReturnModal(order)}
                                          className="px-4 py-2 rounded-full border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-bold transition-colors"
                                        >
                                          Request Return
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                 TAB 4: WALLET & REWARDS
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'wallet' && (
                <motion.div
                  key="tab-wallet"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="rounded-[2rem] p-6 sm:p-8 lg:p-10 shadow-sm bg-white border border-brand-primary/10">
                    <h2 className="text-xl font-bold font-display text-brand-primary mb-8 flex items-center gap-3 border-b border-brand-primary/5 pb-4">
                      <FiCreditCard size={20} className="text-brand-secondary" /> Wallet & Reward Points
                    </h2>

                    <div className="grid sm:grid-cols-2 gap-6 mb-8">
                      <div className="bg-[var(--ivory)] border border-brand-primary/10 rounded-[1.5rem] p-6 text-center flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold text-brand-text/60 mb-1 uppercase tracking-wider">Wallet Balance</p>
                          <p className="text-3xl sm:text-4xl font-display font-bold text-brand-primary">₹{walletData.walletBalance.toFixed(2)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTopupModal(true)}
                          className="mt-4 px-5 py-2 bg-brand-primary text-white text-xs font-bold rounded-full hover:bg-brand-primary/90 transition-colors shadow-sm inline-flex items-center justify-center gap-1.5 self-center"
                        >
                          <FiPlus size={14} /> Add Money to Wallet
                        </button>
                      </div>

                      <div className="bg-brand-secondary/10 border border-brand-secondary/20 rounded-[1.5rem] p-6 text-center flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold text-brand-text/60 mb-1 uppercase tracking-wider">Reward Points</p>
                          <p className="text-3xl sm:text-4xl font-display font-bold text-brand-secondary">{walletData.rewardPoints}</p>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={handleConvertPoints}
                            disabled={walletLoading || walletData.rewardPoints < 10}
                            className="mt-3 px-4 py-1.5 bg-white text-brand-primary text-xs font-bold rounded-full border border-brand-primary/10 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
                          >
                            {walletLoading ? 'Converting...' : 'Convert to ₹'}
                          </button>
                          <p className="text-[10px] text-brand-text/50 mt-1.5 font-medium">10 Points = ₹1 wallet cash</p>
                        </div>
                      </div>
                    </div>

                    {/* ── Wallet Passbook (Transaction History) ── */}
                    <div className="border border-brand-primary/10 rounded-2xl overflow-hidden mb-8">
                      <div className="bg-gray-50 px-5 py-3.5 border-b border-brand-primary/10 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2">
                          <FiClock size={14} /> Wallet Passbook & Transactions
                        </h3>
                        <span className="text-[11px] font-medium text-brand-text/50">
                          {walletData.transactions?.length || 0} transaction{walletData.transactions?.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {walletData.transactions && walletData.transactions.length > 0 ? (
                        <div className="divide-y divide-brand-primary/5 max-h-96 overflow-y-auto">
                          {walletData.transactions.map((tx) => {
                            const isCredit = tx.type === 'CREDIT';
                            return (
                              <div key={tx._id} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                    isCredit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {isCredit ? '+' : '−'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-brand-primary text-sm">{tx.description || tx.transactionType}</p>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                        tx.transactionType === 'REFUND' ? 'bg-amber-100 text-amber-800' :
                                        tx.transactionType === 'TOPUP' ? 'bg-blue-100 text-blue-800' :
                                        tx.transactionType === 'PURCHASE' ? 'bg-gray-100 text-gray-700' :
                                        'bg-purple-100 text-purple-800'
                                      }`}>
                                        {tx.transactionType}
                                      </span>
                                    </div>
                                    <p className="text-xs text-brand-text/50 font-medium mt-0.5">
                                      {new Date(tx.createdAt).toLocaleString('en-IN', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                      })} • Balance: ₹{Number(tx.balanceAfter || 0).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={`text-base font-extrabold font-display ${
                                    isCredit ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {isCredit ? '+' : '−'}₹{Number(tx.amount || 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-brand-text/50 text-xs font-medium">
                          No wallet transactions yet. Top up your wallet to make instant 1-click checkouts!
                        </div>
                      )}
                    </div>

                    {/* Refer & Earn Card */}
                    {user.referralCode && (
                      <div className="bg-gradient-to-r from-[#132B69] via-[#1B2F6E] to-[#0F2254] rounded-[1.5rem] p-6 sm:p-8 text-white shadow-lg relative overflow-hidden mb-8">
                        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                          <div>
                            <h3 className="text-lg sm:text-xl font-bold font-display flex items-center gap-2 mb-2 text-brand-secondary">
                              <FiShare2 /> Refer Friends & Earn ₹50!
                            </h3>
                            <p className="text-xs sm:text-sm text-white/80 leading-relaxed max-w-md">
                              Share your referral code with friends. When they register and complete their first order, you both receive ₹50 in your wallet.
                            </p>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/20">
                            <span className="text-lg sm:text-xl font-bold font-mono px-4 tracking-wider">{user.referralCode}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/register?ref=${user.referralCode}`)
                                toast.success('Referral link copied to clipboard!')
                              }}
                              className="w-10 h-10 flex items-center justify-center bg-white text-brand-primary rounded-xl hover:bg-brand-secondary transition-colors"
                              title="Copy Referral Link"
                            >
                              <FiCopy size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* My Referrals List */}
                    {referrals.length > 0 && (
                      <div className="border border-brand-primary/10 rounded-2xl overflow-hidden">
                        <div className="bg-gray-50 px-5 py-3.5 border-b border-brand-primary/10">
                          <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider">Referral History</h3>
                        </div>
                        <div className="divide-y divide-brand-primary/5">
                          {referrals.map(ref => (
                            <div key={ref._id} className="p-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="font-bold text-brand-primary text-sm">{ref.name}</p>
                                <p className="text-xs text-brand-text/50 font-medium">Joined: {new Date(ref.joinedAt).toLocaleDateString()}</p>
                              </div>
                              <div>
                                {ref.status === 'Completed' ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-200">
                                    Rewarded (+₹50)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                                    Pending First Order
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                 TAB 5: CHANGE PASSWORD
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'password' && (
                <motion.div
                  key="tab-password"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="rounded-[2rem] p-6 sm:p-8 lg:p-10 shadow-sm bg-white border border-brand-primary/10">
                    <h2 className="text-xl font-bold font-display text-brand-primary mb-8 flex items-center gap-3 border-b border-brand-primary/5 pb-4">
                      <FiLock size={20} className="text-brand-secondary" /> Change Account Password
                    </h2>

                    <form onSubmit={handlePasswordSubmit} className="space-y-5 max-w-md">
                      <FloatingInput
                        id="old_pass"
                        label="Current Password*"
                        type={showOld ? 'text' : 'password'}
                        icon={FiLock}
                        required
                        value={oldPassword}
                        onChange={e => setOldPassword(e.target.value)}
                        rightElement={
                          <button
                            type="button"
                            onClick={() => setShowOld(!showOld)}
                            className="text-gray-400 hover:text-brand-primary p-1 transition-colors"
                          >
                            {showOld ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                          </button>
                        }
                      />

                      <FloatingInput
                        id="new_pass"
                        label="New Password (min 8 characters)*"
                        type={showNew ? 'text' : 'password'}
                        icon={FiLock}
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        rightElement={
                          <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="text-gray-400 hover:text-brand-primary p-1 transition-colors"
                          >
                            {showNew ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                          </button>
                        }
                      />

                      <FloatingInput
                        id="conf_pass"
                        label="Confirm New Password*"
                        type={showConfirm ? 'text' : 'password'}
                        icon={FiLock}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        rightElement={
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="text-gray-400 hover:text-brand-primary p-1 transition-colors"
                          >
                            {showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                          </button>
                        }
                      />

                      <div className="pt-3">
                        <button
                          type="submit"
                          disabled={passLoading}
                          className="btn btn-primary px-8 h-13 rounded-full text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
                        >
                          {passLoading ? 'Updating Password...' : 'Update Password'}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                 TAB 6: MY SUBSCRIPTIONS
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'subscriptions' && (
                <motion.div
                  key="tab-subscriptions"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="rounded-[2rem] p-6 sm:p-8 lg:p-10 shadow-sm bg-white border border-brand-primary/10">
                    <h2 className="text-xl font-bold font-display text-brand-primary mb-8 flex items-center gap-3 border-b border-brand-primary/5 pb-4">
                      <FiRefreshCw size={20} className="text-brand-secondary" /> My Subscriptions
                    </h2>

                    {subscriptions.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-brand-primary/5 text-brand-primary/40">
                          <FiRefreshCw size={28} />
                        </div>
                        <h3 className="text-lg font-bold font-display text-brand-primary mb-2">No active subscriptions</h3>
                        <p className="text-sm text-brand-text/50 max-w-sm mx-auto mb-6">Enjoy automatic weekly or monthly deliveries of pure Vedic ghee with exclusive subscription discounts.</p>
                        <Link to="/products" className="btn btn-primary px-6 h-11 rounded-full text-sm font-bold inline-flex items-center gap-2">
                          Subscribe & Save 10%
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {subscriptions.map(sub => (
                          <div
                            key={sub._id}
                            className="p-5 sm:p-6 rounded-[1.5rem] border border-brand-primary/10 bg-[var(--ivory)] flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between"
                          >
                            <div className="flex gap-4 items-center">
                              <img
                                src={sub.plan?.product?.image || sub.plan?.product?.images?.[0] || '/matka.png'}
                                alt=""
                                className="w-16 h-16 object-contain bg-white rounded-2xl p-2 border border-brand-primary/10"
                              />
                              <div>
                                <p className="text-base font-bold font-display text-brand-primary">{sub.plan?.name}</p>
                                <p className="text-xs font-semibold text-brand-text/60 mt-0.5">₹{sub.plan?.price} / {sub.plan?.period}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase ${sub.status === 'active' || sub.status === 'authenticated'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-200 text-gray-600'
                                    }`}>
                                    {sub.status}
                                  </span>
                                  {sub.nextBillingDate && sub.status === 'active' && (
                                    <span className="text-xs font-bold text-brand-text/40 flex items-center gap-1">
                                      <FiClock size={11} /> Next bill: {new Date(sub.nextBillingDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {sub.status === 'active' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (await confirm('Are you sure you want to cancel this subscription?')) {
                                    handleCancelSubscription(sub._id)
                                  }
                                }}
                                className="px-4 py-2 rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
                              >
                                Cancel Subscription
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {reviewModal && (
          <ReviewModal
            item={reviewModal}
            onClose={() => setReviewModal(null)}
            onSubmitted={() => { }}
          />
        )}
        {cancelModal && (
          <CancelModal
            order={cancelModal}
            onClose={() => setCancelModal(null)}
            onConfirm={handleCancelOrder}
            loading={cancelLoading}
          />
        )}
        {returnModal && (
          <ReturnModal
            order={returnModal}
            onClose={() => setReturnModal(null)}
            onConfirm={handleReturnRequest}
            loading={returnLoading}
          />
        )}
        {topupModal && (
          <TopupModal
            isOpen={topupModal}
            onClose={() => setTopupModal(false)}
            onTopup={handleWalletTopup}
            loading={topupLoading}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Profile
