import { useState, useEffect } from 'react' // fix-casing
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiUsers, FiSearch, FiLock, FiUnlock, FiX,
  FiShoppingBag, FiShield, FiMail, FiPhone, FiCalendar,
  FiRefreshCw, FiUserCheck, FiAlertCircle
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import RestrictedAccess from '../../components/RestrictedAccess'
import { useConfirm } from '../../context/ConfirmContext'

/* ── shared mini-helpers ── */
const Card = ({ children, style }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', ...style }}>
    {children}
  </div>
)

const AdminUsers = () => {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [filterRole, setFilterRole] = useState('all')

  useEffect(() => {
    if (hasPermission('users')) fetchAllData()
  }, [hasPermission])

  const fetchAllData = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true)
      const [uRes, oRes] = await Promise.all([
        api.get('/api/auth/users'),
        api.get('/api/orders')
      ])
      setUsers(uRes.data || [])
      setOrders(oRes.data?.orders || [])
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleToggleBlock = async (target) => {
    const actionName = target.isBlocked ? 'unblock' : 'block';
    if (!(await confirm(`Are you sure you want to ${actionName} this user?`))) {
      return;
    }
    
    try {
      setProcessingId(target._id)
      const res = await api.put(
        `/api/auth/users/${target._id}/block`,
        { reason: target.isBlocked ? 'Unblocked by admin' : 'Blocked by admin' }
      )
      const updated = { ...target, isBlocked: res.data.isBlocked }
      setUsers(u => u.map(x => x._id === target._id ? updated : x))
      if (selectedUser?._id === target._id) setSelectedUser(updated)
      toast.success(`User successfully ${actionName}ed`)
    } catch {
      toast.error(`Failed to ${actionName} user`)
    } finally {
      setProcessingId(null)
    }
  }

  const handleRoleChange = async (target, newRole) => {
    if (!(await confirm(`Are you sure you want to change ${target.name}'s role to ${newRole}?`))) return;
    try {
      setProcessingId(target._id)
      const res = await api.put(`/api/auth/users/${target._id}/role`, { role: newRole })
      const updated = { ...target, role: res.data.role }
      setUsers(u => u.map(x => x._id === target._id ? updated : x))
      if (selectedUser?._id === target._id) setSelectedUser(updated)
      toast.success('Role updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role')
    } finally {
      setProcessingId(null)
    }
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone && u.phone.includes(search))
    const matchRole = filterRole === 'all' ? true :
      filterRole === 'blocked' ? u.isBlocked : u.role === filterRole
    return matchSearch && matchRole
  })

  const getUserOrders = (uid) =>
    orders.filter(o => (o.user && typeof o.user === 'object' ? o.user._id : o.user) === uid)

  if (!hasPermission('users')) return (
    <RestrictedAccess title="Access Restricted" message="You don't have permission to view users." />
  )

  if (loading) return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>
      <div style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-8 w-40 shimmer rounded mb-2" />
          <div className="h-5 w-56 shimmer rounded" />
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', padding: 20 }} className="flex items-center gap-4">
            <div className="w-10 h-10 shimmer rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 shimmer rounded" />
              <div className="h-3 w-52 shimmer rounded" />
            </div>
            <div className="h-7 w-20 shimmer rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>

      {/* ── Premium Admin Header ── */}
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.25) 0%, transparent 70%)', filter: 'blur(60px)', opacity: 0.7 }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full border mb-3"
                style={{ background: 'rgba(245,197,24,0.18)', color: 'var(--gold)', borderColor: 'rgba(245,197,24,0.35)' }}>
                <FiShield size={10} /> Admin Panel
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}>
                Manage Users
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
                <FiSearch size={15} style={{ color: 'rgba(255,255,255,0.55)' }} className="shrink-0" />
                <input type="text" placeholder="Search name, email, phone…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-transparent outline-none text-sm w-52"
                  style={{ color: '#FFFFFF', caretColor: 'var(--gold)', fontFamily: 'var(--font)' }}
                  id="user-search"
                />
              </div>
              <button onClick={() => fetchAllData(true)} disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.80)' }}>
                <FiRefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats + Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(245,166,35,0.18)', border: '1px solid rgba(245,166,35,0.30)' }}>
                <FiUsers size={13} style={{ color: 'var(--gold)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{users.length} Users</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(229,62,62,0.18)', border: '1px solid rgba(229,62,62,0.30)' }}>
                <FiLock size={13} style={{ color: '#FCA5A5' }} />
                <span className="text-xs font-bold" style={{ color: '#FCA5A5' }}>{users.filter(u => u.isBlocked).length} Blocked</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(96,165,250,0.18)', border: '1px solid rgba(96,165,250,0.30)' }}>
                <FiShield size={13} style={{ color: '#93C5FD' }} />
                <span className="text-xs font-bold" style={{ color: '#93C5FD' }}>{users.filter(u => u.role === 'admin').length} Admins</span>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[['all', 'All'], ['user', 'Customers'], ['admin', 'Admins'], ['blocked', 'Blocked']].map(([val, label]) => (
                <button key={val} onClick={() => setFilterRole(val)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={filterRole === val
                    ? { background: 'var(--gold)', color: 'var(--navy)', border: 'none' }
                    : { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.75)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Users Table ── */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-alt)' }}>
                  {['User', 'Role & Status', 'Joined', 'Orders', 'Total Spent', 'Action'].map((h, i) => (
                    <th key={h} style={{
                      padding: '12px 20px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: 'var(--text-muted)',
                      textAlign: i >= 3 ? 'right' : 'left', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center' }}>
                      <FiUsers size={36} style={{ color: 'var(--border-color)', margin: '0 auto 12px', display: 'block' }} />
                      <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>No users found</p>
                    </td>
                  </tr>
                ) : filtered.map(u => (
                  <motion.tr
                    key={u._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => setSelectedUser(u)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-alt)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* User */}
                    <td style={{ padding: '14px 20px' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                          style={{ background: 'rgba(245,166,35,0.12)', color: 'var(--brand-secondary)', border: '1.5px solid rgba(245,166,35,0.25)' }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td style={{ padding: '14px 20px' }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{
                          padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: '1px solid',
                          ...(u.role === 'admin'
                            ? { background: 'rgba(49,130,206,0.08)', color: 'var(--info)', borderColor: 'rgba(49,130,206,0.20)' }
                            : u.role === 'superadmin'
                              ? { background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', borderColor: 'rgba(139,92,246,0.20)' }
                              : { background: 'var(--bg-alt)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }
                          )
                        }}>{u.role}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: '1px solid',
                          ...(u.isBlocked
                            ? { background: 'rgba(229,62,62,0.08)', color: 'var(--danger)', borderColor: 'rgba(229,62,62,0.20)' }
                            : { background: 'rgba(56,161,105,0.08)', color: 'var(--success)', borderColor: 'rgba(56,161,105,0.20)' }
                          )
                        }}>
                          {u.isBlocked ? '⊘ Blocked' : '● Active'}
                        </span>
                      </div>
                    </td>
                    {/* Joined */}
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    {/* Orders */}
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {u.totalOrders}
                    </td>
                    {/* Spent */}
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--brand-secondary)' }}>
                      ₹{u.totalSpent?.toFixed(0)}
                    </td>
                    {/* Action */}
                    <td style={{ padding: '14px 20px' }}>
                      <div className="flex justify-end">
                        <button
                          onClick={e => { e.stopPropagation(); handleToggleBlock(u) }}
                          disabled={processingId === u._id}
                          style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                            transition: 'all 0.2s', opacity: processingId === u._id ? 0.6 : 1,
                            ...(u.isBlocked
                              ? { background: 'rgba(56,161,105,0.08)', color: 'var(--success)', border: '1px solid rgba(56,161,105,0.25)' }
                              : { background: 'rgba(229,62,62,0.08)', color: 'var(--danger)', border: '1px solid rgba(229,62,62,0.25)' }
                            )
                          }}
                        >
                          {processingId === u._id ? '…' : u.isBlocked ? <><FiUnlock size={11} /> Unblock</> : <><FiLock size={11} /> Block</>}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Side Drawer ── */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[200] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(27,47,110,0.45)', backdropFilter: 'blur(12px)' }}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              style={{
                position: 'relative', width: '100%', maxWidth: 480, height: '100%',
                background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column',
                boxShadow: 'var(--shadow-lg)', borderLeft: '1px solid var(--border-color)',
              }}
            >
              {/* Drawer Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="flex items-center gap-3">
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'rgba(245,166,35,0.12)', border: '2px solid rgba(245,166,35,0.30)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 800, color: 'var(--brand-secondary)',
                  }}>
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>{selectedUser.name}</h2>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>#{selectedUser._id.slice(-8).toUpperCase()}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)}
                  style={{ padding: 8, color: 'var(--text-muted)', cursor: 'pointer', background: 'transparent', border: 'none', borderRadius: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-alt)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <FiX size={18} />
                </button>
              </div>

              {/* Drawer Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Status Banner */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 'var(--radius-card)',
                  ...(selectedUser.isBlocked
                    ? { background: 'rgba(229,62,62,0.07)', border: '1px solid rgba(229,62,62,0.20)' }
                    : { background: 'rgba(56,161,105,0.07)', border: '1px solid rgba(56,161,105,0.20)' }
                  )
                }}>
                  <div className="flex items-center gap-2.5">
                    {selectedUser.isBlocked
                      ? <FiAlertCircle size={16} style={{ color: 'var(--danger)' }} />
                      : <FiUserCheck size={16} style={{ color: 'var(--success)' }} />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: selectedUser.isBlocked ? 'var(--danger)' : 'var(--success)' }}>
                      {selectedUser.isBlocked ? 'Account Blocked' : 'Account Active'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleBlock(selectedUser)}
                    disabled={processingId === selectedUser._id}
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                      opacity: processingId === selectedUser._id ? 0.6 : 1,
                      ...(selectedUser.isBlocked
                        ? { background: 'var(--success)', color: '#fff' }
                        : { background: 'var(--danger)', color: '#fff' }
                      )
                    }}
                  >
                    {processingId === selectedUser._id ? '…' : selectedUser.isBlocked ? 'Unblock' : 'Block'}
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div style={{ padding: 16, background: 'var(--bg-alt)', borderRadius: 'var(--radius-input)', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Orders</p>
                    <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{selectedUser.totalOrders}</p>
                  </div>
                  <div style={{ padding: 16, background: 'var(--bg-alt)', borderRadius: 'var(--radius-input)', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spent</p>
                    <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--brand-secondary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>₹{selectedUser.totalSpent?.toFixed(0)}</p>
                  </div>
                </div>

                {/* Account Details */}
                <div style={{ background: 'var(--bg-alt)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                    <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Account Details</h3>
                  </div>
                  <div>
                    {[
                      { icon: FiMail,     label: 'Email',  val: selectedUser.email },
                      { icon: FiPhone,    label: 'Phone',  val: selectedUser.phone || 'Not provided' },
                      { icon: FiShield,   label: 'Role',   
                        val: (
                          <select 
                            value={selectedUser.role}
                            onChange={(e) => handleRoleChange(selectedUser, e.target.value)}
                            disabled={processingId === selectedUser._id}
                            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px', fontSize: '12px' }}
                          >
                            <option value="user">User</option>
                            <option value="courier">Courier</option>
                            <option value="support">Support</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">Superadmin</option>
                          </select>
                        )
                      },
                      { icon: FiCalendar, label: 'Joined', val: new Date(selectedUser.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div className="flex items-center gap-2.5" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          <item.icon size={13} style={{ color: 'var(--brand-secondary)' }} /> {item.label}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Orders */}
                <div>
                  <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Recent Orders</h3>
                  {(() => {
                    const uOrders = getUserOrders(selectedUser._id)
                    if (!uOrders.length) return (
                      <div style={{ padding: '32px 20px', textAlign: 'center', background: 'var(--bg-alt)', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--border-color)' }}>
                        <FiShoppingBag size={24} style={{ color: 'var(--border-color)', margin: '0 auto 8px', display: 'block' }} />
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No orders placed yet</p>
                      </div>
                    )
                    return (
                      <div className="space-y-2">
                        {uOrders.slice(0, 5).map(o => (
                          <div key={o._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-alt)', borderRadius: 'var(--radius-input)', border: '1px solid var(--border-color)' }}>
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>#{o._id.slice(-8).toUpperCase()}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>₹{o.totalPrice?.toFixed(0)}</p>
                              <span style={{ fontSize: 11, fontWeight: 600, color: o.isDelivered ? 'var(--success)' : 'var(--info)' }}>
                                {o.isDelivered ? 'Delivered' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Drawer Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-alt)' }}>
                <button onClick={() => setSelectedUser(null)} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AdminUsers
// force ts update