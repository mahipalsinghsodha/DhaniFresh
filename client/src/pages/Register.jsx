// pages/Register.jsx — Premium Immersive Design
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Check, Sparkles } from 'lucide-react'
import { toast } from 'react-toastify'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

const FloatingInput = ({ id, label, type = 'text', value, onChange, icon: Icon, rightElement, autoComplete, required }) => {
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
          autoComplete={autoComplete} required={required}
          placeholder={`Enter ${label.toLowerCase()}`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full rounded-[1rem] text-sm font-medium outline-none transition-all placeholder:text-brand-text/30"
          style={{
            height: '52px',
            paddingLeft: Icon ? '42px' : '14px',
            paddingRight: rightElement ? '44px' : '14px',
            background: focused ? '#FFFFFF' : 'var(--ivory)',
            border: `1px solid ${focused ? 'var(--brand-secondary)' : 'rgba(27, 47, 110, 0.2)'}`,
            color: 'var(--brand-primary)',
            boxShadow: focused ? '0 0 0 1px var(--brand-secondary)' : 'none',
          }}
        />
        {rightElement && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    </div>
  )
}

// PERKS definition moved inside component to use t()


const Register = () => {
  const { t } = useTranslation()
  
  const PERKS = [
    { text: t('auth.perkDeals', 'Access to exclusive deals & offers'),    color: 'rgba(212, 175, 55, 0.20)',   dot: 'var(--brand-secondary)' },
    { text: t('auth.perkTrack', 'Track your orders in real-time'),        color: 'rgba(56,161,105,0.18)',   dot: 'var(--success)' },
    { text: t('auth.perkWishlist', 'Save products to your wishlist'),         color: 'rgba(49,130,206,0.15)',   dot: 'var(--info)' },
    { text: t('auth.perkDiscount', 'Get 10% off your first order'),          color: 'rgba(212, 175, 55, 0.20)',   dot: 'var(--brand-secondary)' },
  ]

  const { register, googleLogin, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user])

  // Handle token from URL if redirected (fallback from popup)
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
      }).catch((err) => {
        toast.error('Google login failed')
        setLoading(false)
      })
    }
  }, [location.search, googleLogin, navigate])

  /* Password strength */
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
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    
    const messageListener = async (event) => {
      if (event.data && event.data.token) {
        window.removeEventListener('message', messageListener);
        setLoading(true)
        try {
          await googleLogin(event.data.token)
        } catch (err) {
          toast.error('Google login failed')
        } finally {
          setLoading(false)
        }
      }
    };
    window.addEventListener('message', messageListener);

    window.open(
      `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google`,
      'Google Login',
      `width=${width},height=${height},left=${left},top=${top}`
    )
  }

  return (
    <div className="min-h-screen flex bg-[var(--ivory)] font-sans">
      <Helmet>
        <title>Create Account — Daatasa</title>
        <meta name="description" content="Create a Daatasa account to shop pure Bilona ghee online." />
      </Helmet>

      {/* ── Left Panel (Brand Background) ── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden flex-col items-center justify-center p-12 bg-white border-r border-brand-primary/10">
        <div className="absolute top-10 right-10 w-80 h-80 rounded-full pointer-events-none animate-blob"
          style={{ background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%)', filter: 'blur(60px)', opacity: 0.5 }} />
        <div className="absolute bottom-10 left-10 w-64 h-64 rounded-full pointer-events-none animate-blob-delay"
          style={{ background: 'radial-gradient(circle, rgba(27, 47, 110, 0.08) 0%, transparent 70%)', filter: 'blur(50px)', opacity: 0.5 }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, var(--brand-primary) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 text-center max-w-md w-full"
        >
          <Link to="/" className="flex w-full justify-center items-center gap-3 mb-14">
            <img src="/logo_rectangle.png" alt="Daatasa Logo" className="h-16 w-auto" />
          </Link>

          <div className="relative mb-10 inline-block">
            <div className="w-40 h-40 rounded-[2rem] flex items-center justify-center mx-auto bg-brand-primary text-white shadow-[0_20px_60px_rgba(27,47,110,0.15)]">
              <div className="text-4xl sm:text-6xl animate-float">✨</div>
            </div>
            <div className="absolute -inset-4 rounded-[2.5rem] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(212, 175, 55, 0.25) 0%, transparent 70%)', filter: 'blur(16px)' }} />
          </div>

          <h2 className="text-3xl font-extrabold font-display text-brand-primary mb-3">
            {t('auth.registerTitle', 'Join the Family!')}
          </h2>
          <p className="text-base font-medium text-brand-text/60 leading-relaxed mb-10">
            {t('auth.registerDesc', 'Create your account and start enjoying the purest Bilona ghee delivered across India.')}
          </p>

          <div className="space-y-3 text-left">
            {PERKS.map((perk, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-4 p-4 rounded-[1rem] bg-brand-primary/5 border border-brand-primary/10"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white shadow-sm border border-brand-primary/5 text-brand-secondary">
                  <Check size={16} />
                </div>
                <span className="text-sm font-bold text-brand-primary">{perk.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[440px] py-4"
        >
          {/* Mobile logo */}
          <Link to="/" className="flex lg:hidden items-center justify-center mb-8">
            <img src="/logo_rectangle.png" alt="Daatasa Logo" className="h-14 w-auto" />
          </Link>

          {/* Card */}
          <div className="rounded-[1.5rem] sm:rounded-[2rem] p-6 xs:p-8 sm:p-10 bg-white border border-brand-primary/10 shadow-[0_24px_80px_rgba(27,47,110,0.08)]">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-3xl font-bold font-display text-brand-primary mb-2">{t('auth.createAccount', 'Create Account')}</h1>
              <p className="text-sm font-medium text-brand-text/60">
                {t('auth.haveAccount', 'Already have one?')} {' '}
                <Link to="/login" className="text-brand-secondary font-bold hover:text-brand-primary transition-colors">{t('auth.signInBtn', 'Sign in')}</Link>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <FloatingInput
                id="reg-name" label={t('auth.nameLabel', 'Full Name')} type="text"
                value={name} onChange={e => setName(e.target.value)}
                icon={User} autoComplete="name" required
              />
              <FloatingInput
                id="reg-email" label={t('auth.emailLabel', 'Email address')} type="email"
                value={email} onChange={e => setEmail(e.target.value)}
                icon={Mail} autoComplete="email" required
              />
              <FloatingInput
                id="reg-password" label={t('auth.passLabel', 'Password')} type={showPass ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                icon={Lock} autoComplete="new-password" required
                rightElement={
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    style={{ color: 'var(--text-muted)' }} className="p-1 hover:text-[var(--navy)] transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              {/* Password strength bar */}
              {password && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <div className="flex gap-1.5 mb-1.5 mt-2">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="h-1.5 flex-1 rounded-full transition-all duration-500"
                        style={{ background: i <= strength ? strengthGrad : 'rgba(27,47,110,0.1)' }} />
                    ))}
                  </div>
                  <div className="flex justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text/40">{t('auth.passwordStrength', 'Password strength')}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: strengthColor }}>{strengthLabel}</p>
                  </div>
                </motion.div>
              )}

              <FloatingInput
                id="reg-confirm" label={t('auth.confirmPassword', 'Confirm Password')} type={showConf ? 'text' : 'password'}
                value={confirm} onChange={e => setConfirm(e.target.value)}
                icon={Lock} autoComplete="new-password" required
                rightElement={
                  <button type="button" onClick={() => setShowConf(v => !v)}
                    style={{ color: 'var(--text-muted)' }} className="p-1 hover:text-[var(--navy)] transition-colors">
                    {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              <FloatingInput
                id="reg-referral" label={t('auth.referralCode', 'Referral Code (Optional)')} type="text"
                value={referralCode} onChange={e => setReferralCode(e.target.value)}
                icon={Sparkles}
              />

              <button type="submit" disabled={loading}
                className="w-full btn btn-primary h-14 rounded-full flex items-center justify-center gap-2 mt-4 text-sm font-bold">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Sparkles size={16} /> {t('auth.createAccountBtn', 'Create Account')}</>
                }
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-brand-primary/10" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text/40">{t('auth.orContinueWith', 'Or continue with')}</span>
              <div className="flex-1 h-px bg-brand-primary/10" />
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-14 rounded-full flex items-center justify-center gap-3 transition-colors mb-6 bg-white border border-brand-primary/20 text-brand-primary font-bold text-sm hover:bg-brand-primary/5"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              {t('auth.googleSignupBtn', 'Sign up with Google')}
            </button>

            <p className="mt-8 pt-6 text-xs text-center font-medium text-brand-text/60 border-t border-brand-primary/10">
              {t('auth.termsPrivacyConsent', 'By signing up you agree to our Terms & Privacy Policy').split('Terms & Privacy Policy').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <Link to="/terms" className="text-brand-primary font-bold hover:underline">Terms & Privacy Policy</Link>}
                </span>
              ))}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Register
