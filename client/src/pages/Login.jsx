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

// ── Main Component ──
const Login = () => {
  const { t } = useTranslation()
  const { login, loginOtp, googleLogin, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  // Flow State: IDENTIFIER -> OTP (if mobile) -> PASSWORD (fallback or email)
  const [step, setStep] = useState('IDENTIFIER')

  // Form State
  const [identifier, setIdentifier] = useState('') // Mobile or Email
  const [otp, setOtp]               = useState(['', '', '', '', '', '']) // 6 digits to match backend
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [loading, setLoading]       = useState(false)

  // Timer State for OTP
  const [timeLeft, setTimeLeft] = useState(30)

  useEffect(() => {
    if (user) {
      if (user.role === 'courier') navigate('/courier/scan', { replace: true })
      else navigate(from, { replace: true })
    }
  }, [user, navigate, from])

  // Countdown timer for OTP
  useEffect(() => {
    if (step === 'OTP' && timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timerId)
    }
  }, [step, timeLeft])

  // Handle Google Popup Token fallback
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    if (token) {
      setLoading(true)
      googleLogin(token).then(() => {
        toast.success(t('auth.loginDesc', 'Welcome back! 👋').replace(' Please enter your details.', ''))
        navigate(from, { replace: true })
      }).catch(() => {
        toast.error('Google login failed')
        setLoading(false)
      })
    }
  }, [location.search, googleLogin, navigate, from, t])

  // ── Step Handlers ──

  const handleIdentifierSubmit = async (e) => {
    e.preventDefault()
    if (!identifier.trim()) {
      toast.error('Please enter Mobile Number or Email')
      return
    }

    const isEmail = identifier.includes('@')
    const isMobile = /^\d{10}$/.test(identifier.trim())

    if (isEmail) {
      // Direct to password for email
      setStep('PASSWORD')
    } else if (isMobile) {
      // Send OTP for mobile
      setLoading(true)
      try {
        await api.post('/api/otp/send', { phone: identifier.trim() })
        toast.success(`OTP sent to ${identifier.trim()}`)
        setStep('OTP')
        setTimeLeft(30)
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to send OTP')
      } finally {
        setLoading(false)
      }
    } else {
      toast.error('Please enter a valid 10-digit mobile number or email address')
    }
  }

  const handleOtpComplete = async (fullOtp) => {
    if (fullOtp.length !== 6) return
    setLoading(true)
    try {
      await loginOtp(identifier.trim(), fullOtp)
      toast.success('Successfully logged in!')
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP')
      setOtp(['', '', '', '', '', '']) // reset all 6 fields
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (!password) { toast.error('Please enter your password'); return }
    setLoading(true)
    try {
      await login(identifier.trim(), password)
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    const width = 500, height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const messageListener = async (event) => {
      if (event.data && event.data.token) {
        window.removeEventListener('message', messageListener)
        setLoading(true)
        try {
          await googleLogin(event.data.token)
        } catch {
          toast.error('Google login failed')
        } finally {
          setLoading(false)
        }
      }
    }
    window.addEventListener('message', messageListener)
    window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google`, 'Google Login', `width=${width},height=${height},left=${left},top=${top}`)
  }

  const resendOtp = async () => {
    if (timeLeft > 0) return
    setLoading(true)
    try {
      await api.post('/api/otp/send', { phone: identifier.trim() })
      toast.success('OTP resent successfully')
      setTimeLeft(30)
      setOtp(['', '', '', '', '', '']) // reset 6 slots
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[var(--ivory)] font-sans">
      <Helmet>
        <title>Login or Signup — Daatasa</title>
        <meta name="description" content="Sign in to your Daatasa account to access pure Vedic Bilona Ghee orders." />
      </Helmet>

      {/* ── Left Hero Panel (Desktop) ── */}
      <div className="hidden lg:flex flex-col w-[48%] xl:w-[50%] bg-gradient-to-br from-[#1B2F6E] via-[#111e47] to-[#050a17] items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-secondary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <Link to="/" className="z-10">
          <img src="/logo_rectangle.png" alt="Daatasa" className="h-14 w-auto mb-8 bg-white px-4 py-2 rounded-xl shadow-lg hover:opacity-95 transition-opacity" />
        </Link>
        <h1 className="text-4xl font-display font-bold text-white text-center leading-tight mb-4 z-10">
          Experience the Purity of <br/> <span className="text-brand-secondary">Vedic Bilona Ghee</span>
        </h1>
        <p className="text-white/80 text-center max-w-md z-10 leading-relaxed">
          Join thousands of happy families experiencing the health benefits of our traditionally churned ghee.
        </p>
        <div className="mt-12 w-full max-w-lg z-10">
          <img src="/matka.png" alt="Ghee Matka" className="w-full h-auto drop-shadow-2xl" />
        </div>
      </div>

      {/* ── Right Form Container ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 w-full relative">
        <div className="w-full h-48 sm:hidden bg-gradient-to-br from-[#1B2F6E] via-[#111e47] to-[#050a17] absolute top-0 left-0" />

        <div className="w-full max-w-[440px] rounded-[1.5rem] sm:rounded-[2rem] p-6 xs:p-8 sm:p-10 bg-white border border-brand-primary/10 shadow-[0_24px_80px_rgba(27,47,110,0.08)] z-10 min-h-screen sm:min-h-0 flex flex-col justify-center overflow-hidden relative">
          
          {/* Mobile Top Logo inside card */}
          <div className="bg-[#1B2F6E]/10 h-28 flex items-center justify-center relative sm:hidden rounded-2xl mb-8 -mt-2">
            <Link to="/">
              <img src="/logo_rectangle.png" alt="Daatasa" className="h-10 w-auto" />
            </Link>
          </div>

          <div className="w-full">
            <AnimatePresence mode="wait">
              
              {/* STEP 1: IDENTIFIER (Mobile or Email) */}
              {step === 'IDENTIFIER' && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold font-display text-brand-primary mb-2">
                      Login <span className="text-brand-secondary font-normal text-2xl">or</span> Signup
                    </h2>
                    <p className="text-sm font-medium text-brand-text/60">
                      Enter your mobile number or email to proceed
                    </p>
                  </div>
                  
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
                    
                    <p className="text-[11px] text-gray-500 my-4 leading-relaxed">
                      By continuing, I agree to the{' '}
                      <Link to="/terms" className="text-brand-secondary font-bold hover:underline">
                        Terms of Use
                      </Link>{' '}
                      &{' '}
                      <Link to="/privacy" className="text-brand-secondary font-bold hover:underline">
                        Privacy Policy
                      </Link>
                    </p>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full btn btn-primary h-14 rounded-full flex items-center justify-center gap-2 mt-2 text-sm font-bold shadow-lg shadow-gold/20 hover:shadow-gold/40 active:scale-[0.98] transition-all"
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

                  {/* Divider */}
                  <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-brand-primary/10" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text/40">
                      Or continue with
                    </span>
                    <div className="flex-1 h-px bg-brand-primary/10" />
                  </div>

                  {/* Google Sign-In Button */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full h-14 rounded-full flex items-center justify-center gap-3 transition-all mb-6 bg-white border border-brand-primary/20 text-brand-primary font-bold text-sm hover:bg-brand-primary/5 hover:border-brand-primary/40 shadow-sm active:scale-[0.98]"
                  >
                    <img
                      src="https://www.svgrepo.com/show/475656/google-color.svg"
                      alt="Google"
                      className="w-5 h-5"
                    />
                    Continue with Google
                  </button>

                  <div className="mt-4 pt-4 border-t border-brand-primary/10 flex items-center justify-between text-xs text-brand-text/60">
                    <span>Having trouble logging in?</span>
                    <a href="mailto:support@daatasa.com" className="text-brand-secondary font-bold hover:underline flex items-center gap-1">
                      <HelpCircle size={13} />
                      Get help
                    </a>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: OTP VERIFICATION */}
              {step === 'OTP' && (
                <motion.div
                  key="step2"
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
                    <span>Back</span>
                  </button>

                  <div className="mb-6">
                    <h2 className="text-3xl font-bold font-display text-brand-primary mb-2">Verify with OTP</h2>
                    <p className="text-sm font-medium text-brand-text/60">
                      Sent to <span className="font-bold text-brand-primary">{identifier}</span>
                    </p>
                  </div>
                  
                  <div className="flex gap-2 sm:gap-3 justify-center mb-6">
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
                        className="w-11 sm:w-12 h-13 sm:h-14 text-center text-xl font-bold rounded-xl border transition-all text-brand-primary font-mono outline-none"
                        style={{
                          background: otp[index] ? '#FFFFFF' : 'var(--ivory)',
                          border: `1.5px solid ${otp[index] ? 'var(--brand-secondary)' : 'rgba(27, 47, 110, 0.2)'}`,
                          boxShadow: otp[index] ? '0 0 0 3px rgba(217, 165, 32, 0.15)' : 'none',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--brand-secondary)'
                          e.target.style.boxShadow = '0 0 0 3px rgba(217, 165, 32, 0.20), 0 2px 8px rgba(217, 165, 32, 0.10)'
                          e.target.style.background = '#FFFFFF'
                        }}
                        onBlur={(e) => {
                          if (!otp[index]) {
                            e.target.style.borderColor = 'rgba(27, 47, 110, 0.2)'
                            e.target.style.boxShadow = 'none'
                            e.target.style.background = 'var(--ivory)'
                          }
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm mt-4 text-brand-text/60 bg-brand-primary/5 p-3 rounded-xl">
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

                  <div className="mt-6 pt-4 border-t border-brand-primary/10 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('PASSWORD')}
                      className="text-sm font-medium text-brand-text/70 hover:text-brand-secondary text-left transition-colors"
                    >
                      Log in using <span className="text-brand-secondary font-bold">Password</span>
                    </button>
                    
                    <div className="text-xs text-brand-text/50">
                      Having trouble logging in? <a href="mailto:support@daatasa.com" className="text-brand-secondary font-bold hover:underline">Get help</a>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: PASSWORD LOGIN */}
              {step === 'PASSWORD' && (
                <motion.div
                  key="step3"
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
                    <span>Back</span>
                  </button>

                  <div className="mb-6">
                    <h2 className="text-3xl font-bold font-display text-brand-primary mb-2">Welcome Back</h2>
                    <p className="text-sm font-medium text-brand-text/60">Enter your password to sign in</p>
                  </div>
                  
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <FloatingInput
                      id="pass-identifier"
                      label="Email or Mobile Number*"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      icon={identifier.includes('@') ? Mail : Phone}
                      required
                    />

                    <FloatingInput
                      id="password"
                      label="Password*"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      icon={Lock}
                      required
                      autoFocus
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
                          <span>LOGIN</span>
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 pt-4 border-t border-brand-primary/10 flex flex-col gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Forgot your password?</span>{' '}
                      <Link to="/forgot-password" className="text-brand-secondary font-bold hover:underline">
                        Reset here
                      </Link>
                    </div>
                    <div>
                      <span className="text-gray-500">Have trouble logging in?</span>{' '}
                      <a href="mailto:support@daatasa.com" className="text-brand-secondary font-bold hover:underline">
                        Get Help
                      </a>
                    </div>
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

export default Login
