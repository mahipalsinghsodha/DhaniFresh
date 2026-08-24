// pages/admin/AdminNewsletters.jsx — Premium Edition
import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { FiMail, FiUsers, FiSend, FiTrash2, FiSearch, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/axios'
import { useConfirm } from '../../context/ConfirmContext'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
})

const AdminNewsletters = () => {
  const confirm = useConfirm()
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Compose State
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const fetchSubscribers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/subscribers')
      setSubscribers(res.data.data || [])
    } catch (error) {
      toast.error('Failed to load subscribers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscribers()
  }, [])

  const handleDelete = async (id) => {
    if (!(await confirm('Are you sure you want to remove this subscriber?'))) return
    try {
      await api.delete(`/api/subscribers/${id}`)
      toast.success('Subscriber removed')
      setSubscribers(prev => prev.filter(s => s._id !== id))
    } catch (error) {
      toast.error('Failed to remove subscriber')
    }
  }

  const handleSendEmail = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      return toast.error('Subject and message are required')
    }
    
    if (!(await confirm('Are you sure you want to send this email to ALL active subscribers?'))) return

    try {
      setSending(true)
      const res = await api.post('/api/subscribers/send-email', { subject, message })
      toast.success(res.data.message || 'Newsletter sent successfully!')
      setSubject('')
      setMessage('')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send newsletter')
    } finally {
      setSending(false)
    }
  }

  const filteredSubscribers = subscribers.filter(sub => 
    sub.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const activeCount = subscribers.filter(s => s.isActive).length

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>
      <Helmet><title>Manage Newsletters | Admin</title></Helmet>

      {/* ── Header ── */}
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
          <motion.h1 {...fadeUp(0)} className="text-2xl sm:text-3xl font-extrabold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Newsletter & Marketing
          </motion.h1>
          <motion.p {...fadeUp(0.05)} className="text-sm" style={{ color: 'rgba(255,255,255,0.60)' }}>
            Send promotional emails to your subscribers and manage your email list.
          </motion.p>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* ── Left Col: Compose Email ── */}
          <motion.div {...fadeUp(0.1)} className="lg:col-span-1">
            <div className="rounded-2xl overflow-hidden sticky top-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-alt)] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-gradient)' }}>
                  <FiSend size={15} color="white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Compose Broadcast</h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Send to {activeCount} active subscribers</p>
                </div>
              </div>

              <form onSubmit={handleSendEmail} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Flash Sale! 20% Off Pure Ghee"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border focus:ring-2 outline-none transition-all"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Message Content</label>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your email content here. You can use plain text or line breaks."
                    rows={8}
                    className="w-full px-4 py-3 rounded-xl text-sm border focus:ring-2 outline-none transition-all resize-none"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending || activeCount === 0}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                  style={{ 
                    background: 'var(--gold)', 
                    color: 'var(--navy)', 
                    opacity: sending || activeCount === 0 ? 0.7 : 1,
                    cursor: sending || activeCount === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  {sending ? <><FiRefreshCw className="animate-spin" size={16} /> Sending...</> : <><FiSend size={16} /> Send to All</>}
                </button>
              </form>
            </div>
          </motion.div>

          {/* ── Right Col: Subscribers List ── */}
          <motion.div {...fadeUp(0.2)} className="lg:col-span-2 space-y-4">
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,166,35,0.15)', color: 'var(--gold)' }}>
                  <FiUsers size={20} />
                </div>
                <div>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--text-primary)', lineHeight: 1 }}>{subscribers.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Subscribers</p>
                </div>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} size={16} />
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
              {loading ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading subscribers...</div>
              ) : filteredSubscribers.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: 'var(--bg-alt)', color: 'var(--text-muted)' }}>
                    <FiMail size={24} />
                  </div>
                  <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>No subscribers found</h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No one matches your search or you don't have any subscribers yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider font-bold" style={{ background: 'var(--bg-alt)', color: 'var(--text-muted)' }}>
                        <th className="px-5 py-4 border-b border-[var(--border-color)]">Email Address</th>
                        <th className="px-5 py-4 border-b border-[var(--border-color)]">Status</th>
                        <th className="px-5 py-4 border-b border-[var(--border-color)]">Subscribed On</th>
                        <th className="px-5 py-4 border-b border-[var(--border-color)] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubscribers.map((sub, idx) => (
                        <motion.tr 
                          key={sub._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="group hover:bg-[var(--bg-alt)] transition-colors border-b border-[var(--border-color)] last:border-0"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                                style={{ background: 'var(--bg-base)', color: 'var(--navy)' }}>
                                {sub.email.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{sub.email}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold"
                              style={sub.isActive 
                                ? { background: 'rgba(56,161,105,0.15)', color: 'var(--success)' }
                                : { background: 'rgba(226,232,240,0.5)', color: 'var(--text-muted)' }}>
                              {sub.isActive ? 'Active' : 'Unsubscribed'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                            {new Date(sub.subscribedAt).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => handleDelete(sub._id)}
                              className="w-8 h-8 rounded-lg inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 text-red-500"
                              title="Remove Subscriber"
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default AdminNewsletters
