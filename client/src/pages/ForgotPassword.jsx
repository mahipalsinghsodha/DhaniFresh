// pages/ForgotPassword.jsx — Myntra-style Unified Reset Flow
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle, AlertCircle, EyeOff, Eye } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

const LS_KEY = 'resetPasswordSentAt'

const FloatingInput = ({ id, label, type = 'text', value, onChange, icon: Icon, rightElement, autoComplete, required, autoFocus, maxLength }) => {
  const [focused, setFocused] = useState(false)
  return (
    <div className="relative w-full mb-5">
      <div className={`relative border rounded-lg transition-colors duration-200 ${focused ? 'border-brand-secondary' : 'border-gray-300'} bg-white`}>
        <label htmlFor={id} className={`absolute left-3 transition-all duration-200 pointer-events-none ${
          focused || value ? 'top-1 text-[10px] font-bold text-gray-500' : 'top-3.5 text-sm font-medium text-gray-500'
        }`}>
          {label}
        </label>
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon size={16} />
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`w-full bg-transparent outline-none text-sm font-medium text-gray-800 ${
            focused || value ? 'pt-5 pb-1' : 'py-3.5'
          }`}
          style={{
            paddingLeft: Icon ? '36px' : '12px',
            paddingRight: rightElement ? '40px' : '12px',
          }}
        />
        {rightElement && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>
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

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const sentAt = parseInt(raw, 10)
      const elapsed = Math.floor((Date.now() - sentAt) / 1000)
      const remaining = 300 - elapsed // 5 mins
      if (remaining > 0) startTimer(remaining)
      else localStorage.removeItem(LS_KEY)
    }
  }, [])

  const startTimer = (secs) => {
    setCooldown(secs)
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
    return () => clearInterval(id)
  }

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
      startTimer(300)
      
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
      </Helmet>

      {/* Hero Banner (Myntra style top banner on mobile, side on desktop) */}
      <div className="hidden lg:flex flex-col w-[50%] bg-gradient-to-br from-[#1B2F6E] via-[#111e47] to-[#050a17] items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-secondary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <img src="/logo_rectangle.png" alt="Daatasa" className="h-14 w-auto mb-8 bg-white px-4 py-2 rounded-xl z-10" />
        <h1 className="text-4xl font-display font-bold text-white text-center leading-tight mb-4 z-10">
          Secure Account <br/> <span className="text-brand-secondary">Recovery</span>
        </h1>
        <p className="text-white/80 text-center max-w-md z-10">Regain access to pure goodness. We'll send a secure reset link or OTP directly to you.</p>
        <div className="mt-12 w-full max-w-lg z-10">
          <img src="/matka.png" alt="Ghee Matka" className="w-full h-auto drop-shadow-2xl opacity-50" />
        </div>
      </div>

      {/* Form Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-0 sm:p-6 w-full relative">
        <div className="w-full h-48 sm:hidden bg-gradient-to-br from-[#1B2F6E] via-[#111e47] to-[#050a17] absolute top-0 left-0" />

        <div className="w-full max-w-[420px] bg-white sm:rounded-xl shadow-none sm:shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-10 min-h-screen sm:min-h-0 flex flex-col pt-12 sm:pt-0 overflow-hidden relative">
          
          {/* Top Banner inside card (mobile) */}
          <div className="bg-[#1B2F6E]/10 h-32 flex items-center justify-center relative sm:hidden rounded-b-3xl mb-8 -mt-12">
            <img src="/logo_rectangle.png" alt="Daatasa" className="h-10" />
          </div>

          <div className="p-8 flex-1">
            <AnimatePresence mode="wait">
              
              {/* STEP 1: IDENTIFIER */}
              {step === 'IDENTIFIER' && (
                <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <button onClick={() => navigate('/login')} className="flex items-center text-sm text-gray-500 mb-6 hover:text-gray-800">
                    <ArrowLeft size={16} className="mr-1"/> Back to Sign In
                  </button>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Reset Password</h2>
                  <p className="text-sm text-gray-500 mb-8">Enter your mobile number or email to receive reset instructions</p>
                  
                  {cooldown > 0 && (
                    <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-lg text-sm text-orange-800 flex items-center justify-between">
                      <span className="flex items-center gap-2"><AlertCircle size={16}/> Please wait</span>
                      <span className="font-bold">{cdMm}:{cdSs}</span>
                    </div>
                  )}

                  <form onSubmit={handleIdentifierSubmit}>
                    <FloatingInput
                      id="identifier"
                      label="Mobile Number or Email*"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoFocus
                      required
                    />

                    <button type="submit" disabled={loading || cooldown > 0} className="w-full bg-brand-primary text-white font-bold py-3.5 rounded-sm hover:bg-brand-primary/90 transition-colors shadow-sm disabled:opacity-50">
                      {loading ? 'PLEASE WAIT...' : 'CONTINUE'}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* STEP 2A: SENT EMAIL */}
              {step === 'SENT_EMAIL' && (
                <motion.div key="step2a" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-6">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <CheckCircle size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Check Your Email</h3>
                  <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                    We've sent a recovery link to <br/><strong className="text-gray-800">{identifier}</strong>
                  </p>
                  <button onClick={() => setStep('IDENTIFIER')} className="text-brand-secondary font-bold text-sm mb-6">
                    Use a different email
                  </button>
                  <Link to="/login" className="w-full border border-gray-300 rounded-sm py-3 flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                    Back to Login
                  </Link>
                </motion.div>
              )}

              {/* STEP 2B: OTP RESET (MOBILE) */}
              {step === 'OTP_RESET' && (
                <motion.div key="step2b" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <button onClick={() => setStep('IDENTIFIER')} className="flex items-center text-sm text-gray-500 mb-6 hover:text-gray-800">
                    <ArrowLeft size={16} className="mr-1"/> Change Mobile Number
                  </button>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Reset Password</h2>
                  <p className="text-sm text-gray-500 mb-8">Enter the OTP sent to <span className="font-bold text-gray-800">{identifier}</span> and your new password.</p>
                  
                  <form onSubmit={handleOtpResetSubmit}>
                    <FloatingInput
                      id="otp"
                      label="6-Digit OTP*"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      autoFocus
                      required
                    />

                    <FloatingInput
                      id="newPassword"
                      label="New Password*"
                      type={showPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      rightElement={
                        <button type="button" onClick={() => setShowPass(!showPass)} className="text-gray-400 p-1">
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />

                    <button type="submit" disabled={loading} className="w-full bg-brand-primary text-white font-bold py-3.5 rounded-sm hover:bg-brand-primary/90 transition-colors shadow-sm mt-4">
                      {loading ? 'PLEASE WAIT...' : 'RESET PASSWORD'}
                    </button>
                  </form>
                  
                  <div className="flex items-center text-sm mt-6 text-gray-500 justify-center">
                    Resend OTP in: <span className="font-bold text-gray-800 ml-1">00:{cdSs}</span>
                  </div>
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
