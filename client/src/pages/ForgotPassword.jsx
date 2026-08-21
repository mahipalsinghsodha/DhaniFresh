// pages/ForgotPassword.jsx — Unified Password Recovery Flow
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Mail, Phone, Lock, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound } from 'lucide-react'
import { toast } from 'react-toastify'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'

// ── Shared Floating Input ──
const FloatingInput = ({ id, label, type = 'text', value, onChange, icon: Icon, rightElement, autoComplete, required, autoFocus, maxLength, placeholder }) => {
  const [focused, setFocused] = useState(false)

  return (
    <div className="relative w-full mb-3">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200"
            style={{ color: focused ? 'var(--gold)' : 'var(--text-muted)' }}
          >
            <Icon size={15} />
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
          className="w-full rounded-xl text-xs sm:text-sm font-medium outline-none transition-all placeholder:text-gray-400"
          style={{
            height: '44px',
            paddingLeft: Icon ? '36px' : '12px',
            paddingRight: rightElement ? '38px' : '12px',
            background: focused ? '#FFFFFF' : 'var(--ivory)',
            border: `1.5px solid ${focused ? 'var(--brand-secondary)' : 'rgba(27, 47, 110, 0.15)'}`,
            color: 'var(--brand-primary)',
            boxShadow: focused ? '0 0 0 3px rgba(217, 165, 32, 0.15)' : 'none',
          }}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    </div>
  )
}

const ForgotPassword = () => {
  const navigate = useNavigate()

  const [step, setStep] = useState('IDENTIFIER')
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    let timer
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(prev => prev - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [cooldown])

  const handleIdentifierSubmit = async (e) => {
    e.preventDefault()
    if (!identifier.trim()) {
      toast.error('Please enter Mobile Number or Email')
      return
    }

    const isEmail = identifier.includes('@')
    const isMobile = /^\d{10}$/.test(identifier.trim())

    if (!isEmail && !isMobile) {
      toast.error('Please enter a valid 10-digit mobile number or email')
      return
    }

    setLoading(true)
    try {
      if (isEmail) {
        await api.post('/api/auth/forgotpassword', { email: identifier.trim() })
        toast.success('Password reset link sent to your email')
        setStep('SENT_EMAIL')
        setCooldown(60)
      } else {
        await api.post('/api/auth/forgot-password-otp', { phone: identifier.trim() })
        toast.success('OTP sent to your mobile number')
        setStep('OTP_RESET')
        setCooldown(60)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process request')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpResetSubmit = async (e) => {
    e.preventDefault()
    if (!otp.trim() || otp.trim().length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/auth/reset-password-otp', {
        phone: identifier.trim(),
        otp: otp.trim(),
        newPassword
      })
      toast.success('Password reset successful! Please log in.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (cooldown > 0) return
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password-otp', { phone: identifier.trim() })
      toast.success('New OTP sent to your phone')
      setCooldown(60)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  const cdMm = String(Math.floor(cooldown / 60)).padStart(2, '0')
  const cdSs = String(cooldown % 60).padStart(2, '0')

  return (
    <div className="py-4 sm:py-8 lg:py-10 px-3 sm:px-6 flex flex-col items-center justify-start bg-[var(--ivory)] font-sans relative">
      <Helmet>
        <title>Forgot Password — Daatasa</title>
        <meta name="description" content="Reset your Daatasa account password securely." />
      </Helmet>

      {/* Brand Logo Header */}
      <div className="flex justify-center mb-3 sm:mb-5 z-10">
        <Link to="/" className="inline-block bg-white px-3.5 py-1.5 rounded-2xl border border-brand-primary/10 shadow-xs hover:shadow-sm transition-all">
          <img src="/logo_rectangle.png" alt="Daatasa" className="h-8 sm:h-10 w-auto" />
        </Link>
      </div>

      {/* Form Container */}
      <div className="w-full max-w-[400px] rounded-2xl sm:rounded-3xl p-4 xs:p-5 sm:p-7 bg-white border border-brand-primary/10 shadow-lg shadow-brand-primary/5 relative z-10">
        
        <AnimatePresence mode="wait">
          
          {/* STEP 1: IDENTIFIER */}
          {step === 'IDENTIFIER' && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-1 px-2 py-0.5 -ml-2 mb-2 rounded-full text-xs font-semibold text-brand-primary/70 hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
              >
                <ArrowLeft size={13} />
                <span>Back to Sign In</span>
              </button>

              <div className="mb-3">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-primary mb-0.5">Reset Password</h2>
                <p className="text-xs text-brand-text/60">
                  Enter your mobile number or email to receive reset instructions
                </p>
              </div>
              
              {cooldown > 0 && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-medium">
                    <AlertCircle size={13} className="text-amber-600" /> Please wait before resending
                  </span>
                  <span className="font-bold font-mono">{cdMm}:{cdSs}</span>
                </div>
              )}

              <form onSubmit={handleIdentifierSubmit} className="space-y-2.5">
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
                  className="w-full btn btn-primary h-10 sm:h-11 rounded-full flex items-center justify-center gap-1.5 mt-1 text-xs sm:text-sm font-bold shadow-md shadow-gold/20 hover:shadow-gold/40 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>CONTINUE</span>
                      <ArrowRight size={14} />
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
              className="text-center py-2"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-2xs">
                <CheckCircle size={20} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-display text-brand-primary mb-1">Check Your Email</h3>
              <p className="text-xs text-brand-text/70 mb-3 leading-relaxed">
                We've sent a password recovery link to <br/>
                <strong className="text-brand-primary">{identifier}</strong>
              </p>
              
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setStep('IDENTIFIER')}
                  className="text-brand-secondary font-bold text-xs hover:underline block mx-auto"
                >
                  Use a different email or mobile
                </button>
                <Link
                  to="/login"
                  className="w-full h-10 sm:h-11 rounded-full flex items-center justify-center gap-1.5 bg-white border border-brand-primary/20 text-brand-primary font-bold text-xs hover:bg-brand-primary/5 shadow-2xs transition-all"
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <button
                type="button"
                onClick={() => setStep('IDENTIFIER')}
                className="inline-flex items-center gap-1 px-2 py-0.5 -ml-2 mb-2 rounded-full text-xs font-semibold text-brand-primary/70 hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
              >
                <ArrowLeft size={13} />
                <span>Change Mobile Number</span>
              </button>

              <div className="mb-3">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-primary mb-0.5">Reset Password</h2>
                <p className="text-xs text-brand-text/60">
                  Enter the OTP sent to <span className="font-bold text-brand-primary">{identifier}</span>
                </p>
              </div>
              
              <form onSubmit={handleOtpResetSubmit} className="space-y-2.5">
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
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn btn-primary h-10 sm:h-11 rounded-full flex items-center justify-center gap-1.5 mt-1 text-xs sm:text-sm font-bold shadow-md shadow-gold/20 hover:shadow-gold/40 active:scale-[0.98] transition-all"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock size={14} />
                      <span>RESET PASSWORD</span>
                    </>
                  )}
                </button>
              </form>
              
              {cooldown > 0 ? (
                <div className="flex items-center text-xs mt-2.5 text-brand-text/60 justify-center">
                  Resend OTP in: <span className="font-bold font-mono text-brand-primary ml-1">{cdMm}:{cdSs}</span>
                </div>
              ) : (
                <div className="flex items-center text-xs mt-2.5 justify-center">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-brand-secondary hover:text-brand-primary font-bold hover:underline transition-colors cursor-pointer"
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
  )
}

export default ForgotPassword
