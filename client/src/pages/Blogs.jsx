import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { FiClock, FiUser, FiArrowRight } from 'react-icons/fi'

const Blogs = () => {
  const [blogs, setBlogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/blogs')
      .then(res => setBlogs(res.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[var(--ivory)] font-sans text-brand-text pb-12 sm:pb-16">
      <Helmet>
        <title>Our Journal — Daatasa</title>
        <meta name="description" content="Read our latest articles about Bilona ghee, wellness, and Ayurveda." />
      </Helmet>

      {/* Header */}
      <div className="relative overflow-hidden py-10 sm:py-16 md:py-20 text-center bg-brand-primary text-white">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay pointer-events-none" />
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 relative z-10">
          <span className="inline-block text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-brand-secondary mb-1 sm:mb-2">
            Daatasa Chronicle
          </span>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold font-display text-white mb-2 sm:mb-3">
            Our Journal
          </h1>
          <p className="text-xs sm:text-sm md:text-base font-normal text-white/80 max-w-xl mx-auto leading-relaxed">
            Discover insights, recipes, and the ancient wisdom behind authentic Bilona ghee.
          </p>
        </div>
      </div>

      {/* Blog Grid */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-white rounded-2xl overflow-hidden shadow-2xs border border-brand-primary/5">
                <div className="aspect-[16/10] bg-brand-primary/10" />
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="h-3 bg-brand-primary/10 rounded w-1/3" />
                  <div className="h-5 bg-brand-primary/10 rounded w-3/4" />
                  <div className="h-3 bg-brand-primary/10 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-brand-primary/5 p-6 max-w-md mx-auto">
            <p className="text-sm sm:text-base font-bold text-brand-text/60">No articles published yet.</p>
            <p className="text-xs text-brand-text/40 mt-1">Check back soon for new stories & recipes.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {blogs.map(blog => {
              const tag = blog.tags?.[0]
              const displayTag = tag && tag.length > 25 ? `${tag.slice(0, 22)}...` : tag

              return (
                <Link 
                  to={`/blog/${blog.slug}`} 
                  key={blog._id}
                  className="group bg-white rounded-2xl overflow-hidden shadow-2xs border border-brand-primary/10 hover:shadow-md hover:border-brand-secondary/30 transition-all duration-300 flex flex-col"
                >
                  <div className="aspect-[16/10] relative overflow-hidden bg-[var(--ivory)]">
                    <img 
                      src={blog.images?.[0] || 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80'} 
                      alt={blog.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {displayTag && (
                      <div className="absolute top-2.5 left-2.5 max-w-[80%]">
                        <span className="px-2.5 py-0.5 bg-white/95 backdrop-blur-sm text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded-full shadow-2xs truncate block">
                          {displayTag}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 sm:p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold text-brand-text/50 uppercase tracking-wider mb-2">
                      <span className="flex items-center gap-1">
                        <FiClock size={12} /> {new Date(blog.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {blog.author && (
                        <span className="flex items-center gap-1">
                          <FiUser size={12} /> {blog.author}
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm sm:text-base font-bold font-display text-brand-primary mb-1.5 group-hover:text-brand-secondary transition-colors line-clamp-2 leading-snug">
                      {blog.title}
                    </h2>
                    <p className="text-xs font-light text-brand-text/70 line-clamp-2 mb-3 flex-1 leading-relaxed">
                      {blog.content?.replace(/<[^>]*>?/gm, '')}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-brand-secondary group-hover:text-brand-primary transition-colors pt-2 border-t border-brand-primary/5">
                      <span>Read Article</span>
                      <FiArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Blogs
