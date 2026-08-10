import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { FiSearch, FiX, FiMessageSquare, FiUser, FiPhone, FiMail, FiChevronDown, FiSend, FiArrowLeft, FiMove } from 'react-icons/fi'
import api from '../api/axios'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { useLocation } from 'react-router-dom'
import SupportOrderPanel from './SupportOrderPanel'

const SupportWidget = () => {
  const { user } = useAuth()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('chats') // 'chats' or 'search'
  
  const dragControls = useDragControls()

  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState('all')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState({ users: [], orders: [] })
  
  // Chat / Ticket State
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [activeChat, setActiveChat] = useState(null)
  const [chatMessage, setChatMessage] = useState('')
  const messagesEndRef = useRef(null)

  // Interaction states
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [action, setAction] = useState('') // 'status', 'message'
  const [actionValue, setActionValue] = useState('')
  const [processing, setProcessing] = useState(false)

  // Hide the floating widget on the Admin Support page because it's embedded there
  if (location.pathname === '/admin/support') return null

  // Show for support role, or superadmin/admin with support access
  const hasSupportAccess = user?.role === 'support' || user?.role === 'superadmin' || (user?.role === 'admin' && user?.permissions?.includes('support'))
  
  useEffect(() => {
    if (isOpen && activeTab === 'chats' && hasSupportAccess && !activeChat) {
      fetchTickets()
    }
  }, [isOpen, activeTab, hasSupportAccess, activeChat])

  // Scroll to bottom of chat
  useEffect(() => {
    if (activeChat && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeChat?.messages])

  if (!hasSupportAccess) return null

  const fetchTickets = async () => {
    try {
      setLoadingTickets(true)
      const res = await api.get('/api/support/admin')
      setTickets(res.data)
    } catch (err) {
      toast.error('Failed to load chats')
    } finally {
      setLoadingTickets(false)
    }
  }

  const handleReply = async (e) => {
    e.preventDefault()
    if (!chatMessage.trim() || !activeChat) return
    try {
      setProcessing(true)
      const res = await api.post(`/api/support/${activeChat._id}/reply`, { message: chatMessage })
      
      const updatedTicket = { ...activeChat, messages: res.data.messages, status: res.data.status }
      setActiveChat(updatedTicket)
      setTickets(prev => prev.map(t => t._id === updatedTicket._id ? updatedTicket : t))
      setChatMessage('')
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      {/* Floating Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-6 w-14 h-14 bg-brand-primary text-white rounded-full shadow-2xl flex items-center justify-center z-[9999] hover:bg-brand-secondary transition-colors"
          >
            <FiMessageSquare size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Draggable Window Container */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            className="fixed z-[99999]"
            style={{
              bottom: '100px',
              right: '24px'
            }}
          >
            {/* Resizable Inner Content */}
            <div 
              className="bg-white shadow-2xl flex flex-col rounded-xl border border-slate-200 relative"
              style={{
                width: '380px',
                height: '600px',
                minWidth: '320px',
                minHeight: '400px',
                maxWidth: '90vw',
                maxHeight: '90vh',
                resize: 'both',
                overflow: 'hidden'
              }}
            >
              {/* Draggable Header */}
              <div 
                onPointerDown={(e) => dragControls.start(e)}
                className="bg-brand-secondary text-white p-3 shrink-0 shadow-md flex items-center justify-between cursor-move select-none"
              >
                <div className="flex items-center gap-2 pointer-events-none">
                  <FiMove className="opacity-70" />
                  <div>
                    <h2 className="font-bold text-sm leading-tight flex items-center gap-1">
                      Support Portal
                    </h2>
                    <p className="text-[10px] text-white/70 leading-tight">Agent: {user?.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <FiX size={16} />
                </button>
              </div>

              {/* Tabs */}
              {!activeChat && (
                <div className="flex border-b border-slate-200 shrink-0 bg-white">
                  <button 
                    onClick={() => setActiveTab('chats')}
                    className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'chats' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Recent Chats
                  </button>
                  <button 
                    onClick={() => setActiveTab('search')}
                    className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'search' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Search Database
                  </button>
                </div>
              )}

              {/* Main Content Area */}
              <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 relative">
                
                {/* === CHATS TAB === */}
                {activeTab === 'chats' && !activeChat && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {loadingTickets ? (
                      <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-brand-primary"></div>
                      </div>
                    ) : tickets.length === 0 ? (
                      <div className="text-center py-10">
                        <FiMessageSquare size={28} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-xs font-medium text-slate-500">No recent chats</p>
                      </div>
                    ) : (
                      tickets.map(ticket => (
                        <div 
                          key={ticket._id} 
                          onClick={() => setActiveChat(ticket)}
                          className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm cursor-pointer hover:border-brand-primary/40 transition-all flex gap-3 items-center"
                        >
                          <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 text-brand-primary font-bold text-sm">
                            {ticket.user?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                              <h4 className="font-bold text-xs text-slate-800 truncate">{ticket.user?.name || 'Unknown User'}</h4>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                                ticket.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                                ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {ticket.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">{ticket.subject}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* === ACTIVE CHAT VIEW === */}
                {activeChat && (
                  <div className="flex flex-col h-full bg-white relative">
                    {/* Chat Header */}
                    <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
                      <button onClick={() => setActiveChat(null)} className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors">
                        <FiArrowLeft size={16} />
                      </button>
                      <div className="w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 text-brand-primary font-bold text-xs">
                        {activeChat.user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-slate-800 truncate">{activeChat.user?.name || 'Unknown User'}</h4>
                        <p className="text-[9px] text-slate-500 truncate">Ticket: {activeChat.ticketId}</p>
                      </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
                      {activeChat.messages.map((msg, idx) => {
                        const isAdmin = msg.sender === 'admin'
                        return (
                          <div key={idx} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs ${
                              isAdmin 
                                ? 'bg-brand-primary text-white rounded-tr-sm' 
                                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                            }`}>
                              <p>{msg.message}</p>
                              <p className={`text-[8px] mt-1 text-right ${isAdmin ? 'text-white/70' : 'text-slate-400'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Reply Input */}
                    <form onSubmit={handleReply} className="p-2 bg-white border-t border-slate-200 shrink-0">
                      <div className="relative flex items-center gap-2">
                        <input 
                          type="text" 
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder="Type a reply..."
                          className="flex-1 pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs outline-none focus:border-brand-primary transition-colors"
                          disabled={processing || activeChat.status === 'RESOLVED' || activeChat.status === 'CLOSED'}
                        />
                        <button 
                          type="submit" 
                          disabled={!chatMessage.trim() || processing || activeChat.status === 'RESOLVED' || activeChat.status === 'CLOSED'}
                          className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center disabled:opacity-50 shrink-0 hover:bg-brand-secondary transition-colors"
                        >
                          <FiSend size={14} className="-ml-0.5" />
                        </button>
                      </div>
                    </form>
                  </div>
                )}


                {/* === SEARCH TAB === */}
                {activeTab === 'search' && !activeChat && (
                  <div className="flex-1 overflow-hidden relative">
                    <SupportOrderPanel />
                  </div>
                )}

              </div>

              {/* Resize Indicator Handle */}
              <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize pointer-events-none opacity-30">
                <svg viewBox="0 0 10 10" className="w-full h-full text-slate-900"><polygon points="10,0 10,10 0,10" fill="currentColor"/></svg>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default SupportWidget
