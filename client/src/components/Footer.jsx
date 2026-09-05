import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FiInstagram, FiFacebook, FiMail, FiPhone, FiMapPin, FiArrowRight, FiYoutube, FiLinkedin } from 'react-icons/fi'
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
  {
    Icon: FiFacebook,
    label: 'Facebook',
    href: 'https://www.facebook.com/daatasa',
    color: '#1877F2'
  },
  {
    Icon: FiInstagram,
    label: 'Instagram',
    href: 'https://www.instagram.com/daatasaofficial',
    color: '#E1306C'
  },
  {
    Icon: FiYoutube,
    label: 'YouTube',
    href: 'https://www.youtube.com/@daatasa',
    color: '#FF0000'
  },
  {
    Icon: FiLinkedin,
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/daatasa',
    color: '#0A66C2'
  },
]

export default function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()
  const navCols = useMemo(() => getNavCols(t), [t])

  return (
    <footer className="bg-brand-primary relative overflow-hidden text-white mt-8 sm:mt-14 border-t-2 sm:border-t-4 border-brand-secondary" role="contentinfo">

      {/* Premium Ambient Background */}
      <div className="absolute top-0 right-0 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-brand-secondary/10 rounded-full blur-[90px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-6 mb-8 sm:mb-10">

          {/* Brand Column */}
          <div className="lg:col-span-5 pr-0 lg:pr-8">
            <Link to="/" className="inline-block mb-3 sm:mb-4 bg-[#fffdf8] rounded-xl px-3 py-1.5 shadow-xs">
              <img 
                src="/logo_rectangle.png" 
                alt="Daatasa"
                className="h-10 sm:h-12 w-auto" 
              />
            </Link>
            <p className="text-white/70 leading-relaxed font-normal mb-4 sm:mb-5 text-xs sm:text-sm max-w-sm">
              {t('footer.tagline', 'Experience the pinnacle of purity with our traditionally hand-churned Vedic Bilona Ghee crafted in Khuri, Jaisalmer.')}
            </p>

            {/* Social Icons */}
            <div className="flex gap-2.5 flex-wrap">
              {SOCIALS.map(({ Icon, label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={label}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-secondary hover:text-white transition-all duration-300 shadow-2xs hover:scale-110 group"
                  style={{ '--hover-bg': color }}
                  onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.borderColor = color }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = '' }}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
            {/* Follow us label */}
            <p className="text-white/35 text-[10px] font-medium mt-2 uppercase tracking-widest">
              Follow us @daatasaofficial
            </p>
          </div>

          {/* Navigation Columns */}
          <div className="lg:col-span-4 grid grid-cols-2 sm:flex sm:flex-row flex-wrap gap-x-4 gap-y-6 sm:gap-10">
            {navCols.map(col => (
              <div key={col.title}>
                <h4 className="font-display text-sm sm:text-base font-bold mb-3 sm:mb-4 text-white tracking-wide">
                  {col.title}
                </h4>
                <ul className="space-y-2 sm:space-y-2.5">
                  {col.links.map(link => (
                    <li key={link.label}>
                      <Link to={link.to} className={`hover:text-brand-secondary transition-colors duration-300 font-medium text-xs sm:text-sm flex items-center group ${link.highlight ? 'text-brand-secondary' : 'text-white/65'}`}>
                        <span className="w-0 overflow-hidden group-hover:w-2.5 transition-all duration-300 text-brand-secondary">
                          <FiArrowRight size={10} />
                        </span>
                        <span className={link.highlight ? 'animate-pulse flex items-center gap-1.5' : ''}>
                          {link.label}
                          {link.highlight && (
                            <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[8px] font-bold px-1 py-0.2 rounded-full animate-pulse shadow-2xs">NEW</span>
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
            <h4 className="font-display text-sm sm:text-base font-bold mb-3 sm:mb-4 text-white tracking-wide">
              {t('footer.contactHeading') || 'Contact Us'}
            </h4>
            <ul className="space-y-3">
              <li className="flex gap-2.5 items-start group">
                <div className="mt-0.5 w-7 h-7 rounded-md bg-white/5 flex items-center justify-center shrink-0 text-brand-secondary transition-colors group-hover:bg-brand-secondary/20">
                  <FiMapPin size={13} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white mb-0.5">{t('footer.ourFarm', 'Our Farm')}</h5>
                  <p className="text-white/60 font-normal text-[11px] leading-relaxed">
                    {t('footer.contactAddress', 'Bakhtawar singh ki dhani, Khuri, Jaisalmer, Rajasthan')}
                  </p>
                </div>
              </li>
              <li className="flex gap-2.5 items-start group">
                <div className="mt-0.5 w-7 h-7 rounded-md bg-white/5 flex items-center justify-center shrink-0 text-brand-secondary transition-colors group-hover:bg-brand-secondary/20">
                  <FiMail size={13} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white mb-0.5">{t('footer.emailUs', 'Email Us')}</h5>
                  <a href="mailto:support@daatasa.com" className="text-white/60 hover:text-brand-secondary font-normal text-[11px] transition-colors">
                    support@daatasa.com
                  </a>
                </div>
              </li>
              <li className="flex gap-2.5 items-start group">
                <div className="mt-0.5 w-7 h-7 rounded-md bg-white/5 flex items-center justify-center shrink-0 text-brand-secondary transition-colors group-hover:bg-brand-secondary/20">
                  <FiPhone size={13} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white mb-0.5">{t('footer.callUs', 'Call Us')}</h5>
                  <a href="tel:+917665306403" className="text-white/60 hover:text-brand-secondary font-normal text-[11px] transition-colors">
                    +91 7665306403
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/50 text-[10px] sm:text-xs font-normal text-center sm:text-left leading-relaxed">
            {t('footer.copyright', { year }, `Daatasa. Daatasa Ghee — © Copyright ${year} by Daatasa Pvt. Ltd. All rights reserved.`)}
          </p>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="text-white/50 hover:text-brand-secondary text-[11px] font-normal transition-colors">
              Privacy
            </Link>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <Link to="/terms" className="text-white/50 hover:text-brand-secondary text-[11px] font-normal transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
