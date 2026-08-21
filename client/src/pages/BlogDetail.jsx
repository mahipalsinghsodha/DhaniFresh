import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { FiClock, FiUser, FiArrowLeft, FiShare2, FiCheck } from 'react-icons/fi'
import { toast } from 'react-toastify'

const BlogDetail = () => {
  const { slug } = useParams()
  const [blog, setBlog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.get(`/api/blogs/${slug}`)
      .then(res => setBlog(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [slug])

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    toast.success('Article link copied to clipboard!')
    setTimeout(() => setCopied(false), 2500)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-[var(--ivory)] pt-20 pb-16 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="min-h-[60vh] bg-[var(--ivory)] pt-20 pb-16 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-brand-primary mb-2">Article Not Found</h1>
        <p className="text-xs sm:text-sm text-brand-text/60 mb-6">The article you are looking for does not exist or has been removed.</p>
        <Link to="/blogs" className="btn btn-primary px-6 h-10 rounded-full inline-flex items-center justify-center text-xs font-bold">
          Back to Journal
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--ivory)] font-sans text-brand-text pb-12 sm:pb-16">
      <Helmet>
        <title>{blog.title} — Daatasa</title>
        <meta name="description" content={blog.content?.substring(0, 150).replace(/<[^>]*>?/gm, '')} />
      </Helmet>

      {/* Header Image */}
      <div className="w-full h-[32vh] sm:h-[45vh] relative bg-brand-primary overflow-hidden">
        <img 
          src={blog.images?.[0] || 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=1200&q=80'} 
          alt={blog.title}
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-[800px] mx-auto w-full px-4 sm:px-6 pb-6 sm:pb-10 text-white text-center">
            {blog.tags && blog.tags.length > 0 && (
              <div className="mb-3 flex justify-center gap-1.5 flex-wrap">
                {blog.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-0.5 bg-white/20 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-full border border-white/25">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold font-display mb-3 leading-tight drop-shadow-md">
              {blog.title}
            </h1>
            <div className="flex items-center justify-center gap-4 text-xs font-medium text-white/80">
              <span className="flex items-center gap-1">
                <FiClock size={13} /> {new Date(blog.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {blog.author && (
                <span className="flex items-center gap-1">
                  <FiUser size={13} /> {blog.author}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Link to="/blogs" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-secondary hover:text-brand-primary transition-colors mb-6 uppercase tracking-wider">
          <FiArrowLeft size={14} /> Back to Journal
        </Link>
        
        <div 
          className="prose prose-sm sm:prose-base max-w-none text-brand-text/85 prose-headings:font-display prose-headings:text-brand-primary prose-a:text-brand-secondary leading-relaxed bg-white p-5 sm:p-8 rounded-2xl border border-brand-primary/5 shadow-2xs"
          dangerouslySetInnerHTML={{ __html: blog.content }}
        />
        
        {/* Footer / Share */}
        <div className="mt-8 pt-4 border-t border-brand-primary/10 flex items-center justify-between">
          <p className="font-bold text-xs sm:text-sm text-brand-primary">Share this article</p>
          <button 
            onClick={handleShare}
            aria-label="Share article"
            className="w-9 h-9 rounded-full bg-white border border-brand-primary/10 flex items-center justify-center text-brand-primary hover:bg-brand-secondary hover:text-white transition-all shadow-2xs"
          >
            {copied ? <FiCheck size={16} className="text-emerald-600" /> : <FiShare2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BlogDetail
