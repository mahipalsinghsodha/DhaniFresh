import { useState, useEffect } from 'react'
import { FiStar, FiMessageSquare, FiEyeOff, FiEye, FiTrash2, FiSearch, FiRefreshCw, FiExternalLink } from 'react-icons/fi'
import { motion } from 'framer-motion'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import RestrictedAccess from '../../components/RestrictedAccess'
import Pagination from '../../components/Pagination'

const AdminReviews = () => {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalReviews, setTotalReviews] = useState(0)

  const [search, setSearch] = useState('')

  useEffect(() => {
    if (hasPermission('products')) fetchReviews(true)
  }, [hasPermission, page])

  const fetchReviews = async (showLoad = false) => {
    if (showLoad) setLoading(true); else setSyncing(true)
    try {
      const res = await api.get(`/api/reviews/admin?page=${page}&limit=12`)
      setReviews(res.data.reviews || [])
      setTotalPages(res.data.pages || 1)
      setTotalReviews(res.data.total || 0)
    } catch { toast.error('Failed to load reviews') }
    finally { setLoading(false); setSyncing(false) }
  }

  const toggleVisibility = async (id, currentStatus) => {
    try {
      await api.put(`/api/reviews/admin/${id}/toggle`)
      toast.success(currentStatus ? 'Review hidden from customers' : 'Review is now public')
      fetchReviews(false)
    } catch { toast.error('Failed to update review visibility') }
  }

  const deleteReview = async (id) => {
    if (!(await confirm('Permanently delete this review? This cannot be undone.'))) return
    try {
      await api.delete(`/api/reviews/${id}`)
      toast.success('Review permanently deleted')
      fetchReviews(false)
    } catch { toast.error('Failed to delete review') }
  }

  if (!hasPermission('products')) return <RestrictedAccess title="Access Restricted" message="You don't have permission to manage reviews." />

  const filteredReviews = reviews.filter(r => 
    !search || 
    r.title?.toLowerCase().includes(search.toLowerCase()) || 
    r.body?.toLowerCase().includes(search.toLowerCase()) ||
    r.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.product?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)', filter: 'blur(60px)', opacity: 0.7 }} />
        
        <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full border mb-3"
                style={{ background: 'rgba(99,102,241,0.18)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.35)' }}>
                <FiMessageSquare size={10} /> Moderation
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}>
                Customer Reviews
              </h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Manage and moderate {totalReviews} product reviews</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
                <FiSearch size={14} style={{ color: 'rgba(255,255,255,0.55)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reviews…" className="bg-transparent outline-none text-sm w-48 text-white placeholder-white/50" />
              </div>
              <button onClick={() => fetchReviews(true)} disabled={syncing} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.80)' }}>
                <FiRefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border shadow-sm">
                <div className="h-4 w-32 shimmer rounded mb-4" />
                <div className="h-16 w-full shimmer rounded mb-4" />
                <div className="h-4 w-24 shimmer rounded" />
              </div>
            ))}
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <FiMessageSquare size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">No reviews found</h3>
            <p className="text-sm text-slate-500">There are no reviews matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredReviews.map((review) => (
              <motion.div key={review._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden transition-all shadow-sm ${!review.isActive ? 'border-red-200 dark:border-red-900/30 opacity-75' : 'hover:shadow-md hover:border-indigo-200'}`}>
                
                {/* Header */}
                <div className="p-4 border-b border-slate-50 flex items-start justify-between gap-4" style={{ background: review.isActive ? 'var(--bg-surface)' : 'rgba(229,62,62,0.03)' }}>
                  <div className="flex items-center gap-3">
                    <img src={review.product?.image} alt="" className="w-10 h-10 rounded-xl object-cover border" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">{review.product?.name || 'Unknown Product'}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {[...Array(5)].map((_, i) => (
                          <FiStar key={i} size={10} className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-slate-200 text-slate-200'} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {!review.isActive && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">Hidden</span>
                  )}
                </div>

                {/* Body */}
                <div className="p-5">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2">{review.title}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-4 leading-relaxed">{review.body}</p>
                  
                  {review.images?.length > 0 && (
                    <div className="flex gap-2 mt-4">
                      {review.images.map((img, i) => (
                        <img key={i} src={img} alt="Review attachment" className="w-12 h-12 rounded-lg object-cover border" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold">{review.user?.name || 'Anonymous User'}</span>
                    <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button onClick={() => toggleVisibility(review._id, review.isActive)} 
                      className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${review.isActive ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                      {review.isActive ? <><FiEyeOff size={13} /> Hide</> : <><FiEye size={13} /> Publish</>}
                    </button>
                    
                    <button onClick={() => deleteReview(review._id)} className="w-10 h-[32px] bg-red-50 text-red-600 hover:bg-red-100 rounded-lg flex items-center justify-center transition-colors">
                      <FiTrash2 size={13} />
                    </button>
                    
                    {review.product && (
                      <button onClick={() => navigate(`/product/${review.product._id}`)} className="w-10 h-[32px] bg-white border shadow-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center justify-center transition-colors">
                        <FiExternalLink size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Responsive Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalReviews}
          pageSize={15}
          onPageChange={(newPage) => setPage(newPage)}
          itemName="reviews"
        />
      </div>
    </div>
  )
}

export default AdminReviews
