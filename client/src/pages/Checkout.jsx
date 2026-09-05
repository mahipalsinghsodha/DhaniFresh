import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useCart, getCartItemDetails } from '../context/CartContext'
import { toast } from 'react-toastify'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiMapPin, FiCreditCard, FiShield, FiTruck,
  FiArrowRight, FiHome, FiBriefcase,
  FiCheck, FiAlertCircle, FiEdit2, FiLock, FiBox
} from 'react-icons/fi'

const STATES = [
  'Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar',
  'Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka',
  'Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya',
  'Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
]

const emptyNew = { name:'', email:'', phone:'', street:'', city:'', district:'', state:'', zipCode:'', country:'India' }

const StepHeader = ({ num, title, sub, active }) => (
  <div className="px-8 py-6 border-b border-brand-primary/5 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
      active ? 'bg-brand-primary text-white shadow-md' : 'bg-brand-primary/5 text-brand-text/40'
    }`}>
      {num}
    </div>
    <div>
      <h3 className="text-lg font-bold font-display text-brand-primary">{title}</h3>
      <p className="text-sm font-medium text-brand-text/60">{sub}</p>
    </div>
  </div>
)

const Checkout = () => {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { fetchCartCount, clearCart } = useCart()

  const [cart, setCart]               = useState(null)
  const { items: cartItems }          = useCart()
  const [loading, setLoading]         = useState(false)
  const [paymentMethod, setPayment]   = useState(user ? 'COD' : 'Online')
  const [savedAddresses, setSaved]    = useState([])
  const [selectedAddrId, setSelAddr]  = useState(null)
  const [showNewForm, setShowNew]     = useState(false)
  const [newAddr, setNewAddr]         = useState(emptyNew)
  const [saveNewAddr, setSaveNew]     = useState(true)
  const [couponCode, setCoupon]       = useState('')
  const [appliedCoupon, setApplied]   = useState(null)
  const [couponLoading, setCouponL]   = useState(false)
  
  const [giftCardCode, setGiftCard]     = useState('')
  const [appliedGiftCard, setAppliedGC] = useState(null)
  const [gcLoading, setGcLoading]       = useState(false)

  const [stockModal, setStockModal]   = useState(null)
  const [pinLoading, setPinL]         = useState(false)
  const [pinError, setPinErr]         = useState('')
  const [preview, setPreview]         = useState(null)
  const [previewLoad, setPreviewLoad] = useState(false)
  const [useWallet, setUseWallet]     = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)

  // Memoize guestCartItems string for dependency arrays
  const guestCartStr = !user ? JSON.stringify(cartItems) : '[]';

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      toast.info('Please log in to complete your checkout', { toastId: 'login_redirect' });
      navigate('/login', { state: { from: '/checkout' }, replace: true });
      return;
    }

    fetchCart(); 
    fetchAddresses();
    api.get('/api/wallet').then(res => setWalletBalance(res.data.walletBalance)).catch(console.error)

    const cleanPhone = (user.phone || '').replace(/\D/g, '').slice(-10);
    setNewAddr(prev => ({
      ...prev,
      name: user.name || prev.name,
      phone: cleanPhone || prev.phone,
      email: user.email ? user.email : prev.email
    }));

    if (location.state?.couponCode) {
      const code = location.state.couponCode
      setCoupon(code)
      setCouponL(true)
      
      const guestCartItems = !user ? JSON.parse(guestCartStr) : undefined;
      
      api.post('/api/orders/verify-coupon', { couponCode: code, guestCartItems })
        .then(res => {
          const coupon = res.data.coupon
          const bd = res.data.breakdown
          setApplied(coupon)
          setPreview(prev => ({
            ...prev,
            discount: coupon.discountAmount,
            taxPrice: bd.taxPrice,
            shippingPrice: bd.shippingPrice,
            totalPrice: bd.totalPrice
          }))
          toast.success("Coupon auto-applied from cart!")
        })
        .catch(() => {
          setApplied(null)
          setCoupon('')
        })
        .finally(() => setCouponL(false))
    }
  }, [user, location.state])

  const fetchCart = async () => {
    try {
      if (user) {
        const res = await api.get('/api/cart')
        setCart(res.data)
        if (res.data.items.length === 0) { navigate('/cart'); return }
      } else {
        const parsedItems = JSON.parse(guestCartStr);
        setCart({ items: parsedItems })
        if (parsedItems.length === 0) { navigate('/cart'); return }
      }
      fetchPreview()
    } catch(e) { console.error(e) }
  }

  const fetchPreview = async (couponDiscount = 0) => {
    setPreviewLoad(true)
    try {
      const guestCartItems = !user ? JSON.parse(guestCartStr) : undefined;
      const res = await api.post('/api/orders/price-preview', { guestCartItems })
      const p = res.data
      if (couponDiscount > 0) {
        const after = Math.max(0, p.itemsPrice - couponDiscount)
        const tax = after * (p.gstRate / 100)
        const ship = after > (p.freeShippingThreshold || 500) ? 0 : (p.shippingPrice || 50)
        setPreview({ ...p, discount: couponDiscount, taxPrice: tax, shippingPrice: ship, totalPrice: after + tax + ship })
      } else { setPreview({ ...p, discount: 0 }) }
    } catch(e) { console.error(e) } finally { setPreviewLoad(false) }
  }

  const fetchAddresses = async () => {
    try {
      const res = await api.get('/api/auth/me')
      const addrs = res.data.addresses || []
      setSaved(addrs)
      const def = addrs.find(a => a.isDefault) || addrs[addrs.length - 1]
      if (def) setSelAddr(String(def._id))
    } catch(e) { console.error(e) }
  }

  const handlePin = async (val) => {
    const c = val.replace(/\D/g,'').slice(0,6)
    setPinErr(''); setNewAddr(p => ({ ...p, zipCode: c }))
    if (c.length === 6) {
      setPinL(true)
      try {
        const res = await api.get(`/api/pincode/${c}`)
        const data = res.data
        if (data[0]?.Status === 'Success' && data[0].PostOffice?.length) {
          const po = data[0].PostOffice[0]
          setNewAddr(p => ({ ...p, zipCode: c, state: po.State, district: po.District, city: po.Division || po.District }))
        } else { setPinErr('PIN not found — fill manually') }
      } catch { setPinErr('Could not fetch PIN') } finally { setPinL(false) }
    }
  }

  const getAddr = () => {
    if (showNewForm || savedAddresses.length === 0) return newAddr
    return savedAddresses.find(a => String(a._id) === selectedAddrId) || newAddr
  }

  const placeOrder = async () => {
    const shippingAddress = getAddr()
    if (showNewForm && saveNewAddr && user) await api.post('/api/auth/addresses', { ...newAddr, isDefault: savedAddresses.length === 0 })
    
    // For guest checkout, pull email from shipping address
    const guestEmail = !user ? shippingAddress.email : null;
    const guestCartItems = !user ? JSON.parse(guestCartStr) : undefined;
    
    const payload = { shippingAddress, paymentMethod, couponCode: appliedCoupon?.code || null, giftCardCode: appliedGiftCard?.code || null, guestEmail, guestCartItems, useWallet }
    
    // Calculate final total on frontend to check if online payment is needed
    let finalTotal = preview?.totalPrice || 0
    if (useWallet && walletBalance > 0) finalTotal = Math.max(0, finalTotal - walletBalance)
    if (appliedGiftCard) finalTotal = Math.max(0, finalTotal - appliedGiftCard.balance)

    if (paymentMethod === 'COD' || finalTotal === 0) {
      await api.post('/api/orders', payload); 
      clearCart();
      fetchCartCount();
      toast.success('Order placed successfully!'); 
      navigate('/orders');
    } else { await startOnlinePayment(payload) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    // Validate address before opening Razorpay or placing order
    const addr = getAddr()
    if (!addr.name?.trim() || !addr.street?.trim() || !addr.city?.trim() || !addr.zipCode?.trim() || !addr.state?.trim() || (!user && !addr.email?.trim())) {
      toast.error('Please fill in all required delivery details (including email for guests)')
      setLoading(false); return
    }

    const phoneDigits = String(addr.phone || '').replace(/\D/g, '').slice(-10)
    if (!/^[6-9][0-9]{9}$/.test(phoneDigits)) {
      toast.error('Please enter a valid 10-digit Indian mobile number')
      setLoading(false); return
    }

    // Calculate final total to see if COD is really required (not fully paid by wallet)
    let finalTotal = preview?.totalPrice || 0
    if (useWallet && walletBalance > 0) finalTotal = Math.max(0, finalTotal - walletBalance)
    if (appliedGiftCard) finalTotal = Math.max(0, finalTotal - appliedGiftCard.balance)

    try { await placeOrder() } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.allItems) {
        setStockModal(err.response.data.allItems)
      } else {
        toast.error(err.response?.data?.message || 'Failed to place order')
      }
    } finally { setLoading(false) }
  }

  const startOnlinePayment = async (payload) => {
    const { data } = await api.post('/api/orders', payload)
    const { order, razorpayOrder: rzrOrder } = data;

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (!razorpayKey) {
      toast.error('Razorpay Key is missing in frontend environment variables.');
      return;
    }
    const rzp = new window.Razorpay({
      key: razorpayKey,
      order_id: rzrOrder.id, name: 'Daatasa',
      description: 'Premium Ghee Purchase', amount: rzrOrder.amount,
      theme: { color: '#F5A623' }, prefill: { name: user?.name || getAddr().name, email: user?.email || getAddr().email, contact: user?.phone || getAddr().phone },
      handler: async (res) => {
        try { 
          await api.post('/api/payment/verify', res); 
          clearCart();
          fetchCartCount(); 
          toast.success('Payment successful!'); 
          navigate('/orders');
        }
        catch { toast.error('Payment verification failed') }
      },
      modal: { ondismiss: async () => {
        try { await api.post('/api/orders/fail', { razorpay_order_id: rzrOrder.id }) } catch {}
        toast.error('Payment cancelled')
      }},
    })
    rzp.open()
  }

  if (!cart || cart.items.length === 0) return null

  const inputCls = "w-full h-12 px-4 rounded-xl border border-brand-primary/20 bg-white text-sm focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary outline-none transition-all placeholder:text-brand-text/30"
  const labelCls = "block text-xs font-bold text-brand-text/80 mb-2 uppercase tracking-wider"

  return (
    <div className="min-h-screen pb-24 page-enter bg-[var(--ivory)] font-sans text-brand-text">
      <Helmet>
        <title>Secure Checkout | Daatasa - Pure Vedic Bilona Ghee</title>
        <meta name="description" content="Fast, 100% secure checkout for pure Vedic Bilona A2 Ghee with free shipping and easy payments." />
      </Helmet>

      {/* Header */}
      <div className="relative overflow-hidden py-16 sm:py-20 text-center bg-brand-primary text-white">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay" />

        <div className="max-w-[1280px] mx-auto px-6 relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6 bg-white/10 border border-white/20">
            <FiLock size={12} /> Secure Checkout
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold font-display text-white mb-8">
            Complete Your Order
          </h1>

          {/* Progress stepper */}
          <div className="flex items-center justify-center gap-0 max-w-sm mx-auto">
            {[
              { num: 1, label: 'Address' },
              { num: 2, label: 'Payment' },
              { num: 3, label: 'Review' },
            ].map((step, i, arr) => (
              <div key={step.num} className="flex items-center w-full relative">
                <div className="flex flex-col items-center w-full z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i <= 1 ? 'bg-brand-secondary text-brand-primary' : 'bg-white/10 text-white/40'
                  }`}>
                    {step.num}
                  </div>
                  <span className={`text-[10px] font-bold mt-2 uppercase tracking-wider ${
                    i <= 1 ? 'text-brand-secondary' : 'text-white/40'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`absolute top-4 left-1/2 w-full h-[2px] -translate-y-1/2 ${
                    i < 1 ? 'bg-brand-secondary' : 'bg-white/10'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8 items-start">

          {/* Left */}
          <div className="lg:col-span-2 space-y-5">

            {/* Step 1: Address */}
            <div className="rounded-[2rem] bg-white border border-brand-primary/10 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-primary/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-brand-primary text-sm font-bold shadow-md">
                    1
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display text-brand-primary">Delivery Address</h3>
                    <p className="text-sm font-medium text-brand-text/60">Where should we deliver?</p>
                  </div>
                </div>
                {savedAddresses.length > 0 && (
                  <button type="button" onClick={() => setShowNew(!showNewForm)} className="text-xs font-bold text-brand-secondary hover:text-brand-primary transition-colors">
                    {showNewForm ? '← Use saved address' : '+ Add new address'}
                  </button>
                )}
              </div>

              <div className="p-8">
                <AnimatePresence mode="wait">
                  {!showNewForm && savedAddresses.length > 0 ? (
                    <motion.div key="saved" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="grid sm:grid-cols-2 gap-4">
                      {savedAddresses.map(addr => (
                        <div key={addr._id} onClick={() => setSelAddr(String(addr._id))}
                          className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${
                            selectedAddrId === String(addr._id) 
                              ? 'border-brand-primary bg-brand-primary/5 shadow-sm' 
                              : 'border-brand-primary/10 bg-white hover:border-brand-primary/30 hover:bg-[var(--ivory)]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-xl bg-white shadow-sm border border-brand-primary/5 text-brand-primary">
                                {addr.label === 'Home' ? <FiHome size={14}/> : <FiBriefcase size={14}/>}
                              </div>
                              <span className="text-xs font-bold uppercase tracking-widest text-brand-primary">{addr.label || 'Address'}</span>
                            </div>
                            {selectedAddrId === String(addr._id) && <FiCheck size={16} className="text-brand-primary"/>}
                          </div>
                          <p className="text-sm leading-relaxed text-brand-text/70 mt-2 font-medium">{addr.name}<br/>{addr.street}<br/>{addr.city}, {addr.state} — {addr.zipCode}</p>
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div key="new" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div><label className={labelCls}>Full Name *</label><input required value={newAddr.name} onChange={e => setNewAddr(p=>({...p,name:e.target.value}))} className={inputCls} placeholder="Recipient name"/></div>
                        <div><label className={labelCls}>Email</label><input type="email" value={newAddr.email} onChange={e => setNewAddr(p=>({...p,email:e.target.value}))} className={inputCls} placeholder="For order updates (optional)"/></div>
                        <div>
                          <label className={labelCls}>Phone *</label>
                          <div className="relative flex items-center">
                            <span className="absolute left-3.5 flex items-center gap-1 text-xs font-bold text-brand-primary pointer-events-none select-none border-r border-brand-primary/15 pr-2 z-10">
                              <span>🇮🇳</span>
                              <span>+91</span>
                            </span>
                            <input
                              required
                              type="tel"
                              inputMode="numeric"
                              maxLength={10}
                              value={newAddr.phone ? newAddr.phone.replace(/\D/g, '').slice(-10) : ''}
                              onChange={e => {
                                let val = e.target.value.replace(/\D/g, '')
                                if (val.startsWith('91') && val.length > 10) val = val.slice(2)
                                else if (val.startsWith('0') && val.length > 10) val = val.slice(1)
                                setNewAddr(p => ({ ...p, phone: val.slice(0, 10) }))
                              }}
                              className={`${inputCls} pl-16`}
                              placeholder="9876543210"
                            />
                          </div>
                        </div>
                      </div>
                      <div><label className={labelCls}>Street Address</label><input required value={newAddr.street} onChange={e => setNewAddr(p=>({...p,street:e.target.value}))} className={inputCls} placeholder="House no., Street, Area"/></div>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                          <label className={labelCls}>PIN Code</label>
                          <div className="relative">
                            <input required type="text" inputMode="numeric" maxLength={6} value={newAddr.zipCode}
                              onChange={e => handlePin(e.target.value)} className={`${inputCls} pr-8`} placeholder="6-digit PIN"/>
                            {pinLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin"/>}
                          </div>
                          {pinError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{pinError}</p>}
                          {!pinError && newAddr.city && newAddr.zipCode.length===6 && <p className="text-xs mt-1 font-medium" style={{ color: 'var(--success)' }}>✓ {newAddr.city}, {newAddr.state}</p>}
                        </div>
                        <div><label className={labelCls}>City</label><input required value={newAddr.city} onChange={e => setNewAddr(p=>({...p,city:e.target.value}))} className={inputCls} placeholder="City"/></div>
                        <div>
                          <label className={labelCls}>District</label>
                          <input value={newAddr.district} onChange={e => setNewAddr(p=>({...p,district:e.target.value}))} className={inputCls} placeholder="District (auto-filled)"/>
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>State</label>
                        <select required value={newAddr.state} onChange={e => setNewAddr(p=>({...p,state:e.target.value}))} className={inputCls}>
                          <option value="">Select State</option>
                          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      {user && (
                        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-brand-primary/10 bg-[var(--ivory)] hover:bg-brand-primary/5 transition-colors">
                          <input type="checkbox" checked={saveNewAddr} onChange={e => setSaveNew(e.target.checked)} className="w-5 h-5 rounded text-brand-primary focus:ring-brand-primary"/>
                          <span className="text-sm font-bold text-brand-text/70">Save this address for future orders</span>
                        </label>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Step 2: Payment */}
            <div className="rounded-[2rem] bg-white border border-brand-primary/10 shadow-sm overflow-hidden">
              <StepHeader num="2" title="Payment Method" sub="Choose how to pay" active={true}/>
              <div className="p-8 grid sm:grid-cols-2 gap-4">
                {[
                  { id:'COD',    label:'Cash on Delivery', icon:<FiBox size={20}/>,    desc:'Pay when you receive', disabled: !user },
                  { id:'Online', label:'Pay Online',       icon:<FiShield size={20}/>, desc:'Secure via Razorpay'  },
                ].map(opt => (
                  <div key={opt.id} onClick={() => !opt.disabled && setPayment(opt.id)}
                    className={`p-5 rounded-3xl border-2 transition-all flex items-center gap-4 relative overflow-hidden ${
                      opt.disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' : 
                      paymentMethod === opt.id 
                        ? 'border-brand-primary bg-brand-primary/5 shadow-sm cursor-pointer' 
                        : 'border-brand-primary/10 bg-white hover:border-brand-primary/30 hover:bg-[var(--ivory)] cursor-pointer'
                    }`}
                  >
                    <div className={`w-12 h-12 flex items-center justify-center rounded-xl shadow-sm transition-all z-10 ${
                      paymentMethod === opt.id ? 'bg-brand-primary text-white' : 'bg-white border border-brand-primary/10 text-brand-text/40'
                    }`}>
                      {opt.icon}
                    </div>
                    <div className="z-10">
                      <div className="text-sm font-bold text-brand-primary flex items-center gap-2">
                        {opt.label}
                      </div>
                      <p className="text-xs font-medium text-brand-text/60 mt-0.5">
                        {opt.disabled ? 'Requires Account' : opt.desc}
                      </p>
                    </div>
                    {paymentMethod === opt.id && <FiCheck size={18} className="ml-auto text-brand-primary z-10"/>}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3: Order Items */}
            <div className="rounded-[2rem] bg-white border border-brand-primary/10 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-brand-primary/5">
                <h3 className="text-lg font-bold font-display text-brand-primary">Order Items ({cart?.items?.length || 0})</h3>
              </div>
              <div className="divide-y divide-brand-primary/5">
                {cart?.items?.map((item, idx) => {
                  const details = getCartItemDetails(item)
                  const displayPrice = details.price
                  const displayWeight = details.weight
                  const displayImage = details.image
                  const displayName = details.name
                  return (
                    <div key={item._id || idx} className="px-8 py-5 flex items-center gap-5">
                      <div className="w-16 h-16 rounded-[1rem] overflow-hidden shrink-0 bg-[var(--ivory)] border border-brand-primary/5">
                        <img src={displayImage} alt={displayName} className="w-full h-full object-cover"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold font-display text-brand-primary truncate">{displayName}</p>
                        <p className="text-sm font-medium mt-1 text-brand-text/60 flex items-center">
                          {displayWeight && <span className="mr-2 px-2 py-0.5 rounded text-[10px] bg-brand-primary/10 text-brand-primary">{displayWeight}</span>}
                          Qty: {item.quantity} × ₹{displayPrice?.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <span className="text-base font-bold font-display text-brand-primary shrink-0">₹{(displayPrice * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-28">

            {/* Price Breakdown */}
            <div className="rounded-[2rem] bg-white border border-brand-primary/10 shadow-sm p-8">
              <h2 className="text-xl font-bold font-display text-brand-primary mb-5 pb-4 border-b border-brand-primary/5">Price Breakdown</h2>
              <div className="space-y-4 mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-brand-text/60">MRP (incl. of all taxes)</span>
                  <span className="font-bold text-brand-primary">
                    ₹{(preview?.itemsPrice && preview.itemsPrice > 0 ? preview.itemsPrice : (cart?.items?.reduce((acc, i) => acc + getCartItemDetails(i).price * (i.quantity || 1), 0) || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
                {(preview?.discount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="font-bold text-green-600">Discount on MRP {appliedCoupon?.code ? `(${appliedCoupon.code})` : ''}</span>
                    <span className="font-bold text-green-600">−₹{Math.round(preview.discount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-medium text-brand-text/60">Shipping</span>
                  <span className={`font-bold ${(preview?.shippingPrice ?? (preview?.itemsPrice > 500 ? 0 : 50)) === 0 ? 'text-green-600' : 'text-brand-primary'}`}>
                    {(preview?.shippingPrice ?? (preview?.itemsPrice > 500 ? 0 : 50)) === 0 ? '🚚 FREE' : `₹${preview?.shippingPrice ?? (preview?.itemsPrice > 500 ? 0 : 50)}`}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center py-5 border-t border-brand-primary/10">
                <span className="font-extrabold text-lg text-brand-primary">Total Amount</span>
                {previewLoad
                  ? <span className="inline-block w-24 h-8 bg-brand-primary/5 rounded-full animate-pulse"/>
                  : <span className="text-3xl font-extrabold font-display text-brand-primary">
                      ₹{Math.max(0, Math.round(((preview?.totalPrice && preview.totalPrice > 0 ? preview.totalPrice : ((cart?.items?.reduce((acc, i) => acc + getCartItemDetails(i).price * (i.quantity || 1), 0) || 0) + (cart?.items?.reduce((acc, i) => acc + getCartItemDetails(i).price * (i.quantity || 1), 0) > 500 ? 0 : 50))) - (appliedGiftCard ? appliedGiftCard.balance : 0)))).toLocaleString('en-IN')}
                    </span>
                }
              </div>

              {/* Gift Card Section */}
              <div className="p-4 rounded-xl border border-brand-primary/10 bg-[var(--ivory)] mb-6">
                <label className="text-sm font-bold text-brand-primary mb-2 block">Gift Card</label>
                {appliedGiftCard ? (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                    <div>
                      <p className="text-sm font-bold text-green-700">{appliedGiftCard.code}</p>
                      <p className="text-xs text-green-600">Balance: ₹{appliedGiftCard.balance}</p>
                    </div>
                    <button type="button" onClick={() => { setAppliedGC(null); setGiftCard(''); }} className="text-xs font-bold text-red-500 hover:underline">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" value={giftCardCode} onChange={e => setGiftCard(e.target.value.toUpperCase())} placeholder="Enter Code" className="flex-1 h-10 px-3 rounded-lg border border-brand-primary/20 text-sm focus:border-brand-primary outline-none uppercase" />
                    <button type="button" onClick={async () => {
                      if (!giftCardCode) return;
                      setGcLoading(true);
                      try {
                        const res = await api.get(`/api/giftcards/check/${giftCardCode}`);
                        setAppliedGC({ code: giftCardCode, balance: res.data.balance });
                        toast.success(`Gift card applied! Balance: ₹${res.data.balance}`);
                      } catch (err) {
                        toast.error(err.response?.data?.message || 'Invalid gift card');
                      } finally { setGcLoading(false); }
                    }} disabled={gcLoading || !giftCardCode} className="px-4 h-10 rounded-lg bg-brand-primary text-white text-sm font-bold disabled:opacity-50">
                      {gcLoading ? '...' : 'Apply'}
                    </button>
                  </div>
                )}
              </div>

              {walletBalance > 0 && (
                <div className="p-4 rounded-xl border border-brand-secondary/20 bg-brand-secondary/5 mb-6 flex items-start gap-3">
                  <input type="checkbox" id="useWallet" checked={useWallet} onChange={e => setUseWallet(e.target.checked)} className="mt-1 w-4 h-4 text-brand-secondary rounded border-gray-300 focus:ring-brand-secondary cursor-pointer"/>
                  <div>
                    <label htmlFor="useWallet" className="text-sm font-bold text-brand-primary cursor-pointer">Use Wallet Balance (₹{walletBalance.toFixed(2)})</label>
                    <p className="text-xs font-medium text-brand-text/60 mt-1">
                      {useWallet 
                        ? (walletBalance >= (preview?.totalPrice || 0) 
                           ? 'Your order will be fully paid using your wallet.' 
                           : `Remaining ₹${((preview?.totalPrice || 0) - walletBalance).toLocaleString('en-IN')} to be paid.`) 
                        : 'Check to apply wallet balance towards this order.'}
                    </p>
                  </div>
                </div>
              )}

              {(preview?.discount ?? 0) > 0 && (
                <div className="bg-[#e6fcf5] text-[#0ca678] text-sm font-bold text-center p-3 rounded-xl mb-6 mt-2">
                  You will save ₹{Math.round(preview.discount).toLocaleString('en-IN')} on this order
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full h-14 btn btn-primary rounded-full flex items-center justify-center gap-2 text-base transition-all disabled:opacity-60"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <FiArrowRight size={18}/>}
                {loading ? 'Placing Order…' : (paymentMethod === 'COD' ? 'Place Order' : ((useWallet && walletBalance >= (preview?.totalPrice || 0)) ? 'Pay via Wallet' : 'Pay Now'))}
              </button>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {[['🔒','Secure Payment'],['🚚','Fast Delivery']].map(([ic,lb]) => (
                  <div key={lb} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider rounded-xl px-3 py-2.5 bg-brand-primary/5 text-brand-primary/70">
                    <span className="text-sm">{ic}</span><span>{lb}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      </div>



      {/* Stock Modal */}
      <AnimatePresence>
        {stockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale:0.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
              className="rounded-[2rem] w-full max-w-md p-8 shadow-2xl bg-white border border-brand-primary/10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-red-50 text-red-500 shadow-sm"><FiAlertCircle size={24}/></div>
                <div>
                  <h2 className="text-xl font-bold font-display text-brand-primary">Stock Issue</h2>
                  <p className="text-sm font-medium text-brand-text/60">Some items have insufficient stock</p>
                </div>
              </div>
              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
                {stockModal.map(item => (
                  <div key={item.itemId} className="p-4 rounded-xl flex items-center justify-between border border-red-500/20 bg-red-50/50">
                    <div>
                      <p className="text-sm font-bold text-brand-primary truncate max-w-[200px]">{item.name || 'Product'}</p>
                      <p className="text-xs font-bold mt-1 text-red-500">Requested {item.quantity} · Available {item.stock}</p>
                    </div>
                    <Link to="/cart" onClick={() => setStockModal(null)} className="p-2.5 rounded-full transition-all shadow-sm bg-white text-red-500 hover:bg-red-50"><FiEdit2 size={16}/></Link>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={() => navigate('/cart')} className="w-full h-12 btn btn-primary rounded-full flex items-center justify-center gap-2">
                  Update Cart <FiArrowRight size={16}/>
                </button>
                <button onClick={() => setStockModal(null)} className="w-full h-12 rounded-full font-bold text-brand-text/50 hover:bg-brand-primary/5 transition-colors">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Checkout
