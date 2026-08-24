import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  FiMinus, FiX, FiSend, FiSearch, FiMessageSquare, FiExternalLink,
  FiMaximize2, FiUser, FiPackage, FiPhone, FiMail, FiCheckCircle,
  FiMove, FiCopy, FiAlertCircle, FiChevronLeft, FiLayers, FiCalendar,
  FiMapPin, FiTruck, FiCreditCard
} from 'react-icons/fi';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { toast } from 'react-toastify';
import ChatBubble from './ChatBubble';
import { formatOrderId } from '../../utils/formatOrderId';

const STATUS_CFG = {
  WAITING: { label: 'Waiting', dot: 'var(--warning, #f59e0b)', text: '#d97706', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  ACTIVE: { label: 'Active', dot: 'var(--success, #10b981)', text: '#059669', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  CLOSED: { label: 'Closed', dot: 'var(--text-muted, #94a3b8)', text: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
  BOT_HANDLING: { label: 'Bot', dot: 'var(--brand-primary, #1B2F6E)', text: '#1B2F6E', bg: 'rgba(27,47,110,0.1)', border: 'rgba(27,47,110,0.25)' },
};

export default function AdminFloatingChat({ session, onClose, onQuickSearch }) {
  const { user } = useAuth();
  const { connect, emit, on, off } = useSocket();
  const dragControls = useDragControls();

  const [currentSession, setCurrentSession] = useState(session);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // In-Chat Order Inspection State
  const [inspectingOrder, setInspectingOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [newOrderStatus, setNewOrderStatus] = useState('');
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Sync session prop if updated
  useEffect(() => {
    if (session) {
      setCurrentSession(session);
    }
  }, [session]);

  // Connect socket and listen to events
  useEffect(() => {
    connect();

    const handleSessionUpdate = (data) => {
      if (data.sessionId === currentSession?.sessionId) {
        setCurrentSession(prev => ({ ...prev, ...data }));
      }
    };

    const handleMessage = (msg) => {
      if (msg.sessionId === currentSession?.sessionId) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });

        if (isMinimized) {
          setUnreadCount(prev => prev + 1);
        }
      }
    };

    const handleUserTyping = ({ sessionId, isTyping }) => {
      if (sessionId === currentSession?.sessionId) {
        setIsUserTyping(isTyping);
      }
    };

    on('admin:session_update', handleSessionUpdate);
    on('admin:session_rejected', handleSessionUpdate);
    on('chat:message', handleMessage);
    on('chat:user_typing', handleUserTyping);

    return () => {
      off('admin:session_update', handleSessionUpdate);
      off('admin:session_rejected', handleSessionUpdate);
      off('chat:message', handleMessage);
      off('chat:user_typing', handleUserTyping);
    };
  }, [connect, on, off, currentSession?.sessionId, isMinimized]);

  // Fetch messages for session
  useEffect(() => {
    if (!currentSession?.sessionId) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await api.get(`/api/chat/sessions/${currentSession.sessionId}/messages`);
        setMessages(res.data || []);
      } catch (err) {
        toast.error('Failed to load chat messages');
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();
  }, [currentSession?.sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isMinimized && !inspectingOrder && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isMinimized, inspectingOrder]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentSession) return;

    emit('agent:message', {
      sessionId: currentSession.sessionId,
      content: inputText.trim(),
      messageType: 'TEXT'
    });
    emit('agent:typing', { sessionId: currentSession.sessionId, isTyping: false });
    setInputText('');
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!currentSession) return;

    emit('agent:typing', { sessionId: currentSession.sessionId, isTyping: true });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emit('agent:typing', { sessionId: currentSession.sessionId, isTyping: false });
    }, 2000);
  };

  const handleAccept = () => {
    if (!currentSession) return;
    emit('agent:join_session', { sessionId: currentSession.sessionId });
    setCurrentSession(prev => ({ ...prev, status: 'ACTIVE', agentId: user?._id }));
    toast.success('Joined chat session');
  };

  const handleReject = () => {
    if (!currentSession) return;
    emit('agent:reject_session', { sessionId: currentSession.sessionId });
    toast.info('Session rejected');
    if (onClose) onClose();
  };

  const handleClose = () => {
    if (!currentSession) return;
    emit('chat:close', { sessionId: currentSession.sessionId });
    toast.success('Chat closed');
    setCurrentSession(prev => ({ ...prev, status: 'CLOSED' }));
  };

  // Inspect Order function: Loads full order details inside the chat overlay
  const handleInspectOrder = async (orderRef = currentSession?.orderId) => {
    if (!orderRef) return;
    
    // Extract ID string safely whether orderRef is an object or string
    const orderIdentifier = typeof orderRef === 'object'
      ? (orderRef._id || orderRef.orderIdString)
      : String(orderRef).replace(/^#/, '').trim();

    if (!orderIdentifier) return;

    setLoadingOrder(true);
    try {
      const res = await api.get(`/api/support/orders/${encodeURIComponent(orderIdentifier)}`);
      setInspectingOrder(res.data);
    } catch (err) {
      // Fallback: If not found by direct ID, search in Dashboard
      if (onQuickSearch) {
        onQuickSearch(orderIdentifier, 'orderId');
        toast.info(`Opened search for order #${orderIdentifier}`);
      } else {
        toast.error('Could not load order details');
      }
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleUpdateOrderStatus = async () => {
    if (!inspectingOrder || !newOrderStatus) return;
    setUpdatingOrderStatus(true);
    try {
      const res = await api.patch(`/api/support/orders/${inspectingOrder._id}/status`, { status: newOrderStatus });
      toast.success(`Order payment status updated to ${newOrderStatus}`);
      setInspectingOrder(res.data);
      setNewOrderStatus('');
    } catch (err) {
      toast.error('Failed to update order status');
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  const handleCopy = (text, label = 'Text') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleQuickSearchClick = () => {
    const rawOrderId = typeof currentSession?.orderId === 'object'
      ? (currentSession.orderId?.orderIdString || currentSession.orderId?._id)
      : currentSession?.orderId;

    const query = rawOrderId || currentSession?.userId?.email || currentSession?.guestEmail || currentSession?.guestName;
    const type = rawOrderId ? 'orderId' : (currentSession?.userId?.email || currentSession?.guestEmail) ? 'email' : 'all';
    
    if (onQuickSearch && query) {
      onQuickSearch(query, type);
      toast.info(`Searching for "${query}" in Dashboard`);
    }
  };

  const customerName = currentSession?.userId?.name || currentSession?.guestName || 'Guest User';
  const customerEmail = currentSession?.userId?.email || currentSession?.guestEmail || '';
  const customerInitials = customerName.slice(0, 2).toUpperCase();
  const statusCfg = STATUS_CFG[currentSession?.status] || STATUS_CFG.CLOSED;

  // Safe order ID label
  const linkedOrderLabel = typeof currentSession?.orderId === 'object'
    ? (currentSession.orderId?.orderIdString || String(currentSession.orderId?._id || '').slice(-8).toUpperCase())
    : String(currentSession?.orderId || '').replace(/^#/, '').slice(-8).toUpperCase();

  const getPaymentBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">PAID</span>;
      case 'COD_CONFIRMED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">COD CONFIRMED</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">CANCELLED</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">FAILED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">{status || 'PENDING'}</span>;
    }
  };

  return (
    <div className="fixed z-[99999]" style={{ bottom: '24px', right: '24px' }}>
      
      {/* ─── MINIMIZED DOCK PILL ─── */}
      {isMinimized ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={() => {
            setIsMinimized(false);
            setUnreadCount(0);
          }}
          className="bg-slate-900 text-white rounded-2xl p-3 shadow-2xl border border-slate-700 flex items-center gap-3 cursor-pointer hover:bg-slate-800 transition-all select-none"
          style={{ minWidth: '240px' }}
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-brand-secondary text-white font-bold flex items-center justify-center text-sm shadow-sm">
              {customerInitials}
            </div>
            <span
              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900"
              style={{ background: statusCfg.dot }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-xs truncate text-white">{customerName}</p>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {isUserTyping ? (
                <span className="text-amber-400 font-semibold animate-pulse">typing message...</span>
              ) : (
                `${currentSession?.category || 'Live Chat'} • Click to open`
              )}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
                setUnreadCount(0);
              }}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
              title="Expand Chat"
            >
              <FiMaximize2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onClose) onClose();
              }}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400"
              title="Close Popup"
            >
              <FiX size={14} />
            </button>
          </div>
        </motion.div>
      ) : (
        
        /* ─── EXPANDED FLOATING WINDOW ─── */
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 30 }}
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          className="bg-white shadow-2xl rounded-2xl border border-slate-200 flex flex-col overflow-hidden relative"
          style={{
            width: '430px',
            height: '580px',
            minWidth: '340px',
            minHeight: '400px',
            maxWidth: '92vw',
            maxHeight: '88vh',
            resize: 'both',
          }}
        >
          {/* Draggable Header */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="bg-slate-900 text-white p-3.5 flex items-center justify-between shrink-0 shadow-md cursor-move select-none"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-lg bg-brand-secondary text-white font-bold flex items-center justify-center text-xs">
                  {customerInitials}
                </div>
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-900"
                  style={{ background: statusCfg.dot }}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs text-white truncate max-w-[150px]">{customerName}</h3>
                  <span
                    className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border uppercase"
                    style={{ background: statusCfg.bg, color: statusCfg.text, borderColor: statusCfg.border }}
                  >
                    {statusCfg.label}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {isUserTyping ? (
                    <span className="text-amber-400 font-semibold animate-pulse">typing...</span>
                  ) : (
                    customerEmail || currentSession?.category || 'Live Support'
                  )}
                </p>
              </div>
            </div>

            {/* Header Action Tools */}
            <div className="flex items-center gap-1 shrink-0">
              {onQuickSearch && (
                <button
                  onClick={handleQuickSearchClick}
                  className="p-1.5 bg-white/10 hover:bg-brand-primary rounded-lg text-slate-300 hover:text-white transition-colors"
                  title="Search this customer/order in Dashboard"
                >
                  <FiSearch size={14} />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                title="Minimize Chat Window"
              >
                <FiMinus size={14} />
              </button>
              <button
                onClick={() => {
                  if (onClose) onClose();
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-red-400 transition-colors"
                title="Close Chat Window"
              >
                <FiX size={15} />
              </button>
            </div>
          </div>

          {/* Banner for Waiting Session */}
          {currentSession?.status === 'WAITING' && (
            <div className="bg-amber-50 border-b border-amber-200 p-2.5 px-4 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-amber-900 font-semibold">
                <FiAlertCircle className="text-amber-600 shrink-0" />
                <span>Customer is waiting for support</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleReject}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all"
                >
                  Reject
                </button>
                <button
                  onClick={handleAccept}
                  className="px-3 py-1 bg-brand-secondary text-white hover:bg-brand-primary rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  Accept
                </button>
              </div>
            </div>
          )}

          {/* Linked Order Bar: Inspect Order Button */}
          {currentSession?.orderId && (
            <div className="bg-slate-50 border-b border-slate-100 p-2 px-3 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <FiPackage className="text-brand-secondary" /> Linked Order: <b className="font-mono text-slate-800">#{linkedOrderLabel}</b>
              </span>
              <button
                onClick={() => handleInspectOrder(currentSession.orderId)}
                disabled={loadingOrder}
                className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white transition-all flex items-center gap-1"
                title="View full order details, items, address, and status"
              >
                {loadingOrder ? (
                  <span className="animate-pulse">Loading...</span>
                ) : (
                  <>
                    Inspect Order <FiExternalLink size={10} />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ─── MAIN CONTENT AREA: MESSAGES OR ORDER INSPECTION DRAWER ─── */}
          {inspectingOrder ? (
            /* ── IN-CHAT ORDER INSPECTION DRAWER ── */
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button
                  onClick={() => setInspectingOrder(null)}
                  className="text-xs font-bold text-slate-600 hover:text-brand-primary flex items-center gap-1"
                >
                  <FiChevronLeft size={16} /> Back to Chat
                </button>
                {onQuickSearch && (
                  <button
                    onClick={() => onQuickSearch(formatOrderId(inspectingOrder), 'orderId')}
                    className="text-[11px] font-bold text-brand-primary hover:underline flex items-center gap-1"
                  >
                    Open in Dashboard <FiExternalLink size={11} />
                  </button>
                )}
              </div>

              {/* Order Header Summary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        #{formatOrderId(inspectingOrder)}
                      </span>
                      <button onClick={() => handleCopy(formatOrderId(inspectingOrder), 'Order ID')} className="text-slate-400 hover:text-brand-primary">
                        <FiCopy size={12} />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <FiCalendar size={10} /> {new Date(inspectingOrder.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getPaymentBadge(inspectingOrder.paymentStatus)}
                    {inspectingOrder.orderStatus && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                        {inspectingOrder.orderStatus.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-0.5 pt-1 border-t border-slate-200/60">
                  <p className="font-semibold text-slate-800">
                    <FiUser className="inline mr-1" /> {inspectingOrder.user?.name || inspectingOrder.shippingAddress?.name || 'Customer'}
                  </p>
                  <p className="text-slate-500">
                    <FiMail className="inline mr-1" /> {inspectingOrder.user?.email || inspectingOrder.guestEmail || 'N/A'}
                  </p>
                  {inspectingOrder.shippingAddress?.phone && (
                    <p className="text-slate-500">
                      <FiPhone className="inline mr-1" /> {inspectingOrder.shippingAddress.phone}
                    </p>
                  )}
                  {inspectingOrder.shippingAddress?.city && (
                    <p className="text-slate-500">
                      <FiMapPin className="inline mr-1" /> {inspectingOrder.shippingAddress.street}, {inspectingOrder.shippingAddress.city}, {inspectingOrder.shippingAddress.state} - {inspectingOrder.shippingAddress.zipCode}
                    </p>
                  )}
                </div>
              </div>

              {/* Ordered Items List */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <FiLayers /> Items Ordered ({inspectingOrder.orderItems?.length || 0})
                </h4>
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
                  {inspectingOrder.orderItems?.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-2 bg-slate-50/50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                          {item.image || item.product?.image ? (
                            <img src={item.image || item.product?.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-slate-400">IMG</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500">Qty: {item.quantity} {item.weight ? `• ${item.weight}` : ''}</p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-900 shrink-0">
                        ₹{(Number(item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial & Logistics Info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Payment Method:</span>
                  <span className="font-bold">{inspectingOrder.paymentMethod}</span>
                </div>
                {inspectingOrder.paymentInfo?.razorpay_payment_id && (
                  <div className="flex justify-between text-slate-500 font-mono text-[11px]">
                    <span>Razorpay ID:</span>
                    <span>{inspectingOrder.paymentInfo.razorpay_payment_id}</span>
                  </div>
                )}
                {inspectingOrder.invoiceNumber && (
                  <div className="flex justify-between text-slate-500 font-mono text-[11px]">
                    <span>Invoice No:</span>
                    <span>{inspectingOrder.invoiceNumber}</span>
                  </div>
                )}
                {inspectingOrder.trackingNumber && (
                  <div className="flex justify-between text-slate-500 font-mono text-[11px]">
                    <span>Tracking No:</span>
                    <span>{inspectingOrder.trackingNumber}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Total Amount:</span>
                  <span className="text-brand-primary">₹{Number(inspectingOrder.totalPrice || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Fast Payment Status Changer */}
              <div className="p-3 bg-brand-primary/5 rounded-xl border border-brand-primary/20 space-y-2">
                <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">
                  Update Payment Status
                </label>
                <div className="flex gap-2">
                  <select
                    value={newOrderStatus}
                    onChange={(e) => setNewOrderStatus(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none focus:border-brand-primary"
                  >
                    <option value="">-- Select Status --</option>
                    <option value="PAID">PAID</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="FAILED">FAILED</option>
                    <option value="COD_CONFIRMED">COD CONFIRMED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                  <button
                    onClick={handleUpdateOrderStatus}
                    disabled={!newOrderStatus || updatingOrderStatus}
                    className="px-3 py-1.5 bg-brand-secondary text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-brand-primary transition-all shrink-0"
                  >
                    {updatingOrderStatus ? '...' : 'Update'}
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => {
                    setInputText(prev => `${prev} Reference Order #${formatOrderId(inspectingOrder)} `);
                    setInspectingOrder(null);
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <FiCopy size={12} /> Paste Order Reference into Chat
                </button>
              </div>
            </div>
          ) : (
            /* ── REGULAR MESSAGES STREAM ── */
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50"
            >
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 text-xs">
                  <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                  Loading conversation...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-6">
                  <FiMessageSquare size={32} className="mb-2 opacity-30" />
                  <p className="font-bold text-xs text-slate-600">Conversation Started</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Send a message to greet the customer.</p>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <ChatBubble
                    key={m._id || idx}
                    message={m}
                    currentUserId={currentSession?.userId?._id || 'guest'}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Area (Visible when not inspecting order) */}
          {!inspectingOrder && (
            <>
              {currentSession?.status === 'ACTIVE' && (currentSession.agentId?._id === user?._id || currentSession.agentId === user?._id || user?.role === 'superadmin') ? (
                <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                  <form onSubmit={handleSend} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={handleInputChange}
                      placeholder="Type a message to customer..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all font-medium"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="w-9 h-9 rounded-xl bg-brand-secondary text-white flex items-center justify-center disabled:opacity-50 hover:bg-brand-primary transition-all shrink-0 shadow-xs"
                    >
                      <FiSend size={14} className="-ml-0.5" />
                    </button>
                  </form>
                  <div className="flex justify-between items-center mt-2 text-[10px] text-slate-400">
                    <span>Press Enter to send</span>
                    <button
                      onClick={handleClose}
                      className="text-red-500 hover:text-red-700 font-bold hover:underline"
                    >
                      Close Chat Session
                    </button>
                  </div>
                </div>
              ) : currentSession?.status === 'CLOSED' ? (
                <div className="p-3 bg-slate-100 border-t border-slate-200 text-center text-xs font-bold text-slate-500 shrink-0">
                  This chat session is closed.
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 shrink-0">
                  {currentSession?.status === 'WAITING' ? 'Accept the session to start chatting' : 'Chat handled by another agent'}
                </div>
              )}
            </>
          )}

          {/* Resize Indicator Handle */}
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize pointer-events-none opacity-30">
            <svg viewBox="0 0 10 10" className="w-full h-full text-slate-900"><polygon points="10,0 10,10 0,10" fill="currentColor" /></svg>
          </div>
        </motion.div>
      )}
    </div>
  );
}
