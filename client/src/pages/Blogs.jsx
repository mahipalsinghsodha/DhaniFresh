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
      .then(res => setBlogs(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[var(--ivory)] font-sans text-brand-text pb-20">
      <Helmet>
        <title>Our Blog — Daatasa</title>
        <meta name="description" content="Read our latest articles about Bilona ghee, wellness, and Ayurveda." />
      </Helmet>

      {/* Header */}
      <div className="relative overflow-hidden py-24 sm:py-32 text-center bg-brand-primary text-white">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay" />
        <div className="max-w-[1280px] mx-auto px-6 relative z-10">
          <h1 className="text-4xl sm:text-6xl font-bold font-display text-white mb-6">Our Journal</h1>
          <p className="text-lg sm:text-xl font-medium text-white/80 max-w-2xl mx-auto">
            Discover insights, recipes, and the ancient wisdom behind authentic Bilona ghee.
          </p>
        </div>
      </div>

      {/* Blog Grid */}
      <div className="max-w-[1280px] mx-auto px-6 py-16">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="animate-pulse bg-white rounded-[2rem] overflow-hidden shadow-sm">
                <div className="aspect-[4/3] bg-brand-primary/5"></div>
                <div className="p-8 space-y-4">
                  <div className="h-4 bg-brand-primary/5 rounded w-1/3"></div>
                  <div className="h-8 bg-brand-primary/5 rounded w-3/4"></div>
                  <div className="h-4 bg-brand-primary/5 rounded w-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl font-bold text-brand-text/50">No articles published yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogs.map(blog => (
              <Link 
                to={`/blog/${blog.slug}`} 
                key={blog._id}
                className="group bg-white rounded-[2rem] overflow-hidden shadow-sm border border-brand-primary/10 hover:shadow-lg transition-all duration-300 flex flex-col"
              >
                <div className="aspect-[4/3] relative overflow-hidden bg-[var(--ivory)]">
                  {blog.images?.[0] ? (
                    <img 
                      src={blog.images[0]} 
                      alt={blog.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-primary/20">
                      <span className="text-4xl font-display font-bold">Daatasa</span>
                    </div>
                  )}
                  {blog.tags && blog.tags.length > 0 && (
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-brand-primary text-xs font-bold uppercase tracking-widest rounded-full">
                        {blog.tags[0]}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-8 flex flex-col flex-1">
                  <div className="flex items-center gap-4 text-xs font-bold text-brand-text/50 uppercase tracking-widest mb-4">
                    <span className="flex items-center gap-1.5"><FiClock size={14} /> {new Date(blog.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1.5"><FiUser size={14} /> {blog.author}</span>
                  </div>
                  <h2 className="text-xl font-bold font-display text-brand-primary mb-3 group-hover:text-brand-secondary transition-colors line-clamp-2">
                    {blog.title}
                  </h2>
                  <p className="text-sm font-medium text-brand-text/70 line-clamp-3 mb-6 flex-1">
                    {blog.content.replace(/<[^>]*>?/gm, '')}
                  </p>
                  <div className="flex items-center gap-2 text-sm font-bold text-brand-primary group-hover:text-brand-secondary transition-colors">
                    Read Article <FiArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Blogs
