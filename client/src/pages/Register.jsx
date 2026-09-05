// pages/Register.jsx — Premium Immersive Design
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Check, Sparkles } from 'lucide-react'
import { toast } from 'react-toastify'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

const FloatingInput = ({ id, label, type = 'text', value, onChange, icon: Icon, rightElement, autoComplete, required, placeholder }) => {
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

const Register = () => {
  const { t } = useTranslation()
  const { register, googleLogin, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [name,         setName]         = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [showConf,     setShowConf]     = useState(false)
  const [loading,      setLoading]      = useState(false)

  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user, navigate])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    const ref = params.get('ref')
    if (ref) setReferralCode(ref)
    
    if (token) {
      setLoading(true)
      googleLogin(token).then(() => {
        toast.success('Account created! Welcome to Daatasa 🎉')
        navigate('/', { replace: true })
      }).catch(() => {
        toast.error('Google login failed')
        setLoading(false)
      })
    }
  }, [location.search, googleLogin, navigate])

  const strength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 6) s++
    if (password.length >= 10) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][strength]
  const strengthColor = strength <= 2 ? 'var(--danger)' : strength <= 4 ? 'var(--warning)' : 'var(--success)'
  const strengthGrad = strength <= 2
    ? 'linear-gradient(90deg, #E53E3E, #FC8181)'
    : strength <= 4
    ? 'linear-gradient(90deg, #D69E2E, #F6D860)'
    : 'linear-gradient(90deg, #38A169, #68D391)'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password || !confirm) { toast.error('Please fill all required fields'); return }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address (e.g. name@gmail.com, name@domain.in, name@domain.co.in)')
      return
    }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await register(name.trim(), email.trim(), password, referralCode.trim())
      toast.success('Account created! Welcome to Daatasa 🎉')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Registration failed. Please try again.')
    } finally { setLoading(false) }
  }

  const handleGoogleLogin = () => {
    const width = 500, height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    
    const messageListener = async (event) => {
      if (event.data && event.data.token) {
        window.removeEventListener('message', messageListener);
        setLoading(true)
        try {
          await googleLogin(event.data.token)
        } catch {
          toast.error('Google login failed')
        } finally {
          setLoading(false)
        }
      }
    };
    window.addEventListener('message', messageListener);

    const authBaseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '')
    window.open(
      `${authBaseUrl}/api/auth/google`,
      'Google Login',
      `width=${width},height=${height},left=${left},top=${top}`
    )
  }

  return (
    <div className="py-4 sm:py-8 lg:py-10 px-3 sm:px-6 flex flex-col items-center justify-start bg-[var(--ivory)] font-sans relative">
      <Helmet>
        <title>Create Account — Daatasa</title>
        <meta name="description" content="Create a Daatasa account to shop pure Bilona ghee online." />
      </Helmet>

      {/* Brand Logo Header */}
      <div className="flex justify-center mb-3 sm:mb-5 z-10">
        <Link to="/" className="inline-block bg-white px-3.5 py-1.5 rounded-2xl border border-brand-primary/10 shadow-xs hover:shadow-sm transition-all">
          <img src="/logo_rectangle.png" alt="Daatasa" className="h-8 sm:h-10 w-auto" />
        </Link>
      </div>

      {/* Centered Form Card */}
      <div className="w-full max-w-[420px] rounded-2xl sm:rounded-3xl p-4 xs:p-5 sm:p-7 bg-white border border-brand-primary/10 shadow-lg shadow-brand-primary/5 relative z-10">
        <div className="mb-3.5 text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold font-display text-brand-primary mb-0.5">{t('auth.createAccount', 'Create Account')}</h1>
          <p className="text-xs text-brand-text/60">
            {t('auth.haveAccount', 'Already have one?')} {' '}
            <Link to="/login" className="text-brand-secondary font-bold hover:text-brand-primary transition-colors">{t('auth.signInBtn', 'Sign in')}</Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <FloatingInput
            id="reg-name" label={t('auth.nameLabel', 'Full Name*')} type="text"
            value={name} onChange={e => setName(e.target.value)}
            icon={User} autoComplete="name" required
          />
          <FloatingInput
            id="reg-email" label={t('auth.emailLabel', 'Email address*')} type="email"
            value={email} onChange={e => setEmail(e.target.value)}
            icon={Mail} autoComplete="email" required
          />
          <FloatingInput
            id="reg-password" label={t('auth.passLabel', 'Password*')} type={showPass ? 'text' : 'password'}
            value={password} onChange={e => setPassword(e.target.value)}
            icon={Lock} autoComplete="new-password" required
            rightElement={
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="text-gray-400 hover:text-brand-primary transition-colors">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />

          {password && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pb-0.5">
              <div className="flex gap-1 mb-0.5">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-1 flex-1 rounded-full transition-all duration-500"
                    style={{ background: i <= strength ? strengthGrad : 'rgba(27,47,110,0.1)' }} />
                ))}
              </div>
              <div className="flex justify-between">
                <p className="text-[9px] font-bold uppercase tracking-widest text-brand-text/40">{t('auth.passwordStrength', 'Password strength')}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: strengthColor }}>{strengthLabel}</p>
              </div>
            </motion.div>
          )}

          <FloatingInput
            id="reg-confirm" label={t('auth.confirmPassword', 'Confirm Password*')} type={showConf ? 'text' : 'password'}
            value={confirm} onChange={e => setConfirm(e.target.value)}
            icon={Lock} autoComplete="new-password" required
            rightElement={
              <button type="button" onClick={() => setShowConf(v => !v)}
                className="text-gray-400 hover:text-brand-primary transition-colors">
                {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />

          <FloatingInput
            id="reg-referral" label={t('auth.referralCode', 'Referral Code (Optional)')} type="text"
            value={referralCode} onChange={e => setReferralCode(e.target.value)}
            icon={Sparkles}
          />

          <button type="submit" disabled={loading}
            className="w-full btn btn-primary h-10 sm:h-11 rounded-full flex items-center justify-center gap-1.5 mt-1 text-xs sm:text-sm font-bold shadow-md shadow-gold/20 hover:shadow-gold/40 active:scale-[0.98] transition-all">
            {loading
              ? <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              : <><Sparkles size={14} /> {t('auth.createAccountBtn', 'Create Account')}</>
            }
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-2.5 my-3">
          <div className="flex-1 h-px bg-brand-primary/10" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-text/40">{t('auth.orContinueWith', 'Or continue with')}</span>
          <div className="flex-1 h-px bg-brand-primary/10" />
        </div>

        {/* Google Login Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full h-10 sm:h-11 rounded-full flex items-center justify-center gap-2 transition-all mb-3 bg-white border border-brand-primary/15 text-brand-primary font-bold text-xs hover:bg-brand-primary/5 hover:border-brand-primary/30 shadow-2xs active:scale-[0.98]"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-3.5 h-3.5" />
          <span>{t('auth.googleSignupBtn', 'Sign up with Google')}</span>
        </button>

        <p className="mt-2.5 pt-2.5 text-[10px] sm:text-[11px] text-center font-normal text-brand-text/60 border-t border-brand-primary/10">
          By signing up you agree to our{' '}
          <Link to="/terms" className="text-brand-secondary font-bold hover:underline">Terms of Use</Link>
          {' '}&{' '}
          <Link to="/privacy-policy" className="text-brand-secondary font-bold hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
