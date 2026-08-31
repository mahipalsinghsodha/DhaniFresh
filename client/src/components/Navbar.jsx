// components/Navbar.jsx — Premium Frosted Glass Theme
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { useCart } from '../context/CartContext'
import { AnimatePresence, motion } from 'framer-motion'

import { useNotificationStore } from '../store/notifications'
import api from '../api/axios'
import {
  ShoppingCart, User, LogOut, Menu, X, Package,
  Heart, Bell, ChevronDown, Shield, Search, Sparkles, Loader2, HelpCircle, Globe, Briefcase, MessageSquare
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSupportStore } from '../store/support'

const Navbar = () => {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { cartCount } = useCart()
  const { unreadCount, toggleDrawer, setNotifications } = useNotificationStore()
  const openSupport = useSupportStore(state => state.openSupport)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { t, i18n } = useTranslation()
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const langMenuRef = useRef(null)
  const [suggestions, setSuggestions] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const userMenuRef = useRef(null)
  const searchRef = useRef(null)
  const debounceTimeout = useRef(null)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.get('/api/categories')
        setCategories(res.data)
      } catch (err) {}
    }
    fetchCats()
  }, [])

  useEffect(() => {
    if (user) {
      api.get('/api/notifications')
        .then(res => {
          if (res.data && res.data.notifications) {
            setNotifications(res.data.notifications);
          }
        })
        .catch(err => console.error('Failed to load notifications', err));
    } else {
      setNotifications([]);
    }
  }, [user, setNotifications])

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setIsSearching(true)
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
      debounceTimeout.current = setTimeout(async () => {
        try {
          const res = await api.get(`/api/search/suggestions?q=${encodeURIComponent(searchQuery.trim())}`)
          setSuggestions(res.data.suggestions || [])
        } catch (error) {
          console.error('Failed to fetch search suggestions', error)
        } finally {
          setIsSearching(false)
        }
      }, 300)
    } else {
      setSuggestions([])
    }
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current) }
  }, [searchQuery])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false); setUserMenuOpen(false); setSearchOpen(false) }, [location.pathname])

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false)
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) setLangMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { if (searchOpen) searchRef.current?.focus() }, [searchOpen])

  const handleLogout = () => { logout(); navigate('/') }
  const isActive = (path) => location.pathname === path
  const isCustomer = !user || (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'support')
  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin')
  const isSupport = user && user.role === 'support'

  const handleLanguageChange = async (lang) => {
    i18n.changeLanguage(lang)
    setLangMenuOpen(false)
    if (user) {
      try {
        await api.put('/api/auth/profile', { language: lang })
      } catch (err) {
        console.error('Failed to update language', err)
      }
    }
  }

  const navLinkCls = (path) => `
    relative px-3.5 py-1.5 text-[13.5px] font-semibold rounded-lg transition-all duration-200 group
    ${isActive(path) ? 'text-[var(--gold)]' : 'text-white/75 hover:text-white'}
  `

  const mobileLinkCls = (path) => `
    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
    ${isActive(path)
      ? 'text-[var(--gold)]'
      : 'text-white/70 hover:text-white'
    }
  `

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-400`}
      style={{
        background: scrolled
          ? 'rgba(19, 43, 105, 0.85)'
          : 'var(--bg-navy)',
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.10)' : '1px solid transparent',
        boxShadow: scrolled ? '0 4px 30px rgba(27,47,110,0.40)' : 'none',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-2 sm:px-4 md:px-6">
        <div className="flex items-center justify-between h-[60px] sm:h-[68px]">

          {/* ── Logo ── */}
          <Link to={isAdmin ? '/admin' : isSupport ? '/support-panel' : '/'} className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 group bg-[#fffdf8] rounded-xl px-1 sm:px-1.5 py-1">
            <img 
              src="/logo_rectangle.png" 
              alt="Daatasa Logo" 
              className="h-[34px] sm:h-[48px] w-auto transition-transform duration-300 group-hover:scale-[1.02]" 
            />
            {(isAdmin || isSupport) && (
              <span className="hidden sm:inline-block ml-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-full"
                style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
                {user.role === 'superadmin' ? 'Super' : isSupport ? 'Support' : 'Admin'}
              </span>
            )}
          </Link>

          {/* ── Desktop Nav ── */}
          <nav className="hidden md:flex items-center gap-0.5">
            {isCustomer && (
              <>
                <Link to="/" className={navLinkCls('/')}>
                  {t('navbar.home', 'Home')}
                  {isActive('/') && <motion.span layoutId="navActive" className="absolute bottom-0 left-3.5 right-3.5 h-0.5 rounded-full" style={{ background: 'var(--gold)' }} />}
                </Link>

                <div className="relative group">
                  <button className="relative px-3.5 py-1.5 text-[13.5px] font-semibold rounded-lg transition-all duration-200 text-white/75 hover:text-white flex items-center gap-1">
                    {t('navbar.categories', 'Categories')} <ChevronDown size={14} className="opacity-70 group-hover:rotate-180 transition-transform" />
                  </button>
                  <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="bg-[#132b69] border border-white/10 rounded-xl shadow-2xl p-2 min-w-[200px] backdrop-blur-xl">
                      <Link to="/products" className="block px-4 py-2.5 text-[13px] font-semibold text-white/75 hover:text-white hover:bg-white/10 rounded-lg transition-colors border-b border-white/10 mb-1">
                        {t('navbar.allCategories', 'All Categories')}
                      </Link>
                      {categories.map(c => (
                        <Link key={c._id} to={`/products?category=${c.slug}`} className="block px-4 py-2.5 text-[13px] font-semibold text-white/75 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                          {t(`category.${c.slug}`, c.name)}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {[
                  { to: '/products', label: t('navbar.shop', 'Products') },
                  { to: '/about', label: t('navbar.about', 'About Us') },
                  { to: '/blogs', label: t('navbar.blogs', 'Blogs') },
                  ...(user ? [{ to: '#support', label: t('navbar.help', 'Help'), isSupport: true }] : []),
                  { to: '/contact', label: t('navbar.contact', 'Contact') },
                ].map(({ to, label, isSupport }) => (
                  isSupport ? (
                    <button
                      key="support-nav-btn"
                      onClick={() => openSupport()}
                      className={`${navLinkCls('/support')} cursor-pointer bg-transparent border-none`}
                    >
                      {label}
                    </button>
                  ) : (
                    <Link key={to} to={to} className={navLinkCls(to)}>
                      {label}
                      {isActive(to) && (
                        <motion.span
                          layoutId="navActive"
                          className="absolute bottom-0 left-3.5 right-3.5 h-0.5 rounded-full"
                          style={{ background: 'var(--gold)' }}
                        />
                      )}
                    </Link>
                  )
                ))}
              </>
            )}
            {isAdmin && (
              <>
                {[
                  { to: '/admin', label: t('navbar.dashboard', 'Dashboard') },
                  ...(hasPermission('products') ? [{ to: '/admin/products', label: t('navbar.products', 'Products') }] : []),
                  ...(hasPermission('products') ? [{ to: '/admin/reviews', label: t('navbar.reviews', 'Reviews') }] : []),
                  ...(hasPermission('products') ? [{ to: '/admin/subscriptions', label: t('navbar.subscriptions', 'Subscriptions') }] : []),
                  ...(hasPermission('orders') ? [{ to: '/admin/ordersAdmin', label: t('navbar.ordersAdmin', 'Orders') }] : []),
                  ...(hasPermission('users') ? [{ to: '/admin/users', label: t('navbar.users', 'Users') }] : []),
                  ...(user?.role === 'superadmin' ? [{ to: '/admin/newsletters', label: t('navbar.newsletters', 'Newsletters') }] : []),
                  { to: '/admin/blogs', label: t('navbar.manageBlogs', 'Blogs') },
                  { to: '/admin/analytics', label: t('navbar.analytics', 'Analytics') },
                ].map(({ to, label }) => (
                  <Link key={to} to={to} className={navLinkCls(to)}>
                    {label}
                    {isActive(to) && (
                      <motion.span
                        layoutId="navActiveAdmin"
                        className="absolute bottom-0 left-3.5 right-3.5 h-0.5 rounded-full"
                        style={{ background: 'var(--gold)' }}
                      />
                    )}
                  </Link>
                ))}
              </>
            )}
            {isSupport && (
              <>
                {[
                  { to: '/admin/support', label: 'Live Chat' },
                  { to: '/support-panel', label: 'Support Tickets' },
                ].map(({ to, label }) => (
                  <Link key={to} to={to} className={navLinkCls(to)}>
                    {label}
                    {isActive(to) && (
                      <motion.span
                        layoutId="navActiveSupport"
                        className="absolute bottom-0 left-3.5 right-3.5 h-0.5 rounded-full"
                        style={{ background: 'var(--gold)' }}
                      />
                    )}
                  </Link>
                ))}
              </>
            )}
          </nav>

          {/* ── Desktop Actions ── */}
          <div className="hidden md:flex items-center gap-1.5">

            {/* Search */}
            <button
              onClick={() => setSearchOpen(v => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all text-white/65 hover:text-white hover:bg-white/12"
              aria-label="Search" id="search-toggle"
            >
              <Search size={16} />
            </button>

            {/* Theme toggle */}


            {/* Language Switcher */}
            <button
              onClick={() => handleLanguageChange(i18n.language?.startsWith('hi') ? 'en' : 'hi')}
              className="flex items-center gap-1.5 px-3 py-1.5 h-9 rounded-full transition-all text-[13px] font-bold border border-white/20 text-white hover:bg-white/12"
              title={t('navbar.language', 'Language')}
            >
              <Globe size={14} />
              {i18n.language?.startsWith('hi') ? 'English' : 'हिंदी'}
            </button>

            {/* Cart (Rendered for all customers: guest or logged-in user) */}
            {isCustomer && (
              <Link
                to="/cart"
                className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all text-white/65 hover:text-white hover:bg-white/12"
                aria-label="Cart"
              >
                <ShoppingCart size={16} />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      key={cartCount}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: 'var(--gold)', color: 'var(--navy)' }}
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            )}

            {user && (
              <>
                {/* Notifications */}
                <button
                  onClick={toggleDrawer}
                  className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all text-white/65 hover:text-white hover:bg-white/12"
                  aria-label="Notifications" id="notifications-btn"
                >
                  <Bell size={16} />
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span
                        key={unreadCount}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                        style={{ background: 'var(--gold)', color: 'var(--navy)' }}
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full transition-all hover:bg-white/12"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold"
                      style={{ background: 'var(--gold)', color: 'var(--navy)' }}
                    >
                      {(user.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[13px] font-semibold text-white max-w-[72px] truncate hidden lg:block">
                      {(user.name || 'User').split(' ')[0]}
                    </span>
                    <ChevronDown size={13} className={`text-white/45 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute right-0 top-full mt-2 w-56 rounded-2xl overflow-hidden z-50"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          boxShadow: '0 20px 60px rgba(27,47,110,0.20), 0 4px 20px rgba(27,47,110,0.12)',
                        }}
                      >
                        <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-alt)' }}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold" style={{ background: 'var(--brand-gradient)', color: 'white' }}>
                              {(user.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{user.name || 'User'}</p>
                              <p className="text-[11px] truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-1.5 space-y-0.5">
                          {[
                            { to: '/profile', icon: User, label: t('navbar.profile', 'My Profile') },
                            ...(isCustomer ? [
                              { to: '/orders', icon: Package, label: t('navbar.orders', 'My Orders') },
                              { to: '/b2b', icon: Briefcase, label: t('navbar.bulkOrders', 'Bulk Orders') },
                              { to: '/wishlist', icon: Heart, label: t('navbar.wishlist', 'Wishlist') },
                              { to: '#support', icon: HelpCircle, label: t('navbar.helpCenter', 'Support Center'), isSupportAction: true },
                            ] : []),
                            ...(isAdmin ? [
                              { to: '/admin', icon: Shield, label: t('navbar.adminPanel', 'Admin Panel') },
                            ] : []),
                            ...(isSupport ? [
                              { to: '/admin/support', icon: MessageSquare, label: 'Live Chat Support' },
                              { to: '/support-panel', icon: Shield, label: 'Support Tickets' },
                            ] : []),
                          ].map(item => (
                            item.isSupportAction ? (
                              <button
                                key={item.label}
                                onClick={() => { setUserMenuOpen(false); openSupport(); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all text-left cursor-pointer border-none bg-transparent"
                                style={{ color: 'var(--text-secondary)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-alt)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                              >
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-alt)' }}>
                                  <item.icon size={13} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <span>{item.label}</span>
                              </button>
                            ) : (
                              <Link key={item.to} to={item.to}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all"
                                style={{ color: 'var(--text-secondary)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-alt)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                              >
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-alt)' }}>
                                  <item.icon size={13} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                {item.label}
                              </Link>
                            )
                          ))}
                        </div>
                        <div className="p-1.5" style={{ borderTop: '1px solid var(--border-color)' }}>
                          <button onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all"
                            style={{ color: 'var(--danger)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(229,62,62,0.07)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(229,62,62,0.08)' }}>
                              <LogOut size={13} />
                            </div>
                            {t('navbar.logout', 'Log out')}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            {!user && (
              <>
                <Link to="/login" className="text-[13.5px] font-semibold text-white/75 hover:text-white px-3.5 py-1.5 rounded-lg hover:bg-white/12 transition-all">
                  {t('navbar.login', 'Log in')}
                </Link>
                <Link to="/register"
                  className="text-[13.5px] font-bold px-5 py-2 rounded-lg transition-all hover:scale-105 flex items-center gap-1.5"
                  style={{ background: 'var(--gold)', color: 'var(--navy)', boxShadow: '0 4px 14px rgba(245,166,35,0.40)' }}
                >
                  <Sparkles size={13} />
                  {t('navbar.getStarted', 'Get Started')}
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile Right ── */}
          <div className="flex md:hidden items-center gap-0.5 sm:gap-1.5">
            <button
              onClick={() => handleLanguageChange(i18n.language?.startsWith('hi') ? 'en' : 'hi')}
              className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 h-8 rounded-full transition-all text-[11px] sm:text-[12px] font-bold border border-white/20 text-white hover:bg-white/12"
              title={t('navbar.language', 'Language')}
            >
              <Globe size={12} />
              {i18n.language?.startsWith('hi') ? 'EN' : 'हिंदी'}
            </button>

            {isCustomer && (
              <Link to="/cart" className="relative w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:bg-white/12 transition-all">
                <ShoppingCart size={17} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
                    {cartCount}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="w-8 sm:w-9 h-8 sm:h-9 rounded-full flex items-center justify-center text-white/80 hover:bg-white/12 transition-all"
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mobileOpen ? 'x' : 'm'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  {mobileOpen ? <X size={18} className="sm:w-5 sm:h-5" /> : <Menu size={18} className="sm:w-5 sm:h-5" />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {/* ── Search Expansion ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 56, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
            style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex items-center gap-3 h-full">
              <Search size={16} style={{ color: 'rgba(255,255,255,0.45)' }} className="shrink-0" />
              <input
                ref={searchRef}
                type="text"
                placeholder={t('navbar.search', 'Search products…')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
                    setSearchOpen(false); setSearchQuery('')
                  }
                  if (e.key === 'Escape') setSearchOpen(false)
                }}
                className="flex-1 bg-transparent border-0 text-[14px] font-semibold placeholder:font-normal focus:outline-none"
                style={{ color: '#FFFFFF', caretColor: 'var(--gold)' }}
                id="global-search"
                autoComplete="off"
              />
              <div className="flex items-center gap-2">
                {isSearching && <Loader2 size={14} className="animate-spin text-white/50" />}
                <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] rounded border text-white/35"
                  style={{ borderColor: 'rgba(255,255,255,0.18)' }}>ESC</kbd>
              </div>
            </div>
            
            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 max-w-[1280px] mx-auto px-4 sm:px-6 z-50">
                <div className="mt-2 rounded-2xl overflow-hidden shadow-2xl border"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
                >
                  {suggestions.map((item, index) => (
                    <Link
                      key={item.id}
                      to={`/product/${item.slug}`}
                      onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                      className="flex items-center gap-4 p-3 transition-colors hover:bg-white/5"
                      style={{ borderBottom: index < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                    >
                      <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-lg bg-black/20" />
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-white truncate">{item.name}</p>
                        <p className="text-[11px] text-white/50">{t(`category.${item.category}`, item.category)}</p>
                      </div>
                      <span className="text-[13px] font-bold text-[var(--gold)]">₹{item.price}</span>
                    </Link>
                  ))}
                  <Link
                    to={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                    onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                    className="block p-3 text-center text-[12px] font-bold text-white/70 hover:text-white transition-colors bg-white/5 hover:bg-white/10"
                  >
                    {t('navbar.seeAllResults', 'See all results for')} "{searchQuery}"
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile Menu ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-[68px] bg-black/50 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden absolute top-full left-0 right-0 z-50"
              style={{
                background: 'rgba(19, 43, 105, 0.97)',
                backdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 20px 50px rgba(27,47,110,0.55)',
              }}
            >
              <div className="px-3 sm:px-4 py-4 sm:py-5 space-y-1">
                {user && (
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-4"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-extrabold shadow-md"
                      style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
                      {(user.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-white">{user.name || 'User'}</p>
                      <p className="text-[11px] truncate max-w-[200px]" style={{ color: 'rgba(255,255,255,0.50)' }}>{user.email}</p>
                    </div>
                  </div>
                )}

                {isCustomer && (
                  <>
                    {[
                      { to: '/', label: t('navbar.home', 'Home') },
                      { to: '/products', label: t('navbar.shop', 'Products') },
                      { to: '/about', label: t('navbar.about', 'About Us') },
                      { to: '/blogs', label: t('navbar.blogs', 'Blogs') },
                      ...(user ? [{ to: '/support', label: t('navbar.help', 'Help') }] : []),
                      { to: '/contact', label: t('navbar.contact', 'Contact') },
                    ].map(({ to, label }, i) => (
                      <motion.div
                        key={to}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Link to={to} className={mobileLinkCls(to)}>
                          {isActive(to) && (
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--gold)' }} />
                          )}
                          {label}
                        </Link>
                      </motion.div>
                    ))}
                    {categories.length > 0 && (
                      <div className="pt-3 pb-1 px-4 mt-1 border-t border-white/10">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">{t('navbar.shopByCategory', 'Shop by Category')}</p>
                        <div className="flex flex-wrap gap-2">
                          <Link to="/products" onClick={() => setMobileOpen(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-brand-secondary bg-brand-secondary/15 hover:bg-brand-secondary hover:text-brand-primary transition-all border border-brand-secondary/30">
                            {t('navbar.allCategories', 'All Categories')}
                          </Link>
                          {categories.map(c => (
                            <Link key={c._id} to={`/products?category=${c.slug}`} onClick={() => setMobileOpen(false)} className="px-3 py-1.5 rounded-lg bg-white/5 text-[12px] font-semibold text-white/80 hover:bg-white/15 hover:text-white transition-all border border-white/10">
                              {t(`category.${c.slug}`, c.name)}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {isAdmin && (
                  <>
                    <Link to="/admin" className={mobileLinkCls('/admin')}>{t('navbar.dashboard', 'Dashboard')}</Link>
                    <Link to="/admin/products" className={mobileLinkCls('/admin/products')}>{t('navbar.products', 'Products')}</Link>
                    <Link to="/admin/reviews" className={mobileLinkCls('/admin/reviews')}>{t('navbar.reviews', 'Reviews')}</Link>
                    <Link to="/admin/orders" className={mobileLinkCls('/admin/orders')}>{t('navbar.ordersAdmin', 'Orders')}</Link>
                    <Link to="/admin/users" className={mobileLinkCls('/admin/users')}>{t('navbar.users', 'Users')}</Link>
                    <Link to="/admin/blogs" className={mobileLinkCls('/admin/blogs')}>{t('navbar.manageBlogs', 'Blogs')}</Link>
                    <Link to="/admin/analytics" className={mobileLinkCls('/admin/analytics')}>{t('navbar.analytics', 'Analytics')}</Link>
                  </>
                )}
                {isSupport && (
                  <>
                    <Link to="/admin/support" className={mobileLinkCls('/admin/support')}>Live Chat Support</Link>
                    <Link to="/support-panel" className={mobileLinkCls('/support-panel')}>Support Tickets</Link>
                  </>
                )}

                <div className="pt-4 mt-2 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                  {user ? (
                    <>
                      <Link to="/profile" className={mobileLinkCls('/profile')}><User size={16} className="shrink-0" />{t('navbar.profile', 'Profile')}</Link>
                      {isCustomer && (
                        <>
                          <Link to="/orders" className={mobileLinkCls('/orders')}><Package size={16} className="shrink-0" />{t('navbar.orders', 'My Orders')}</Link>
                          <Link to="/b2b" className={mobileLinkCls('/b2b')}><Briefcase size={16} className="shrink-0" />{t('navbar.bulkOrders', 'Bulk Orders')}</Link>
                          <Link to="/wishlist" className={mobileLinkCls('/wishlist')}><Heart size={16} className="shrink-0" />{t('navbar.wishlist', 'Wishlist')}</Link>
                          <button
                            onClick={() => { setMobileOpen(false); openSupport(); }}
                            className={`${mobileLinkCls('/support')} w-full text-left flex items-center gap-3 cursor-pointer bg-transparent border-none`}
                          >
                            <HelpCircle size={16} className="shrink-0" />
                            {t('navbar.help', 'Help')}
                          </button>
                        </>
                      )}
                      <button onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold rounded-xl transition-all"
                        style={{ color: '#FC8181' }}>
                        <LogOut size={16} className="shrink-0" /> {t('navbar.logout', 'Log out')}
                      </button>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link to="/login" className="flex items-center justify-center h-11 rounded-xl border border-white/20 text-white font-semibold text-[13.5px] hover:bg-white/10 transition-all">
                          {t('navbar.login', 'Log in')}
                      </Link>
                      <Link to="/register"
                        className="flex items-center justify-center h-11 rounded-xl font-bold text-[13.5px] transition-all hover:scale-[1.02] gap-1.5"
                        style={{ background: 'var(--gold)', color: 'var(--navy)', boxShadow: '0 4px 14px rgba(245,166,35,0.35)' }}>
                          <Sparkles size={13} /> {t('navbar.signup', 'Sign up')}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}

export default Navbar