import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HelmetProvider } from 'react-helmet-async'
import Navbar from './components/Navbar'
import Breadcrumb from './components/Breadcrumb'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './context/AuthContext'
import PromoPopup from './components/PromoPopup'
import { CartProvider } from './context/CartContext'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import WhatsAppButton from './components/WhatsAppButton'
import { useThemeStore } from './store/theme'
import NotificationDrawer from './components/NotificationDrawer'
import SupportWidget from './components/SupportWidget'
import api from './api/axios'
import { ConfirmProvider } from './context/ConfirmContext'


// ─── Lazy Imports ─────────────────────────────────────────────────────────────
const Home            = lazy(() => import('./pages/Home'))
const Products        = lazy(() => import('./pages/Products'))
const SearchResults   = lazy(() => import('./pages/SearchResults'))
const ProductDetail   = lazy(() => import('./pages/ProductDetail'))
const Cart            = lazy(() => import('./pages/Cart'))
const TrackOrder      = lazy(() => import('./pages/TrackOrder')) // ✅ P1: Track Order page
const Category        = lazy(() => import('./pages/Category'))   // ✅ P1: Category Landing page

const ChangePassword  = lazy(() => import('./pages/ChangePassword')) // ✅ P1: Change Password page
const Login           = lazy(() => import('./pages/Login'))
const Register        = lazy(() => import('./pages/Register'))
const ForgotPassword  = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword   = lazy(() => import('./pages/ResetPassword'))
const Contact         = lazy(() => import('./pages/Contact'))
const Profile         = lazy(() => import('./pages/Profile'))
const Addresses       = lazy(() => import('./pages/Addresses')) // ✅ P1: Address Book page
const Orders          = lazy(() => import('./pages/Orders'))
const Checkout        = lazy(() => import('./pages/Checkout'))
const Support         = lazy(() => import('./pages/Support'))
const OrderDetail     = lazy(() => import('./pages/OrderDetail'))
const ReturnRequest   = lazy(() => import('./pages/ReturnRequest')) // ✅ P1: Return Request page
const Wishlist        = lazy(() => import('./pages/Wishlist'))  // ✅ P1: Wishlist page
const NotFound        = lazy(() => import('./pages/NotFound'))
const ComingSoon = lazy(() => import('./pages/ComingSoon'))
const Maintenance = lazy(() => import('./pages/Maintenance'))

// Static Pages
const AboutUs         = lazy(() => import('./pages/AboutUs'))
const PrivacyPolicy   = lazy(() => import('./pages/PrivacyPolicy'))
const Terms           = lazy(() => import('./pages/Terms'))
const RefundPolicy    = lazy(() => import('./pages/RefundPolicy'))
const ShippingPolicy  = lazy(() => import('./pages/ShippingPolicy'))
const FAQ             = lazy(() => import('./pages/FAQ'))
const Disclaimer      = lazy(() => import('./pages/Disclaimer'))
const HowItWorks      = lazy(() => import('./pages/HowItWorks'))

const CheckoutSubscription = lazy(() => import('./pages/CheckoutSubscription'))

// Support Admin pages
const SupportDashboard = lazy(() => import('./pages/Admin/SupportDashboard.jsx'))

// Courier pages
const ScanOrder = lazy(() => import('./pages/Courier/ScanOrder.jsx'))

// Admin pages
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard.jsx'))
const AdminReturns = lazy(() => import('./pages/Admin/AdminReturns.jsx')) // ✅ P1: Admin Returns page
const AdminInventory = lazy(() => import('./pages/Admin/AdminInventory.jsx')) // ✅ P1: Admin Inventory page
const AdminUserActivity = lazy(() => import('./pages/Admin/AdminUserActivity.jsx')) // ✅ P1: Admin User Activity
const AddProduct = lazy(() => import('./pages/Admin/AddProduct.jsx'))
const ManageOrders = lazy(() => import('./pages/Admin/ManageOrders.jsx'))
const AdminReviews = lazy(() => import('./pages/Admin/AdminReviews.jsx'))
const AdminSupport = lazy(() => import('./pages/Admin/AdminSupport.jsx'))
const AdminCoupons = lazy(() => import('./pages/Admin/AdminCoupons.jsx'))
const AdminUsers = lazy(() => import('./pages/Admin/AdminUsers.jsx'))
const AdminCategories = lazy(() => import('./pages/Admin/AdminCategories.jsx'))
const AdminProducts = lazy(() => import('./pages/Admin/AdminProducts.jsx'))
const AdminManagement = lazy(() => import('./pages/Admin/AdminManagement.jsx'))
const AuditLogs = lazy(() => import('./pages/Admin/AuditLogs.jsx'))
const AdminAnalytics = lazy(() => import('./pages/Admin/AdminAnalytics.jsx'))
const AdminProductImages = lazy(() => import('./pages/Admin/AdminProductImages.jsx'))
const AdminMedia = lazy(() => import('./pages/Admin/AdminMedia.jsx'))
const AdminSettings = lazy(() => import('./pages/Admin/AdminSettings.jsx'))
const AdminNewsletters = lazy(() => import('./pages/Admin/AdminNewsletters.jsx'))
const AdminSubscriptions = lazy(() => import('./pages/Admin/AdminSubscriptions.jsx'))
const AdminSupportAgents = lazy(() => import('./pages/Admin/AdminSupportAgents.jsx'))

// ─── Guest-Only Route ─────────────────────────────────────────────────────────
function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />

  if (user) {
    const isAdmin = user.role === 'admin' || user.role === 'superadmin'
    const isSupport = user.role === 'support'
    // Respect the intended destination set by navigate('/login', { state: { from } })
    const destination = location.state?.from || (isAdmin ? '/admin' : isSupport ? '/support-panel' : '/')
    return <Navigate to={destination} replace />
  }
  return children
}

// ─── Scroll to top on route change ───────────────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    
    if (!pathname.startsWith('/admin')) {
      api.post('/api/activity/track', { action: 'PAGE_VISIT', details: { path: pathname } })
         .catch(e => console.error('Failed to track activity', e))
    }
  }, [pathname])
  return null
}

// ─── Site Status Interceptor ──────────────────────────────────────────────────
function SiteStatusWrapper({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    api.get('/api/settings')
      .then(res => setSettings(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading || authLoading) return <PageLoader />

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  if (!isAdmin && settings) {
    if (settings.isMaintenanceMode || settings.isComingSoon) {
      let isLaunchPast = false;
      if (settings.isComingSoon) {
        isLaunchPast = settings.comingSoonLaunchDate && new Date(settings.comingSoonLaunchDate).getTime() < Date.now();
      }

      // If active mode is on, lock down the site
      if (settings.isMaintenanceMode || (settings.isComingSoon && !isLaunchPast)) {
        
        // If the user tries to access /login, /products, etc., automatically redirect them to the root URL (/)
        if (location.pathname !== '/') {
          return <Navigate to="/" replace />;
        }

        if (settings.isMaintenanceMode) {
          return (
            <Suspense fallback={<PageLoader />}>
              <Maintenance />
            </Suspense>
          );
        } else {
          return (
            <Suspense fallback={<PageLoader />}>
              <ComingSoon launchDate={settings.comingSoonLaunchDate} />
            </Suspense>
          );
        }
      }
    }
  }

  return children
}

// ─── Page loading spinner ─────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
      style={{ background: 'var(--bg-base)' }}>
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full" style={{ border: '2px solid var(--border-color)' }} />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--brand-primary)] animate-spin" />
      </div>
      <p className="text-[12px] font-medium tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Loading…</p>
    </div>
  )
}

// ─── Animated page transitions ────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className="flex-1"
      >
        <Suspense fallback={<PageLoader />}>
          <Routes location={location} key={location.pathname}>

            {/* ── Public ── */}
            <Route path="/"                       element={<Home />} />
            <Route path="/products"               element={<Products />} />
            <Route path="/category/:slug"         element={<Category />} /> {/* ✅ P1 */}

            <Route path="/search"                 element={<SearchResults />} />
            <Route path="/products/:id"           element={<ProductDetail />} />
            <Route path="/cart"                   element={<Cart />} />
            <Route path="/track-order"            element={<TrackOrder />} /> {/* ✅ P1 */}
            <Route path="/checkout-subscription"  element={<ProtectedRoute><CheckoutSubscription /></ProtectedRoute>} />
            <Route path="/contact"                element={<Contact />} />

            {/* ── Static ── */}
            <Route path="/about"                  element={<AboutUs />} />
            <Route path="/privacy-policy"         element={<PrivacyPolicy />} />
            <Route path="/terms"                  element={<Terms />} />
            <Route path="/refund-policy"          element={<RefundPolicy />} />
            <Route path="/shipping-policy"        element={<ShippingPolicy />} />
            <Route path="/faq"                    element={<FAQ />} />
            <Route path="/disclaimer"             element={<Disclaimer />} />
            <Route path="/how-it-works"           element={<HowItWorks />} />

            {/* ── Guest-Only ── */}
            <Route path="/login"                  element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register"               element={<GuestRoute><Register /></GuestRoute>} />
            <Route path="/forgot-password"        element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/reset-password/:token"  element={<GuestRoute><ResetPassword /></GuestRoute>} />

            {/* ── Protected User ── */}
            <Route path="/profile"  element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/addresses" element={<ProtectedRoute><Addresses /></ProtectedRoute>} /> {/* ✅ P1 */}
            <Route path="/orders"   element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
            <Route path="/orders/:id/return" element={<ProtectedRoute><ReturnRequest /></ProtectedRoute>} /> {/* ✅ P1 */}
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} /> {/* ✅ P1 */}
            <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} /> {/* ✅ P1 */}
            <Route path="/support"  element={<ProtectedRoute><Support /></ProtectedRoute>} />

            {/* ── Admin ── */}
            <Route path="/admin"                  element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/add-product"      element={<ProtectedRoute adminOnly><AddProduct /></ProtectedRoute>} />
            <Route path="/admin/products"         element={<ProtectedRoute adminOnly><AdminProducts /></ProtectedRoute>} />
            <Route path="/admin/categories"       element={<ProtectedRoute adminOnly><AdminCategories /></ProtectedRoute>} />
            <Route path="/products/edit/:id"      element={<ProtectedRoute adminOnly><AddProduct /></ProtectedRoute>} />
            <Route path="/admin/inventory"        element={<ProtectedRoute adminOnly><AdminInventory /></ProtectedRoute>} /> {/* ✅ P1 */}
            <Route path="/admin/orders"           element={<ProtectedRoute adminOnly><ManageOrders /></ProtectedRoute>} />
            <Route path="/admin/returns"          element={<ProtectedRoute adminOnly><AdminReturns /></ProtectedRoute>} /> {/* ✅ P1 */}
            <Route path="/admin/support"          element={<ProtectedRoute adminOnly><AdminSupport /></ProtectedRoute>} />
            <Route path="/admin/newsletters"      element={<ProtectedRoute adminOnly><AdminNewsletters /></ProtectedRoute>} />
            <Route path="/admin/subscriptions"    element={<ProtectedRoute adminOnly><AdminSubscriptions /></ProtectedRoute>} />
            <Route path="/admin/coupons"          element={<ProtectedRoute adminOnly><AdminCoupons /></ProtectedRoute>} />
            <Route path="/admin/users"            element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/user-activity"    element={<ProtectedRoute adminOnly><AdminUserActivity /></ProtectedRoute>} /> {/* ✅ P1 */}
            <Route path="/admin/analytics"        element={<ProtectedRoute adminOnly><AdminAnalytics /></ProtectedRoute>} />
            <Route path="/admin/settings"          element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />
            <Route path="/admin/media"             element={<ProtectedRoute adminOnly><AdminMedia /></ProtectedRoute>} />
            <Route path="/admin/products/:id/images" element={<ProtectedRoute adminOnly><AdminProductImages /></ProtectedRoute>} />
            <Route path="/admin/reviews"          element={<ProtectedRoute adminOnly><AdminReviews /></ProtectedRoute>} />

            {/* ── Support ── */}
            <Route path="/support-panel"          element={<ProtectedRoute supportAccess><SupportDashboard /></ProtectedRoute>} />

            {/* ── Courier ── */}
            <Route path="/courier/scan"           element={<ProtectedRoute><ScanOrder /></ProtectedRoute>} />

            {/* ── Superadmin ── */}
            <Route path="/admin/manage-admins"    element={<ProtectedRoute adminOnly permission="superadmin_view"><AdminManagement /></ProtectedRoute>} />
            <Route path="/admin/support-agents"   element={<ProtectedRoute adminOnly permission="superadmin_view"><AdminSupportAgents /></ProtectedRoute>} />
            <Route path="/admin/audit-logs"       element={<ProtectedRoute adminOnly permission="superadmin_view"><AuditLogs /></ProtectedRoute>} />

            {/* ── 404 ── */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </Suspense>
      </motion.main>
    </AnimatePresence>
  )
}


// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const { initTheme } = useThemeStore()

  // Sync theme class with stored state on mount
  useEffect(() => { initTheme() }, [])

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <ConfirmProvider>
          <AuthProvider>
            <CartProvider>
              <Router>
                <div className="flex flex-col min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
                  <ToastContainer
                    position="bottom-center"
                    autoClose={4000}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    pauseOnHover
                    draggable
                    theme="light"
                    limit={3}
                    toastStyle={{
                      borderRadius: '12px',
                      fontSize: '13.5px',
                      fontWeight: 500,
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <SiteStatusWrapper>
                    <PromoPopup />
                    <ScrollToTop />
                    <Navbar />
                    <Breadcrumb />
                    <AnimatedRoutes />
                    <Footer />
                    <WhatsAppButton />
                    <NotificationDrawer />
                    <SupportWidget />
                  </SiteStatusWrapper>
                </div>
              </Router>
            </CartProvider>
          </AuthProvider>
        </ConfirmProvider>
      </HelmetProvider>
    </ErrorBoundary>
  )
}

export default App
// force ts update