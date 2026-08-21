import React, { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight, FiArrowRight } from 'react-icons/fi'
import ProductCard from './ProductCard'
import { useTranslation } from 'react-i18next'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 15 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-20px" },
  transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] },
})

const ProductCarousel = ({ title, subtitle, products, loading, viewAllLink, showRank }) => {
  const { t } = useTranslation()
  const scrollContainerRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 10)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    checkScroll()
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScroll, { passive: true })
      window.addEventListener('resize', checkScroll)
      return () => {
        container.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
      }
    }
  }, [products, loading])

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-3 sm:mb-5 gap-1.5 sm:gap-4 px-1 sm:px-0">
        <div>
          {subtitle && (
            <motion.h4 {...fadeUp(0)} className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary mb-0.5 sm:mb-1">
              {subtitle}
            </motion.h4>
          )}
          <motion.h2 {...fadeUp(0.08)} className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-brand-primary leading-snug">
            {title}
          </motion.h2>
        </div>
        
        <motion.div {...fadeUp(0.12)} className="flex items-center gap-2.5 self-end sm:self-auto">
          {viewAllLink && (
            <Link to={viewAllLink} className="text-xs sm:text-sm font-bold text-brand-secondary hover:text-brand-primary transition-colors flex items-center gap-1 group">
              <span>{t('carousel.viewAll', 'View All')}</span>
              <FiArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          
          {/* Desktop Navigation Arrows */}
          <div className="hidden sm:flex gap-1.5">
            <button 
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="Previous products"
              className="w-8 h-8 rounded-full border border-brand-primary/15 flex items-center justify-center text-brand-primary hover:bg-brand-primary hover:text-white transition-all disabled:opacity-25 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-2xs"
            >
              <FiChevronLeft size={16} />
            </button>
            <button 
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="Next products"
              className="w-8 h-8 rounded-full border border-brand-primary/15 flex items-center justify-center text-brand-primary hover:bg-brand-primary hover:text-white transition-all disabled:opacity-25 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-2xs"
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Carousel Container */}
      <div className="relative group -mx-3 px-3 sm:mx-0 sm:px-0">
        <div 
          ref={scrollContainerRef}
          className="flex gap-3 sm:gap-4.5 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-3 pt-1 scroll-smooth items-stretch"
        >
          {loading ? (
             [...Array(4)].map((_, i) => (
               <div key={i} className="snap-start shrink-0 w-[210px] xs:w-[230px] sm:w-[260px] h-[320px] sm:h-[350px] bg-white rounded-2xl skeleton border border-brand-primary/5" />
             ))
          ) : products && products.length > 0 ? (
            products.map((product, idx) => (
              <motion.div 
                key={product._id || idx} 
                initial={{ opacity: 0, x: 15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: Math.min(idx * 0.04, 0.2) }}
                className="snap-start shrink-0 w-[210px] xs:w-[230px] sm:w-[260px] flex"
              >
                <ProductCard product={product} rank={showRank ? idx + 1 : undefined} />
              </motion.div>
            ))
          ) : (
            <div className="w-full py-6 text-center text-brand-text/50 text-xs sm:text-sm font-light bg-white rounded-xl border border-brand-primary/5">
              {t('carousel.noProducts', 'No products available at the moment.')}
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile View All Button */}
      {viewAllLink && (
        <div className="mt-1 text-center sm:hidden">
          <Link to={viewAllLink} className="btn btn-secondary w-full h-9 flex items-center justify-center rounded-full text-xs font-bold shadow-xs">
            {t('carousel.viewAll', 'View All')} ({products?.length || 0})
          </Link>
        </div>
      )}
    </div>
  )
}

export default ProductCarousel
