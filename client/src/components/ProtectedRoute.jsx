import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

// ── Branded page loader used during auth resolution ──
const AuthLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: 'var(--bg-base)' }}>
    <div className="relative w-11 h-11">
      <div className="absolute inset-0 border-2 border-slate-200 rounded-full" />
      <div className="absolute inset-0 border-2 border-transparent border-t-orange-500 rounded-full animate-spin" />
      <div className="absolute inset-2 bg-orange-500/10 rounded-full" />
    </div>
    <p className="text-xs text-slate-400 font-semibold tracking-widest uppercase">Loading…</p>
  </div>
)

const ProtectedRoute = ({ children, adminOnly = false, permission = null, supportAccess = false }) => {
  const { user, loading, hasPermission } = useAuth()

  // ✅ FIX C3: Always show loader while auth is resolving — never render children prematurely
  if (loading) return <AuthLoader />

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Admin, Super Admin, and Support Agents can access admin routes
  if (adminOnly && !['admin', 'superadmin', 'support'].includes(user.role)) {
    return <Navigate to="/" replace />
  }

  // Support Panel Access
  if (supportAccess && !['admin', 'superadmin', 'support'].includes(user.role)) {
    return <Navigate to="/" replace />
  }

  // Fine-grained permission check for specific pages
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/admin" replace />
  }

  return children
}

export default ProtectedRoute