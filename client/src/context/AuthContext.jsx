// frontend/src/context/AuthContext.jsx
// ✅ Access token and refresh token stored in localStorage
// ✅ On app init: restores session using stored tokens
// ✅ Listens to auth:forced_logout event from Axios interceptor

import { createContext, useState, useEffect, useContext, useCallback } from 'react'
import { toast } from 'react-toastify'
import api, { setAccessToken, getAccessToken, refreshAuthToken, setRefreshToken, getRefreshToken } from '../api/axios'
import i18n from '../i18n'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Sync language preference ────────────────────────────────
  useEffect(() => {
    if (user?.language && i18n.language !== user.language) {
      i18n.changeLanguage(user.language)
    }
  }, [user?.language])

  // ── On mount: restore session from stored tokens ──────────
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (getAccessToken()) {
          const res = await api.get('/api/auth/me')
          setUser(res.data)
        } else if (getRefreshToken()) {
          const res = await refreshAuthToken()
          setAccessToken(res.data.token)
          if (res.data.refreshToken) setRefreshToken(res.data.refreshToken)
          setUser(res.data.user)
        }
      } catch {
        setAccessToken(null)
        setRefreshToken(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  // ── Listen for forced logout (when refresh token expires or multi-login kicked out) ───
  useEffect(() => {
    const handleForcedLogout = (e) => {
      setUser(null)
      setAccessToken(null)
      setRefreshToken(null)
      const reason = e?.detail?.reason
      if (reason) {
        toast.warn(reason, { toastId: 'force-logout-warn', autoClose: 6000 })
      }
    }
    window.addEventListener('auth:forced_logout', handleForcedLogout)
    return () => window.removeEventListener('auth:forced_logout', handleForcedLogout)
  }, [])

  // ── After login/register: merge any pending guest cart item ───────────────
  const flushPendingCartItem = async () => {
    const pending = sessionStorage.getItem('pendingCartItem')
    if (!pending) return
    try {
      const { productId, quantity } = JSON.parse(pending)
      await api.post('/api/cart/items', { productId, quantity })
    } catch { /* non-fatal */ }
    finally { sessionStorage.removeItem('pendingCartItem') }
  }

  const login = async (emailOrPhone, password) => {
    const res = await api.post('/api/auth/login', { emailOrPhone, password })
    setAccessToken(res.data.token)
    if (res.data.refreshToken) setRefreshToken(res.data.refreshToken)
    setUser(res.data.user)
    await flushPendingCartItem()
    return res.data
  }

  const loginOtp = async (phone, otpCode) => {
    const res = await api.post('/api/auth/login-otp', { phone, otpCode })
    setAccessToken(res.data.token)
    if (res.data.refreshToken) setRefreshToken(res.data.refreshToken)
    setUser(res.data.user)
    await flushPendingCartItem()
    return res.data
  }

  const register = async (name, email, password, referralCode) => {
    const res = await api.post('/api/auth/register', { name, email, password, referralCode })
    setAccessToken(res.data.token)
    if (res.data.refreshToken) setRefreshToken(res.data.refreshToken)
    setUser(res.data.user)
    await flushPendingCartItem()
    return res.data
  }

  const googleLogin = async (token) => {
    setAccessToken(token)
    try {
      const res = await api.get('/api/auth/me')
      setUser(res.data)
      await flushPendingCartItem()
      return res.data
    } catch {
      setAccessToken(null)
      throw new Error('Google login failed')
    }
  }

  const logout = async () => {
    try {
      // Pass refreshToken so backend can remove the specific session
      await api.post('/api/auth/logout', { refreshToken: getRefreshToken() })
    } catch {
      // Non-fatal — clear client state regardless
    } finally {
      setAccessToken(null)
      setRefreshToken(null)
      setUser(null)
    }
  }

  const logoutAll = async () => {
    try {
      await api.post('/api/auth/logout-all')
    } catch { /* non-fatal */ }
    finally {
      setAccessToken(null)
      setRefreshToken(null)
      setUser(null)
    }
  }

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/me')
      setUser(res.data)
      return res.data
    } catch (error) {
      throw error
    }
  }, [])

  const hasPermission = (permission) => {
    if (!user) return false
    // All permissions enabled by default for superadmin, admin, and support staff
    if (['superadmin', 'admin', 'support'].includes(user.role)) return true
    return user.permissions?.includes(permission) || user.permissions?.includes('all') || false
  }

  const toggleWishlist = async (productId) => {
    if (!user) return false
    try {
      const res = await api.post('/api/auth/wishlist', { productId })
      setUser(prev => ({ ...prev, wishlist: res.data.wishlist }))
      return res.data.added
    } catch (error) {
      console.error('Wishlist toggle error', error)
      throw error
    }
  }

  const updateUser = (updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      loginOtp,
      register,
      googleLogin,
      logout,
      logoutAll,
      fetchUser,
      hasPermission,
      toggleWishlist,
      updateUser,
      isAuthenticated: !!user,
      isAdmin: ['admin', 'superadmin', 'support'].includes(user?.role),
      isSupport: ['admin', 'superadmin', 'support'].includes(user?.role),
    }}>
      {children}
    </AuthContext.Provider>
  )
}