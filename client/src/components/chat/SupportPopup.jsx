// client/src/components/chat/SupportPopup.jsx
// ── Ultra-Premium Daatasa In-App Support Drawer (Mobile & Desktop) ───────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Send, Image as ImageIcon,
  Package, RotateCcw, ArrowDown, Headphones,
  CheckCircle2, Clock, Truck, AlertTriangle, XCircle, ShieldCheck,
  FileText, Check, Phone, MapPin
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../hooks/useSocket'
import { useSupportStore } from '../../store/support'
import api from '../../api/axios'
import ChatBubble from './ChatBubble'
import { useTranslation } from 'react-i18next'

const MAX_IMAGES = 6

const STATUS_BADGE = {
  DELIVERED:          { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)', label: 'Delivered', icon: CheckCircle2 },
  OUT_FOR_DELIVERY:   { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.3)', label: 'Out for Delivery', icon: Truck },
  SHIPPED:            { bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.3)', label: 'Shipped', icon: Truck },
  PICKED_UP:          { bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.3)', label: 'In Transit', icon: Truck },
  ASSIGNED_TO_COURIER:{ bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.3)', label: 'Courier Assigned', icon: Package },
  PROCESSING:         { bg: 'rgba(217, 165, 32, 0.14)', text: '#b45309', border: 'rgba(217, 165, 32, 0.35)', label: 'Processing', icon: Clock },
  ACCEPTED:           { bg: 'rgba(217, 165, 32, 0.14)', text: '#b45309', border: 'rgba(217, 165, 32, 0.35)', label: 'Accepted', icon: Clock },
  CONFIRMED:          { bg: 'rgba(217, 165, 32, 0.14)', text: '#b45309', border: 'rgba(217, 165, 32, 0.35)', label: 'Confirmed', icon: Clock },
  PENDING_ACCEPTANCE: { bg: 'rgba(217, 165, 32, 0.14)', text: '#b45309', border: 'rgba(217, 165, 32, 0.35)', label: 'Order Placed', icon: Clock },
  CANCELLED:          { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)', label: 'Cancelled', icon: XCircle },
  FAILED:             { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)', label: 'Failed', icon: AlertTriangle },
  RETURNED:           { bg: 'rgba(168, 85, 247, 0.12)', text: '#9333ea', border: 'rgba(168, 85, 247, 0.3)', label: 'Returned', icon: RotateCcw },
}

export default function SupportPopup() {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const isHindi = (i18n.language || '').toLowerCase().startsWith('hi')

  const { isOpen, order, initialCategory, closeSupport } = useSupportStore()
  const { connect, emit, on, off } = useSocket()

  const [sessionId, setSessionId] = useState(null)
  const [sessionStatus, setSessionStatus] = useState('BOT_HANDLING') // BOT_HANDLING | ROUTING | WAITING | ACTIVE | CLOSED
  const [messages, setMessages] = useState([])
  const [agentTyping, setAgentTyping] = useState(false)
  const [assignedAgent, setAssignedAgent] = useState(null)
  const [queueInfo, setQueueInfo] = useState(null)
  const [chatError, setChatError] = useState(null)

  const [inputText, setInputText] = useState('')
  const [imageFiles, setImageFiles] = useState([])
  const [uploadingImages, setUploadingImages] = useState(false)

  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [currentOrder, setCurrentOrder] = useState(order)

  const location = useLocation()

  // Operating Schedule & Live Status
  const [supportSchedule, setSupportSchedule] = useState({ isOpen: true, startHour: '09:00', endHour: '18:00', message: '' })
  const [statusBanner, setStatusBanner] = useState(null)

  // In-Drawer Offline Ticket Form
  const [showOfflineForm, setShowOfflineForm] = useState(false)
  const [offlineSubject, setOfflineSubject] = useState('')
  const [offlineMessage, setOfflineMessage] = useState('')
  const [offlinePhone, setOfflinePhone] = useState(user?.phone || '')
  const [offlineAddress, setOfflineAddress] = useState('')
  const [offlineCategory, setOfflineCategory] = useState(order ? 'ORDER_ISSUE' : 'OTHER')
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [ticketSuccess, setTicketSuccess] = useState(false)

  const messagesAreaRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimerRef = useRef(null)

  // Fetch live schedule
  useEffect(() => {
    if (!isOpen) return
    api.get('/api/chat/status')
      .then(res => setSupportSchedule(res.data))
      .catch(() => setSupportSchedule({ isOpen: true, startHour: '09:00', endHour: '18:00' }))
  }, [isOpen])

  // Sync page URL with active chat session in real time
  useEffect(() => {
    if (sessionId && isOpen) {
      emit('chat:update_page', {
        sessionId,
        currentPage: location.pathname + location.search
      })
    }
  }, [location.pathname, location.search, sessionId, isOpen, emit])

  const getActiveLang = () => {
    const lng = i18n.language || localStorage.getItem('i18nextLng') || document.documentElement.lang || 'en'
    return lng.toLowerCase().startsWith('hi') ? 'hi' : 'en'
  }

  // ── Auto-scroll & Viewport Management ──────────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' })
    } else if (messagesAreaRef.current) {
      messagesAreaRef.current.scrollTop = messagesAreaRef.current.scrollHeight
    }
    setShowScrollBtn(false)
  }, [])

  const handleScroll = useCallback(() => {
    const el = messagesAreaRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setShowScrollBtn(!atBottom)
  }, [])

  // Instant scroll on new messages or typing
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom(true)
    }, 80)
    return () => clearTimeout(timer)
  }, [messages, agentTyping, scrollToBottom])

  // ── Start / Rejoin Session on Open ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return

    connect()
    setMessages([])
    setSessionId(null)
    setSessionStatus('BOT_HANDLING')
    setAssignedAgent(null)
    setChatError(null)

    const handleSessionCreated = ({ sessionId: sid, status }) => {
      setSessionId(sid)
      setSessionStatus(status)
      setChatError(null)
      setTimeout(() => scrollToBottom(true), 120)
    }

    const handleMessage = (msg) => {
      setChatError(null)
      setMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev
        return [...prev, msg]
      })
      setTimeout(() => scrollToBottom(true), 100)
    }

    const handleHistory = ({ messages: hist, session }) => {
      setChatError(null)
      setMessages(hist || [])
      if (session) {
        setSessionId(session.sessionId)
        setSessionStatus(session.status)
        if (session.assignedTo) setAssignedAgent(session.assignedTo)
      }
      setTimeout(() => scrollToBottom(false), 120)
    }

    const handleAgentJoined = ({ agent }) => {
      setAssignedAgent(agent)
      setSessionStatus('ACTIVE')
      setQueueInfo(null)
      setTimeout(() => scrollToBottom(true), 100)
    }

    const handleAgentTyping = ({ isTyping, sessionId: sId }) => {
      if (!sId || sId === sessionId) {
        setAgentTyping(isTyping)
        if (isTyping) setTimeout(() => scrollToBottom(true), 50)
      }
    }

    const handleStatusChanged = (data) => {
      setSessionStatus(data.status)
      if (data.position) setQueueInfo({ position: data.position })
      if (data.status === 'WAITING' || data.status === 'OFFLINE_HOURS') {
        setStatusBanner({
          status: data.status,
          message: data.message || (data.onlineAgentsCount === 0
            ? (isHindi ? 'वर्तमान में कोई सहायता एजेंट ऑनलाइन नहीं है।' : 'All support agents are currently offline.')
            : (isHindi ? 'हमारे सभी सहायता विशेषज्ञ अन्य ग्राहकों की सहायता में व्यस्त हैं।' : 'All our specialists are currently assisting other customers.')),
          allBusy: true,
          canCreateTicket: true,
        })
      } else if (data.status === 'ACTIVE') {
        setStatusBanner(null)
      }
    }

    const handleSessionClosed = () => {
      setSessionStatus('CLOSED')
    }

    const handleChatError = (err) => {
      console.error('[Chat] chat:error received:', err)
      setChatError(err?.message || 'Failed to connect. Please tap retry.')
    }

    on('chat:session_created', handleSessionCreated)
    on('chat:message',         handleMessage)
    on('chat:history',         handleHistory)
    on('chat:agent_joined',    handleAgentJoined)
    on('chat:agent_typing',    handleAgentTyping)
    on('chat:status_changed',  handleStatusChanged)
    on('chat:session_closed',  handleSessionClosed)
    on('chat:error',           handleChatError)

    const activeAddress = user?.addresses?.find(a => a.isDefault) || user?.addresses?.[0] || null
    emit('chat:start', {
      guestName: user?.name || 'Customer',
      guestEmail: user?.email,
      category: order ? 'ORDER' : (initialCategory || 'OTHER'),
      orderId: order?._id || null,
      language: getActiveLang(),
      currentPage: typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/',
      userPhone: user?.phone || '',
      userAddress: activeAddress ? {
        street: activeAddress.street || '',
        city: activeAddress.city || '',
        state: activeAddress.state || '',
        postalCode: activeAddress.zipCode || activeAddress.postalCode || '',
        country: activeAddress.country || 'India',
      } : null,
      deviceInfo: {
        isMobile: typeof window !== 'undefined' && window.innerWidth < 768,
        platform: typeof navigator !== 'undefined' ? navigator.platform : '',
      },
    })

    return () => {
      off('chat:session_created', handleSessionCreated)
      off('chat:message',         handleMessage)
      off('chat:history',         handleHistory)
      off('chat:agent_joined',    handleAgentJoined)
      off('chat:agent_typing',    handleAgentTyping)
      off('chat:status_changed',  handleStatusChanged)
      off('chat:session_closed',  handleSessionClosed)
      off('chat:error',           handleChatError)
    }
  }, [isOpen, order?._id, connect, emit, on, off, user, initialCategory, scrollToBottom])

  // ── Sync Website Language ──────────────────────────────────────────────────
  useEffect(() => {
    if (sessionId) {
      emit('chat:set_language', { sessionId, language: getActiveLang() })
    }
  }, [i18n.language, sessionId, emit])

  // ── Quick Reply Action ─────────────────────────────────────────────────────
  const handleQuickReply = (option) => {
    if (!sessionId) return
    emit('chat:message', {
      sessionId,
      content: option,
      messageType: 'TEXT',
      language: getActiveLang(),
    })
    setTimeout(() => scrollToBottom(true), 60)
  }

  // ── Reset Chat ─────────────────────────────────────────────────────────────
  const handleResetChat = () => {
    if (sessionId) {
      emit('chat:close', { sessionId })
    }
    setSessionId(null)
    setMessages([])
    setSessionStatus('BOT_HANDLING')
    setAssignedAgent(null)

    const activeAddress = user?.addresses?.find(a => a.isDefault) || user?.addresses?.[0] || null
    emit('chat:start', {
      guestName: user?.name || 'Customer',
      guestEmail: user?.email,
      category: order ? 'ORDER' : 'OTHER',
      orderId: order?._id || null,
      language: getActiveLang(),
      currentPage: typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/',
      userPhone: user?.phone || '',
      userAddress: activeAddress ? {
        street: activeAddress.street || '',
        city: activeAddress.city || '',
        state: activeAddress.state || '',
        postalCode: activeAddress.zipCode || activeAddress.postalCode || '',
        country: activeAddress.country || 'India',
      } : null,
      deviceInfo: {
        isMobile: typeof window !== 'undefined' && window.innerWidth < 768,
        platform: typeof navigator !== 'undefined' ? navigator.platform : '',
      },
    })
  }

  // ── Offline Ticket Submission ──────────────────────────────────────────────
  const handleSubmitTicket = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!offlineMessage.trim()) return
    setSubmittingTicket(true)
    try {
      const fullDetails = `[Page: ${window.location.pathname}] ${offlinePhone ? `[Phone: ${offlinePhone}] ` : ''}${offlineAddress ? `[Address: ${offlineAddress}] ` : ''}\n\n${offlineMessage.trim()}`
      await api.post('/api/support', {
        subject: offlineSubject.trim() || (order ? `Support for Order #${orderShortId}` : 'Customer Support Query'),
        category: offlineCategory,
        order: order?._id || null,
        message: fullDetails,
      })
      setTicketSuccess(true)
      setTimeout(() => {
        setTicketSuccess(false)
        setShowOfflineForm(false)
        setOfflineMessage('')
        setOfflineSubject('')
      }, 3500)
    } catch (err) {
      console.error('Failed to submit ticket:', err)
    } finally {
      setSubmittingTicket(false)
    }
  }

  // ── Send Message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if (!text && imageFiles.length === 0) return
    if (!sessionId) return

    let uploadedUrls = []
    if (imageFiles.length > 0) {
      setUploadingImages(true)
      try {
        const formData = new FormData()
        imageFiles.forEach(f => formData.append('images', f.file))
        const res = await api.post('/api/support/upload-images', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        uploadedUrls = res.data?.urls || []
      } catch (err) {
        console.error('Image upload failed:', err)
      } finally {
        setUploadingImages(false)
        setImageFiles([])
      }
    }

    clearTimeout(typingTimerRef.current)
    if (sessionId) {
      emit('chat:typing', { sessionId, isTyping: false })
    }

    emit('chat:message', {
      sessionId,
      content: text,
      messageType: uploadedUrls.length > 0 ? 'IMAGE' : 'TEXT',
      attachments: uploadedUrls,
      language: getActiveLang(),
    })

    setInputText('')
    setTimeout(() => scrollToBottom(true), 60)
  }, [inputText, imageFiles, sessionId, emit, scrollToBottom])

  const handleInputChange = (e) => {
    const val = e.target.value
    setInputText(val)
    if (!sessionId) return

    emit('chat:typing', { sessionId, isTyping: true })
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      emit('chat:typing', { sessionId, isTyping: false })
    }, 1500)
  }

  // ── Image Handling ─────────────────────────────────────────────────────────
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    const remaining = MAX_IMAGES - imageFiles.length
    const allowed = files.slice(0, remaining)
    const newImgs = allowed.map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      preview: URL.createObjectURL(f),
    }))
    setImageFiles(prev => [...prev, ...newImgs])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (id) => {
    setImageFiles(prev => {
      const img = prev.find(i => i.id === id)
      if (img) URL.revokeObjectURL(img.preview)
      return prev.filter(i => i.id !== id)
    })
  }

  // ── Real-time Order Updates Sync ───────────────────────────────────────────
  useEffect(() => {
    setCurrentOrder(order)
  }, [order])

  useEffect(() => {
    const handleOrderUpdate = (updatedOrder) => {
      if (currentOrder && (updatedOrder._id === currentOrder._id || updatedOrder.orderId === currentOrder._id || updatedOrder.orderIdString === currentOrder.orderIdString)) {
        setCurrentOrder(prev => ({ ...prev, ...updatedOrder }))
      }
    }
    on('orderStatusUpdated', handleOrderUpdate)
    return () => {
      off('orderStatusUpdated', handleOrderUpdate)
    }
  }, [currentOrder, on, off])

  const activeOrder = currentOrder || order
  const orderShortId = activeOrder?.orderIdString
    ? activeOrder.orderIdString.slice(-8)
    : activeOrder?._id?.toString()?.slice(-6)?.toUpperCase()
  const totalPrice = Number(activeOrder?.totalPrice ?? 0).toLocaleString('en-IN')
  const orderStatusKey = activeOrder?.orderStatus || activeOrder?.status || 'CONFIRMED'
  const badgeInfo = STATUS_BADGE[orderStatusKey] || STATUS_BADGE.CONFIRMED
  const BadgeIcon = badgeInfo.icon || Package

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 35, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 360 }}
          className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[420px] md:w-[440px] h-[88vh] sm:h-[610px] max-h-[95vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl z-[70] flex flex-col overflow-hidden border border-slate-200/90 dark:border-slate-700/90"
        >
          {/* ── Luxury Header ────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-[#0B1A3F] via-[#132B69] to-[#0F2254] px-4 py-3 sm:px-5 sm:py-3.5 text-white flex items-center justify-between shadow-md relative shrink-0">
            {/* Mobile Drag Indicator */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/20 rounded-full sm:hidden" />

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-[#0B1A3F] flex items-center justify-center font-bold shadow-xs shrink-0">
                <ShieldCheck size={20} className="stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 tracking-tight font-sans">
                  {orderShortId
                    ? `${isHindi ? 'ऑर्डर #' : 'Order #'}${orderShortId} ${isHindi ? 'सहायता' : 'Support'}`
                    : (isHindi ? 'दातासा कस्टमर केयर' : 'Daatasa Support')}
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-200/90 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <span>
                    {sessionStatus === 'ACTIVE'
                      ? (assignedAgent ? `${assignedAgent.name}` : (isHindi ? 'लाइव एजेंट' : 'Live Agent'))
                      : (isHindi ? 'त्वरित सहायता (24x7)' : 'Instant Help (24x7)')}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleResetChat}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200 hover:text-white transition-all cursor-pointer"
                title={isHindi ? 'चैट रीसेट करें' : 'Reset Chat'}
                aria-label="Reset Chat"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={closeSupport}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200 hover:text-white transition-all cursor-pointer"
                id="close-support-popup"
                aria-label="Close Support Drawer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Operating Hours Bar ── */}
          <div className="px-4 py-2 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b border-amber-200/50 dark:border-slate-800 flex items-center justify-between text-xs text-amber-950 dark:text-amber-200 shrink-0">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-amber-600 shrink-0" />
              <span className="text-[11px] font-medium">
                {supportSchedule?.isOpen === false
                  ? (isHindi ? 'लाइव सहायता बंद है (समय: 9:00 AM - 6:00 PM)' : 'Live Support Closed (Hours: 9:00 AM – 6:00 PM IST)')
                  : (isHindi ? 'लाइव सहायता खुली है (9:00 AM - 6:00 PM)' : 'Live Support Online (9:00 AM – 6:00 PM IST)')}
              </span>
            </div>
            <button
              onClick={() => setShowOfflineForm(prev => !prev)}
              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white transition-all shrink-0 cursor-pointer"
            >
              {showOfflineForm ? (isHindi ? 'चैट देखें' : 'View Chat') : (isHindi ? 'टिकट भेजें' : 'Create Ticket')}
            </button>
          </div>

          {/* ── Pinned Order Context Pill ─────────────────────────────────── */}
          {activeOrder && (
            <div className="px-4 py-2.5 bg-[#FFFDF8] dark:bg-slate-900/90 border-b border-amber-200/60 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                <Package size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">
                  {isHindi ? 'ऑर्डर:' : 'Order:'} <strong className="font-mono text-gray-900 dark:text-white">#{orderShortId}</strong>
                </span>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="text-amber-800 dark:text-amber-400 font-extrabold">₹{totalPrice}</span>
              </div>
              <div
                className="px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 border shadow-2xs shrink-0"
                style={{ background: badgeInfo.bg, color: badgeInfo.text, borderColor: badgeInfo.border }}
              >
                <BadgeIcon size={12} />
                <span>{badgeInfo.label}</span>
              </div>
            </div>
          )}

          {/* ── Status Banner (Waiting / All Agents Busy) ── */}
          {statusBanner && !showOfflineForm && (
            <div className="mx-4 mt-2.5 p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex flex-col gap-2 shrink-0 shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-bold text-amber-900 dark:text-amber-200">{statusBanner.message}</p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-0.5">
                    {isHindi ? 'आप कतार में प्रतीक्षा कर सकते हैं या तुरंत ऑफलाइन टिकट सबमिट कर सकते हैं।' : 'You are in queue. Or you can submit an offline ticket and we will reach out.'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowOfflineForm(true)}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {isHindi ? 'ऑफलाइन टिकट सबमिट करें' : 'Submit Offline Ticket'}
                </button>
              </div>
            </div>
          )}

          {/* ── Offline Ticket Form View (if toggled) ── */}
          {showOfflineForm ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#FDF9F1]/40 dark:bg-slate-950/70">
              {ticketSuccess ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
                    <Check size={28} />
                  </div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-white">
                    {isHindi ? 'टिकट सफलतापूर्वक भेजा गया!' : 'Ticket Submitted Successfully!'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs">
                    {isHindi ? 'हमारी टीम आपके ईमेल और फोन पर जल्द ही संपर्क करेगी।' : 'Our support team will review your query and contact you as soon as possible.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitTicket} className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <FileText size={16} className="text-amber-600" />
                      {isHindi ? 'सहायता टिकट / ऑफलाइन मैसेज' : 'Submit Support Ticket / Query'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowOfflineForm(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {isHindi ? 'रद्द करें' : 'Back to Chat'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isHindi ? 'विषय (Subject)' : 'Subject'}
                    </label>
                    <input
                      type="text"
                      placeholder={isHindi ? 'उदा. ऑर्डर डिलीवरी देरी, रिफंड आदि' : 'e.g. Order delivery status, refund inquiry...'}
                      value={offlineSubject}
                      onChange={e => setOfflineSubject(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isHindi ? 'फोन नंबर' : 'Phone Number'}
                      </label>
                      <input
                        type="tel"
                        placeholder="+91..."
                        value={offlinePhone}
                        onChange={e => setOfflinePhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isHindi ? 'श्रेणी' : 'Category'}
                      </label>
                      <select
                        value={offlineCategory}
                        onChange={e => setOfflineCategory(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 outline-none focus:border-amber-500"
                      >
                        <option value="ORDER_ISSUE">{isHindi ? 'ऑर्डर समस्या' : 'Order Issue'}</option>
                        <option value="PAYMENT">{isHindi ? 'पेमेंट / रिफंड' : 'Payment / Refund'}</option>
                        <option value="PRODUCT">{isHindi ? 'प्रोडक्ट जानकारी' : 'Product Inquiry'}</option>
                        <option value="OTHER">{isHindi ? 'अन्य' : 'Other'}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isHindi ? 'पता / शहर (वैकल्पिक)' : 'Address / City (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder={isHindi ? 'उदा. जयपुर, राजस्थान' : 'e.g. Street, City, Pincode'}
                      value={offlineAddress}
                      onChange={e => setOfflineAddress(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isHindi ? 'आपका संदेश / समस्या *' : 'Your Message / Issue *'}
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder={isHindi ? 'कृपया अपनी समस्या विस्तार से लिखें...' : 'Please describe your query or issue in detail...'}
                      value={offlineMessage}
                      onChange={e => setOfflineMessage(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingTicket || !offlineMessage.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-98 flex items-center justify-center gap-2"
                  >
                    {submittingTicket ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={13} />
                        {isHindi ? 'टिकट सबमिट करें' : 'Submit Ticket'}
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <>
            {/* ── Messages Scroll Area ──────────────────────────────────────── */}
          <div
            ref={messagesAreaRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#FDF9F1]/40 dark:bg-slate-950/70 relative overscroll-contain"
          >
            {messages.length === 0 && !chatError && (
              <div className="flex flex-col items-center justify-center h-48 text-center text-sm text-gray-400">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="font-medium text-gray-500 dark:text-gray-400">
                  {isHindi ? 'सहायता लोड हो रही है…' : 'Connecting to support…'}
                </p>
              </div>
            )}

            {chatError && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center text-sm p-4">
                <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                <p className="text-gray-700 dark:text-gray-300 font-medium mb-3">{chatError}</p>
                <button
                  onClick={handleResetChat}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  {isHindi ? 'पुनः प्रयास करें' : 'Try Again'}
                </button>
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatBubble
                key={msg._id || i}
                message={msg}
                isSelf={msg.senderType === 'USER'}
                isHindi={isHindi}
                onQuickReply={handleQuickReply}
              />
            ))}

            {/* Bot / Agent Typing Indicator */}
            {agentTyping && (
              <div className="flex items-center gap-2 p-3 rounded-2xl max-w-xs text-xs bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-xs text-gray-500">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:0.4s]" />
                </div>
                <span className="font-medium">{isHindi ? 'टाइप किया जा रहा है…' : 'Typing…'}</span>
              </div>
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* Floating scroll to bottom button */}
          {showScrollBtn && (
            <button
              onClick={() => scrollToBottom(true)}
              className="absolute right-5 bottom-24 w-8 h-8 rounded-full shadow-lg flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white transition-all z-20 cursor-pointer active:scale-90"
              aria-label="Scroll to bottom"
            >
              <ArrowDown size={15} />
            </button>
          )}

          {/* Selected image previews */}
          {imageFiles.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 flex gap-2 overflow-x-auto bg-white dark:bg-slate-900 shrink-0">
              {imageFiles.map(img => (
                <div key={img.id} className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-amber-300">
                  <img src={img.preview} alt="Upload preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/75 text-white flex items-center justify-center text-[10px]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Bottom Input & Guidance Bar ───────────────────────────────── */}
          <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-2 shadow-lg shrink-0">
            {sessionStatus !== 'ACTIVE' && sessionStatus !== 'CLOSED' && sessionStatus !== 'RESOLVED' && (
              <div className="flex justify-between items-center text-xs px-1 text-gray-500 dark:text-gray-400">
                <span className="font-medium">{isHindi ? '👆 ऊपर दिए गए बटन दबाकर चुनें या नीचे लिखें' : '👆 Tap an option above or type below'}</span>
                <button
                  onClick={() => handleQuickReply(isHindi ? '💬 एजेंट से बात करें' : '💬 Talk to a human agent')}
                  className="font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Headphones size={13} /> {isHindi ? 'लाइव एजेंट' : 'Live Agent'}
                </button>
              </div>
            )}

            <div className="flex gap-2 items-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sessionStatus === 'CLOSED' || sessionStatus === 'RESOLVED' || imageFiles.length >= MAX_IMAGES || uploadingImages}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                title={`Attach image (${imageFiles.length}/${MAX_IMAGES})`}
              >
                {uploadingImages
                  ? <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  : <ImageIcon size={18} />}
              </button>
              <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImageSelect} className="hidden" />

              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  disabled={sessionStatus === 'CLOSED' || sessionStatus === 'RESOLVED'}
                  placeholder={
                    sessionStatus === 'CLOSED' || sessionStatus === 'RESOLVED'
                      ? (isHindi ? 'यह चैट समाप्त हो चुकी है' : 'This chat has ended')
                      : sessionStatus === 'ACTIVE'
                        ? (isHindi ? 'एजेंट को संदेश लिखें…' : 'Type a message to the agent…')
                        : (isHindi ? 'अपनी समस्या या प्रश्न लिखें…' : 'Type your message or question…')
                  }
                  value={inputText}
                  maxLength={5000}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  className="w-full h-10 px-3.5 text-sm outline-none rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed focus:border-amber-500 transition-all"
                  id="popup-support-chat-input"
                />
              </div>

              <button
                onClick={handleSend}
                disabled={(sessionStatus === 'CLOSED' || sessionStatus === 'RESOLVED') || (!inputText.trim() && imageFiles.length === 0)}
                className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-sm active:scale-95 transition-all cursor-pointer"
                id="popup-support-chat-send"
                aria-label="Send message"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
          </>
          )}

        </motion.div>
      )}
    </AnimatePresence>
  )
}
