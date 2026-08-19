// pages/ForgotPassword.jsx — Unified Reset Flow
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle, EyeOff, Eye, Phone, Mail, Lock, KeyRound } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

const LS_KEY = 'resetPasswordSentAt'

// ── Shared Floating Input System with Focus Border Glow ──
const FloatingInput = ({ id, label, type = 'text', value, onChange, icon: Icon, rightElement, autoComplete, required, autoFocus, maxLength, placeholder }) => {
  const [focused, setFocused] = useState(false)

  return (
    <div className="relative w-full mb-5">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200"
            style={{ color: focused ? 'var(--gold)' : 'var(--text-muted)' }}
          >
            <Icon size={18} />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          maxLength={maxLength}
          placeholder={placeholder || (label ? `Enter ${label.replace('*', '').trim()}` : '')}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full rounded-[1rem] text-sm font-medium outline-none transition-all placeholder:text-gray-400"
          style={{
            height: '52px',
            paddingLeft: Icon ? '42px' : '16px',
            paddingRight: rightElement ? '44px' : '16px',
            background: focused ? '#FFFFFF' : 'var(--ivory)',
            border: `1.5px solid ${focused ? 'var(--brand-secondary)' : 'rgba(27, 47, 110, 0.18)'}`,
            color: 'var(--brand-primary)',
            boxShadow: focused ? '0 0 0 3px rgba(217, 165, 32, 0.20), 0 2px 8px rgba(217, 165, 32, 0.10)' : 'none',
          }}
        />
        {rightElement && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    </div>
  )
}

const ForgotPassword = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  
  // flow states: 'IDENTIFIER' -> 'SENT_EMAIL' | 'OTP_RESET'
  const [step, setStep] = useState('IDENTIFIER')
  
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading]       = useState(false)
  const [cooldown, setCooldown]     = useState(0)
  
  // OTP Reset specific states
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  const timerRef = useState(null)[1] // or standard let
  const [timerId, setTimerId] = useState(null)

  const startTimer = (secs) => {
    setCooldown(secs)
    if (timerId) clearInterval(timerId)
    const id = setInterval(() => {
      setCooldown(s => {
        if (s <= 1) {
          clearInterval(id)
          localStorage.removeItem(LS_KEY)
          return 0
        }
        return s - 1
      })
    }, 1000)
    setTimerId(id)
  }

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const sentAt = parseInt(raw, 10)
      const elapsed = Math.floor((Date.now() - sentAt) / 1000)
      const remaining = 120 - elapsed // 2 mins cooldown (120s)
      if (remaining > 0) startTimer(remaining)
      else localStorage.removeItem(LS_KEY)
    }
    return () => {
      if (timerId) clearInterval(timerId)
    }
  }, [])

  const handleIdentifierSubmit = async (e) => {
    e.preventDefault()
    if (cooldown > 0) {
      toast.info('Please wait before requesting another reset.')
      return
    }
    if (!identifier.trim()) {
      toast.error('Please enter your email or mobile number')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/api/auth/forgot-password', { emailOrPhone: identifier.trim() })
      localStorage.setItem(LS_KEY, Date.now().toString())
      startTimer(120)
      
      if (res.data.isOtp) {
        setStep('OTP_RESET')
        toast.success(`OTP sent to ${identifier}`)
      } else {
        setStep('SENT_EMAIL')
        toast.success('Reset link sent to your email')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (cooldown > 0 || !identifier.trim()) return
    setLoading(true)
    try {
      const res = await api.post('/api/auth/forgot-password', { emailOrPhone: identifier.trim(), isResend: true })
      localStorage.setItem(LS_KEY, Date.now().toString())
      startTimer(120)
      toast.success(res.data.message || `New OTP sent to ${identifier}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpResetSubmit = async (e) => {
    e.preventDefault()
    if (!otp || !newPassword) {
      toast.error('Please enter OTP and new password')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await api.post(`/api/auth/reset-password/${otp}`, { password: newPassword })
      toast.success('Password reset successfully! You can now log in.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP')
    } finally {
      setLoading(false)
    }
  }

  const cdMm = String(Math.floor(cooldown / 60)).padStart(2, '0')
  const cdSs = String(cooldown % 60).padStart(2, '0')

  return (
    <div className="min-h-screen flex bg-[var(--ivory)] font-sans">
      <Helmet>
        <title>Forgot Password — Daatasa</title>
        <meta name="description" content="Reset your Daatasa account password securely." />
      </Helmet>

      {/* Hero Banner (Desktop) */}
      <div className="hidden lg:flex flex-col w-[48%] xl:w-[50%] bg-gradient-to-br from-[#1B2F6E] via-[#111e47] to-[#050a17] items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-secondary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <Link to="/" className="z-10">
          <img src="/logo_rectangle.png" alt="Daatasa" className="h-14 w-auto mb-8 bg-white px-4 py-2 rounded-xl shadow-lg hover:opacity-95 transition-opacity" />
        </Link>
        <h1 className="text-4xl font-display font-bold text-white text-center leading-tight mb-4 z-10">
          Secure Account <br/> <span className="text-brand-secondary">Recovery</span>
        </h1>
        <p className="text-white/80 text-center max-w-md z-10 leading-relaxed">
          Regain access to pure goodness. We'll send a secure reset link or OTP directly to you.
        </p>
        <div className="mt-12 w-full max-w-lg z-10">
          <img src="/matka.png" alt="Ghee Matka" className="w-full h-auto drop-shadow-2xl opacity-50" />
        </div>
      </div>

      {/* Form Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 w-full relative">
        <div className="w-full h-48 sm:hidden bg-gradient-to-br from-[#1B2F6E] via-[#111e47] to-[#050a17] absolute top-0 left-0" />

        <div className="w-full max-w-[440px] rounded-[1.5rem] sm:rounded-[2rem] p-6 xs:p-8 sm:p-10 bg-white border border-brand-primary/10 shadow-[0_24px_80px_rgba(27,47,110,0.08)] z-10 min-h-screen sm:min-h-0 flex flex-col justify-center overflow-hidden relative">
          
          {/* Top Banner inside card (mobile) */}
          <div className="bg-[#1B2F6E]/10 h-28 flex items-center justify-center relative sm:hidden rounded-2xl mb-8 -mt-2">
            <Link to="/">
              <img src="/logo_rectangle.png" alt="Daatasa" className="h-10 w-auto" />
            </Link>
          </div>

          <div className="w-full">
            <AnimatePresence mode="wait">
              
              {/* STEP 1: IDENTIFIER */}
              {step === 'IDENTIFIER' && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 -ml-3 mb-4 rounded-full text-sm font-semibold text-brand-primary/70 hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Sign In</span>
                  </button>

                  <div className="mb-6">
                    <h2 className="text-3xl font-bold font-display text-brand-primary mb-2">Reset Password</h2>
                    <p className="text-sm font-medium text-brand-text/60">
                      Enter your mobile number or email to receive reset instructions
                    </p>
                  </div>
                  
                  {cooldown > 0 && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-900 flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium">
                        <AlertCircle size={18} className="text-amber-600" /> Please wait before resending
                      </span>
                      <span className="font-bold font-mono">{cdMm}:{cdSs}</span>
                    </div>
                  )}

                  <form onSubmit={handleIdentifierSubmit} className="space-y-4">
                    <FloatingInput
                      id="identifier"
                      label="Mobile Number or Email*"
                      placeholder="e.g. 9876543210 or name@example.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      icon={identifier.includes('@') ? Mail : Phone}
                      autoFocus
                      required
                    />

                    <button
                      type="submit"
                      disabled={loading || cooldown > 0}
                      className="w-full btn btn-primary h-14 rounded-full flex items-center justify-center gap-2 mt-4 text-sm font-bold shadow-lg shadow-gold/20 hover:shadow-gold/40 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>CONTINUE</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* STEP 2A: SENT EMAIL */}
              {step === 'SENT_EMAIL' && (
                <motion.div
                  key="step2a"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-4"
                >
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                    <CheckCircle size={32} />
                  </div>
                  <h3 className="text-2xl font-bold font-display text-brand-primary mb-2">Check Your Email</h3>
                  <p className="text-sm text-brand-text/70 mb-6 leading-relaxed">
                    We've sent a password recovery link to <br/>
                    <strong className="text-brand-primary">{identifier}</strong>
                  </p>
                  
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setStep('IDENTIFIER')}
                      className="text-brand-secondary font-bold text-sm hover:underline block mx-auto mb-4"
                    >
                      Use a different email or mobile
                    </button>
                    <Link
                      to="/login"
                      className="w-full h-14 rounded-full flex items-center justify-center gap-2 bg-white border border-brand-primary/20 text-brand-primary font-bold text-sm hover:bg-brand-primary/5 shadow-sm transition-all"
                    >
                      Back to Login
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* STEP 2B: OTP RESET (MOBILE) */}
              {step === 'OTP_RESET' && (
                <motion.div
                  key="step2b"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    type="button"
                    onClick={() => setStep('IDENTIFIER')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 -ml-3 mb-4 rounded-full text-sm font-semibold text-brand-primary/70 hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
                  >
                    <ArrowLeft size={16} />
                    <span>Change Mobile Number</span>
                  </button>

                  <div className="mb-6">
                    <h2 className="text-3xl font-bold font-display text-brand-primary mb-2">Reset Password</h2>
                    <p className="text-sm font-medium text-brand-text/60">
                      Enter the OTP sent to <span className="font-bold text-brand-primary">{identifier}</span> and choose a new password.
                    </p>
                  </div>
                  
                  <form onSubmit={handleOtpResetSubmit} className="space-y-4">
                    <FloatingInput
                      id="otp"
                      label="6-Digit OTP*"
                      placeholder="e.g. 123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      icon={KeyRound}
                      autoFocus
                      required
                    />

                    <FloatingInput
                      id="newPassword"
                      label="New Password*"
                      type={showPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      icon={Lock}
                      required
                      rightElement={
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="text-gray-400 hover:text-brand-primary p-1 transition-colors"
                        >
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full btn btn-primary h-14 rounded-full flex items-center justify-center gap-2 mt-4 text-sm font-bold shadow-lg shadow-gold/20 hover:shadow-gold/40 active:scale-[0.98] transition-all"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Lock size={16} />
                          <span>RESET PASSWORD</span>
                        </>
                      )}
                    </button>
                  </form>
                  
                  {cooldown > 0 ? (
                    <div className="flex items-center text-sm mt-6 text-brand-text/60 justify-center">
                      Resend OTP in: <span className="font-bold font-mono text-brand-primary ml-1.5">{cdMm}:{cdSs}</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-sm mt-6 justify-center">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="text-brand-secondary hover:text-brand-primary font-bold hover:underline transition-colors text-sm cursor-pointer"
                      >
                        Resend OTP
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
