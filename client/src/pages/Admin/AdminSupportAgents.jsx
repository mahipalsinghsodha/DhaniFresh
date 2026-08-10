import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiUsers, FiPlus, FiTrash2, FiSearch, FiShield, FiMail, FiPhone } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import RestrictedAccess from '../../components/RestrictedAccess'
import { useConfirm } from '../../context/ConfirmContext'

const AdminSupportAgents = () => {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (user?.role === 'superadmin') fetchAgents()
  }, [user])

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/admin/support-agents')
      setAgents(res.data || [])
    } catch {
      toast.error('Failed to load support agents')
    } finally {
      setLoading(false)
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
      setAgents([...agents, res.data])
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

  if (user?.role !== 'superadmin') return (
    <RestrictedAccess title="Superadmin Required" message="Only Super Administrators can manage support agents." />
  )

  const filtered = agents.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="min-h-screen pb-20 flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-10 h-10 border-2 border-t-[var(--brand-primary)] border-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full border mb-3"
                style={{ background: 'rgba(245,197,24,0.18)', color: 'var(--gold)', borderColor: 'rgba(245,197,24,0.35)' }}>
                <FiShield size={10} /> Super Admin
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}>
                Support Agents
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
                <FiSearch size={15} style={{ color: 'rgba(255,255,255,0.55)' }} />
                <input type="text" placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)}
                  className="bg-transparent outline-none text-sm w-48" style={{ color: '#FFFFFF' }} />
              </div>
              <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-white text-[var(--brand-primary)] hover:bg-slate-50 transition-colors">
                <FiPlus size={16} /> New Agent
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
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

        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent Details</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-12 text-center">
                    <FiUsers size={32} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-500">No support agents found.</p>
                  </td>
                </tr>
              ) : filtered.map(agent => (
                <tr key={agent._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold border border-brand-primary/20">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-800">{agent.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><FiMail size={10} /> {agent.email}</p>
                        {agent.phone && <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><FiPhone size={10} /> {agent.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(agent.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(agent._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <FiTrash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminSupportAgents
