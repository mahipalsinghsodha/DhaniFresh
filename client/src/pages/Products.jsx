import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import ProductCard from '../components/ProductCard'
import { FiSearch, FiPackage, FiChevronLeft, FiChevronRight, FiSliders, FiX } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const PAGE_SIZE = 12

const SkeletonCard = () => (
  <div className="rounded-[20px] overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
    <div className="aspect-square skeleton" />
    <div className="p-4 space-y-2.5">
      <div className="h-3 skeleton rounded-full w-3/4" />
      <div className="h-3 skeleton rounded-full w-1/2" />
      <div className="h-5 skeleton rounded-full w-1/3 mt-1" />
    </div>
  </div>
)

const SORT_OPTIONS = [
  { label: 'Default',           value: 'default'   },
  { label: 'Price: Low → High', value: 'price_asc' },
  { label: 'Price: High → Low', value: 'price_desc' },
  { label: 'Top Rated',         value: 'rating'    },
  { label: 'Newest',            value: 'newest'    },
]

const Products = () => {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [products,         setProducts]         = useState([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all')
  const [sort,             setSort]             = useState(searchParams.get('sort') || 'default')

  useEffect(() => {
    setSelectedCategory(searchParams.get('category') || 'all')
    if (searchParams.get('sort')) {
      setSort(searchParams.get('sort'))
    }
  }, [searchParams])

  const [searchTerm,       setSearchTerm]       = useState('')
  const [debouncedSearch,  setDebouncedSearch]  = useState('')
  const [categories,       setCategories]       = useState([])
  const [page,             setPage]             = useState(1)
  const [total,            setTotal]            = useState(0)
  const [totalPages,       setTotalPages]       = useState(0)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    api.get('/api/categories').then(r => setCategories(r.data)).catch(console.error)
  }, [])

  useEffect(() => { fetchProducts() }, [selectedCategory, debouncedSearch, page, sort])

  const fetchProducts = async () => {
    setLoading(true); setError(null)
    try {
      const params = { page, limit: PAGE_SIZE, sort }
      if (selectedCategory !== 'all') params.category = selectedCategory
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim()
      const res = await api.get('/api/products', { params })
      setProducts(res.data.products || [])
      setTotal(res.data.total || 0)
      setTotalPages(res.data.pages || 0)
    } catch (err) {
      console.error(err)
      setError('Could not load products. Please check your connection and try again.')
    } finally { setLoading(false) }
  }

  const handleCategoryChange = cat => {
    setSelectedCategory(cat); setPage(1)
    cat === 'all' ? setSearchParams({}) : setSearchParams({ category: cat })
  }

  const clearFilters = () => {
    setSearchTerm(''); setSelectedCategory('all')
    setSearchParams({}); setSort('default'); setPage(1)
  }

  const hasFilters = selectedCategory !== 'all' || debouncedSearch

  return (
    <div className="min-h-screen bg-[var(--ivory)] font-sans text-brand-text selection:bg-brand-secondary selection:text-white">
      <Helmet>
        <title>{selectedCategory && selectedCategory !== 'all'
          ? `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Ghee — Daatasa`
          : 'Buy Pure Desi Ghee Online — Daatasa'}</title>
        <meta name="description" content="Shop premium Bilona Desi Ghee online. Traditional Tharparkar cow ghee crafted in our Rajasthan village. FSSAI certified. Free shipping above ₹500. Pan India delivery." />
        <link rel="canonical" href="https://daatasa.in/products" />
      </Helmet>

      {/* ── Premium Hero Header ── */}
      <div className="relative overflow-hidden bg-white text-brand-primary border-b border-brand-primary/5">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none bg-brand-secondary/10" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, var(--brand-primary) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-10 text-center">
          <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-brand-primary/5 text-brand-primary border border-brand-primary/10 mb-4">
            {t('products.heroTag', 'Pure Ghee Collection')}
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="text-3xl sm:text-5xl font-display font-bold mb-3 text-brand-primary">
            {t('products.heroTitle', 'Our Heritage Products')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="text-base font-medium text-brand-text/60 max-w-xl mx-auto">
            {t('products.heroDesc', 'Handcrafted using traditional methods for absolute purity, rich aroma, and holistic well-being.')}
          </motion.p>
        </div>
      </div>

      {/* ── Sticky Filter Bar ── */}
      <div className="sticky top-[60px] md:top-[80px] z-30 bg-white/80 backdrop-blur-xl border-b border-brand-primary/10 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {[{ slug: 'all', name: 'All Products' }, ...categories].map(cat => {
                const active = selectedCategory === cat.slug
                return (
                  <button
                    key={cat.slug}
                    onClick={() => handleCategoryChange(cat.slug)}
                    className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                      active ? 'btn btn-primary' : 'bg-white border border-brand-primary/10 text-brand-text/60 hover:border-brand-primary/30 hover:text-brand-primary'
                    }`}
                  >
                    {cat.name}
                  </button>
                )
              })}
            </div>

            {/* Search + Sort */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
              {/* Search */}
              <div className="relative group">
                <FiSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-0 transition-all placeholder:text-brand-text/30 w-full sm:w-56 bg-white border border-brand-primary/10 text-brand-primary rounded-full focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/30 shadow-inner"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <FiX size={13} />
                  </button>
                )}
              </div>

              {/* Sort */}
              <div className="relative">
                <FiSliders className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} size={13} />
                <select
                  value={sort}
                  onChange={e => { setSort(e.target.value); setPage(1) }}
                  className="pl-10 pr-8 py-2.5 text-sm outline-none transition-all cursor-pointer appearance-none w-full sm:w-auto bg-white border border-brand-primary/10 text-brand-text/80 rounded-full focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/30 shadow-inner"
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Products Grid ── */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

        {/* Result count + clear */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-brand-text/60 font-light">
              Showing <span className="font-bold text-brand-primary">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</span> of{' '}
              <span className="font-bold text-brand-primary">{total}</span> products
              {selectedCategory !== 'all' && (
                <> in <span className="font-bold capitalize text-brand-secondary">{selectedCategory}</span></>
              )}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs font-bold transition-colors text-brand-text/40 hover:text-brand-primary">
                <FiX size={12} /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Products Grid */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {[...Array(PAGE_SIZE)].map((_, i) => <SkeletonCard key={i} />)}
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="py-24 rounded-[2rem] flex flex-col items-center text-center p-10 bg-white border border-brand-primary/10 shadow-sm">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-red-50 text-red-500">
                <FiPackage size={28} />
              </div>
              <h2 className="text-2xl font-display font-bold mb-3 text-brand-primary">Could Not Load Products</h2>
              <p className="text-base max-w-sm mb-8 text-brand-text/60 font-light">{error}</p>
              <button onClick={fetchProducts} className="btn btn-primary px-8 h-12 rounded-full">Try Again</button>
            </motion.div>
          ) : products.length > 0 ? (
            <motion.div key="grid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {products.map(product => (
                <ProductCard key={product._id} product={product} categories={categories} />
              ))}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="py-32 rounded-[2rem] flex flex-col items-center text-center p-10 bg-white border-2 border-dashed border-brand-primary/10">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-[var(--ivory)] text-brand-primary/40">
                <FiPackage size={32} />
              </div>
              <h3 className="text-3xl font-display font-bold mb-4 text-brand-primary">No Products Found</h3>
              <p className="text-base max-w-sm mb-8 text-brand-text/60 font-light">
                Try adjusting your search or filter to find what you're looking for.
              </p>
              <button onClick={clearFilters} className="btn btn-primary text-sm">Reset Filters</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-14">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-12 h-12 flex items-center justify-center rounded-full transition-all disabled:opacity-30 bg-white border border-brand-primary/10 text-brand-text/60 hover:border-brand-primary hover:text-brand-primary shadow-sm"
            >
              <FiChevronLeft size={18} />
            </button>
            {[...Array(totalPages)].map((_, i) => {
              const p = i + 1
              if (totalPages > 7 && Math.abs(p - page) > 2 && p !== 1 && p !== totalPages) {
                if (p === 2 || p === totalPages - 1) return <span key={p} className="text-brand-text/40 text-sm px-2">…</span>
                return null
              }
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-12 h-12 rounded-full text-sm font-bold transition-all duration-300 shadow-sm ${
                    page === p
                      ? 'btn btn-primary'
                      : 'bg-white text-brand-text/60 border border-brand-primary/10 hover:border-brand-primary hover:text-brand-primary'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-12 h-12 flex items-center justify-center rounded-full transition-all disabled:opacity-30 bg-white border border-brand-primary/10 text-brand-text/60 hover:border-brand-primary hover:text-brand-primary shadow-sm"
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Products
