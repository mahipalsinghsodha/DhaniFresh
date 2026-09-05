import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiArrowRight } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'

// Shared premium layout for all legal/policy pages
const PolicyPage = ({ icon, tag = 'Legal Document', title, subtitle, lastUpdated, toc = [], children }) => {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-[var(--ivory)] font-sans text-brand-text">
      <Helmet>
        <title>{`${title || 'Policy'} | Daatasa Pure Vedic Ghee`}</title>
        <meta name="description" content={subtitle || `${title} document for Daatasa customer terms and policies.`} />
      </Helmet>

      {/* Premium Hero */}
      <div className="relative overflow-hidden bg-white text-brand-primary border-b border-brand-primary/5">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none bg-brand-secondary/10" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, var(--brand-primary) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        
        <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase mb-4 border border-brand-primary/10 bg-brand-primary/5 text-brand-primary">
              <span className="text-[12px]">{icon}</span>
              {tag}
            </span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="text-3xl sm:text-4xl font-extrabold text-brand-primary mb-3 leading-[1.1] font-display -tracking-[0.04em]">
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}
              className="text-sm max-w-sm mx-auto text-brand-text/70 font-medium">{subtitle}</motion.p>
          )}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
            className="text-xs mt-3 text-brand-text/50 font-medium">
            Last Updated: {lastUpdated}
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className={`grid gap-8 ${toc.length ? 'lg:grid-cols-4' : 'max-w-4xl mx-auto'}`}>

          {/* Table of contents */}
          {toc.length > 0 && (
            <div className="lg:col-span-1">
              <div className="rounded-[2rem] p-5 lg:sticky lg:top-28 bg-white border border-brand-primary/10 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest mb-4 text-brand-text/50">{t('policy.toc')}</p>
                <nav className="space-y-1">
                  {toc.map((item, i) => (
                    <a key={i} href={`#section-${i + 1}`}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all group font-medium text-brand-text/70 hover:bg-brand-primary/5 hover:text-brand-primary">
                      <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 transition-all bg-brand-bg text-brand-text/50 group-hover:bg-brand-primary/10 group-hover:text-brand-primary">{i + 1}</span>
                      {item}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          )}

          {/* Main content */}
          <div className={toc.length ? 'lg:col-span-3' : ''}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="rounded-[2rem] overflow-hidden bg-white border border-brand-primary/10 shadow-sm">
              <div className="p-8 sm:p-12 space-y-10 text-[15px] leading-relaxed text-brand-text/80">
                {children}
              </div>
            </motion.div>

            {/* Footer nav */}
            <div className="mt-6 flex flex-wrap gap-3 justify-between items-center">
              <Link to="/" className="text-sm font-medium transition-colors text-brand-text/50 hover:text-brand-primary">{t('policy.backToHome')}</Link>
              <Link to="/contact" className="inline-flex items-center gap-2 text-sm font-medium transition-colors text-brand-text/50 hover:text-brand-primary">
                {t('policy.questionsContact')} <FiArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
// Section component used inside policies
export const PolicySection = ({ id, title, children }) => (
  <section id={id} className="scroll-mt-28">
    <div className="flex items-start gap-4 mb-5">
      <div className="w-1 h-8 rounded-full shrink-0 mt-0.5 bg-brand-secondary/80" />
      <h2 className="text-xl font-extrabold text-brand-primary font-display -tracking-[0.02em]">{title}</h2>
    </div>
    <div className="pl-5 space-y-3">{children}</div>
  </section>
)

// Bullet list item
export const PolicyBullet = ({ children, color = 'text-brand-secondary' }) => (
  <li className="flex items-start gap-3">
    <span className={`mt-1.5 shrink-0 text-xs ${color}`}>✦</span>
    <span>{children}</span>
  </li>
)

// Info callout box
export const PolicyCallout = ({ type = 'info', children }) => {
  const styles = {
    info:    { bg: 'bg-blue-500/10', border: 'border-blue-500/20', color: 'text-blue-600' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', color: 'text-amber-600' },
    success: { bg: 'bg-green-500/10', border: 'border-green-500/20', color: 'text-green-600' },
    tip:     { bg: 'bg-brand-secondary/10', border: 'border-brand-secondary/20', color: 'text-brand-secondary' },
  }
  const icons = { info: 'ℹ️', warning: '⚠️', success: '✅', tip: '💡' }
  const s = styles[type]
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm font-medium ${s.bg} ${s.border} ${s.color}`}>
      <span className="shrink-0 text-base">{icons[type]}</span>
      <span className="text-brand-text/80">{children}</span>
    </div>
  )
}

export default PolicyPage

