import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, ArrowLeft, Home } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Helmet } from 'react-helmet-async'

// Route map: path → breadcrumb label
const ROUTE_MAP = {
  '/products':       { label: 'Products',        parent: '/' },
  '/cart':           { label: 'Cart',             parent: '/' },
  '/checkout':       { label: 'Checkout',         parent: '/cart' },
  '/orders':         { label: 'My Orders',        parent: '/' },
  '/profile':        { label: 'My Profile',       parent: '/' },
  '/support':        { label: 'Help Center',      parent: '/' },
  '/contact':        { label: 'Contact Us',       parent: '/' },
  '/about':          { label: 'About Us',         parent: '/' },
  '/faq':            { label: 'FAQ',              parent: '/' },
  '/privacy-policy': { label: 'Privacy Policy',  parent: '/' },
  '/terms':          { label: 'Terms & Conditions', parent: '/' },
  '/refund-policy':  { label: 'Refund Policy',   parent: '/' },
  '/shipping-policy':{ label: 'Shipping Policy', parent: '/' },
  // Admin pages
  '/admin':               { label: 'Dashboard',      parent: null, admin: true },
  '/admin/products':      { label: 'Products',        parent: '/admin', admin: true },
  '/admin/add-product':   { label: 'Add Product',     parent: '/admin/products', admin: true },
  '/admin/orders':        { label: 'Orders',          parent: '/admin', admin: true },
  '/admin/support':       { label: 'Support Tickets', parent: '/admin', admin: true },
  '/admin/users':         { label: 'Users',           parent: '/admin', admin: true },
  '/admin/coupons':       { label: 'Coupons',         parent: '/admin', admin: true },
  '/admin/analytics':     { label: 'Analytics',       parent: '/admin', admin: true },
  '/admin/categories':    { label: 'Categories',      parent: '/admin', admin: true },
  '/admin/manage-admins': { label: 'Manage Admins',   parent: '/admin', admin: true },
  '/admin/audit-logs':    { label: 'Audit Logs',      parent: '/admin', admin: true },
  '/admin/settings':      { label: 'Settings',        parent: '/admin', admin: true },
}

const HIDDEN_ON = ['/', '/login', '/register', '/forgot-password']

function buildCrumbs(pathname) {
  const crumbs = []
  let current = pathname

  const isProductDetail = /^\/products\/[^/]+$/.test(current)
  const isEditProduct   = /^\/products\/edit\/[^/]+$/.test(current)

  if (isProductDetail) {
    const pageTitle   = document.title?.split(' – ')?.[0] || document.title?.split(' | ')?.[0] || 'Product Details'
    const productName = pageTitle !== 'Daatasa' ? pageTitle : 'Product Details'
    crumbs.unshift({ path: current, label: productName })
    crumbs.unshift({ path: '/products', label: 'Products' })
    crumbs.unshift({ path: '/', label: 'Home' })
    return crumbs
  }
  if (isEditProduct) {
    crumbs.unshift({ path: current, label: 'Edit Product' })
    crumbs.unshift({ path: '/admin/products', label: 'Products' })
    crumbs.unshift({ path: '/admin', label: 'Dashboard' })
    return crumbs
  }

  const visited = new Set()
  while (current && !visited.has(current)) {
    visited.add(current)
    const config = ROUTE_MAP[current]
    if (!config) break
    crumbs.unshift({ path: current, label: config.label })
    current = config.parent
  }

  const homeLabel = crumbs[0]?.path?.startsWith('/admin') ? 'Admin' : 'Home'
  const homePath  = crumbs[0]?.path?.startsWith('/admin') ? '/admin' : '/'

  if (crumbs.length > 0 && crumbs[0].path !== homePath) {
    crumbs.unshift({ path: homePath, label: homeLabel })
  }

  return crumbs
}

export default function Breadcrumb() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const pathname = location.pathname

  const [titleToken, setTitleToken] = React.useState(0);
  
  React.useEffect(() => {
    const observer = new MutationObserver(() => setTitleToken(t => t + 1));
    const titleNode = document.querySelector('title');
    if (titleNode) {
      observer.observe(titleNode, { childList: true, characterData: true, subtree: true });
    }
    return () => observer.disconnect();
  }, []);

  if (HIDDEN_ON.includes(pathname)) return null
  if (pathname.startsWith('/reset-password')) return null

  // buildCrumbs reads document.title internally, the titleToken ensures re-evaluation when title changes
  const crumbs = buildCrumbs(pathname)
  if (crumbs.length < 2) return null

  const isAdmin = pathname.startsWith('/admin')

  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": crumb.label,
      "item": `${window.location.origin}${crumb.path}`
    }))
  }

  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(schemaMarkup)}
        </script>
      </Helmet>
      <div
        className="sticky top-[60px] z-40"
      style={{
        background: 'var(--bg-surface)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div className={`${isAdmin ? 'max-w-full px-4 sm:px-6' : 'max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8'} py-2`}>
        <div className="flex items-center gap-2.5">

          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <ArrowLeft size={13} />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Divider */}
          <div className="w-px h-4" style={{ background: 'var(--border-color)' }} />

          {/* Breadcrumb trail */}
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1
              const isHome = i === 0
              return (
                <div key={crumb.path} className="flex items-center gap-1 shrink-0">
                  {i > 0 && (
                    <ChevronRight size={11} style={{ color: 'var(--border-color)' }} />
                  )}
                  {isLast ? (
                    <span className="text-xs font-semibold truncate max-w-[160px]"
                      style={{ color: 'var(--text-primary)' }}>
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.path}
                      className="text-xs font-medium transition-colors flex items-center gap-1"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--brand-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      {isHome && !isAdmin && <Home size={11} />}
                      {crumb.label}
                    </Link>
                  )}
                </div>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
    </>
  )
}
