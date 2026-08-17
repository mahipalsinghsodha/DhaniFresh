// pages/Admin/AdminDashboard.jsx — Premium Edition
import { useState, useEffect } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  FiPlus, FiPackage, FiShoppingBag, FiAlertCircle, FiTag,
  FiUsers, FiShield, FiActivity, FiBarChart2, FiTrendingUp,
  FiArrowRight, FiBox, FiSettings, FiZap, FiStar, FiLock, FiMail, FiRefreshCw, FiImage, FiEdit2
} from 'react-icons/fi'
import api from '../../api/axios'
import { motion } from 'framer-motion'

/* ── Animated counter ────────────────────────────────────────── */
const useCountUp = (end, duration = 900) => {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!end) { setCount(0); return }
    let start = 0
    const increment = end / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) { setCount(end); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [end, duration])
  return count
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
})

/* ── Skeletons ───────────────────────────────────────────────── */
const StatCardSkeleton = () => (
  <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <div className="h-3 w-20 skeleton rounded" />
        <div className="h-8 w-16 skeleton rounded" />
      </div>
      <div className="w-12 h-12 skeleton rounded-2xl" />
    </div>
  </div>
)

/* ── Gradient Stat Card ──────────────────────────────────────── */
const StatCard = ({ title, value, icon: Icon, gradient, iconBg, textColor = '#FFFFFF', prefix = '', trend, delay = 0 }) => {
  const animated = useCountUp(value)
  return (
    <motion.div {...fadeUp(delay)}
      className="rounded-2xl p-5 relative overflow-hidden cursor-default"
      style={{ background: gradient || 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-card)' }}
    >
      {/* Decorative circle */}
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.10)' }} />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.06)' }} />

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2"
            style={{ color: gradient ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)' }}>{title}</p>
          <p className="text-2xl sm:text-3xl font-extrabold tabular-nums"
            style={{ color: gradient ? textColor : 'var(--text-primary)', letterSpacing: '-0.03em', fontFamily: 'var(--font-display)' }}>
            {prefix}{animated.toLocaleString('en-IN')}
          </p>
          {trend !== undefined && (
            <p className={`text-[11px] font-semibold mt-1.5 ${trend >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% this week
            </p>
          )}
        </div>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform hover:scale-110"
          style={{ background: iconBg || 'rgba(255,255,255,0.20)', color: gradient ? '#FFFFFF' : 'var(--brand-secondary)' }}>
          <Icon size={20} />
        </div>
      </div>
    </motion.div>
  )
}

/* ── Quick Link Card ─────────────────────────────────────────── */
const QuickCard = ({ title, desc, icon: Icon, to, accent, delay = 0 }) => (
  <motion.div {...fadeUp(delay)}>
    <Link
      to={to}
      className="flex items-center gap-4 p-4 rounded-xl transition-all group"
      style={{
        background: accent ? 'rgba(245,197,24,0.06)' : 'var(--bg-base)',
        border: `1.5px solid ${accent ? 'rgba(245,197,24,0.25)' : 'var(--border-color)'}`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = accent ? 'rgba(245,197,24,0.10)' : 'var(--bg-alt)'
        e.currentTarget.style.borderColor = accent ? 'rgba(245,197,24,0.45)' : 'var(--brand-primary)'
        e.currentTarget.style.transform = 'translateX(4px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = accent ? 'rgba(245,197,24,0.06)' : 'var(--bg-base)'
        e.currentTarget.style.borderColor = accent ? 'rgba(245,197,24,0.25)' : 'var(--border-color)'
        e.currentTarget.style.transform = 'none'
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
        style={accent
          ? { background: 'var(--brand-gradient)', color: 'white', boxShadow: 'var(--shadow-brand)' }
          : { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }
        }
      >
        <Icon size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>}
      </div>
      <FiArrowRight size={14} className="shrink-0 transition-all group-hover:translate-x-1"
        style={{ color: accent ? 'var(--brand-secondary)' : 'var(--text-muted)' }} />
    </Link>
  </motion.div>
)

/* ── Section Card wrapper ────────────────────────────────────── */
const SectionCard = ({ title, icon: Icon, children, delay = 0 }) => (
  <motion.div {...fadeUp(delay)}
    className="rounded-2xl overflow-hidden"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
    <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-alt)' }}>
      {Icon && <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-gradient)' }}>
        <Icon size={14} color="white" />
      </div>}
      <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{title}</h2>
    </div>
    <div className="p-4 space-y-2">{children}</div>
  </motion.div>
)

/* ── Main Component ──────────────────────────────────────────── */
const AdminDashboard = () => {
  const { user, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ totalProducts: 0, totalOrders: 0, pendingOrders: 0, activeCoupons: 0, totalUsers: 0, blockedUsers: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'superadmin') fetchStats()
    else setLoading(false)
  }, [user])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const promises = []; const indexMap = {}
      if (hasPermission('products')) { indexMap.products = promises.length; promises.push(api.get('/api/products').catch(() => ({ data: [] }))) }
      if (hasPermission('orders'))   { indexMap.orders   = promises.length; promises.push(api.get('/api/orders').catch(() => ({ data: { orders: [] } }))) }
      if (hasPermission('coupons'))  { indexMap.coupons  = promises.length; promises.push(api.get('/api/coupons').catch(() => ({ data: [] }))) }
      if (hasPermission('users'))    { indexMap.users    = promises.length; promises.push(api.get('/api/auth/users').catch(() => ({ data: [] }))) }

      const results  = await Promise.all(promises)
      const products = indexMap.products !== undefined ? results[indexMap.products]?.data || [] : []
      const orders   = indexMap.orders   !== undefined ? results[indexMap.orders]?.data?.orders || [] : []
      const coupons  = indexMap.coupons  !== undefined ? results[indexMap.coupons]?.data || [] : []
      const users    = indexMap.users    !== undefined ? results[indexMap.users]?.data || [] : []
      const now = new Date()

      setStats({
        totalProducts: products.length,
        totalOrders:   orders.length,
        pendingOrders: orders.filter(o => !o.isPaid || !o.isDelivered).length,
        activeCoupons: coupons.filter(c => c.isActive && new Date(c.validUntil) > now).length,
        totalUsers:    users.length,
        blockedUsers:  users.filter(u => u.isBlocked).length,
      })
    } catch (err) {
      console.error(err); setError('Failed to load dashboard data')
    } finally { setLoading(false) }
  }

  if (!user) return <Navigate to="/login" />
  if (user.role !== 'admin' && user.role !== 'superadmin') return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="p-8 rounded-2xl max-w-md w-full text-center"
        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--danger)' }}>
          <FiLock size={28} />
        </div>
        <h2 className="font-extrabold text-lg mb-2" style={{ color: 'var(--danger)', fontFamily: 'var(--font-display)' }}>Access Denied</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>You must be an admin to access this page.</p>
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
        <div className="h-5 w-28 skeleton rounded mb-3" />
        <div className="h-8 w-64 skeleton rounded mb-2" />
        <div className="h-4 w-48 skeleton rounded mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(6)].map((_,i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="p-6 rounded-xl max-w-md w-full flex items-center gap-3"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)' }}>
        <FiAlertCircle size={20} /> {error}
      </div>
    </div>
  )

  const isSuperAdmin = user.role === 'superadmin'

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>

      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none opacity-10"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.6) 0%, transparent 70%)', filter: 'blur(50px)' }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <motion.span {...fadeUp(0)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full border mb-3"
                style={isSuperAdmin
                  ? { background: 'rgba(139,92,246,0.20)', color: '#C4B5FD', borderColor: 'rgba(139,92,246,0.35)' }
                  : { background: 'rgba(245,197,24,0.18)', color: 'var(--gold)', borderColor: 'rgba(245,197,24,0.35)' }
                }>
                {isSuperAdmin ? <><FiZap size={10} /> Super Admin</> : <><FiShield size={10} /> Admin Panel</>}
              </motion.span>
              <motion.h1 {...fadeUp(0.08)}
                className="text-2xl sm:text-3xl font-extrabold text-white"
                style={{ letterSpacing: '-0.025em', fontFamily: 'var(--font-display)' }}>
                {isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}
              </motion.h1>
              <motion.p {...fadeUp(0.14)} className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.60)' }}>
                Welcome back, <span className="font-bold text-white">{user.name}</span>
              </motion.p>
            </div>
            {hasPermission('products') && (
              <motion.button
                {...fadeUp(0.1)}
                onClick={() => navigate('/admin/add-product')}
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105"
                style={{ background: 'var(--gold)', color: 'var(--navy)', boxShadow: '0 6px 20px rgba(245,166,35,0.45)', border: 'none', cursor: 'pointer' }}
              >
                <FiPlus size={16} /> Add Product
              </motion.button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {hasPermission('products') && (
            <StatCard title="Products" value={stats.totalProducts} icon={FiBox} delay={0}
              gradient="linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)" iconBg="rgba(255,255,255,0.20)" />
          )}
          {hasPermission('orders') && <>
            <StatCard title="Total Orders" value={stats.totalOrders} icon={FiShoppingBag} delay={0.06}
              gradient="linear-gradient(135deg, #38A169 0%, #68D391 100%)" iconBg="rgba(255,255,255,0.20)" />
            <StatCard title="Pending Orders" value={stats.pendingOrders} icon={FiAlertCircle} delay={0.12}
              gradient="linear-gradient(135deg, #F5A623 0%, #FBBF4A 100%)" iconBg="rgba(255,255,255,0.20)" textColor="#1B2F6E" />
          </>}
          {hasPermission('coupons') && (
            <StatCard title="Active Coupons" value={stats.activeCoupons} icon={FiTag} delay={0.18}
              gradient="linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)" iconBg="rgba(255,255,255,0.20)" />
          )}
          {hasPermission('users') && <>
            <StatCard title="Total Users" value={stats.totalUsers} icon={FiUsers} delay={0.24}
              gradient="linear-gradient(135deg, #1B2F6E 0%, #2D4499 100%)" iconBg="rgba(255,255,255,0.20)" />
            <StatCard title="Blocked Users" value={stats.blockedUsers} icon={FiAlertCircle} delay={0.30}
              gradient="linear-gradient(135deg, #E53E3E 0%, #FC8181 100%)" iconBg="rgba(255,255,255,0.20)" />
          </>}
        </div>

        {/* ── Quick Actions ── */}
        <div className="grid md:grid-cols-2 gap-6">
          <SectionCard title="Management" icon={FiSettings} delay={0.15}>
            {hasPermission('products')   && <QuickCard title="Manage Products"   desc="Add, edit, or remove products"         icon={FiPackage}    to="/admin/products"      delay={0.20} />}
            {hasPermission('products')   && <QuickCard title="Inventory"         desc="Manage stock and low inventory"        icon={FiBox}        to="/admin/inventory"     delay={0.20} />}
            {hasPermission('products')   && <QuickCard title="Media Library"     desc="View and bulk upload images"           icon={FiImage}      to="/admin/media"         delay={0.21} />}
            {hasPermission('products')   && <QuickCard title="Product Reviews"   desc="Hide or delete customer reviews"       icon={FiStar}       to="/admin/reviews"       delay={0.22} />}
            {hasPermission('orders')     && <QuickCard title="Manage Orders"     desc="View and update order status"          icon={FiShoppingBag}to="/admin/orders"        delay={0.25} />}
            {hasPermission('orders')     && <QuickCard title="Manage Returns"    desc="Approve or reject returns"             icon={FiRefreshCw}  to="/admin/returns"       delay={0.26} />}
            {hasPermission('products')   && <QuickCard title="Subscriptions"     desc="Manage auto-renewing orders"           icon={FiRefreshCw}  to="/admin/subscriptions" delay={0.28} />}
            {hasPermission('users')      && <QuickCard title="Manage Users"      desc="View users, block/unblock accounts"    icon={FiUsers}      to="/admin/users"         delay={0.30} />}
            {hasPermission('users')      && <QuickCard title="User Activity"     desc="Track logins and page visits"          icon={FiActivity}   to="/admin/user-activity" delay={0.31} />}
            {isSuperAdmin                && <QuickCard title="Newsletters"       desc="Manage subscribers and emails"         icon={FiMail}       to="/admin/newsletters"   delay={0.32} />}
            {isSuperAdmin                && <QuickCard title="Manage Blogs"      desc="Publish and edit blog posts"           icon={FiEdit2}      to="/admin/blogs"         delay={0.33} />}
            {hasPermission('coupons')    && <QuickCard title="Manage Coupons"    desc="Create and manage discount codes"      icon={FiTag}        to="/admin/coupons"       delay={0.35} />}
            {hasPermission('categories') && <QuickCard title="Manage Categories" desc="Organize product categories"          icon={FiBox}        to="/admin/categories"    delay={0.40} />}
          </SectionCard>

          <SectionCard title="Analytics & Tools" icon={FiBarChart2} delay={0.20}>
            <QuickCard title="Analytics"         desc="Sales reports and insights"           icon={FiBarChart2}  to="/admin/analytics"      accent delay={0.25} />
            <QuickCard title="Support Tickets"   desc="Customer support messages"            icon={FiActivity}   to="/support-panel"                   delay={0.30} />
            {hasPermission('orders') && <QuickCard title="B2B Inquiries" desc="Manage bulk wholesale orders" icon={FiShoppingBag} to="/admin/b2b" delay={0.32} />}
            {isSuperAdmin && <>
              <QuickCard title="Platform Settings" desc="GST rate and shipping config"        icon={FiSettings}   to="/admin/settings"                  delay={0.35} />
              <QuickCard title="Admin Management" desc="Manage admin accounts"              icon={FiShield}     to="/admin/manage-admins"  accent delay={0.40} />
              <QuickCard title="Support Agents"   desc="Manage support team"                icon={FiUsers}      to="/admin/support-agents" accent delay={0.42} />
              <QuickCard title="Audit Logs"       desc="System activity and security logs"  icon={FiTrendingUp} to="/admin/audit-logs"               delay={0.45} />
            </>}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard