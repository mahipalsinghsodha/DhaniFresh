// components/NotificationDrawer.jsx — Slide-in from right notification panel
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, Check, CheckCheck, Package, MessageSquare, Tag, Info, AlertCircle } from 'lucide-react'
import { useNotificationStore } from '../store/notifications'
import { useSupportStore } from '../store/support'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'

/* ── Notification Icon ──────────────────────────────────────── */
const NotifIcon = ({ type }) => {
  const map = {
    ORDER_CONFIRMED:  { icon: Package, color: 'rgba(245,197,24,0.12)', text: 'var(--brand-secondary)' },
    ORDER_SHIPPED:    { icon: Package, color: 'rgba(59,130,246,0.12)', text: '#3B82F6' },
    ORDER_DELIVERED:  { icon: Package, color: 'rgba(34,197,94,0.12)', text: 'var(--success)' },
    ORDER_CANCELLED:  { icon: AlertCircle, color: 'rgba(239,68,68,0.10)', text: 'var(--danger)' },
    REFUND_INITIATED: { icon: CheckCheck, color: 'rgba(34,197,94,0.12)', text: 'var(--success)' },
    OFFER:            { icon: Tag, color: 'rgba(245,197,24,0.12)', text: 'var(--brand-secondary)' },
    CHAT_REPLY:       { icon: MessageSquare, color: 'rgba(139,92,246,0.12)', text: '#8B5CF6' },
    SYSTEM:           { icon: Info, color: 'rgba(100,116,139,0.10)', text: 'var(--text-muted)' },
  }
  const cfg = map[type] || map.SYSTEM
  const Icon = cfg.icon
  return (
    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
      style={{ background: cfg.color }}>
      <Icon size={16} style={{ color: cfg.text }} />
    </div>
  )
}

/* ── Single Notification Item ───────────────────────────────── */
const NotifItem = ({ notif, onClick, onRemove }) => {
  let timeAgo = 'just now';
  if (notif.createdAt) {
    const d = new Date(notif.createdAt);
    if (!isNaN(d.valueOf())) {
      timeAgo = formatDistanceToNow(d, { addSuffix: true });
    }
  }

  return (
    <div
      className="group relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors"
      style={{
        background: 'rgba(245,197,24,0.04)',
        borderBottom: '1px solid var(--border-color)',
      }}
      onClick={() => onClick(notif)}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,197,24,0.08)' }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(245,197,24,0.04)'
      }}
    >
      <NotifIcon type={notif.type} />
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-[13px] font-medium text-[var(--text-primary)] leading-snug">{notif.title}</p>
        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-0.5">{notif.message}</p>
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">{timeAgo}</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(notif._id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-all absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        title="Dismiss notification"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
      {!notif.isRead && (
        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 group-hover:opacity-0 transition-opacity"
          style={{ background: 'var(--brand-primary)' }} />
      )}
    </div>
  )
}

/* ── Sample notifications for demo ──────────────────────────── */
const DEMO_NOTIFICATIONS = [
  {
    _id: '1', type: 'ORDER_DELIVERED', title: 'Order Delivered!',
    message: 'Your order #84021 has been delivered. Enjoy your pure Tharparkar ghee!',
    isRead: false, createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    _id: '2', type: 'ORDER_SHIPPED', title: 'Order Shipped',
    message: 'Order #84020 is on its way. Track via Delhivery.',
    isRead: false, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    _id: '3', type: 'OFFER', title: '🎉 15% Off This Weekend',
    message: 'Use code GHEE15 for 15% off on orders above ₹999.',
    isRead: true, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    _id: '4', type: 'REFUND_INITIATED', title: 'Refund Initiated',
    message: '₹499 refund for order #84018 initiated. Expect 5–7 business days.',
    isRead: true, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
]

export default function NotificationDrawer() {
  const navigate = useNavigate()
  const {
    isDrawerOpen, closeDrawer, notifications, unreadCount,
    setNotifications, markRead, markAllRead, removeNotification,
  } = useNotificationStore()
  const openSupport = useSupportStore(state => state.openSupport)

  const handleNotifClick = (notif) => {
    markRead(notif._id)
    
    if (notif.link) {
      navigate(notif.link)
      closeDrawer()
      return
    }

    if (notif.metadata?.orderId) {
      navigate(`/orders/${notif.metadata.orderId}`)
      closeDrawer()
      return
    }

    // Fallback based on type
    if (notif.type?.startsWith('ORDER_') || notif.type?.startsWith('REFUND_') || notif.type?.startsWith('RETURN_')) {
      navigate('/orders')
      closeDrawer()
    } else if (notif.type === 'OFFER') {
      navigate('/products')
      closeDrawer()
    } else if (notif.type === 'CHAT_REPLY') {
      openSupport()
      closeDrawer()
    }
  }

  // Notifications are fetched via the store/api or Socket.io. 
  // No demo notifications should be loaded.
  const groups = notifications.reduce((acc, n) => {
    let d = new Date(n.createdAt || Date.now())
    if (isNaN(d.valueOf())) {
      d = new Date()
    }
    const now = new Date()
    let group = 'Earlier'
    if (d.toDateString() === now.toDateString()) group = 'Today'
    else {
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
      if (d.toDateString() === yesterday.toDateString()) group = 'Yesterday'
    }
    if (!acc[group]) acc[group] = []
    acc[group].push(n)
    return acc
  }, {})

  const groupOrder = ['Today', 'Yesterday', 'Earlier']

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[200]"
            onClick={closeDrawer}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 right-0 h-full w-[340px] max-w-[90vw] z-[201] flex flex-col"
            style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}
            id="notification-drawer"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4"
              style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-2.5">
                <Bell size={17} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-[15px] font-semibold text-[var(--text-primary)]">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ background: 'var(--brand-gradient)', color: 'var(--brand-text)' }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button
                    onClick={markAllRead}
                    className="btn-ghost text-[12px]"
                    style={{ height: '32px', padding: '0 10px', gap: '4px' }}
                    id="mark-all-read-btn"
                  >
                    <CheckCheck size={13} />
                    Clear all
                  </button>
                )}
                <button onClick={closeDrawer} className="btn-icon w-8 h-8" aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(245,197,24,0.08)' }}>
                    <Bell size={24} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">No notifications yet</p>
                  <p className="text-[12.5px] text-[var(--text-muted)]">
                    Order updates, offers, and more will appear here
                  </p>
                </div>
              ) : (
                groupOrder.filter(g => groups[g]?.length).map(group => (
                  <div key={group}>
                    <div className="px-4 py-2.5"
                      style={{ background: 'var(--bg-card)' }}>
                      <span className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}>{group}</span>
                    </div>
                    {groups[group].map(n => (
                      <NotifItem key={n._id} notif={n} onClick={handleNotifClick} onRemove={removeNotification} />
                    ))}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
