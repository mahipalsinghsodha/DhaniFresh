import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiHome, FiArrowRight } from 'react-icons/fi'
import { Helmet } from 'react-helmet-async'

const NotFound = () => (
  <div className="min-h-screen relative overflow-hidden flex flex-col" style={{ background: 'var(--bg-base)' }}>
    <Helmet>
      <title>404 - Page Not Found | Daatasa</title>
      <meta name="description" content="The page you are looking for does not exist on Daatasa." />
    </Helmet>

    {/* Background blobs */}
    <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full blur-3xl pointer-events-none"
      style={{ background: 'rgba(27,47,110,0.06)' }} />
    <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full blur-3xl pointer-events-none"
      style={{ background: 'rgba(245,166,35,0.05)' }} />

    <div className="flex-1 flex items-center justify-center px-4 py-20">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-lg w-full relative z-10">

        {/* Giant "404" outline + icon overlay */}
        <div className="relative mb-6 select-none">
          <p className="text-[160px] sm:text-[200px] font-black leading-none"
            style={{ color: 'transparent', WebkitTextStroke: '2px var(--border-color)' }}>
            404
          </p>
          {/* Floating center card */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 flex flex-col items-center justify-center rounded-3xl"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)' }}>
              <span className="text-3xl">🫙</span>
            </motion.div>
          </div>
        </div>

        {/* Tag */}
        <div className="mb-4">
          <span className="section-tag">
            Page not found
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold mb-3"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Looks like this jar is empty
        </h1>
        <p className="text-sm mb-10 leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Link to="/" className="btn btn-primary w-full sm:w-auto">
            <FiHome size={16} /> Go Home
          </Link>
          <Link to="/products" className="btn btn-secondary w-full sm:w-auto">
            Browse Products <FiArrowRight size={15} />
          </Link>
        </div>

        {/* Helpful links */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>You might be looking for</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Our Products',  to: '/products',  emoji: '🛒' },
              { label: 'My Orders',     to: '/orders',    emoji: '📦' },
              { label: 'Contact Us',    to: '/contact',   emoji: '💬' },
              { label: 'FAQ',           to: '/faq',       emoji: '❓' },
            ].map(link => (
              <Link key={link.to} to={link.to}
                className="flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium transition-all group"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,166,35,0.40)'; e.currentTarget.style.background = 'rgba(245,166,35,0.06)'; e.currentTarget.style.color = 'var(--brand-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-base)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
                <span className="text-base">{link.emoji}</span>
                {link.label}
                <FiArrowRight size={12} className="ml-auto transition-all" style={{ color: 'var(--text-muted)' }} />
              </Link>
            ))}
          </div>
        </div>

        {/* Brand mark */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center"
            style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--shadow-brand)' }}>
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
              <path d="M5 0.5C5 0.5 1 4 1 7C1 9.209 2.791 11 5 11C7.209 11 9 9.209 9 7C9 4 5 0.5 5 0.5Z" fill="var(--brand-text)" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            Daatasa
          </span>
        </div>
      </motion.div>
    </div>
  </div>
)

export default NotFound
