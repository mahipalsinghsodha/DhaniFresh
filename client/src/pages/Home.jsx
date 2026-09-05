import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { 
  FiArrowRight, FiShield, FiStar, FiTruck, FiDroplet, 
  FiAward, FiCheck, FiPlay, FiEye, FiHeart, FiX, FiCopy, FiCheckCircle 
} from 'react-icons/fi'

import ProductCarousel from '../components/ProductCarousel'
import HeroCarousel from '../components/HeroCarousel'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-20px" },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
})

const slideIn = (delay = 0, direction = "left") => ({
  initial: { opacity: 0, x: direction === "left" ? -20 : 20 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
})

export default function Home() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Product States for Carousels
  const [bestSellers, setBestSellers] = useState([])
  const [recommendedProducts, setRecommendedProducts] = useState([])
  const [comingSoonProducts, setComingSoonProducts] = useState([])

  const [galleryFilter, setGalleryFilter] = useState('All')
  const [activeLightboxImage, setActiveLightboxImage] = useState(null)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [copiedCoupon, setCopiedCoupon] = useState(false)

  // Newsletter
  const [email, setEmail] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  const handleSubscribe = async (e) => {
    e.preventDefault()
    if (!email.trim()) return toast.error(t('home.enterEmailAlert', 'Please enter your email'))
    try {
      setSubscribing(true)
      const res = await api.post('/api/subscribers/subscribe', { email })
      toast.success(res.data.message || t('home.subscribeSuccess', 'Successfully subscribed!'))
      setEmail('')
    } catch (err) {
      toast.error(err.response?.data?.message || t('home.subscribeError', 'Failed to subscribe'))
    } finally {
      setSubscribing(false)
    }
  }

  const handleCopyCoupon = (code = 'FIRST10') => {
    navigator.clipboard.writeText(code)
    setCopiedCoupon(true)
    toast.success(`Coupon code ${code} copied to clipboard!`)
    setTimeout(() => setCopiedCoupon(false), 3000)
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [
          catRes,
          bestRes,
          recRes,
          comingRes
        ] = await Promise.all([
          api.get('/api/categories').catch(() => ({ data: [] })),
          api.get('/api/products?sort=rating&limit=10').catch(() => ({ data: [] })),
          api.get('/api/products?featured=true&limit=8').catch(() => api.get('/api/products?limit=8')),
          api.get('/api/products?comingSoon=true&limit=8').catch(() => ({ data: [] }))
        ])

        setCategories(catRes.data || [])

        const extractProds = (res) => {
          if (!res || !res.data) return []
          if (Array.isArray(res.data)) return res.data
          return res.data.products || res.data.data || []
        }

        setBestSellers(extractProds(bestRes))
        const recList = extractProds(recRes)
        setRecommendedProducts(recList.length > 0 ? recList : extractProds(bestRes))
        setComingSoonProducts(extractProds(comingRes))
      } catch (e) {
        console.error('Error fetching home data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Structured Data for Trust & Feature Sections
  const TRUST_ITEMS = [
    { icon: <FiAward size={18} />, title: t('home.trust1Title', 'Direct from Local Farms'), sub: t('home.trust1Sub', 'Khuri, Jaisalmer sourced') },
    { icon: <FiDroplet size={18} />, title: t('home.trust2Title', 'Bilona Hand-Churned'), sub: t('home.trust2Sub', 'Ancient Vedic method') },
    { icon: <FiShield size={18} />, title: t('home.trust3Title', 'FSSAI Certified'), sub: t('home.trust3Sub', 'Govt. approved quality') },
    { icon: <FiCheck size={18} />, title: t('home.trust4Title', 'Lab Tested'), sub: t('home.trust4Sub', 'No preservatives added') }
  ]

  const WHY_CHOOSE = [
    { icon: <FiAward size={20} />, title: t('home.wc1Title', '100% Pure'), text: t('home.wc1Text', 'Unadulterated, uncompromised purity in every drop.') },
    { icon: <FiCheck size={20} />, title: t('home.wc2Title', 'Lab Tested'), text: t('home.wc2Text', 'Rigorously tested to meet the highest safety standards.') },
    { icon: <FiHeart size={20} />, title: t('home.wc3Title', 'Farm Fresh'), text: t('home.wc3Text', 'Sourced directly from trusted local farmers.') },
    { icon: <FiShield size={20} />, title: t('home.wc4Title', 'Chemical Free'), text: t('home.wc4Text', 'Zero preservatives, zero artificial additives.') },
    { icon: <FiDroplet size={20} />, title: t('home.wc5Title', 'Traditional Process'), text: t('home.wc5Text', 'Hand-churned using the authentic Vedic Bilona method.') },
    { icon: <FiTruck size={20} />, title: t('home.wc6Title', 'Fast Delivery'), text: t('home.wc6Text', 'Delivered fresh to your doorstep across India.') },
    { icon: <FiStar size={20} />, title: t('home.wc7Title', 'Lab Reports Available'), text: t('home.wc7Text', 'Full transparency — view our third-party lab test certificates anytime.'), link: '/about' },
  ]

  const TESTIMONIALS = [
    { 
      name: t('home.t1Name', 'Aarav Sharma'), 
      role: t('home.t1Role', 'Chef'), 
      rating: 5, 
      text: t('home.t1Comment', 'The rich aroma and granular texture are unmatched. It instantly elevates every dish I prepare.'), 
      image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=120&h=120&fit=crop' 
    },
    { 
      name: t('home.t2Name', 'Priya Desai'), 
      role: t('home.t2Role', 'Nutritionist'), 
      rating: 5, 
      text: t('home.t2Comment', "Finding pure A2 ghee is difficult, but Daatasa delivers on its promise. It's truly authentic and digestible."), 
      image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop' 
    },
    { 
      name: t('home.t3Name', 'Vikram Singh'), 
      role: t('home.t3Role', 'Fitness Coach'), 
      rating: 5, 
      text: t('home.t3Comment', 'I start my day with Daatasa ghee in my coffee. It provides clean, sustained energy for my workouts.'), 
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop' 
    }
  ]

  const GALLERY_TABS = [
    { key: 'All', label: t('home.galleryAll', 'All') },
    { key: 'Farm', label: t('home.galleryFarm', 'Farm') },
    { key: 'Products', label: t('home.galleryProducts', 'Products') },
    { key: 'Bilona', label: t('home.galleryBilona', 'Bilona') },
    { key: 'Lifestyle', label: t('home.galleryLifestyle', 'Lifestyle') }
  ]

  const GALLERY_IMAGES = [
    { id: 1, cat: 'Farm', title: 'Desi Cows at Daatasa Farm', url: '/gallery-cows.png' },
    { id: 2, cat: 'Products', title: 'Pure A2 Desi Cow Ghee — Daatasa', url: '/gallery-jar.png' },
    { id: 3, cat: 'Bilona', title: 'Traditional Bilona Churning', url: '/gallery-churn.png' },
    { id: 4, cat: 'Lifestyle', title: 'Rajasthani Bilona Heritage', url: '/herosection.png' },
    { id: 5, cat: 'Farm', title: 'Tharparkar Herd — Khuri Farm', url: '/tharparkar-herd.jpg' },
    { id: 6, cat: 'Bilona', title: 'Earthen Matka — Traditional Process', url: '/matka.png' }
  ]

  const PROCESS_STEPS = [
    { title: t('home.processStep1Title', 'Milk Collection'), desc: t('home.processStep1Desc', 'Fresh A2 milk sourced from happy, free-grazing cows.') },
    { title: t('home.processStep2Title', 'Curd Culturing'), desc: t('home.processStep2Desc', 'Milk is boiled and traditionally set into curd overnight.') },
    { title: t('home.processStep3Title', 'Bilona Churning'), desc: t('home.processStep3Desc', 'Curd is hand-churned in wooden bilona to separate Makhan.') },
    { title: t('home.processStep4Title', 'Slow Heating'), desc: t('home.processStep4Desc', 'Makhan is slowly heated on cow-dung fire to craft liquid gold.') }
  ]

  const CERTIFICATIONS = [
    { icon: <FiShield className="text-brand-secondary" size={20} />, name: 'FSSAI Certified', desc: 'Government Approved' },
    { icon: <FiDroplet className="text-brand-secondary" size={20} />, name: '100% A2 Milk', desc: 'Desi Cow Breed' },
    { icon: <FiCheck className="text-brand-secondary" size={20} />, name: 'Lab Tested Purity', desc: 'Zero Preservatives' },
    { icon: <FiHeart className="text-brand-secondary" size={20} />, name: '100% Organic', desc: 'Free Grazing Herds' },
    { icon: <FiAward className="text-brand-secondary" size={20} />, name: 'Vedic Bilona', desc: 'Ancient Method' }
  ]

  return (
    <div className="min-h-screen bg-[var(--ivory)] font-sans text-brand-text selection:bg-brand-secondary selection:text-white">
      <Helmet>
        <title>Daatasa — Premium Vedic Bilona Ghee | 100% Pure Desi Cow Ghee</title>
        <meta name="description" content="Experience the pinnacle of purity with Daatasa authentic A2 Vedic Bilona Ghee, traditionally hand-churned from free-grazing cows in Khuri, Jaisalmer. Fast delivery across India." />
        <meta name="keywords" content="A2 ghee, Bilona Ghee, Desi Cow Ghee, Vedic Ghee, Organic Ghee, Daatasa, Pure Ghee Rajasthan" />
        <meta property="og:title" content="Daatasa — Premium Vedic Bilona Ghee" />
        <meta property="og:description" content="Handcrafted Vedic Bilona Ghee direct from our Khuri farm in Rajasthan to your family." />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* ══════════ HERO SECTION (Image Slider) ══════════ */}
      <HeroCarousel />

      {/* ══════════ TRUST BAR ══════════ */}
      <div className="max-w-[1280px] mx-auto px-3 sm:px-6 -mt-4 sm:-mt-6 relative z-20 mb-6 sm:mb-10">
        <motion.div {...fadeUp(0)} className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-brand-primary/5 p-3 sm:p-4 md:p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {TRUST_ITEMS.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 sm:gap-3 group p-1.5 rounded-lg transition-colors hover:bg-brand-bg/60">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-brand-bg flex items-center justify-center text-brand-secondary shrink-0 transition-all duration-300 group-hover:scale-105 group-hover:bg-brand-secondary group-hover:text-white shadow-2xs">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-brand-primary tracking-tight truncate">{item.title}</h4>
                  <p className="text-[10px] sm:text-xs text-brand-text/60 truncate">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ══════════ BEST SELLERS ══════════ */}
      <section className="py-6 sm:py-9 bg-white">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8">
          <ProductCarousel
            title={t('home.bestSellers', 'Best Sellers')}
            subtitle={t('home.crowdFavorites', 'Crowd Favorites')}
            products={bestSellers}
            loading={loading}
            viewAllLink="/products?sort=rating"
            showRank={true}
          />
        </div>
      </section>

      {/* ══════════ RECOMMENDED PRODUCTS ══════════ */}
      <section className="py-6 sm:py-9 bg-brand-bg">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8">
          <ProductCarousel
            title={t('home.recommendedProducts', 'Recommended For You')}
            subtitle={t('home.curated', 'Curated Picks')}
            products={recommendedProducts}
            loading={loading}
            viewAllLink="/products"
          />
        </div>
      </section>

      {/* ══════════ COMING SOON (Only shown if products exist or loading) ══════════ */}
      {(loading || (comingSoonProducts && comingSoonProducts.length > 0)) && (
        <section className="py-6 sm:py-9 bg-white border-y border-brand-primary/5">
          <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8">
            <ProductCarousel
              title={t('home.comingSoon', 'Coming Soon')}
              subtitle={t('home.sneakPeek', 'Sneak Peek')}
              products={comingSoonProducts}
              loading={loading}
            />
          </div>
        </section>
      )}

      {/* ══════════ ABOUT SECTION (Farm to Family) ══════════ */}
      <section className="py-8 sm:py-12 md:py-14 overflow-hidden relative bg-[var(--ivory)] border-y border-brand-primary/5">
        <div className="absolute top-0 right-0 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-brand-secondary/5 rounded-full blur-[80px] -z-10 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-6 sm:gap-10 items-center">
          <motion.div {...slideIn(0.1, "left")} className="relative order-2 lg:order-1">
            <div className="aspect-[16/10] sm:aspect-[4/3] lg:aspect-[4/5] max-h-[360px] sm:max-h-[420px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg relative max-w-md mx-auto group">
              <img 
                src="/tharparkar-herd.jpg" 
                alt="Tharparkar Cows at Daatasa Farm, Khuri Jaisalmer" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                style={{ objectPosition: 'center center' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center">
                <button 
                  onClick={() => setIsVideoModalOpen(true)}
                  aria-label="Play Farm Story Video"
                  className="w-12 h-12 sm:w-16 sm:h-16 bg-white/40 hover:bg-brand-secondary backdrop-blur-md border border-white/60 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110 shadow-md cursor-pointer group"
                >
                  <FiPlay size={22} className="ml-1 text-white transition-transform group-hover:scale-110" />
                </button>
              </div>
            </div>
          </motion.div>
          
          <div className="max-w-lg order-1 lg:order-2">
            <motion.h4 {...fadeUp(0.05)} className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary mb-1.5 sm:mb-2">
              {t('home.ourHeritageLabel', 'Our Heritage')}
            </motion.h4>
            <motion.h2 {...fadeUp(0.1)} className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-brand-primary leading-tight mb-2 sm:mb-3">
              {t('home.farmToFamilyTitle', 'From Our Farms')} <br className="hidden sm:inline" /> 
              <span className="italic font-light text-brand-secondary">{t('home.farmToFamilySub', 'To Your Family')}</span>
            </motion.h2>
            <motion.p {...fadeUp(0.15)} className="text-brand-text/75 mb-4 sm:mb-5 leading-relaxed font-light text-xs sm:text-sm">
              {t('home.farmToFamilyDesc', 'Nurtured with love in the pure environment of Khuri, Jaisalmer. Our free-grazing cows feed on natural organic grass, ensuring the milk produced is rich in vital nutrients.')}
            </motion.p>
            
            <motion.div {...fadeUp(0.2)} className="grid grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6 p-3 sm:p-4 bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-brand-primary/5 shadow-2xs">
              <div>
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-brand-secondary mb-0.5">600+</h3>
                <p className="text-xs text-brand-text/70 font-medium">{t('home.happyCowsLabel', 'Happy Cows')}</p>
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-brand-secondary mb-0.5">50+</h3>
                <p className="text-xs text-brand-text/70 font-medium">{t('home.acresFarmLabel', 'Acres of Farm')}</p>
              </div>
            </motion.div>

            {/* ── Sourcing Story 3-Step Cards ── */}
            <motion.div {...fadeUp(0.22)} className="mb-4 sm:mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-secondary mb-3">{t('home.sourcingTitle', 'How We Source')}</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    emoji: '🐄',
                    title: t('home.src1Title', 'Free-Grazing Cows'),
                    sub: t('home.src1Sub', 'Gir & Sahiwal breeds on open pastures'),
                  },
                  {
                    emoji: '🏺',
                    title: t('home.src2Title', 'Bilona Churning'),
                    sub: t('home.src2Sub', 'Traditional curd hand-churned in wooden vessel'),
                  },
                  {
                    emoji: '🔥',
                    title: t('home.src3Title', 'Slow-Simmered'),
                    sub: t('home.src3Sub', 'Low flame, no shortcuts, pure liquid gold'),
                  }
                ].map((s, i) => (
                  <div key={i} className="flex flex-col items-center text-center p-2.5 rounded-xl bg-white/80 border border-brand-primary/8 shadow-2xs hover:border-brand-secondary/40 hover:shadow-sm transition-all group">
                    <span className="text-xl mb-1.5 transition-transform group-hover:scale-110 inline-block">{s.emoji}</span>
                    <h5 className="text-[10px] sm:text-xs font-bold text-brand-primary leading-tight mb-0.5">{s.title}</h5>
                    <p className="text-[9px] sm:text-[10px] text-brand-text/55 font-light leading-snug">{s.sub}</p>
                  </div>
                ))}
              </div>
            </motion.div>
            
            <motion.div {...fadeUp(0.25)}>
              <Link to="/about" className="btn btn-secondary h-10 px-6 rounded-full flex items-center justify-center w-full sm:w-max text-xs sm:text-sm font-bold shadow-xs">
                <span>{t('home.storyBtn', 'Explore Our Story')}</span> <FiArrowRight className="ml-1.5" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ BILONA PROCESS SECTION ══════════ */}
      <section className="py-8 sm:py-12 md:py-14 bg-white text-brand-text overflow-hidden relative border-b border-brand-primary/5">
        <div className="absolute top-0 right-0 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-brand-secondary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 items-center">
            {/* Left Content */}
            <div>
              <motion.h4 {...fadeUp(0)} className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary mb-1.5 sm:mb-2 flex items-center gap-1.5">
                <FiDroplet size={14} /> {t('home.ancientWisdomLabel', 'Ancient Wisdom')}
              </motion.h4>
              <motion.h2 {...fadeUp(0.08)} className="text-2xl sm:text-3xl md:text-4xl font-display font-bold leading-tight mb-2 sm:mb-3 text-brand-primary">
                {t('home.authenticLabel', 'The Authentic')} <br className="hidden sm:inline" /> 
                <span className="text-brand-secondary italic">{t('home.bilonaProcessLabel', 'Bilona Process')}</span>
              </motion.h2>
              <motion.p {...fadeUp(0.12)} className="text-brand-text/75 mb-4 sm:mb-6 leading-relaxed font-light text-xs sm:text-sm md:text-base">
                {t('home.processDescNew', "We don't make ghee from malai (cream). We follow the rigorous 4-step Vedic process mentioned in ancient texts. Every drop is crafted with patience and devotion.")}
              </motion.p>
              <motion.div {...fadeUp(0.16)}>
                <Link to="/about" className="btn btn-secondary h-10 sm:h-11 px-6 rounded-full flex items-center justify-center w-full sm:w-max text-xs sm:text-sm font-bold shadow-xs">
                  <span>{t('home.discoverMethodBtn', 'Discover The Method')}</span> <FiArrowRight className="ml-1.5" />
                </Link>
              </motion.div>
            </div>
            
            {/* Right Video Preview */}
            <motion.div {...slideIn(0.15, "right")} className="relative">
              <div className="aspect-[16/9] max-h-[300px] sm:max-h-[360px] rounded-xl sm:rounded-2xl overflow-hidden shadow-lg relative bg-black group border border-brand-primary/10 cursor-pointer" onClick={() => setIsVideoModalOpen(true)}>
                <img 
                  src="/herosection.png" 
                  alt="Vedic Bilona Churning Process" 
                  className="w-full h-full object-cover opacity-85 transition-transform duration-700 group-hover:scale-105" 
                  style={{ objectPosition: 'center center' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/60 via-black/30 to-transparent" />
                <button 
                  aria-label="Play Bilona Method Video"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-16 sm:h-16 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center text-brand-primary hover:scale-110 transition-transform shadow-lg group-hover:text-brand-secondary"
                >
                  <FiPlay size={22} className="ml-1" />
                </button>
              </div>
            </motion.div>
          </div>
          
          {/* Process Timeline below */}
          <motion.div {...fadeUp(0.2)} className="mt-6 sm:mt-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {PROCESS_STEPS.map((step, idx) => (
                <div key={idx} className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--ivory)] border border-brand-primary/10 shadow-2xs relative overflow-hidden group hover:shadow-sm hover:border-brand-secondary/40 transition-all">
                  <div className="text-xl sm:text-2xl font-display font-bold text-brand-secondary mb-1">{`0${idx + 1}`}</div>
                  <h4 className="text-sm sm:text-base font-bold text-brand-primary mb-1">{step.title}</h4>
                  <p className="text-[11px] sm:text-xs text-brand-text/70 font-light leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════ WHY CHOOSE DAATASA ══════════ */}
      <section className="py-8 sm:py-12 md:py-14 bg-white">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-8 max-w-xl mx-auto">
            <motion.h4 {...fadeUp(0)} className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary mb-1">
              {t('home.ourPromiseLabel', 'Our Promise')}
            </motion.h4>
            <motion.h2 {...fadeUp(0.06)} className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-brand-primary mb-2">
              {t('home.whyChooseLabel', 'Why Choose Daatasa')}
            </motion.h2>
            <motion.p {...fadeUp(0.1)} className="text-brand-text/70 text-xs sm:text-sm font-light leading-relaxed">
              {t('home.promiseDesc', 'We bring the ancient Vedic tradition right to your doorstep, ensuring unmatched purity and health benefits.')}
            </motion.p>
          </div>
          
          <motion.div {...fadeUp(0.15)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {WHY_CHOOSE.map((item, idx) => (
                item.link ? (
                  <Link key={idx} to={item.link} className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-brand-bg border border-brand-secondary/20 hover:border-brand-secondary/50 transition-all hover:shadow-md group block">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white flex items-center justify-center text-brand-secondary mb-2.5 shadow-2xs group-hover:scale-105 group-hover:bg-brand-secondary group-hover:text-white transition-all">
                      {item.icon}
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-brand-primary mb-1">{item.title}</h4>
                    <p className="text-[11px] sm:text-xs text-brand-text/65 font-light leading-relaxed">{item.text}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-brand-secondary uppercase tracking-widest">
                      View Reports <FiArrowRight size={10} />
                    </span>
                  </Link>
                ) : (
                  <div key={idx} className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-brand-bg border border-brand-primary/5 hover:border-brand-secondary/40 transition-all hover:shadow-md group">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white flex items-center justify-center text-brand-secondary mb-2.5 shadow-2xs group-hover:scale-105 group-hover:bg-brand-secondary group-hover:text-white transition-all">
                      {item.icon}
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-brand-primary mb-1">{item.title}</h4>
                    <p className="text-[11px] sm:text-xs text-brand-text/65 font-light leading-relaxed">{item.text}</p>
                  </div>
                )
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section className="py-8 sm:py-12 md:py-14 bg-brand-bg relative overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-8">
            <motion.h4 {...fadeUp(0)} className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary mb-1">
              {t('home.testimonialTag', 'Testimonials')}
            </motion.h4>
            <motion.h2 {...fadeUp(0.06)} className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-brand-primary">
              {t('home.testimonialTitle', 'Loved by Families')}
            </motion.h2>
          </div>

          <motion.div {...fadeUp(0.12)}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {TESTIMONIALS.map((review, idx) => (
                <div key={idx} className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl shadow-2xs hover:shadow-xs transition-shadow relative border border-brand-primary/5 flex flex-col justify-between">
                  <div>
                    <div className="flex gap-0.5 mb-2.5 text-brand-secondary">
                      {[...Array(review.rating)].map((_, i) => (
                        <FiStar key={i} size={14} className="fill-brand-secondary text-brand-secondary" />
                      ))}
                    </div>
                    <p className="text-xs sm:text-sm text-brand-text/75 italic leading-relaxed mb-4 font-serif">
                      "{review.text}"
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 pt-3 border-t border-brand-primary/5">
                    <img 
                      src={review.image} 
                      alt={review.name} 
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shadow-2xs border border-brand-secondary/20" 
                    />
                    <div>
                      <h5 className="font-bold text-brand-primary text-xs sm:text-sm">{review.name}</h5>
                      <p className="text-[10px] text-brand-text/50">{review.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════ GALLERY (Masonry Layout) ══════════ */}
      <section className="py-8 sm:py-12 md:py-14 bg-white border-y border-brand-primary/5">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div className="text-center md:text-left">
              <motion.h2 {...fadeUp(0)} className="text-2xl sm:text-3xl font-display font-bold text-brand-primary mb-0.5">
                Our World
              </motion.h2>
              <motion.p {...fadeUp(0.06)} className="text-[11px] sm:text-xs text-brand-text/60">
                Glimpses of our authentic Rajasthan heritage and farm process.
              </motion.p>
            </div>
            <motion.div {...fadeUp(0.1)} className="flex flex-wrap gap-1.5 justify-center">
              {GALLERY_TABS.map((tab) => (
                <button 
                  key={tab.key}
                  onClick={() => setGalleryFilter(tab.key)}
                  className={`px-3 sm:px-4 py-1 rounded-full text-xs font-bold transition-all ${
                    galleryFilter === tab.key 
                      ? 'bg-brand-primary text-white shadow-xs' 
                      : 'bg-brand-bg text-brand-text/60 hover:bg-brand-primary/10 hover:text-brand-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </motion.div>
          </div>

          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
            {GALLERY_IMAGES.filter(img => galleryFilter === 'All' || img.cat === galleryFilter).map((img, idx) => (
              <motion.div 
                key={img.id} 
                {...fadeUp(idx * 0.05)} 
                onClick={() => setActiveLightboxImage(img)}
                className="break-inside-avoid relative rounded-xl sm:rounded-2xl overflow-hidden group shadow-2xs hover:shadow-md cursor-pointer border border-brand-primary/5"
              >
                <img 
                  src={img.url} 
                  alt={img.title} 
                  loading="lazy"
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-brand-primary/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-9 h-9 bg-white/25 backdrop-blur rounded-full flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform duration-300 mb-1">
                    <FiEye size={16} />
                  </div>
                  <span className="text-white font-bold text-xs drop-shadow">{img.title}</span>
                  <span className="text-brand-secondary text-[10px] font-semibold uppercase tracking-wider">{img.cat}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CERTIFICATIONS ══════════ */}
      <section className="py-6 sm:py-8 bg-brand-bg border-b border-brand-primary/5">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4 items-center justify-center text-center">
            {CERTIFICATIONS.map((cert, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/60 border border-brand-primary/5 hover:bg-white transition-colors">
                <div className="w-9 h-9 rounded-full bg-brand-bg border border-brand-secondary/30 flex items-center justify-center shadow-2xs">
                  {cert.icon}
                </div>
                <div>
                  <h5 className="text-[11px] sm:text-xs font-bold text-brand-primary uppercase tracking-wide">{cert.name}</h5>
                  <p className="text-[9px] sm:text-[10px] text-brand-text/50 font-medium">{cert.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TRACK ORDER BANNER ══════════ */}
      <section className="py-6 sm:py-8 bg-white relative">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8">
          <motion.div {...fadeUp(0)} className="bg-brand-primary p-5 sm:p-7 md:p-8 rounded-xl sm:rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 shadow-md">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-brand-secondary/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            
            <div className="relative z-10 max-w-xl text-white text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2.5 mb-1.5 sm:mb-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary shrink-0">
                  <FiTruck size={18} />
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-white">
                  {t('home.trackOrderTitle', 'Track Your Order')}
                </h3>
              </div>
              <p className="text-white/80 text-xs sm:text-sm font-light leading-relaxed">
                {t('home.trackOrderDesc', 'Waiting for your pure Bilona Ghee? Use our tracking portal to get real-time updates on your delivery status.')}
              </p>
            </div>
            
            <div className="relative z-10 w-full md:w-auto shrink-0">
              <Link to="/track-order" className="btn btn-primary h-10 sm:h-11 px-6 sm:px-8 text-xs sm:text-sm rounded-full flex items-center justify-center gap-1.5 shadow-gold whitespace-nowrap w-full">
                <span>{t('home.trackNowBtn', 'Track Now')}</span> <FiArrowRight size={14} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════ NEWSLETTER & LIMITED OFFER ══════════ */}
      <section className="py-6 sm:py-8 bg-white relative pb-10 sm:pb-14">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-4 sm:gap-6">
          <motion.div {...fadeUp(0)} className="bg-brand-bg p-5 sm:p-6 rounded-xl sm:rounded-2xl relative overflow-hidden border border-brand-primary/5 flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-36 h-36 bg-brand-secondary/10 rounded-full blur-2xl -z-10 translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            
            <div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-brand-primary mb-1.5">
                {t('home.joinFamilyTitle', 'Join The Daatasa Family')}
              </h3>
              <p className="text-brand-text/70 mb-4 font-light text-xs sm:text-sm leading-relaxed">
                {t('home.joinFamilyDesc', 'Subscribe to get exclusive health tips, early access to new products, and special family-only discounts.')}
              </p>
            </div>
            
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('home.emailPlaceholder', 'Enter your email address')} 
                className="flex-1 px-3.5 py-2.5 rounded-lg bg-white border border-brand-primary/15 focus:border-brand-secondary outline-none shadow-2xs text-xs sm:text-sm"
                required
              />
              <button type="submit" disabled={subscribing} className="btn btn-primary h-10 px-5 rounded-full whitespace-nowrap text-xs sm:text-sm">
                {subscribing ? t('home.subscribingBtn', 'Joining...') : t('home.subscribeBtn', 'Subscribe Now')}
              </button>
            </form>
          </motion.div>

          <motion.div {...slideIn(0.15, "right")} className="bg-brand-primary rounded-xl sm:rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden flex flex-col justify-center shadow-lg">
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 opacity-15 pointer-events-none">
              <FiAward size={150} />
            </div>
            
            <div className="relative z-10">
              <span className="inline-block px-2.5 py-0.5 rounded bg-brand-secondary text-brand-primary text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1.5">
                {t('home.limitedOffer', 'Limited Time Offer')}
              </span>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-display font-bold mb-1.5 text-white">
                {t('home.get10Off', 'Get 10% OFF')}
              </h3>
              <p className="text-white/75 mb-4 text-xs sm:text-sm font-light leading-relaxed">
                {t('home.offerDesc', 'On your first order of our premium Desi Cow Bilona Ghee.')}
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyCoupon('FIRST10')}
                  title="Click to copy coupon code"
                  className="w-full sm:w-auto px-4 py-2 border border-white/25 rounded-lg bg-white/10 font-mono text-brand-secondary text-sm sm:text-base font-bold tracking-widest shadow-inner text-center hover:bg-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>FIRST10</span>
                  {copiedCoupon ? <FiCheckCircle size={14} className="text-emerald-400" /> : <FiCopy size={14} />}
                </button>
                <Link to="/products" className="btn btn-accent w-full sm:w-auto h-10 px-5 rounded-full flex items-center justify-center shadow-gold bg-brand-secondary text-brand-primary hover:bg-white transition-colors text-xs sm:text-sm font-bold">
                  <span>{t('home.orderNowBtn', 'Order Now')}</span> <FiArrowRight size={14} className="ml-1" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════ VIDEO STORY MODAL ══════════ */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-brand-primary rounded-2xl sm:rounded-3xl overflow-hidden max-w-2xl w-full relative shadow-2xl border border-white/10"
            >
              <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-white/10 text-white">
                <h3 className="font-display font-bold text-base sm:text-lg flex items-center gap-2">
                  <FiDroplet className="text-brand-secondary" /> The Vedic Bilona Craft Story
                </h3>
                <button 
                  onClick={() => setIsVideoModalOpen(false)}
                  aria-label="Close Video"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                >
                  <FiX size={18} />
                </button>
              </div>
              <div className="aspect-video w-full bg-black relative">
                <iframe 
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" 
                  title="Vedic Bilona Ghee Crafting" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                />
              </div>
              <div className="p-3 sm:p-4 bg-brand-primary/95 text-white/80 text-xs flex justify-between items-center">
                <span>Handcrafted with love in Khuri, Jaisalmer.</span>
                <Link to="/about" onClick={() => setIsVideoModalOpen(false)} className="text-brand-secondary font-bold hover:underline">
                  Read Full Story →
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════ GALLERY LIGHTBOX MODAL ══════════ */}
      <AnimatePresence>
        {activeLightboxImage && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md cursor-pointer"
            onClick={() => setActiveLightboxImage(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl sm:rounded-3xl overflow-hidden max-w-xl w-full relative shadow-2xl cursor-default"
            >
              <div className="relative aspect-[4/3] w-full bg-black">
                <img 
                  src={activeLightboxImage.url} 
                  alt={activeLightboxImage.title} 
                  className="w-full h-full object-cover" 
                />
                <button 
                  onClick={() => setActiveLightboxImage(null)}
                  aria-label="Close Lightbox"
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all shadow-md"
                >
                  <FiX size={18} />
                </button>
              </div>
              <div className="p-3 sm:p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-display font-bold text-sm sm:text-base text-brand-primary">{activeLightboxImage.title}</h4>
                  <span className="text-[10px] sm:text-xs text-brand-secondary font-semibold uppercase tracking-wider">{activeLightboxImage.cat} Collection</span>
                </div>
                <Link to="/products" onClick={() => setActiveLightboxImage(null)} className="btn btn-primary h-8 sm:h-9 px-4 rounded-full text-xs">
                  Shop Ghee
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
