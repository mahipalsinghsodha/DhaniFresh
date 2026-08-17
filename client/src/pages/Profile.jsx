import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useConfirm } from '../context/ConfirmContext'
import api from '../api/axios'
import { FiUser, FiMapPin, FiChevronRight, FiPackage, FiLogOut, FiAlertCircle, FiPhone, FiMail, FiRefreshCw, FiClock, FiLock, FiCreditCard, FiCopy, FiShare2 } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'

// ── Shared Floating Input System ────────────────────────────────
const FloatingInput = ({ id, label, type = 'text', value, onChange, icon: Icon, rightElement, autoComplete, required, disabled, maxLength, inputMode }) => {
  const [focused, setFocused] = useState(false)

  return (
    <div className="relative w-full">
      <label htmlFor={id} className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200"
            style={{ color: focused ? 'var(--gold)' : 'var(--text-muted)' }}>
            <Icon size={16} />
          </div>
        )}
        <input
          id={id} type={type} value={value} onChange={onChange}
          autoComplete={autoComplete} required={required} disabled={disabled}
          maxLength={maxLength} inputMode={inputMode} placeholder={`Enter ${label.toLowerCase()}`}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full rounded-[1rem] text-sm font-medium outline-none transition-all placeholder:text-brand-text/30"
          style={{
            height: '52px',
            paddingLeft: Icon ? '42px' : '14px',
            paddingRight: rightElement ? '44px' : '14px',
            background: disabled ? 'var(--ivory)' : (focused ? '#FFFFFF' : 'var(--ivory)'),
            border: `1px solid ${focused ? 'var(--brand-secondary)' : 'rgba(27, 47, 110, 0.2)'}`,
            color: 'var(--brand-primary)',
            boxShadow: focused ? '0 0 0 1px var(--brand-secondary)' : 'none',
            opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
        {rightElement && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    </div>
  )
}

const Profile = () => {
  const { user, updateUser, logout } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [profLoading, setProfLoading] = useState(false)
  const [subscriptions, setSubscriptions] = useState([])
  const [walletData, setWalletData] = useState({ walletBalance: 0, rewardPoints: 0, transactions: [] })
  const [walletLoading, setWalletLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
      fetchSubscriptions()
      fetchWallet()
    }
  }, [user])

  const fetchSubscriptions = async () => {
    try {
      const res = await api.get('/api/subscriptions/my')
      setSubscriptions(res.data.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const fetchWallet = async () => {
    try {
      const res = await api.get('/api/wallet')
      setWalletData(res.data)
    } catch (err) {
      console.error('Failed to fetch wallet data', err)
    }
  }

  const handleCancelSubscription = async (id) => {
    try {
      await api.post('/api/subscriptions/cancel', { subscriptionId: id });
      toast.success('Subscription cancelled');
      fetchSubscriptions();
    } catch(e) { toast.error('Failed to cancel'); }
  }

  const handleConvertPoints = async () => {
    if (walletData.rewardPoints < 10) {
      toast.error('Minimum 10 points required to convert.');
      return;
    }
    if (await confirm(`Convert ${walletData.rewardPoints} points to ₹${(walletData.rewardPoints * 0.1).toFixed(2)} wallet balance?`)) {
      setWalletLoading(true);
      try {
        await api.post('/api/wallet/rewards/convert', { points: walletData.rewardPoints });
        toast.success('Points converted successfully!');
        fetchWallet();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to convert points');
      } finally {
        setWalletLoading(false);
      }
    }
  }

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

  if (!user) return null

  return (
    <div className="min-h-screen pb-16 bg-[var(--ivory)] font-sans text-brand-text">

      {/* ── Page header ── */}
      <div className="bg-white border-b border-brand-primary/10 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 py-12 text-center">
          <h1 className="text-4xl font-bold font-display text-brand-primary">My Account</h1>
          <p className="text-base mt-3 text-brand-text/60 font-medium">Manage your profile and settings</p>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* ── Left sidebar ── */}
          <div className="space-y-6">

            {/* Avatar card */}
            <div className="rounded-[2rem] p-8 text-center shadow-sm bg-white border border-brand-primary/10">
              <div className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center text-4xl font-bold mx-auto mb-5 shadow-sm bg-brand-primary text-white">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <p className="text-xl font-bold font-display text-brand-primary">{user.name}</p>
              <p className="text-sm mt-1 text-brand-text/60">{user.email}</p>
              <span className={`inline-block mt-4 px-4 py-1.5 text-xs font-bold rounded-full uppercase tracking-widest ${
                  user.role === 'admin' || user.role === 'superadmin'
                    ? 'bg-purple-100 text-purple-700'
                    : user.role === 'courier'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-brand-primary/5 text-brand-primary'
                }`}>
                {user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : user.role === 'courier' ? 'Courier' : 'Customer'}
              </span>
            </div>

            {/* Nav links */}
            <div className="rounded-[2rem] overflow-hidden shadow-sm bg-white border border-brand-primary/10">
              {[
                { label: 'Profile', icon: FiUser, to: '/profile', active: true },
                { label: 'My Addresses', icon: FiMapPin, to: '/addresses' },
                { label: 'My Orders', icon: FiPackage, to: '/orders' },
                { label: 'Wallet & Rewards', icon: FiCreditCard, action: () => document.getElementById('wallet-section')?.scrollIntoView({ behavior: 'smooth' }) },
                { label: 'Change Password', icon: FiLock, to: '/change-password' },
                { label: 'My Subscriptions', icon: FiRefreshCw, action: () => document.getElementById('subscriptions-section')?.scrollIntoView({ behavior: 'smooth' }) },
                { label: 'Sign Out', icon: FiLogOut, danger: true, action: () => { logout(); navigate('/') } },
              ].map((item, i, arr) => (
                <button
                  key={i}
                  onClick={item.action || (() => navigate(item.to))}
                  className="w-full flex items-center justify-between px-6 py-5 text-sm font-bold transition-all hover:bg-[var(--ivory)]"
                  style={{ 
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(27, 47, 110, 0.05)' : 'none', 
                    color: item.danger ? '#ef4444' : (item.active ? 'var(--brand-secondary)' : 'var(--brand-primary)'),
                    background: item.active ? 'var(--ivory)' : 'transparent'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className={item.danger ? 'text-red-500' : (item.active ? 'text-brand-secondary' : 'text-brand-text/40')} />
                    {item.label}
                  </div>
                  {!item.active && <FiChevronRight size={18} className="text-brand-text/30" />}
                </button>
              ))}
            </div>
          </div>

          {/* ── Right main content ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* ── Profile form ── */}
            <div className="rounded-[2rem] p-8 lg:p-10 shadow-sm bg-white border border-brand-primary/10">
              <h2 className="text-xl font-bold font-display text-brand-primary mb-8 flex items-center gap-3 border-b border-brand-primary/5 pb-4">
                <FiUser size={20} className="text-brand-secondary" /> Personal Details
              </h2>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <FloatingInput id="name" label="Full Name" icon={FiUser} required value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div>
                    <FloatingInput id="phone" label="Phone Number" icon={FiPhone} value={phone} maxLength={10} inputMode="numeric" onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                    {phone && !/^[6-9][0-9]{9}$/.test(phone) && phone.length === 10 && (
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--danger)' }}><FiAlertCircle size={11} /> Enter a valid Indian mobile number</p>
                    )}
                  </div>
                </div>
                <div>
                  <FloatingInput id="email" label="Email Address (cannot be changed)" icon={FiMail} type="email" disabled value={user.email} />
                </div>
                <div className="flex justify-end pt-5">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit" disabled={profLoading} 
                    className="btn btn-primary px-10 h-12 rounded-full flex items-center justify-center gap-2"
                  >
                    {profLoading ? 'Saving...' : 'Save Changes'}
                  </motion.button>
                </div>
              </form>
            </div>

            {/* ── Wallet & Rewards ── */}
            <div id="wallet-section" className="rounded-[2rem] p-8 lg:p-10 shadow-sm bg-white border border-brand-primary/10">
              <div className="flex items-center justify-between mb-8 border-b border-brand-primary/5 pb-4">
                <h2 className="text-xl font-bold font-display text-brand-primary flex items-center gap-3">
                  <FiCreditCard size={20} className="text-brand-secondary" /> Wallet & Rewards
                </h2>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-6 mb-8">
                <div className="bg-[var(--ivory)] border border-brand-primary/5 rounded-[1.5rem] p-6 text-center">
                  <p className="text-sm font-bold text-brand-text/60 mb-2">Wallet Balance</p>
                  <p className="text-3xl font-display font-bold text-brand-primary">₹{walletData.walletBalance.toFixed(2)}</p>
                </div>
                <div className="bg-brand-secondary/10 border border-brand-secondary/20 rounded-[1.5rem] p-6 text-center">
                  <p className="text-sm font-bold text-brand-text/60 mb-2">Reward Points</p>
                  <p className="text-3xl font-display font-bold text-brand-secondary">{walletData.rewardPoints}</p>
                  <button 
                    onClick={handleConvertPoints}
                    disabled={walletLoading || walletData.rewardPoints < 10}
                    className="mt-4 px-4 py-2 bg-white text-brand-primary text-xs font-bold rounded-full border border-brand-primary/10 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {walletLoading ? 'Converting...' : 'Convert to ₹'}
                  </button>
                  <p className="text-[10px] text-brand-text/50 mt-2 font-medium">10 Points = ₹1</p>
                </div>
              </div>

              {/* Refer & Earn */}
              {user.referralCode && (
                <div className="bg-gradient-to-r from-brand-primary to-[#2a4399] rounded-[1.5rem] p-6 text-white shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay" />
                  <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                      <h3 className="text-lg font-bold font-display flex items-center gap-2 mb-1">
                        <FiShare2 /> Refer & Earn ₹50!
                      </h3>
                      <p className="text-sm text-white/80">
                        Share your unique code. When a friend signs up, you both get ₹50 in your wallet.
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 bg-white/10 p-2 rounded-xl backdrop-blur-sm border border-white/20">
                      <span className="text-xl font-bold font-display px-4 tracking-widest">{user.referralCode}</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/register?ref=${user.referralCode}`);
                          toast.success('Referral link copied to clipboard!');
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-white text-brand-primary rounded-lg hover:bg-brand-secondary transition-colors"
                        title="Copy Referral Link"
                      >
                        <FiCopy size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Subscriptions ── */}
            <div id="subscriptions-section" className="rounded-[2rem] p-8 lg:p-10 shadow-sm bg-white border border-brand-primary/10">
              <div className="flex items-center justify-between mb-8 border-b border-brand-primary/5 pb-4">
                <h2 className="text-xl font-bold font-display text-brand-primary flex items-center gap-3">
                  <FiRefreshCw size={20} className="text-brand-secondary" /> My Subscriptions
                </h2>
              </div>
              
              {subscriptions.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-base font-medium text-brand-text/50">You don't have any active subscriptions.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {subscriptions.map(sub => (
                    <div key={sub._id} className="p-6 rounded-[1.5rem] border border-brand-primary/5 bg-[var(--ivory)] flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
                      <div className="flex gap-5 items-center">
                        <img src={sub.plan?.product?.image || sub.plan?.product?.images?.[0]} alt="" className="w-20 h-20 object-contain bg-white rounded-[1rem] p-2 border border-brand-primary/5" />
                        <div>
                          <p className="text-lg font-bold font-display text-brand-primary">{sub.plan?.name}</p>
                          <p className="text-sm font-medium text-brand-text/60 mt-1">₹{sub.plan?.price} / {sub.plan?.period}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${sub.status === 'active' || sub.status === 'authenticated' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                              {sub.status}
                            </span>
                            {sub.nextBillingDate && sub.status === 'active' && (
                              <span className="text-xs font-bold text-brand-text/40 flex items-center gap-1.5">
                                <FiClock size={12} /> Next bill: {new Date(sub.nextBillingDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {sub.status === 'active' && (
                        <button 
                          onClick={async () => {
                            if(await confirm('Are you sure you want to cancel this subscription?')) {
                              handleCancelSubscription(sub._id);
                            }
                          }}
                          style={{
                              padding: '8px 16px', background: 'var(--bg-base)', color: 'var(--danger)', 
                              border: '1.5px solid rgba(229, 62, 62, 0.2)', borderRadius: '8px', 
                              fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229, 62, 62, 0.1)'; e.currentTarget.style.borderColor = 'var(--danger)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-base)'; e.currentTarget.style.borderColor = 'rgba(229, 62, 62, 0.2)' }}
                        >
                          Cancel Subscription
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
