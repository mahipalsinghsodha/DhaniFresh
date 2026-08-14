// pages/Login.jsx — Premium Immersive Design
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'
import { FiShield, FiTruck, FiAward } from 'react-icons/fi'
import { FaUser } from 'react-icons/fa'
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
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
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

const TRUST_BADGES = [
  { emoji: '🔬', label: 'FSSAI Certified', icon: <FiAward size={16} /> },
  { emoji: '🧪', label: 'Lab Tested',      icon: <FiShield size={16} /> },
  { emoji: '🚚', label: 'Pan India',        icon: <FiTruck size={16} /> },
]

const Login = () => {
  const { t } = useTranslation()
  const { login, googleLogin, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => { if (user) navigate(from, { replace: true }) }, [user])

  // Handle token from URL if redirected (fallback from popup)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    if (token) {
      setLoading(true)
      googleLogin(token).then(() => {
        toast.success(t('auth.loginDesc', 'Welcome back! 👋').replace(' Please enter your details.', ''))
        navigate(from, { replace: true })
      }).catch((err) => {
        toast.error('Google login failed')
        setLoading(false)
      })
    }
  }, [location.search, googleLogin, navigate, from, t])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) { toast.error('Please fill all fields'); return }
    setLoading(true)
    try {
      const res = await login(email.trim(), password)
      toast.success(t('auth.loginDesc', 'Welcome back! 👋').replace(' Please enter your details.', ''))
      
      if (res?.user?.role === 'courier') {
        navigate('/courier/scan', { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid email or password')
    } finally { setLoading(false) }
  }

  const handleGoogleLogin = () => {
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    
    const messageListener = async (event) => {
      // Allow message if it contains the expected token structure
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
        <title>Login — Daatasa</title>
        <meta name="description" content="Log in to your Daatasa account to shop pure Bilona ghee." />
      </Helmet>

      {/* ── Left Panel (Brand Background) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] xl:w-[48%] p-10 xl:p-14 relative overflow-hidden bg-gradient-to-br from-[#1B2F6E] via-[#111e47] to-[#050a17]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-secondary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-2">
          <Link to="/" className="inline-block bg-[#fffdf8] rounded-[12px] px-3 py-1.5 shadow-sm">
            <img src="/logo_rectangle.png" alt="Daatasa Logo" className="h-10 w-auto" />
          </Link>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center pb-[38vh] pr-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex justify-center w-full mb-8">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-transparent border border-brand-secondary/50 text-brand-secondary">
                <FaUser size={24} />
              </div>
            </div>

            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-brand-secondary border border-brand-secondary/40 mb-5 shadow-sm">
              <Sparkles size={12} className="text-brand-secondary" />
              {t('home.heroBadgeNew', 'Heritage of Rajasthan')}
            </span>
            <h1 className="text-3xl xl:text-4xl font-display font-bold leading-[1.3] mb-5 text-white">
              {t('home.heroTitleNew', 'Pure Vedic Bilona')} <br />
              <span className="text-brand-secondary italic font-serif tracking-wide">{t('home.heroSubNew', 'Desi Cow Ghee')}</span>
            </h1>

            <div className="flex items-center gap-4 mb-5 w-48">
              <div className="flex-1 h-px bg-brand-secondary/40" />
              <div className="text-brand-secondary text-lg font-serif">✻</div>
              <div className="flex-1 h-px bg-brand-secondary/40" />
            </div>

            <p className="text-white/80 text-xs md:text-sm leading-relaxed max-w-sm font-medium z-10 relative">
              {t('home.heroDescNew', 'Experience the pinnacle of purity with our traditionally hand-churned liquid gold. Crafted slowly in earthen pots to preserve authentic aroma, texture, and unmatched nutritional benefits.')}
            </p>
          </motion.div>
        </div>

        {/* Decorative Ghee Image at Bottom */}
        <div className="absolute bottom-0 left-0 w-full h-[35vh] min-h-[250px] max-h-[380px] pointer-events-none z-0">
          <img src="/matka.png" alt="Daatasa Ghee" className="w-full h-full object-fill object-bottom" />
        </div>
      </div>

      {/* ── Right Panel (Form) ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[440px]"
        >
          {/* Mobile logo */}
          <Link to="/" className="flex lg:hidden items-center justify-center mb-8">
            <img src="/logo_rectangle.png" alt="Daatasa Logo" className="h-14 w-auto" />
          </Link>

          {/* Card */}
          <div className="rounded-[1.5rem] sm:rounded-[1.75rem] p-6 xs:p-8 sm:p-12 bg-white border border-brand-primary/10 shadow-[0_24px_80px_rgba(27,47,110,0.08)]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-[34px] font-display font-bold text-brand-primary mb-2 tracking-tight leading-tight">
                {t('auth.welcomeBackTitle', 'Welcome Back!')}
              </h2>
              <p className="text-brand-text/60 font-medium text-[15px]">
                {t('auth.loginDesc', 'Sign in to continue to Daatasa')}
              </p>
            </motion.div>

            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <FloatingInput
                id="email"
                label={t('auth.emailLabel', 'Email Address')}
                type="email"
                icon={Mail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <FloatingInput
                id="password"
                label={t('auth.passLabel', 'Password')}
                type={showPass ? 'text' : 'password'}
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                rightElement={
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="text-brand-text/40 hover:text-brand-primary transition-colors focus:outline-none p-1">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm font-bold text-brand-secondary hover:text-brand-primary transition-colors">
                  {t('auth.forgotPassword', 'Forgot password?')}
                </Link>
              </div>

              <button type="submit" disabled={loading}
                className="w-full btn h-12 rounded-lg flex items-center justify-center gap-2 mt-4 text-sm font-bold shadow-md hover:shadow-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #d4af37 0%, #aa8c2c 100%)', color: 'white' }}>
                {loading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <>{t('auth.signInBtn', 'Sign In')} <ArrowRight size={16} /></>
                }
              </button>
            </motion.form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-brand-primary/10" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text/40">{t('auth.orSignInWith', 'Or continue with')}</span>
              <div className="flex-1 h-px bg-brand-primary/10" />
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-12 rounded-lg flex items-center justify-center gap-3 transition-colors mb-8 bg-white border border-brand-primary/20 text-brand-primary font-bold text-sm hover:bg-brand-primary/5 shadow-sm hover:shadow-md"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              {t('auth.googleBtn', 'Continue with Google')}
            </button>

            {/* Social proof */}
            <div className="flex items-center justify-center gap-3 text-[13px] font-medium text-brand-text/60">
              <div className="flex -space-x-2">
                {[
                  'https://randomuser.me/api/portraits/men/32.jpg',
                  'https://randomuser.me/api/portraits/women/44.jpg',
                  'https://randomuser.me/api/portraits/men/46.jpg'
                ].map((url, i) => (
                  <img key={i} src={url} alt="Customer" className="w-8 h-8 rounded-full border-[3px] border-white object-cover shadow-sm" />
                ))}
              </div>
              <span>{t('auth.socialProof', 'Join 5,000+ happy customers').split('5,000+').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <strong className="text-brand-primary font-bold font-display">5,000+</strong>}
                </span>
              ))}</span>
            </div>

            <div className="mt-8 pt-6 text-center border-t border-brand-primary/10">
              <p className="text-xs font-medium text-brand-text/60">
                {t('auth.dontHaveAccount', "Don't have an account?")}{' '}
                <Link to="/register" className="text-brand-secondary font-bold hover:text-brand-primary transition-colors">{t('auth.signUpFree', 'Sign up free')}</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Login
