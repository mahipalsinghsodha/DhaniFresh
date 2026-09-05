import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight, FiArrowRight } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

const HeroCarousel = () => {
  const { t } = useTranslation()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  const slides = [
    {
      id: 1,
      image: "/herosection.png",
      badge: t('hero.badge1', 'Heritage of Rajasthan'),
      title: t('hero.title1', '100% Pure Vedic A2'),
      subtitle: t('hero.sub1', 'Cow Ghee — Traditional Bilona Method'),
      description: t('hero.desc1', 'Traditionally hand-churned liquid gold crafted slowly in earthen pots to preserve authentic aroma and nutrients.'),
      buttonText: t('hero.btn1', 'Shop Collection'),
      secondaryButtonText: t('hero.btn1b', 'Buy Pure Ghee'),
      secondaryLink: '/products',
      link: '/products',
      objectPosition: 'center center'
    },
    {
      id: 2,
      image: "/tharparkar-herd.jpg",
      badge: t('hero.badge2', 'Farm to Family'),
      title: t('hero.title2', '100% Organic & Natural'),
      subtitle: t('hero.sub2', 'Directly from Farms'),
      description: t('hero.desc2', 'Sourced from happy, free-grazing Tharparkar cows fed on natural organic grass in Khuri, Jaisalmer.'),
      buttonText: t('hero.btn2', 'Discover More'),
      link: '/about',
      objectPosition: 'center center'
    },
    {
      id: 3,
      image: "/gallery-churn.png",
      badge: t('hero.badge3', 'Authentic Process'),
      title: t('hero.title3', 'Traditional Bilona'),
      subtitle: t('hero.sub3', 'Hand-Churned Perfection'),
      description: t('hero.desc3', 'Rigorous 4-step Vedic process with patience and tradition for unparalleled health benefits.'),
      buttonText: t('hero.btn3', 'Shop Now'),
      link: '/products',
      objectPosition: 'center top'
    }
  ]

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1))
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))
  }, [slides.length])

  // Touch Swipe Handlers for mobile
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current
    const threshold = 40
    if (Math.abs(diff) > threshold) {
      if (diff > 0) nextSlide()
      else prevSlide()
    }
    touchStartX.current = 0
    touchEndX.current = 0
  }

  // Auto-play
  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => {
      nextSlide()
    }, 5500)
    return () => clearInterval(timer)
  }, [nextSlide, isPaused])

  return (
    <div 
      className="relative w-full h-[48vh] xs:h-[52vh] sm:h-[60vh] lg:h-[72vh] overflow-hidden bg-brand-bg group select-none"
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero Carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          {/* Background Image */}
          <div className="absolute inset-0 w-full h-full">
            <img 
              src={slides[currentSlide].image} 
              alt={slides[currentSlide].title}
              className="w-full h-full object-cover"
              style={{ objectPosition: slides[currentSlide].objectPosition || 'center center' }}
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25 sm:to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
          </div>

          {/* Slide Content */}
          <div className="relative z-10 h-full max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 flex flex-col justify-center">
            <div className="max-w-md sm:max-w-lg lg:max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mb-1.5 sm:mb-2.5"
              >
                <span className="inline-block px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-white bg-brand-secondary/90 backdrop-blur-md border border-white/20 shadow-sm">
                  {slides[currentSlide].badge}
                </span>
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.6 }}
                className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-display font-bold leading-[1.12] mb-1.5 sm:mb-2.5 text-white"
              >
                {slides[currentSlide].title} <br />
                <span className="text-brand-secondary italic">{slides[currentSlide].subtitle}</span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                className="text-xs sm:text-sm lg:text-base text-white/90 mb-3.5 sm:mb-6 leading-relaxed font-light line-clamp-2 sm:line-clamp-3 max-w-md"
              >
                {slides[currentSlide].description}
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.6 }}
                className="flex flex-wrap items-center gap-3"
              >
                <Link 
                  to={slides[currentSlide].link} 
                  className="btn btn-primary h-9 xs:h-10 sm:h-12 px-4 xs:px-6 sm:px-7 text-xs sm:text-sm rounded-full shadow-gold inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform"
                >
                  <span>{slides[currentSlide].buttonText}</span> <FiArrowRight className="text-xs sm:text-sm" />
                </Link>
                {slides[currentSlide].secondaryButtonText && (
                  <Link
                    to={slides[currentSlide].secondaryLink || slides[currentSlide].link}
                    className="h-9 xs:h-10 sm:h-12 px-4 xs:px-6 sm:px-7 text-xs sm:text-sm rounded-full inline-flex items-center gap-1.5 font-bold transition-all hover:scale-105 active:scale-95"
                    style={{
                      border: '2px solid rgba(255,255,255,0.55)',
                      color: '#fff',
                      backdropFilter: 'blur(6px)',
                      background: 'rgba(255,255,255,0.08)'
                    }}
                  >
                    <span>{slides[currentSlide].secondaryButtonText}</span>
                  </Link>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      <button 
        onClick={prevSlide} 
        aria-label="Previous Slide"
        className="absolute left-2 xs:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/25 sm:bg-white/10 hover:bg-white/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 z-20 hover:scale-110 active:scale-90"
      >
        <FiChevronLeft size={18} />
      </button>
      <button 
        onClick={nextSlide} 
        aria-label="Next Slide"
        className="absolute right-2 xs:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/25 sm:bg-white/10 hover:bg-white/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 z-20 hover:scale-110 active:scale-90"
      >
        <FiChevronRight size={18} />
      </button>

      {/* Pagination Dots */}
      <div className="absolute bottom-2.5 xs:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 xs:gap-2 z-20">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`transition-all duration-300 rounded-full h-1.5 xs:h-2 ${
              currentSlide === idx 
                ? 'w-5 xs:w-7 bg-brand-secondary shadow-gold' 
                : 'w-1.5 xs:w-2 bg-white/50 hover:bg-white'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

export default HeroCarousel
