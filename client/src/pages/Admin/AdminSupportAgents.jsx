import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiUsers, FiPlus, FiTrash2, FiSearch, FiShield, FiMail, FiPhone,
  FiCheckCircle, FiXCircle, FiClock, FiActivity, FiRotateCcw, FiEye, FiX, FiAlertCircle
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../hooks/useSocket'
import RestrictedAccess from '../../components/RestrictedAccess'
import { useConfirm } from '../../context/ConfirmContext'

const AdminSupportAgents = () => {
  const { user } = useAuth()
  const { connect, on, off } = useSocket()
  const confirm = useConfirm()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' })
  const [creating, setCreating] = useState(false)

  // Rejection History Modal
  const [historyAgent, setHistoryAgent] = useState(null)
  const [historyLogs, setHistoryLogs] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (user?.role === 'superadmin') {
      fetchAgents()
      connect()

      const handlePresenceChange = ({ agentId, isLive, isOnline }) => {
        setAgents(prev => prev.map(a => {
          if (String(a._id) === String(agentId)) {
            return { ...a, isOnline, isLive }
          }
          return a
        }))
      }

      const handleStatsUpdate = () => {
        fetchAgents(true)
      }

      on('admin:agent_presence_change', handlePresenceChange)
      on('agent:stats_updated', handleStatsUpdate)

      // Fallback background sync every 15s
      const interval = setInterval(() => {
        fetchAgents(true)
      }, 15000)

      return () => {
        off('admin:agent_presence_change', handlePresenceChange)
        off('agent:stats_updated', handleStatsUpdate)
        clearInterval(interval)
      }
    }
  }, [user, connect, on, off])

  const fetchAgents = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await api.get('/api/admin/support-agents')
      setAgents(res.data || [])
    } catch {
      if (!silent) toast.error('Failed to load support agents')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.password) {
      return toast.error('Name, email, and password are required.')
    }
    setCreating(true)
    try {
      const res = await api.post('/api/admin/create-support-agent', formData)
      setAgents([...agents, { ...res.data, isOnline: false, isLive: true, acceptanceRate: 100, activeChats: 0 }])
      setShowCreate(false)
      setFormData({ name: '', email: '', phone: '', password: '' })
      toast.success('Support Agent created successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create agent')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!(await confirm('Are you sure you want to remove this Support Agent?'))) return

    try {
      await api.delete(`/api/admin/support-agent/${id}`)
      setAgents(agents.filter(a => a._id !== id))
      toast.success('Support Agent removed.')
    } catch {
      toast.error('Failed to remove agent')
    }
  }

  const handleResetStats = async (id, name) => {
    if (!(await confirm(`Reset call dispatch & rejection performance stats for ${name}?`))) return

    try {
      await api.post(`/api/admin/support-agent/${id}/reset-stats`)
      toast.success(`Stats reset for ${name}`)
      fetchAgents()
    } catch (err) {
      toast.error('Failed to reset stats')
    }
  }

  const handleViewHistory = async (agent) => {
    setHistoryAgent(agent)
    setLoadingHistory(true)
    try {
      const res = await api.get(`/api/admin/support-agent/${agent._id}/history`)
      setHistoryLogs(res.data || [])
    } catch (err) {
      toast.error('Failed to load agent routing history')
    } finally {
      setLoadingHistory(false)
    }
  }

  if (user?.role !== 'superadmin') return (
    <RestrictedAccess title="Superadmin Required" message="Only Super Administrators can manage support agents and call center analytics." />
  )

  const safeAgents = Array.isArray(agents) ? agents : []

  const filtered = safeAgents.filter(a => 
    (a?.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (a?.email || '').toLowerCase().includes(search.toLowerCase())
  )

  // Overall KPI aggregates
  const totalDispatched = safeAgents.reduce((sum, a) => sum + (a?.supportStats?.dispatchedCount || 0), 0)
  const totalAccepted = safeAgents.reduce((sum, a) => sum + (a?.supportStats?.acceptedCount || 0), 0)
  const totalRejected = safeAgents.reduce((sum, a) => sum + (a?.supportStats?.rejectedCount || 0), 0)
  const totalMissed = safeAgents.reduce((sum, a) => sum + (a?.supportStats?.missedCount || 0), 0)
  const onlineCount = safeAgents.filter(a => a?.isOnline && a?.isLive).length
  const avgAcceptance = totalDispatched > 0 ? Math.round((totalAccepted / totalDispatched) * 100) : 100

  if (loading && safeAgents.length === 0) return (
    <div className="min-h-screen pb-20 flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-10 h-10 border-2 border-t-[var(--brand-primary)] border-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>
      {/* ── Top Hero Header ── */}
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full border mb-3"
                style={{ background: 'rgba(245,197,24,0.18)', color: 'var(--gold)', borderColor: 'rgba(245,197,24,0.35)' }}>
                <FiShield size={10} /> Super Admin Call Center Console
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}>
                Support Agents & Dispatch Analytics
              </h1>
              <p className="text-xs sm:text-sm text-white/70 mt-1">
                Monitor live agent availability, 30s auto-dispatch routing, acceptance rates, and rejection timeouts.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-slate-100 border border-slate-200">
                <FiSearch size={15} className="text-slate-400" />
                <input type="text" placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)}
                  className="bg-transparent outline-none text-sm w-48 text-slate-700 placeholder:text-slate-400" />
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all"
              >
                <FiPlus size={16} /> Add Support Agent
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Agents</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1">{safeAgents.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
            <p className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live & Online
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">{onlineCount}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase">Dispatched Rings</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1">{totalDispatched}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-emerald-50 shadow-sm">
            <p className="text-xs font-bold text-emerald-600 uppercase">Accepted</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{totalAccepted}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-rose-50 shadow-sm">
            <p className="text-xs font-bold text-rose-600 uppercase">Rejected / Missed</p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{totalRejected + totalMissed}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-amber-50 shadow-sm">
            <p className="text-xs font-bold text-amber-600 uppercase">Avg Acceptance</p>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{avgAcceptance}%</p>
          </div>
        </div>

        {/* ── Create Agent Modal ── */}
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Create Support Agent</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Full Name</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone (Optional)</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Temporary Password</label>
                <input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary text-sm" />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                <button type="submit" disabled={creating} className="px-6 py-2 text-sm font-bold bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Agent'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* ── Call Center Performance Table ── */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FiActivity className="text-amber-500" /> Agent Performance, Work Hours & Ratings
            </h2>
            <button onClick={fetchAgents} className="text-xs font-bold text-brand-primary hover:underline">
              Refresh Data
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent Details</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live Status</th>
                  <th className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Work Time (Today)</th>
                  <th className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dispatched</th>
                  <th className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Accepted (Rate)</th>
                  <th className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rejected</th>
                  <th className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rating ⭐</th>
                  <th className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active</th>
                  <th className="px-6 py-3.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center">
                      <FiUsers size={32} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-bold text-slate-500">No support agents found.</p>
                    </td>
                  </tr>
                ) : filtered.map(agent => {
                  const stats = agent.supportStats || {}
                  const dispatched = stats.dispatchedCount || 0
                  const accepted = stats.acceptedCount || 0
                  const rejected = stats.rejectedCount || 0
                  const missed = stats.missedCount || 0
                  const resolved = stats.resolvedCount || 0
                  const rate = agent.acceptanceRate ?? 100

                  return (
                    <tr key={agent._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold border border-brand-primary/20 shrink-0">
                            {(agent.name || 'Agent').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-800">{agent.name || 'Agent'}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><FiMail size={10} /> {agent.email || ''}</p>
                            {agent.phone && <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><FiPhone size={10} /> {agent.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {agent.isOnline && agent.isLive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live & Online
                          </span>
                        ) : agent.isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-2 h-2 rounded-full bg-amber-500" /> Away (Connected)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            <span className="w-2 h-2 rounded-full bg-slate-400" /> Offline
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-sm text-slate-700 font-mono">{dispatched}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-sm text-emerald-600 font-mono">{accepted}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${rate >= 75 ? 'bg-emerald-50 text-emerald-700' : rate >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                            {rate}% rate
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-sm text-rose-600 font-mono">{rejected}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-sm text-orange-600 font-mono">{missed}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-slate-800">{agent.activeChats || 0} active</span>
                          <span className="text-[10px] text-slate-400">{resolved} resolved</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewHistory(agent)}
                            title="View Rejection / Routing History"
                            className="p-2 text-slate-600 hover:text-brand-primary hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <FiEye size={15} />
                          </button>
                          <button
                            onClick={() => handleResetStats(agent._id, agent.name)}
                            title="Reset Agent Stats"
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <FiRotateCcw size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(agent._id)}
                            title="Remove Support Agent"
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Rejection & Routing History Modal ── */}
        <AnimatePresence>
          {historyAgent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
              >
                <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="font-bold text-base text-slate-800">
                      Performance & Audit: {historyAgent.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{historyAgent.email}</span>
                      <span>·</span>
                      <span className="font-bold text-brand-primary">Work: {formatWorkTime(historyAgent.todayWorkSeconds || 0)} today</span>
                      <span>·</span>
                      <span className="font-bold text-amber-600">⭐ {historyAgent.avgRating || 5} ({historyAgent.ratingCount || 0} reviews)</span>
                    </div>
                  </div>
                  <button onClick={() => setHistoryAgent(null)} className="p-2 text-slate-400 hover:text-slate-700">
                    <FiX size={18} />
                  </button>
                </div>

                <div className="p-4 sm:p-6 max-h-[60vh] overflow-y-auto space-y-6">
                  {/* Customer Reviews Section */}
                  {historyAgent.recentReviews && historyAgent.recentReviews.length > 0 && (
                    <div>
                      <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-2.5">
                        Recent Customer Feedback & Ratings
                      </h4>
                      <div className="space-y-2">
                        {historyAgent.recentReviews.map((rev, i) => (
                          <div key={i} className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800">{rev.customerName}</span>
                              <span className="text-xs font-extrabold text-amber-600">⭐ {rev.score} / 5</span>
                            </div>
                            {rev.comment && (
                              <p className="text-xs text-slate-600 mt-1 italic">"{rev.comment}"</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">
                              {new Date(rev.submittedAt).toLocaleDateString()} {new Date(rev.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dispatching / Routing History */}
                  <div>
                    <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-2.5">
                      Call Routing & Action Logs
                    </h4>
                    {loadingHistory ? (
                      <div className="py-12 text-center text-slate-400 text-sm">Loading history...</div>
                    ) : historyLogs.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm">
                        <FiCheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
                        No routing actions or rejections recorded for this agent yet.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {historyLogs.map((log, idx) => (
                          <div key={idx} className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                  log.action === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' :
                                  log.action === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {log.action === 'MISSED_TIMEOUT' ? '30s Timeout (Missed)' : log.action}
                                </span>
                                <span className="text-xs font-bold text-slate-700">{log.customerName}</span>
                                <span className="text-[10px] text-slate-400">({log.category})</span>
                                {log.rating?.score && (
                                  <span className="text-[11px] font-bold text-amber-600">⭐ {log.rating.score}/5</span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                                Session: {log.sessionId}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-slate-500">
                                {new Date(log.dispatchedAt).toLocaleDateString()} {new Date(log.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

export default AdminSupportAgents
