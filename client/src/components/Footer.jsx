import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FiInstagram, FiFacebook, FiTwitter, FiLinkedin, FiMail, FiPhone, FiMapPin, FiArrowRight } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

const getNavCols = (t) => [
  {
    title: t('footer.exploreTitle') || 'Explore',
    links: [
      { label: t('footer.exploreAbout') || 'About Us', to: '/about' },
      { label: t('footer.exploreProducts') || 'Shop Ghee', to: '/products' },
      { label: t('footer.exploreHowItWorks') || 'How It Works', to: '/how-it-works' },
      { label: t('footer.exploreContact') || 'Contact Us', to: '/contact' },
    ],
  },
  {
    title: t('footer.quickLinksTitle') || 'Quick Links',
    links: [
      { label: t('footer.bulkOrders', 'Bulk Orders & B2B'), to: '/b2b', highlight: true },
      { label: t('footer.quickTrackOrder', 'Track Order'), to: '/track-order' },
      { label: t('footer.quickPrivacy') || 'Privacy Policy', to: '/privacy-policy' },
      { label: t('footer.quickTerms') || 'Terms & Conditions', to: '/terms' },
      { label: t('footer.quickDisclaimer') || 'Disclaimer', to: '/disclaimer' },
      { label: t('footer.quickFAQ') || 'FAQ', to: '/faq' },
    ],
  },
]

const SOCIALS = [
  { Icon: FiFacebook,  label: 'Facebook',  href: '#' },
  { Icon: FiTwitter,   label: 'Twitter',   href: '#' },
  { Icon: FiInstagram, label: 'Instagram', href: '#' },
  { Icon: FiLinkedin,  label: 'LinkedIn',  href: '#' },
]

export default function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()
  const navCols = useMemo(() => getNavCols(t), [t])

  return (
    <footer className="bg-brand-primary relative overflow-hidden text-white mt-12 sm:mt-24 border-t-4 border-brand-secondary" role="contentinfo">

      {/* Premium Ambient Background */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-secondary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay pointer-events-none" />

      <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 sm:gap-12 lg:gap-8 mb-12 sm:mb-16">

          {/* Brand Column */}
          <div className="lg:col-span-5 pr-0 lg:pr-12">
            <Link to="/" className="inline-block mb-6 bg-[#fffdf8] rounded-[12px] px-4 py-2">
              <img 
                src="/logo_rectangle.png" 
                alt="Daatasa"
                className="h-16 w-auto" 
              />
            </Link>
            <p className="text-white/70 leading-relaxed font-medium mb-8 text-sm sm:text-base">
              {t('footer.tagline', 'Experience the pinnacle of purity with our traditionally hand-churned Vedic Bilona Ghee. Crafted slowly to preserve authentic aroma and unmatched nutritional benefits for your holistic well-being.')}
            </p>

            {/* Social Icons */}
            <div className="flex gap-3">
              {SOCIALS.map(({ Icon, label, href }) => (
                <a key={label} href={href} aria-label={label}
                  className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-secondary hover:bg-brand-secondary hover:text-brand-primary transition-all duration-300 shadow-sm hover:shadow-gold"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation Columns */}
          <div className="lg:col-span-4 grid grid-cols-2 sm:flex sm:flex-row flex-wrap gap-x-4 gap-y-10 sm:gap-16">
            {navCols.map(col => (
              <div key={col.title}>
                <h4 className="font-display text-lg font-bold mb-6 text-white tracking-wide">
                  {col.title}
                </h4>
                <ul className="space-y-4">
                  {col.links.map(link => (
                    <li key={link.label}>
                      <Link to={link.to} className={`hover:text-brand-secondary transition-colors duration-300 font-medium text-sm flex items-center group ${link.highlight ? 'text-brand-secondary' : 'text-white/60'}`}>
                        <span className="w-0 overflow-hidden group-hover:w-3 transition-all duration-300 text-brand-secondary">
                          <FiArrowRight size={12} />
                        </span>
                        <span className={link.highlight ? 'animate-pulse flex items-center gap-2' : ''}>
                          {link.label}
                          {link.highlight && (
                            <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]">NEW</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Contact Column */}
          <div className="lg:col-span-3">
            <h4 className="font-display text-lg font-bold mb-6 text-white tracking-wide">
              {t('footer.contactHeading') || 'Contact Us'}
            </h4>
            <ul className="space-y-5">
              <li className="flex gap-4 items-start group">
                <div className="mt-1 w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-brand-secondary transition-colors group-hover:bg-brand-secondary/20">
                  <FiMapPin size={16} />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-white mb-1">{t('footer.ourFarm', 'Our Farm')}</h5>
                  <p className="text-white/60 font-medium text-xs leading-relaxed">
                    {t('footer.contactAddress', 'Bakhtawar singh ki dhani, Khuri, Jaisalmer, Rajasthan')}
                  </p>
                </div>
              </li>
              <li className="flex gap-4 items-start group">
                <div className="mt-1 w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-brand-secondary transition-colors group-hover:bg-brand-secondary/20">
                  <FiMail size={16} />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-white mb-1">{t('footer.emailUs', 'Email Us')}</h5>
                  <a href="mailto:support@daatasa.com" className="text-white/60 hover:text-brand-secondary font-medium text-xs transition-colors">
                    support@daatasa.com
                  </a>
                </div>
              </li>
              <li className="flex gap-4 items-start group">
                <div className="mt-1 w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-brand-secondary transition-colors group-hover:bg-brand-secondary/20">
                  <FiPhone size={16} />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-white mb-1">{t('footer.callUs', 'Call Us')}</h5>
                  <a href="tel:+917665306403" className="text-white/60 hover:text-brand-secondary font-medium text-xs transition-colors">
                    +91 7665306403
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/50 text-[11px] sm:text-xs font-medium text-center md:text-left leading-relaxed px-2 sm:px-0">
            {t('footer.copyright', { year }, `Daatasa. Daatasa Ghee — © Copyright ${year} by Daatasa Pvt. Ltd. All rights reserved.`)}
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="text-white/50 hover:text-brand-secondary text-xs font-medium transition-colors">
              Privacy
            </Link>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <Link to="/terms" className="text-white/50 hover:text-brand-secondary text-xs font-medium transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
