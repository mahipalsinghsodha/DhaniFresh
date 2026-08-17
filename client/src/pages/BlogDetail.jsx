import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { FiClock, FiUser, FiArrowLeft, FiShare2 } from 'react-icons/fi'

const BlogDetail = () => {
  const { slug } = useParams()
  const [blog, setBlog] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/blogs/${slug}`)
      .then(res => setBlog(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--ivory)] pt-32 pb-20 flex justify-center">
        <div className="w-8 h-8 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="min-h-screen bg-[var(--ivory)] pt-32 pb-20 flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-4xl font-bold font-display text-brand-primary mb-4">Article Not Found</h1>
        <p className="text-brand-text/60 mb-8">The article you are looking for does not exist or has been removed.</p>
        <Link to="/blogs" className="btn btn-primary px-8 h-12 rounded-full inline-flex items-center justify-center">
          Back to Journal
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--ivory)] font-sans text-brand-text pb-20">
      <Helmet>
        <title>{blog.title} — Daatasa</title>
        <meta name="description" content={blog.content.substring(0, 150).replace(/<[^>]*>?/gm, '')} />
      </Helmet>

      {/* Header Image */}
      <div className="w-full h-[40vh] sm:h-[60vh] relative bg-brand-primary/10 overflow-hidden">
        {blog.images?.[0] && (
          <img 
            src={blog.images[0]} 
            alt={blog.title}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-[800px] mx-auto w-full px-6 pb-12 sm:pb-16 text-white text-center">
            {blog.tags && blog.tags.length > 0 && (
              <div className="mb-6 flex justify-center gap-2 flex-wrap">
                {blog.tags.map(tag => (
                  <span key={tag} className="px-4 py-1.5 bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-widest rounded-full border border-white/30">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold font-display mb-6 leading-tight">
              {blog.title}
            </h1>
            <div className="flex items-center justify-center gap-6 text-sm font-bold uppercase tracking-widest text-white/80">
              <span className="flex items-center gap-2"><FiClock size={16} /> {new Date(blog.createdAt).toLocaleDateString()}</span>
              <span className="flex items-center gap-2"><FiUser size={16} /> {blog.author}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[800px] mx-auto px-6 py-16">
        <Link to="/blogs" className="inline-flex items-center gap-2 text-sm font-bold text-brand-text/50 hover:text-brand-primary transition-colors mb-10 uppercase tracking-widest">
          <FiArrowLeft size={16} /> Back to Journal
        </Link>
        
        <div 
          className="prose prose-lg max-w-none text-brand-text prose-headings:font-display prose-headings:text-brand-primary prose-a:text-brand-secondary"
          dangerouslySetInnerHTML={{ __html: blog.content }}
        ></div>
        
        {/* Footer / Share */}
        <div className="mt-16 pt-8 border-t border-brand-primary/10 flex items-center justify-between">
          <p className="font-bold text-brand-primary">Share this article</p>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Link copied!');
            }}
            className="w-10 h-10 rounded-full bg-white border border-brand-primary/10 flex items-center justify-center text-brand-primary hover:bg-brand-secondary hover:text-white transition-colors"
          >
            <FiShare2 size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default BlogDetail
