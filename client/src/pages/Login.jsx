// pages/Login.jsx — Unified Luxury Login Flow
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Lock, ArrowLeft, ArrowRight, Phone, Mail, Sparkles, HelpCircle } from 'lucide-react'
import { toast } from 'react-toastify'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'

// ── Shared Floating Input System ──
const FloatingInput = ({ id, label, type = 'text', value, onChange, icon: Icon, prefix, rightElement, autoComplete, required, autoFocus, maxLength, placeholder, disabled }) => {
  const [focused, setFocused] = useState(false)

  return (
    <div className="relative w-full mb-3">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none select-none text-brand-primary font-bold text-xs border-r border-brand-primary/15 pr-2.5 z-10">
            {prefix}
          </div>
        ) : Icon ? (
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 z-10"
            style={{ color: focused ? 'var(--gold)' : 'var(--text-muted)' }}
          >
            <Icon size={15} />
          </div>
        ) : null}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={placeholder || (label ? `Enter ${label.replace('*', '').trim()}` : '')}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full rounded-xl text-xs sm:text-sm font-medium outline-none transition-all placeholder:text-gray-400"
          style={{
            height: '44px',
            paddingLeft: prefix ? '74px' : Icon ? '36px' : '12px',
            paddingRight: rightElement ? '38px' : '12px',
            background: focused ? '#FFFFFF' : 'var(--ivory)',
            border: `1.5px solid ${focused ? 'var(--brand-secondary)' : 'rgba(27, 47, 110, 0.15)'}`,
            color: 'var(--brand-primary)',
            boxShadow: focused ? '0 0 0 3px rgba(217, 165, 32, 0.15)' : 'none',
          }}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">{rightElement}</div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ──
const Login = () => {
  const { t } = useTranslation()
  const { login, loginOtp, googleLogin, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [step, setStep] = useState('IDENTIFIER')
  const [mode, setMode] = useState('mobile') // 'mobile' | 'email'
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp]               = useState(['', '', '', '', '', ''])
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [timeLeft, setTimeLeft]     = useState(30)

  useEffect(() => {
    if (user) {
      if (user.role === 'courier') navigate('/courier/scan', { replace: true })
      else if (user.role === 'support') navigate('/support-panel', { replace: true })
      else if ((user.role === 'admin' || user.role === 'superadmin') && from === '/') navigate('/admin', { replace: true })
      else navigate(from, { replace: true })
    }
  }, [user, navigate, from])

  useEffect(() => {
    if (step === 'OTP' && timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timerId)
    }
  }, [step, timeLeft])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    if (token) {
      setLoading(true)
      googleLogin(token).then(() => {
        toast.success('Welcome back! 👋')
        navigate(from, { replace: true })
      }).catch(() => {
        toast.error('Google login failed')
        setLoading(false)
      })
    }
  }, [location.search, googleLogin, navigate, from])

  const handleIdentifierSubmit = async (e) => {
    e.preventDefault()
    const trimmed = identifier.trim()
    if (!trimmed) {
      toast.error(mode === 'mobile' ? 'Please enter your 10-digit mobile number' : 'Please enter your email or username')
      return
    }

    if (mode === 'mobile') {
      const cleanedPhone = trimmed.replace(/\D/g, '').slice(-10)
      if (!/^[6-9][0-9]{9}$/.test(cleanedPhone)) {
        toast.error('Please enter a valid 10-digit Indian mobile number')
        return
      }
      setLoading(true)
      try {
        await api.post('/api/otp/send', { phone: cleanedPhone })
        toast.success(`OTP sent to +91 ${cleanedPhone}`)
        setIdentifier(cleanedPhone)
        setStep('OTP')
        setTimeLeft(30)
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to send OTP')
      } finally {
        setLoading(false)
      }
    } else {
      const hasAtSymbol = trimmed.includes('@')
      if (hasAtSymbol) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        if (!emailRegex.test(trimmed)) {
          toast.error('Please enter a valid email address (e.g. name@gmail.com, name@domain.in, name@domain.co.in)')
          return
        }
      }
      // Valid email or username (e.g. support1, admin) -> proceed to password
      setStep('PASSWORD')
    }
  }

  const handleOtpComplete = async (fullOtp) => {
    if (fullOtp.length !== 6) return
    setLoading(true)
    try {
      await loginOtp(identifier.trim(), fullOtp)
      toast.success('Login successful! 🎉')
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP')
      setOtp(['', '', '', '', '', ''])
      document.getElementById('otp-0')?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (!password) {
      toast.error('Please enter your password')
      return
    }
    setLoading(true)
    try {
      const data = await login(identifier.trim(), password)
      toast.success('Welcome back! 👋')
      const targetUser = data?.user
      if (targetUser?.role === 'support') {
        navigate('/support-panel', { replace: true })
      } else if (targetUser?.role === 'admin' || targetUser?.role === 'superadmin') {
        navigate(from && from !== '/' ? from : '/admin', { replace: true })
      } else if (targetUser?.role === 'courier') {
        navigate('/courier/scan', { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    const width = 500, height = 600
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2
    window.open(
      `${api.defaults.baseURL || ''}/api/auth/google`,
      'Google Login',
      `width=${width},height=${height},left=${left},top=${top}`
    )
  }

  const resendOtp = async () => {
    if (timeLeft > 0) return
    setLoading(true)
    try {
      await api.post('/api/otp/send', { phone: identifier.trim() })
      toast.success('OTP resent successfully')
      setTimeLeft(30)
      setOtp(['', '', '', '', '', ''])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="py-4 sm:py-8 lg:py-10 px-3 sm:px-6 flex flex-col items-center justify-start bg-[var(--ivory)] font-sans relative">
      <Helmet>
        <title>Login or Signup — Daatasa</title>
        <meta name="description" content="Sign in to your Daatasa account to access pure Vedic Bilona Ghee orders." />
      </Helmet>

      {/* Brand Logo Header */}
      <div className="flex justify-center mb-3 sm:mb-5 z-10">
        <Link to="/" className="inline-block bg-white px-3.5 py-1.5 rounded-2xl border border-brand-primary/10 shadow-xs hover:shadow-sm transition-all">
          <img src="/logo_rectangle.png" alt="Daatasa" className="h-8 sm:h-10 w-auto" />
        </Link>
      </div>

      {/* Centered Form Card */}
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
              <div className="mb-3.5 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-primary mb-0.5">
                  Login <span className="text-brand-secondary font-normal text-lg sm:text-xl">or</span> Signup
                </h2>
                <p className="text-xs text-brand-text/60">
                  Enter your mobile number, email, or username to proceed
                </p>
              </div>
              
              {/* Tab Selector: Mobile vs Email / Username */}
              <div className="flex bg-brand-primary/5 p-1 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() => { setMode('mobile'); setIdentifier(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'mobile'
                      ? 'bg-white text-brand-primary shadow-xs'
                      : 'text-brand-text/60 hover:text-brand-primary'
                  }`}
                >
                  <Phone size={13} />
                  <span>Mobile OTP</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('email'); setIdentifier(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'email'
                      ? 'bg-white text-brand-primary shadow-xs'
                      : 'text-brand-text/60 hover:text-brand-primary'
                  }`}
                >
                  <Mail size={13} />
                  <span>Email / Password</span>
                </button>
              </div>

              <form onSubmit={handleIdentifierSubmit} className="space-y-2.5">
                {mode === 'mobile' ? (
                  <FloatingInput
                    id="identifier"
                    label="Mobile Number*"
                    prefix={<span className="flex items-center gap-1"><span>🇮🇳</span><span>+91</span></span>}
                    placeholder="9876543210"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={identifier}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '')
                      if (val.startsWith('91') && val.length > 10) val = val.slice(2)
                      else if (val.startsWith('0') && val.length > 10) val = val.slice(1)
                      setIdentifier(val.slice(0, 10))
                    }}
                    autoFocus
                    required
                  />
                ) : (
                  <FloatingInput
                    id="identifier"
                    label="Email or Username*"
                    icon={Mail}
                    placeholder="e.g. name@gmail.com, support1"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoFocus
                    required
                  />
                )}
                
                <p className="text-[10px] text-gray-500 my-2 leading-relaxed">
                  By continuing, I agree to the{' '}
                  <Link to="/terms" className="text-brand-secondary font-bold hover:underline">
                    Terms of Use
                  </Link>{' '}
                  &{' '}
                  <Link to="/privacy-policy" className="text-brand-secondary font-bold hover:underline">
                    Privacy Policy
                  </Link>
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn btn-primary h-10 sm:h-11 rounded-full flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold shadow-md shadow-gold/20 hover:shadow-gold/40 active:scale-[0.98] transition-all"
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

              {/* Divider */}
              <div className="flex items-center gap-2.5 my-3">
                <div className="flex-1 h-px bg-brand-primary/10" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-brand-text/40">
                  Or continue with
                </span>
                <div className="flex-1 h-px bg-brand-primary/10" />
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-10 sm:h-11 rounded-full flex items-center justify-center gap-2 transition-all mb-3 bg-white border border-brand-primary/15 text-brand-primary font-bold text-xs hover:bg-brand-primary/5 hover:border-brand-primary/30 shadow-2xs active:scale-[0.98]"
              >
                <img
                  src="https://www.svgrepo.com/show/475656/google-color.svg"
                  alt="Google"
                  className="w-3.5 h-3.5"
                />
                <span>Continue with Google</span>
              </button>

              <div className="mt-2.5 pt-2.5 border-t border-brand-primary/10 flex items-center justify-between text-[11px] text-brand-text/60">
                <span>Having trouble logging in?</span>
                <a href="mailto:support@daatasa.com" className="text-brand-secondary font-bold hover:underline flex items-center gap-1">
                  <HelpCircle size={12} />
                  Get help
                </a>
              </div>
            </motion.div>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {step === 'OTP' && (
            <motion.div
              key="step2"
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
                <span>Back</span>
              </button>

              <div className="mb-3">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-primary mb-0.5">Verify with OTP</h2>
                <p className="text-xs font-medium text-brand-text/60">
                  Sent to <span className="font-bold text-brand-primary font-mono">{/^\d{10}$/.test(identifier) ? `+91 ${identifier}` : identifier}</span>
                </p>
              </div>
              
              <div className="flex gap-1.5 sm:gap-2 justify-center mb-3">
                {[0, 1, 2, 3, 4, 5].map((_, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otp[index] || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '')
                      if (val.length > 1) return
                      let newOtp = [...otp]
                      newOtp[index] = val
                      setOtp(newOtp)
                      if (val && index < 5) {
                        document.getElementById(`otp-${index + 1}`)?.focus()
                      }
                      if (newOtp.slice(0, 6).every(v => v !== '') && (val || index === 5)) {
                        handleOtpComplete(newOtp.slice(0, 6).join(''))
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !otp[index] && index > 0) {
                        document.getElementById(`otp-${index - 1}`)?.focus()
                      }
                    }}
                    className="w-9 sm:w-11 h-10 sm:h-12 text-center text-base sm:text-lg font-bold rounded-xl border transition-all text-brand-primary font-mono outline-none"
                    style={{
                      background: otp[index] ? '#FFFFFF' : 'var(--ivory)',
                      border: `1.5px solid ${otp[index] ? 'var(--brand-secondary)' : 'rgba(27, 47, 110, 0.15)'}`,
                      boxShadow: otp[index] ? '0 0 0 2px rgba(217, 165, 32, 0.15)' : 'none',
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs mt-2 text-brand-text/60 bg-brand-primary/5 p-2 rounded-xl">
                <span>
                  Resend OTP in: <span className="font-bold text-brand-primary">00:{timeLeft.toString().padStart(2, '0')}</span>
                </span>
                {timeLeft === 0 && (
                  <button
                    type="button"
                    onClick={resendOtp}
                    disabled={loading}
                    className="text-brand-secondary font-bold hover:underline"
                  >
                    RESEND
                  </button>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-brand-primary/10 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setStep('PASSWORD')}
                  className="text-xs font-medium text-brand-text/70 hover:text-brand-secondary text-left transition-colors"
                >
                  Log in using <span className="text-brand-secondary font-bold">Password</span>
                </button>
                
                <div className="text-[10px] text-brand-text/50">
                  Having trouble logging in? <a href="mailto:support@daatasa.com" className="text-brand-secondary font-bold hover:underline">Get help</a>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: PASSWORD */}
          {step === 'PASSWORD' && (
            <motion.div
              key="step3"
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
                <span>Back</span>
              </button>

              <div className="mb-3">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-primary mb-0.5">Enter Password</h2>
                <p className="text-xs font-medium text-brand-text/60">
                  For <span className="font-bold text-brand-primary font-mono">{/^\d{10}$/.test(identifier) ? `+91 ${identifier}` : identifier}</span>
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-2.5">
                <FloatingInput
                  id="password"
                  label="Password*"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={Lock}
                  autoFocus
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="text-gray-400 hover:text-brand-primary transition-colors"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                />

                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-xs font-bold text-brand-secondary hover:underline">
                    Forgot Password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn btn-primary h-10 sm:h-11 rounded-full flex items-center justify-center gap-1.5 mt-1 text-xs sm:text-sm font-bold shadow-md shadow-gold/20 hover:shadow-gold/40 active:scale-[0.98] transition-all"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>LOG IN</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

export default Login
