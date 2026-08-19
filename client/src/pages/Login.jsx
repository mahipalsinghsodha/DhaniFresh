// pages/Login.jsx — Myntra-style Unified Login Flow
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react'
import { toast } from 'react-toastify'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'

// ── Shared UI Components ──
const FloatingInput = ({ id, label, type = 'text', value, onChange, icon: Icon, rightElement, autoComplete, required, autoFocus, maxLength }) => {
  const [focused, setFocused] = useState(false)
  return (
    <div className="relative w-full mb-5">
      <div className={`relative border rounded-lg transition-colors duration-200 ${focused ? 'border-brand-primary' : 'border-gray-300'} bg-white`}>
        {/* Label that shrinks and floats */}
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


// ── Main Component ──
const Login = () => {
  const { t } = useTranslation()
  const { login, loginOtp, googleLogin, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  // Flow State
  // IDENTIFIER -> OTP (if mobile) -> PASSWORD (fallback or email)
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
    const isMobile = /^\d{10}$/.test(identifier)

    if (isEmail) {
      // Direct to password for email
      setStep('PASSWORD')
    } else if (isMobile) {
      // Send OTP for mobile
      setLoading(true)
      try {
        await api.post('/api/otp/send', { phone: identifier })
        toast.success(`OTP sent to ${identifier}`)
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
      await loginOtp(identifier, fullOtp)
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
      await login(identifier, password)
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
      await api.post('/api/otp/send', { phone: identifier })
      toast.success('OTP resent successfully')
      setTimeLeft(30)
      setOtp(['', '', '', '', '', '']) // reset 6 slots
    } catch (err) {
      toast.error('Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  // ── Render Views ──

  return (
    <div className="min-h-screen flex bg-[var(--ivory)] font-sans">
      <Helmet>
        <title>Login or Signup — Daatasa</title>
      </Helmet>

      {/* Hero Banner (Myntra style top banner on mobile, side on desktop) */}
      <div className="hidden lg:flex flex-col w-[50%] bg-gradient-to-br from-[#1B2F6E] via-[#111e47] to-[#050a17] items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-secondary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <img src="/logo_rectangle.png" alt="Daatasa" className="h-14 w-auto mb-8 bg-white px-4 py-2 rounded-xl z-10" />
        <h1 className="text-4xl font-display font-bold text-white text-center leading-tight mb-4 z-10">
          Experience the Purity of <br/> <span className="text-brand-secondary">Vedic Bilona Ghee</span>
        </h1>
        <p className="text-white/80 text-center max-w-md z-10">Join thousands of happy families experiencing the health benefits of our traditionally churned ghee.</p>
        <div className="mt-12 w-full max-w-lg z-10">
          <img src="/matka.png" alt="Ghee Matka" className="w-full h-auto drop-shadow-2xl" />
        </div>
      </div>

      {/* Form Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-0 sm:p-6 w-full relative">
        <div className="w-full h-48 sm:hidden bg-gradient-to-br from-[#1B2F6E] via-[#111e47] to-[#050a17] absolute top-0 left-0">
          {/* Mobile top banner image could go here */}
        </div>

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
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Login <span className="text-gray-400 font-normal">or</span> Signup</h2>
                  <p className="text-sm text-gray-500 mb-8">Enter your mobile number or email to proceed</p>
                  
                  <form onSubmit={handleIdentifierSubmit}>
                    <FloatingInput
                      id="identifier"
                      label="+91 | Mobile Number or Email*"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoFocus
                      required
                    />
                    
                    <p className="text-[11px] text-gray-500 mb-6 mt-2 leading-relaxed">
                      By continuing, I agree to the <Link to="/terms" className="text-brand-secondary font-bold">Terms of Use</Link> & <Link to="/privacy" className="text-brand-secondary font-bold">Privacy Policy</Link>
                    </p>

                    <button type="submit" disabled={loading} className="w-full bg-brand-primary text-white font-bold py-3.5 rounded-sm hover:bg-brand-primary/90 transition-colors shadow-sm">
                      {loading ? 'PLEASE WAIT...' : 'CONTINUE'}
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">OR</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* Google Sign-In */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-sm py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                    Continue with Google
                  </button>

                  <div className="mt-6 flex items-center justify-start gap-2 text-sm">
                    <span className="text-gray-500">Have trouble logging in?</span>
                    <a href="mailto:support@daatasa.com" className="text-brand-secondary font-bold">Get help</a>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: OTP VERIFICATION */}
              {step === 'OTP' && (
                <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <button onClick={() => setStep('IDENTIFIER')} className="flex items-center text-sm text-gray-500 mb-6 hover:text-gray-800">
                    <ArrowLeft size={16} className="mr-1"/> Back
                  </button>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Verify with OTP</h2>
                  <p className="text-sm text-gray-500 mb-8">Sent to {identifier}</p>
                  
                  <div className="flex gap-2 justify-center mb-6">
                    {[0,1,2,3,4,5].map((_, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={otp[index] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isNaN(val)) return;
                          let newOtp = [...otp];
                          newOtp[index] = val;
                          setOtp(newOtp);
                          if (val && index < 5) document.getElementById(`otp-${index+1}`).focus();
                          if (newOtp.slice(0,6).every(v => v !== '') && index === 5) handleOtpComplete(newOtp.slice(0,6).join(''));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !otp[index] && index > 0) document.getElementById(`otp-${index-1}`).focus();
                        }}
                        className="w-10 h-10 text-center text-xl font-bold border border-gray-300 rounded focus:border-brand-secondary outline-none bg-transparent transition-colors text-gray-800"
                      />
                    ))}
                  </div>

                  <div className="flex items-center text-sm mt-4 text-gray-500">
                    Resend OTP in: <span className="font-bold text-gray-800 ml-1">00:{timeLeft.toString().padStart(2, '0')}</span>
                    {timeLeft === 0 && (
                      <button onClick={resendOtp} disabled={loading} className="text-brand-secondary font-bold ml-2">RESEND</button>
                    )}
                  </div>

                  <div className="mt-8 pt-6">
                    <button onClick={() => setStep('PASSWORD')} className="text-sm font-medium text-gray-600 hover:text-brand-secondary">
                      Log in using <span className="text-brand-secondary font-bold">Password</span>
                    </button>
                  </div>
                  
                  <div className="mt-8 pt-6 text-sm text-gray-500">
                    Having trouble logging in? <a href="#" className="text-brand-secondary font-bold">Get help</a>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: PASSWORD LOGIN */}
              {step === 'PASSWORD' && (
                <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <button onClick={() => setStep('IDENTIFIER')} className="flex items-center text-sm text-gray-500 mb-6 hover:text-gray-800">
                    <ArrowLeft size={16} className="mr-1"/> Back
                  </button>
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Login to your account</h2>
                  
                  <form onSubmit={handlePasswordSubmit}>
                    <FloatingInput
                      id="pass-identifier"
                      label="Email or Mobile Number*"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                    />

                    <FloatingInput
                      id="password"
                      label="Password*"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      rightElement={
                        <button type="button" onClick={() => setShowPass(!showPass)} className="text-gray-400 p-1">
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />

                    <button type="submit" disabled={loading} className="w-full bg-brand-primary text-white font-bold py-3.5 rounded-sm hover:bg-brand-primary/90 transition-colors shadow-sm mt-2 mb-6">
                      {loading ? 'PLEASE WAIT...' : 'LOGIN'}
                    </button>
                  </form>

                  <div className="flex flex-col gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Forgot your password?</span>{' '}
                      <Link to="/forgot-password" className="text-brand-secondary font-bold">Reset here</Link>
                    </div>
                    <div>
                      <span className="text-gray-500">Have trouble logging in?</span>{' '}
                      <a href="#" className="text-brand-secondary font-bold">Get Help</a>
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
