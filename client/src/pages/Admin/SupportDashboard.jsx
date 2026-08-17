import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiMessageSquare, FiUser, FiPackage, FiPhone, FiMail, FiCheckCircle, FiLifeBuoy } from 'react-icons/fi';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import AdminSupport from './AdminSupport';

export default function SupportDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], orders: [] });
  const [isSearching, setIsSearching] = useState(false);

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
      setTickets(res.data);
    } catch (err) {
      toast.error('Failed to load tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.get(`/api/support/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
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

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-[1280px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-primary)' }}>Support Dashboard</h1>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Manage live chats, customer queries, check orders, and resolve issues.
            </p>
          </div>
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'chat' ? 'bg-white shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FiMessageSquare size={15} /> Live Chat
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tickets' ? 'bg-white shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FiLifeBuoy size={15} /> Support Tickets
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-white shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FiSearch size={15} /> User/Order Search
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'chat' && (
          <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
            <AdminSupport />
          </div>
        )}
        {activeTab === 'tickets' && (
          <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-200px)]">
            
            {/* Ticket List */}
            <div className="w-full md:w-1/3 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-800">Recent Tickets</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingTickets ? (
                  <div className="p-8 text-center text-slate-400 font-medium">Loading tickets...</div>
                ) : tickets.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-medium">No tickets found.</div>
                ) : (
                  tickets.map(t => (
                    <button
                      key={t._id}
                      onClick={() => setSelectedTicket(t)}
                      className={`w-full text-left p-4 border-b border-slate-100 transition-colors ${selectedTicket?._id === t._id ? 'bg-brand-primary/5' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm truncate pr-2 text-slate-800">{t.subject}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{t.user?.name || 'Guest User'}</p>
                      <p className="text-[10px] text-slate-400 mt-2">{new Date(t.createdAt).toLocaleDateString()}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Ticket Detail & Chat */}
            <div className="w-full md:w-2/3 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
              {selectedTicket ? (
                <>
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
                    <div>
                      <h2 className="font-bold text-lg text-slate-800">{selectedTicket.subject}</h2>
                      <div className="flex gap-4 mt-2 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1"><FiUser /> {selectedTicket.user?.name || 'Guest'}</span>
                        {selectedTicket.order && <span className="flex items-center gap-1"><FiPackage /> Order Info Linked</span>}
                      </div>
                    </div>
                    {selectedTicket.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleResolve(selectedTicket._id)}
                        className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-green-600 transition-colors flex items-center gap-1.5"
                      >
                        <FiCheckCircle size={14} /> Mark Resolved
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                    {selectedTicket.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${m.sender === 'admin' ? 'bg-brand-primary text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                          {m.message}
                          <div className={`text-[9px] mt-1 text-right ${m.sender === 'admin' ? 'text-white/70' : 'text-slate-400'}`}>
                            {m.sender === 'admin' ? 'Support Agent' : 'User'}
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
                          placeholder="Type your reply..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                        />
                        <button
                          type="submit"
                          disabled={replying || !replyMessage.trim()}
                          className="bg-brand-secondary text-white px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-brand-secondary/90 transition-all shadow-sm"
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="p-4 bg-green-50 border-t border-green-100 text-center text-green-700 text-sm font-bold">
                      This ticket has been resolved.
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <FiMessageSquare size={48} className="mb-4 opacity-20" />
                  <p className="font-medium">Select a ticket to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 min-h-[60vh]">
            <form onSubmit={handleSearch} className="flex gap-4 max-w-2xl mx-auto mb-10">
              <div className="relative flex-1">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Order ID, Email, Phone, or Name..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-medium outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="bg-brand-primary text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Users Results */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <FiUser className="text-brand-secondary" /> Found Users ({searchResults.users.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.users.map(u => (
                    <div key={u._id} className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                      <p className="font-bold text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2"><FiMail /> {u.email}</p>
                      {u.phone && <p className="text-xs text-slate-500 mt-1 flex items-center gap-2"><FiPhone /> {u.phone}</p>}
                      <div className="mt-3 text-xs font-bold">
                        Role: <span className="text-brand-primary uppercase">{u.role}</span>
                      </div>
                    </div>
                  ))}
                  {searchResults.users.length === 0 && !isSearching && searchQuery && (
                    <p className="text-sm text-slate-400">No users found.</p>
                  )}
                </div>
              </div>

              {/* Orders Results */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <FiPackage className="text-brand-secondary" /> Found Orders ({searchResults.orders.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.orders.map(o => (
                    <div key={o._id} className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-sm text-slate-800">Order #{o.orderId || o._id.slice(-6).toUpperCase()}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase">
                          {o.orderStatus}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Customer: {o.user?.name}</p>
                      <p className="text-xs text-slate-500">Amount: ₹{o.totalAmount}</p>
                      <p className="text-[10px] text-slate-400 mt-2">{new Date(o.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                  {searchResults.orders.length === 0 && !isSearching && searchQuery && (
                    <p className="text-sm text-slate-400">No orders found.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
