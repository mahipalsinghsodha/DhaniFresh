import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiMessageSquare, FiUser, FiPackage, FiPhone, FiMail,
  FiCheckCircle, FiLifeBuoy, FiX, FiCopy, FiCalendar,
  FiMapPin, FiTruck, FiFileText, FiCreditCard,
  FiChevronRight, FiRefreshCw, FiAlertCircle, FiShield,
  FiLayers, FiShoppingBag, FiArrowRight, FiExternalLink, FiMinimize2
} from 'react-icons/fi';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import AdminSupport from './AdminSupport';
import AdminFloatingChat from '../../components/chat/AdminFloatingChat';
import { formatOrderId } from '../../utils/formatOrderId';

export default function SupportDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  
  // Floating Live Chat Popup State (persists across tabs for multitasking)
  const [floatingSession, setFloatingSession] = useState(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [resultFilter, setResultFilter] = useState('all'); // 'all' | 'orders' | 'users'
  const [searchResults, setSearchResults] = useState({ users: [], orders: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');

  // Selected Order Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newOrderStatus, setNewOrderStatus] = useState('');
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);

  // Quick Ticket Creation for Order
  const [ticketModalOrder, setTicketModalOrder] = useState(null);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('ORDER_ISSUE');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Tickets State
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    if (activeTab === 'tickets') {
      fetchTickets();
    }
  }, [activeTab]);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await api.get('/api/support/admin');
      setTickets(res.data || []);
    } catch (err) {
      toast.error('Failed to load tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const executeSearch = async (queryText = searchQuery, typeOption = searchType, autoOpenFirstOrder = false) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      toast.info('Please enter a search query');
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    setLastSearchedQuery(trimmed);
    try {
      const res = await api.get(`/api/support/search?q=${encodeURIComponent(trimmed)}&type=${typeOption}`);
      const data = res.data || { users: [], orders: [] };
      setSearchResults(data);
      if (autoOpenFirstOrder && data.orders?.length === 1) {
        handleSelectOrder(data.orders[0]);
        setResultFilter('orders');
      } else if (autoOpenFirstOrder && data.orders?.length > 1) {
        setResultFilter('orders');
        toast.info(`Found ${data.orders.length} orders for ${trimmed}`);
      } else if (autoOpenFirstOrder && data.orders?.length === 0) {
        setResultFilter('all');
        toast.info(`No orders found for ${trimmed}`);
      } else {
        setResultFilter('all');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectOrder = async (orderSummary) => {
    setSelectedOrder(orderSummary);
    if (!orderSummary?._id) return;
    try {
      const res = await api.get(`/api/support/orders/${orderSummary._id}`);
      setSelectedOrder(res.data);
    } catch (err) {
      // Keep summary if full fetch fails
    }
  };

  const handleSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    executeSearch(searchQuery, searchType);
  };

  const handleQuickSearchUser = (userEmail) => {
    if (!userEmail) return;
    setSearchQuery(userEmail);
    setSearchType('email');
    executeSearch(userEmail, 'email', true);
  };

  const handleCopy = (text, label = 'Text') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleUpdateOrderStatus = async () => {
    if (!selectedOrder || !newOrderStatus) return;
    setUpdatingOrderStatus(true);
    try {
      const res = await api.patch(`/api/support/orders/${selectedOrder._id}/status`, { status: newOrderStatus });
      toast.success(`Order payment status updated to ${newOrderStatus}`);
      setSelectedOrder(res.data);
      setSearchResults(prev => ({
        ...prev,
        orders: prev.orders.map(o => o._id === res.data._id ? { ...o, ...res.data } : o)
      }));
      setNewOrderStatus('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  const handleCreateOrderTicket = async (e) => {
    e.preventDefault();
    if (!ticketModalOrder || !newTicketMessage.trim()) return;
    setCreatingTicket(true);
    try {
      await api.post('/api/support', {
        subject: newTicketSubject || `Support for Order #${formatOrderId(ticketModalOrder)}`,
        category: newTicketCategory,
        order: ticketModalOrder._id,
        message: newTicketMessage
      });
      toast.success('Support ticket created successfully');
      setTicketModalOrder(null);
      setNewTicketSubject('');
      setNewTicketMessage('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;
    setReplying(true);
    try {
      const res = await api.post(`/api/support/${selectedTicket._id}/reply`, { message: replyMessage });
      setSelectedTicket(res.data);
      setTickets(tickets.map(t => t._id === res.data._id ? res.data : t));
      setReplyMessage('');
      toast.success('Reply sent');
    } catch (err) {
      toast.error('Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const handleResolve = async (ticketId) => {
    try {
      const res = await api.put(`/api/support/${ticketId}/status`, { status: 'RESOLVED' });
      if (selectedTicket?._id === ticketId) setSelectedTicket(res.data);
      setTickets(tickets.map(t => t._id === res.data._id ? res.data : t));
      toast.success('Ticket marked as resolved');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const getPlaceholderText = () => {
    switch (searchType) {
      case 'orderId': return 'Search by Order ID (e.g., ORD..., or #64f...) or Invoice...';
      case 'email': return 'Search by customer email address...';
      case 'phone': return 'Search by customer or delivery phone number...';
      case 'name': return 'Search by customer name or recipient name...';
      case 'paymentId': return 'Search by Razorpay Payment ID or Razorpay Order ID...';
      case 'invoice': return 'Search by Invoice Number (e.g., INV-2026-...)...';
      default: return 'Search by Order ID, Email, Phone, Name, Invoice, or Payment ID...';
    }
  };

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">PAID</span>;
      case 'COD_CONFIRMED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">COD CONFIRMED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">CANCELLED</span>;
      case 'FAILED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">FAILED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">{status || 'PENDING'}</span>;
    }
  };

  const totalResultsCount = (searchResults.users?.length || 0) + (searchResults.orders?.length || 0);

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-[1360px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--brand-primary)' }}>Support Dashboard</h1>
              {floatingSession && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-brand-secondary/10 border border-brand-secondary/30 rounded-xl text-xs font-bold text-slate-800">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span>Floating Chat: <b className="text-brand-secondary">{floatingSession.userId?.name || floatingSession.guestName || 'Customer'}</b></span>
                  <button
                    onClick={() => setFloatingSession(null)}
                    className="text-slate-400 hover:text-red-500 ml-1"
                    title="Close Floating Chat"
                  >
                    <FiX size={12} />
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Manage live chats, support tickets, search customer orders, and multitask in parallel.
            </p>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'chat' ? 'bg-white shadow-sm text-brand-primary' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <FiMessageSquare size={16} /> Live Chat
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tickets' ? 'bg-white shadow-sm text-brand-primary' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <FiLifeBuoy size={16} /> Support Tickets
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-white shadow-sm text-brand-primary' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <FiSearch size={16} /> User/Order Search
            </button>
          </div>
        </div>

        {/* Tab 1: Live Chat */}
        {activeTab === 'chat' && (
          <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-white">
            <AdminSupport onPopOutSession={(session) => {
              setFloatingSession(session);
              toast.info(`Chat with ${session.userId?.name || session.guestName || 'Customer'} popped out to floating window!`);
            }} />
          </div>
        )}

        {/* Tab 2: Support Tickets */}
        {activeTab === 'tickets' && (
          <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-200px)]">
            {/* Ticket List */}
            <div className="w-full md:w-1/3 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <FiLifeBuoy className="text-brand-primary" /> Recent Tickets ({tickets.length})
                </h2>
                <button onClick={fetchTickets} className="p-1.5 text-slate-500 hover:text-brand-primary transition-colors">
                  <FiRefreshCw size={14} className={loadingTickets ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {loadingTickets ? (
                  <div className="p-8 text-center text-slate-400 font-medium flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                    Loading tickets...
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 font-medium">
                    <FiLifeBuoy size={36} className="mx-auto mb-2 opacity-30" />
                    No tickets found.
                  </div>
                ) : (
                  tickets.map(t => (
                    <button
                      key={t._id}
                      onClick={() => setSelectedTicket(t)}
                      className={`w-full text-left p-4 transition-colors ${selectedTicket?._id === t._id ? 'bg-brand-primary/5 border-l-4 border-l-brand-primary' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <span className="font-bold text-sm truncate text-slate-800">{t.subject}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${t.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate"><FiUser className="inline mr-1" /> {t.user?.name || 'Guest User'}</p>
                      <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                        <FiCalendar size={11} /> {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Ticket Detail & Chat */}
            <div className="w-full md:w-2/3 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
              {selectedTicket ? (
                <>
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-wrap justify-between items-start gap-4">
                    <div>
                      <h2 className="font-bold text-lg text-slate-800">{selectedTicket.subject}</h2>
                      <div className="flex flex-wrap gap-4 mt-2 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1"><FiUser /> {selectedTicket.user?.name || 'Guest'}</span>
                        {selectedTicket.user?.email && <span className="flex items-center gap-1"><FiMail /> {selectedTicket.user?.email}</span>}
                        {selectedTicket.order && (
                          <span className="flex items-center gap-1 font-semibold text-brand-primary">
                            <FiPackage /> Linked Order: #{selectedTicket.order?.orderIdString || selectedTicket.order?._id?.slice(-8)?.toUpperCase() || selectedTicket.order}
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedTicket.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleResolve(selectedTicket._id)}
                        className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-green-700 transition-colors flex items-center gap-1.5"
                      >
                        <FiCheckCircle size={14} /> Mark Resolved
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                    {selectedTicket.messages?.map((m, i) => (
                      <div key={i} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3.5 text-sm shadow-sm ${m.sender === 'admin' ? 'bg-brand-primary text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                          <p className="whitespace-pre-wrap">{m.message}</p>
                          <div className={`text-[10px] mt-1.5 text-right font-medium ${m.sender === 'admin' ? 'text-white/70' : 'text-slate-400'}`}>
                            {m.sender === 'admin' ? 'Support Agent' : (selectedTicket.user?.name || 'Customer')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedTicket.status !== 'RESOLVED' ? (
                    <div className="p-4 bg-white border-t border-slate-100">
                      <form onSubmit={handleReply} className="flex gap-3">
                        <input
                          type="text"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Type your reply to customer..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                        />
                        <button
                          type="submit"
                          disabled={replying || !replyMessage.trim()}
                          className="bg-brand-secondary text-white px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-brand-secondary/90 transition-all shadow-sm flex items-center gap-1.5"
                        >
                          {replying ? 'Sending...' : 'Send Reply'}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="p-4 bg-green-50 border-t border-green-100 text-center text-green-700 text-sm font-bold flex items-center justify-center gap-2">
                      <FiCheckCircle /> This ticket has been marked as resolved.
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <FiLifeBuoy size={48} className="mb-4 opacity-20" />
                  <p className="font-semibold text-base text-slate-600">Select a ticket to view conversation</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Choose any support request from the list on the left to read user queries and send replies.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: User/Order Search */}
        {activeTab === 'search' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8 space-y-8">
            
            {/* Search Header & Filter Controls */}
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-slate-800">Omni Search (Users & Orders)</h2>
                <p className="text-xs text-slate-500">
                  Search across orders, customers, guest checkouts, invoice numbers, or payment transactions while chatting in parallel.
                </p>
              </div>

              {/* Search Category Filter Pills */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                {[
                  { id: 'all', label: 'All Fields' },
                  { id: 'orderId', label: 'Order ID / Suffix' },
                  { id: 'email', label: 'Email Address' },
                  { id: 'phone', label: 'Phone Number' },
                  { id: 'name', label: 'Customer Name' },
                  { id: 'paymentId', label: 'Payment / Razorpay ID' },
                  { id: 'invoice', label: 'Invoice No.' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSearchType(tab.id);
                      if (searchQuery.trim()) {
                        executeSearch(searchQuery, tab.id);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      searchType === tab.id
                        ? 'bg-white text-brand-primary shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Bar Input */}
              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={getPlaceholderText()}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-10 py-3.5 text-sm font-medium outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition-all shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-brand-primary text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 shrink-0"
                >
                  {isSearching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <FiSearch size={16} />
                      Search
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Results Filter Bar */}
            {hasSearched && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    Search Results for <span className="text-brand-primary">"{lastSearchedQuery}"</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Found {searchResults.orders?.length || 0} order(s) and {searchResults.users?.length || 0} user(s)
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setResultFilter('all')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${resultFilter === 'all' ? 'bg-white shadow-xs text-brand-primary' : 'text-slate-600'}`}
                  >
                    All ({totalResultsCount})
                  </button>
                  <button
                    onClick={() => setResultFilter('orders')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${resultFilter === 'orders' ? 'bg-white shadow-xs text-brand-primary' : 'text-slate-600'}`}
                  >
                    Orders ({searchResults.orders?.length || 0})
                  </button>
                  <button
                    onClick={() => setResultFilter('users')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${resultFilter === 'users' ? 'bg-white shadow-xs text-brand-primary' : 'text-slate-600'}`}
                  >
                    Users ({searchResults.users?.length || 0})
                  </button>
                </div>
              </div>
            )}

            {/* Search Initial State */}
            {!hasSearched && !isSearching && (
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-brand-primary">
                  <FiSearch size={28} />
                </div>
                <h3 className="font-bold text-slate-800 text-base mb-1">Search Anything in the Store</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Enter an <b>Order ID</b> (e.g. ORD...), <b>Customer Email</b>, <b>Phone Number</b>, <b>Razorpay Payment ID</b>, or <b>Customer Name</b> to view full details and manage orders instantly.
                </p>
              </div>
            )}

            {/* Search Loading Skeleton */}
            {isSearching && (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-medium text-slate-500">Searching database across users and orders...</p>
              </div>
            )}

            {/* Results Grid */}
            {hasSearched && !isSearching && totalResultsCount === 0 && (
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <FiAlertCircle size={36} className="mx-auto mb-2 text-slate-300" />
                <h3 className="font-bold text-slate-800 text-base mb-1">No matches found for "{lastSearchedQuery}"</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Try switching the search filter to <b>"All Fields"</b> or check if there is a typo in the order ID or email.
                </p>
              </div>
            )}

            {hasSearched && !isSearching && totalResultsCount > 0 && (
              <div className="space-y-8">
                
                {/* 1. Orders Results Section */}
                {(resultFilter === 'all' || resultFilter === 'orders') && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <FiPackage className="text-brand-secondary" /> Found Orders ({searchResults.orders?.length || 0})
                    </h3>
                    
                    {searchResults.orders?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No orders found matching this query.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchResults.orders.map(o => {
                          const orderCode = formatOrderId(o);
                          const customerName = o.user?.name || o.shippingAddress?.name || 'Guest User';
                          const customerEmail = o.user?.email || o.guestEmail || o.shippingAddress?.email || 'No email';
                          const customerPhone = o.shippingAddress?.phone || o.user?.phone || '';

                          return (
                            <div
                              key={o._id}
                              className="p-5 border border-slate-200 rounded-2xl bg-white hover:border-brand-primary/50 transition-all shadow-xs hover:shadow-sm flex flex-col justify-between"
                            >
                              <div className="space-y-3">
                                {/* Order ID & Status Badges */}
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-sm text-slate-900">
                                        #{orderCode}
                                      </span>
                                      <button
                                        onClick={() => handleCopy(orderCode, 'Order ID')}
                                        className="text-slate-400 hover:text-brand-primary p-0.5"
                                        title="Copy Order ID"
                                      >
                                        <FiCopy size={13} />
                                      </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                      <FiCalendar size={11} /> {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    {getPaymentStatusBadge(o.paymentStatus)}
                                    {o.orderStatus && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">
                                        {o.orderStatus.replace(/_/g, ' ')}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Customer Info */}
                                <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 text-xs">
                                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                                    <FiUser className="text-slate-400" size={13} /> {customerName}
                                  </p>
                                  <p className="text-slate-500 flex items-center gap-1.5 truncate">
                                    <FiMail className="text-slate-400" size={13} /> {customerEmail}
                                  </p>
                                  {customerPhone && (
                                    <p className="text-slate-500 flex items-center gap-1.5">
                                      <FiPhone className="text-slate-400" size={13} /> {customerPhone}
                                    </p>
                                  )}
                                  {o.shippingAddress?.city && (
                                    <p className="text-slate-500 flex items-center gap-1.5">
                                      <FiMapPin className="text-slate-400" size={13} /> {o.shippingAddress.city}, {o.shippingAddress.state} - {o.shippingAddress.zipCode}
                                    </p>
                                  )}
                                </div>

                                {/* Items & Price summary */}
                                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                                  <span className="text-slate-500">
                                    {o.orderItems?.length || 0} item(s) • <b className="text-slate-700">{o.paymentMethod || 'COD'}</b>
                                  </span>
                                  <span className="font-bold text-sm text-slate-900">
                                    ₹{Number(o.totalPrice || 0).toLocaleString('en-IN')}
                                  </span>
                                </div>

                                {/* Product item thumbnails preview */}
                                {o.orderItems?.length > 0 && (
                                  <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                                    {o.orderItems.slice(0, 3).map((item, idx) => (
                                      <div key={idx} className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0" title={item.name}>
                                        {item.image || item.product?.image ? (
                                          <img src={item.image || item.product?.image} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-[9px] font-bold">
                                            ITEM
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {o.orderItems.length > 3 && (
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                        +{o.orderItems.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Card Action Buttons */}
                              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                                <button
                                  onClick={() => handleSelectOrder(o)}
                                  className="flex-1 py-2 px-3 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1"
                                >
                                  View Details <FiChevronRight size={14} />
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setTicketModalOrder(o);
                                    setNewTicketSubject(`Support for Order #${orderCode}`);
                                  }}
                                  className="p-2 text-slate-500 hover:text-brand-secondary bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                                  title="Create Ticket for this Order"
                                >
                                  <FiLifeBuoy size={16} />
                                </button>

                                {floatingSession && (
                                  <button
                                    onClick={() => handleCopy(`#${orderCode}`, 'Order ID')}
                                    className="p-2 text-brand-secondary hover:text-white bg-brand-secondary/10 hover:bg-brand-secondary rounded-xl transition-all"
                                    title="Copy Order ID for Chat"
                                  >
                                    <FiCopy size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Users Results Section */}
                {(resultFilter === 'all' || resultFilter === 'users') && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <FiUser className="text-brand-secondary" /> Found Users ({searchResults.users?.length || 0})
                    </h3>

                    {searchResults.users?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No registered users found matching this query.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchResults.users.map(u => (
                          <div
                            key={u._id}
                            className="p-5 border border-slate-200 rounded-2xl bg-white hover:border-brand-secondary/50 transition-all shadow-xs flex flex-col justify-between"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-brand-secondary/10 text-brand-secondary font-bold flex items-center justify-center text-sm uppercase">
                                    {u.name?.slice(0, 2) || 'US'}
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm text-slate-900">{u.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary uppercase">
                                        {u.role || 'customer'}
                                      </span>
                                      {u.isBlocked ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                          Blocked
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                          Active
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 text-slate-500 truncate">
                                    <FiMail size={13} /> {u.email}
                                  </span>
                                  <button
                                    onClick={() => handleCopy(u.email, 'Email')}
                                    className="text-slate-400 hover:text-brand-primary p-0.5"
                                    title="Copy Email"
                                  >
                                    <FiCopy size={12} />
                                  </button>
                                </div>
                                {u.phone && (
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-slate-500">
                                      <FiPhone size={13} /> {u.phone}
                                    </span>
                                    <button
                                      onClick={() => handleCopy(u.phone, 'Phone')}
                                      className="text-slate-400 hover:text-brand-primary p-0.5"
                                      title="Copy Phone"
                                    >
                                      <FiCopy size={12} />
                                    </button>
                                  </div>
                                )}
                                <p className="text-[10px] text-slate-400 pt-1">
                                  Registered: {new Date(u.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                              <button
                                onClick={() => handleQuickSearchUser(u.email)}
                                className="w-full py-2 px-3 bg-slate-100 hover:bg-brand-secondary hover:text-white rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5"
                              >
                                <FiShoppingBag size={13} /> View Customer Orders
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* ORDER DETAILS MODAL                                                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 font-mono">
                      Order #{formatOrderId(selectedOrder)}
                    </h3>
                    <button
                      onClick={() => handleCopy(formatOrderId(selectedOrder), 'Order ID')}
                      className="text-slate-400 hover:text-brand-primary p-1"
                    >
                      <FiCopy size={15} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>Date: {new Date(selectedOrder.createdAt).toLocaleString()}</span>
                    <span>•</span>
                    <span>Method: <b>{selectedOrder.paymentMethod}</b></span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {getPaymentStatusBadge(selectedOrder.paymentStatus)}
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    <FiX size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Customer & Shipping Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FiUser /> Customer Information
                    </h4>
                    <p className="font-bold text-sm text-slate-800">
                      {selectedOrder.user?.name || selectedOrder.shippingAddress?.name || 'Guest User'}
                    </p>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <FiMail size={12} /> {selectedOrder.user?.email || selectedOrder.guestEmail || 'No email provided'}
                    </p>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <FiPhone size={12} /> {selectedOrder.shippingAddress?.phone || selectedOrder.user?.phone || 'No phone provided'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FiMapPin /> Delivery Address
                    </h4>
                    {selectedOrder.shippingAddress ? (
                      <div className="text-xs text-slate-700 space-y-0.5">
                        <p className="font-semibold">{selectedOrder.shippingAddress.name}</p>
                        <p>{selectedOrder.shippingAddress.street}</p>
                        <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.zipCode}</p>
                        <p className="text-slate-500">Country: {selectedOrder.shippingAddress.country || 'India'}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No shipping address recorded</p>
                    )}
                  </div>
                </div>

                {/* 2. Order Items Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <FiLayers /> Ordered Items ({selectedOrder.orderItems?.length || 0})
                  </h4>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-600">
                        <tr>
                          <th className="p-3">Product</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Unit Price</th>
                          <th className="p-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedOrder.orderItems?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                {item.image || item.product?.image ? (
                                  <img src={item.image || item.product?.image} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-[10px]">IMG</div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{item.name}</p>
                                {item.weight && <span className="text-[10px] text-slate-500">{item.weight}</span>}
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700">{item.quantity}</td>
                            <td className="p-3 text-right text-slate-600">₹{Number(item.price || 0).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right font-bold text-slate-900">
                              ₹{(Number(item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Financial Breakdown */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1 text-xs text-slate-500">
                    <p>Payment Method: <b className="text-slate-800">{selectedOrder.paymentMethod}</b></p>
                    {selectedOrder.paymentInfo?.razorpay_payment_id && (
                      <p>Razorpay Pay ID: <span className="font-mono text-slate-700">{selectedOrder.paymentInfo.razorpay_payment_id}</span></p>
                    )}
                    {selectedOrder.invoiceNumber && (
                      <p>Invoice No: <span className="font-mono text-slate-700">{selectedOrder.invoiceNumber}</span></p>
                    )}
                    {selectedOrder.trackingNumber && (
                      <p>Tracking No: <span className="font-mono text-slate-700">{selectedOrder.trackingNumber}</span></p>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs text-right min-w-[200px]">
                    <div className="flex justify-between text-slate-500">
                      <span>Items Total:</span>
                      <span>₹{Number(selectedOrder.itemsPrice || 0).toLocaleString('en-IN')}</span>
                    </div>
                    {selectedOrder.taxPrice > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>Tax:</span>
                        <span>₹{Number(selectedOrder.taxPrice || 0).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {selectedOrder.shippingPrice > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>Shipping:</span>
                        <span>₹{Number(selectedOrder.shippingPrice || 0).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-green-600 font-bold">
                        <span>Discount:</span>
                        <span>-₹{Number(selectedOrder.discount || 0).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                      <span>Total Amount:</span>
                      <span className="text-brand-primary">₹{Number(selectedOrder.totalPrice || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Quick Support Actions */}
                <div className="p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/20 space-y-3">
                  <h4 className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                    Support Agent Quick Actions
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <select
                        value={newOrderStatus}
                        onChange={(e) => setNewOrderStatus(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand-primary"
                      >
                        <option value="">-- Change Payment Status --</option>
                        <option value="PAID">PAID</option>
                        <option value="CANCELLED">CANCELLED</option>
                        <option value="FAILED">FAILED</option>
                        <option value="COD_CONFIRMED">COD CONFIRMED</option>
                        <option value="PENDING">PENDING</option>
                      </select>
                    </div>
                    <button
                      onClick={handleUpdateOrderStatus}
                      disabled={!newOrderStatus || updatingOrderStatus}
                      className="px-4 py-2 bg-brand-secondary text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-brand-primary transition-all"
                    >
                      {updatingOrderStatus ? 'Updating...' : 'Update Status'}
                    </button>
                    <button
                      onClick={() => {
                        setTicketModalOrder(selectedOrder);
                        setNewTicketSubject(`Support for Order #${formatOrderId(selectedOrder)}`);
                      }}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:text-brand-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <FiLifeBuoy size={14} /> Create Ticket
                    </button>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* QUICK TICKET CREATION MODAL                                               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {ticketModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden"
            >
              <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FiLifeBuoy className="text-brand-primary" /> Create Support Ticket
                </h3>
                <button onClick={() => setTicketModalOrder(null)} className="text-slate-400 hover:text-slate-700">
                  <FiX size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateOrderTicket} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Subject</label>
                  <input
                    type="text"
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Category</label>
                  <select
                    value={newTicketCategory}
                    onChange={(e) => setNewTicketCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-brand-primary"
                  >
                    <option value="ORDER_ISSUE">Order Issue / Delay</option>
                    <option value="PAYMENT_ISSUE">Payment / Refund</option>
                    <option value="PRODUCT_INQUIRY">Product Inquiry</option>
                    <option value="GENERAL">General Query</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Initial Message / Notes</label>
                  <textarea
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    required
                    placeholder="Describe the issue or customer communication..."
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs outline-none focus:border-brand-primary resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTicketModalOrder(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingTicket || !newTicketMessage.trim()}
                    className="px-6 py-2.5 bg-brand-primary text-white font-bold text-xs rounded-xl disabled:opacity-50 hover:bg-brand-primary/90 transition-all shadow-sm"
                  >
                    {creatingTicket ? 'Creating...' : 'Create Ticket'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* FLOATING MULTITASKING LIVE CHAT POPUP WINDOW                              */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {floatingSession && (
          <AdminFloatingChat
            session={floatingSession}
            onClose={() => setFloatingSession(null)}
            onQuickSearch={(query, type) => {
              setActiveTab('search');
              setSearchQuery(query);
              setSearchType(type);
              executeSearch(query, type, type === 'orderId');
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
