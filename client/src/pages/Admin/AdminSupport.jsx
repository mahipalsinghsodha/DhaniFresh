import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiMessageSquare, FiSend, FiSearch, FiArrowLeft, FiLifeBuoy, FiExternalLink } from "react-icons/fi";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import RestrictedAccess from "../../components/RestrictedAccess";
import { toast } from "react-toastify";
import { useSocket } from "../../hooks/useSocket";
import ChatBubble from "../../components/chat/ChatBubble";
import SupportOrderPanel from "../../components/SupportOrderPanel";

const STATUS_CFG = {
  WAITING: { label: "Waiting", dot: "var(--warning)", text: "var(--warning)", bg: "rgba(245,166,35,0.08)", border: "rgba(245,166,35,0.25)" },
  ACTIVE: { label: "Active", dot: "var(--success)", text: "var(--success)", bg: "rgba(56,161,105,0.08)", border: "rgba(56,161,105,0.25)" },
  CLOSED: { label: "Closed", dot: "var(--text-muted)", text: "var(--text-muted)", bg: "var(--bg-alt)", border: "var(--border-color)" },
  BOT_HANDLING: { label: "Bot", dot: "var(--brand-primary)", text: "var(--brand-primary)", bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.25)" },
};

const StatusDot = ({ status }) => {
  const s = STATUS_CFG[status] || STATUS_CFG.CLOSED;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px',
      borderRadius: 99, fontSize: 10, fontWeight: 800, background: s.bg, color: s.text, border: `1px solid ${s.border}`
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
};

const timeAgo = (date) => {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function AdminSupport({ onPopOutSession }) {
  const { user, hasPermission } = useAuth();
  const { connect, emit, on, off } = useSocket();
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 1024);
  const [loading, setLoading] = useState(true);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const typingTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Responsive layout
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Fetch Initial Sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/api/chat/sessions?limit=50');
      setSessions(res.data.sessions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasPermission('support')) {
      fetchSessions();
    }
  }, [hasPermission, fetchSessions]);

  // Socket setup
  useEffect(() => {
    if (!hasPermission('support')) return;
    connect();

    const handleNewSession = (session) => {
      setSessions(prev => {
        const filtered = prev.filter(s => s.sessionId !== session.sessionId);
        return [session, ...filtered];
      });
    };

    const handleSessionUpdate = (data) => {
      setSessions(prev => prev.map(s => s.sessionId === data.sessionId ? { ...s, ...data } : s));
      if (selected?.sessionId === data.sessionId) {
        setSelected(prev => ({ ...prev, ...data }));
      }
    };

    const handleMessage = (msg) => {
      setSessions(prev => prev.map(s => s.sessionId === msg.sessionId ? { ...s, lastMessage: msg } : s));
      if (selected?.sessionId === msg.sessionId) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleUserTyping = ({ isTyping }) => {
      setIsUserTyping(isTyping);
    };

    on('admin:new_session', handleNewSession);
    on('admin:session_update', handleSessionUpdate);
    on('admin:session_rejected', handleSessionUpdate);
    on('chat:message', handleMessage);
    on('chat:user_typing', handleUserTyping);

    return () => {
      off('admin:new_session', handleNewSession);
      off('admin:session_update', handleSessionUpdate);
      off('admin:session_rejected', handleSessionUpdate);
      off('chat:message', handleMessage);
      off('chat:user_typing', handleUserTyping);
    };
  }, [hasPermission, on, off, connect, selected?.sessionId]);

  // Fetch messages when a session is selected
  useEffect(() => {
    if (!selected) return;
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/api/chat/sessions/${selected.sessionId}/messages`);
        setMessages(res.data || []);
      } catch (e) {
        toast.error('Failed to load messages');
      }
    };
    fetchMessages();
  }, [selected?.sessionId]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selected) return;
    emit('agent:message', { sessionId: selected.sessionId, content: inputText, messageType: 'TEXT' });
    emit('agent:typing', { sessionId: selected.sessionId, isTyping: false });
    setInputText("");
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!selected) return;
    
    emit('agent:typing', { sessionId: selected.sessionId, isTyping: true });
    
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emit('agent:typing', { sessionId: selected.sessionId, isTyping: false });
    }, 2000);
  };

  const handleAccept = () => {
    if (!selected) return;
    emit('agent:join_session', { sessionId: selected.sessionId });
    setSelected(prev => ({ ...prev, status: 'ACTIVE', agentId: user._id }));
  };

  const handleReject = () => {
    if (!selected) return;
    emit('agent:reject_session', { sessionId: selected.sessionId });
    toast.info('Session rejected');
    setSelected(null);
  };

  const handleClose = () => {
    if (!selected) return;
    emit('chat:close', { sessionId: selected.sessionId });
    toast.success('Session closed');
    setSelected(prev => ({ ...prev, status: 'CLOSED' }));
  };

  if (!hasPermission('support')) return <RestrictedAccess title="Access Restricted" message="You don't have permission to access the support panel." />;

  if (loading && sessions.length === 0) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--brand-secondary)' }} />
    </div>
  );

  const filtered = sessions.filter(s => {
    const matchF = filter === "ALL" || s.status === filter;
    const q = search.toLowerCase();
    const matchS = !q || s.guestName?.toLowerCase().includes(q) || s.userId?.name?.toLowerCase().includes(q) || s.sessionId?.toLowerCase().includes(q);
    const isRejectedByMe = s.agentActions?.some(a => a.action === 'REJECTED' && String(a.adminId) === String(user?._id));
    return matchF && matchS && !(isRejectedByMe && s.status === 'WAITING');
  });

  const counts = {
    waiting: sessions.filter(s => s.status === 'WAITING' && !s.agentActions?.some(a => a.action === 'REJECTED' && String(a.adminId) === String(user?._id))).length,
    active: sessions.filter(s => s.status === 'ACTIVE').length,
  };

  const showSidebar = !isMobile || !selected;
  const showChat = !isMobile || !!selected;

  return (
    <div style={{ display: 'flex', overflow: 'hidden', background: 'var(--bg-base)', height: 'calc(100vh - 106px)' }}>
      {/* ─── LEFT: Session List ─── */}
      {showSidebar && (
        <div style={{ width: isMobile ? '100%' : 360, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, background: 'rgba(245,166,35,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiLifeBuoy size={18} style={{ color: 'var(--brand-secondary)' }} />
              </div>
              <div>
                <h1 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Live Chat Support</h1>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {counts.waiting > 0 ? <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{counts.waiting} waiting</span> : 'Queue empty'}
                  {counts.active > 0 && <span style={{ margin: '0 4px' }}>·</span>}
                  {counts.active > 0 && <span style={{ color: 'var(--success)', fontWeight: 600 }}>{counts.active} active</span>}
                </p>
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <FiSearch size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search chats..."
                style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'var(--bg-alt)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: 12, outline: 'none', color: 'var(--text-primary)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }} className="no-scrollbar">
              {[
                { v: 'ALL', label: 'All' },
                { v: 'WAITING', label: 'Waiting', count: counts.waiting },
                { v: 'ACTIVE', label: 'Active', count: counts.active },
                { v: 'CLOSED', label: 'Closed' },
              ].map(f => (
                <button key={f.v} onClick={() => setFilter(f.v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid', cursor: 'pointer',
                    ...(filter === f.v ? { background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)' } : { background: 'var(--bg-alt)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' })
                  }}>
                  {f.label}
                  {f.count > 0 && <span style={{ fontSize: 9, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: filter === f.v ? '#fff' : 'var(--danger)', color: filter === f.v ? 'var(--navy)' : '#fff' }}>{f.count}</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <FiMessageSquare size={28} style={{ color: 'var(--border-color)', margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>No chats</p>
              </div>
            ) : filtered.map(s => {
              const active = selected?.sessionId === s.sessionId;
              const name = s.userId?.name || s.guestName || 'Guest';
              const lastMsg = s.lastMessage;
              return (
                <button key={s.sessionId} onClick={() => setSelected(s)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12,
                    borderLeft: `3px solid ${active ? 'var(--brand-secondary)' : 'transparent'}`,
                    background: active ? 'rgba(245,166,35,0.06)' : 'transparent'
                  }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(245,166,35,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 14, flexShrink: 0, border: '1.5px solid rgba(245,166,35,0.3)' }}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(s.lastMessageAt || s.createdAt)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.category}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StatusDot status={s.status} />
                        {onPopOutSession && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onPopOutSession(s);
                            }}
                            title="Open in Floating Window"
                            style={{
                              padding: '2px 6px',
                              borderRadius: 6,
                              background: 'rgba(27,47,110,0.08)',
                              color: 'var(--brand-primary)',
                              fontSize: 10,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <FiExternalLink size={10} /> Pop out
                          </span>
                        )}
                      </div>
                    </div>
                    {lastMsg && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lastMsg.senderType !== 'USER' ? 'You: ' : ''}{lastMsg.content}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── RIGHT: Chat Panel ─── */}
      {showChat && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-base)' }}>
          <AnimatePresence mode="wait">
            {!selected ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32 }}>
                <div style={{ width: 64, height: 64, background: 'var(--bg-alt)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <FiMessageSquare size={28} style={{ color: 'var(--border-color)' }} />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Select a chat</h2>
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Pick a conversation to view or reply</p>
              </motion.div>
            ) : (
              <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {isMobile && <button onClick={() => setSelected(null)} style={{ padding: 6, background: 'none', border: 'none', color: 'var(--text-primary)' }}><FiArrowLeft size={18} /></button>}
                    <div style={{ width: 36, height: 36, background: 'rgba(245,166,35,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 14 }}>
                      {(selected.userId?.name || selected.guestName || 'G').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{selected.userId?.name || selected.guestName || 'Guest'}</span>
                        <StatusDot status={selected.status} />
                        {isUserTyping && (
                          <span style={{ fontSize: 11, color: 'var(--brand-secondary)', fontStyle: 'italic', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
                            typing...
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {selected.userId?.email || selected.guestEmail} · {selected.category}
                        {selected.orderId && ` · Order #${selected.orderId.slice(-6).toUpperCase()}`}
                      </div>
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {onPopOutSession && (
                      <button
                        onClick={() => {
                          onPopOutSession(selected);
                          setSelected(null);
                        }}
                        title="Pop out to floating multitasking window"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--border-color)',
                          background: 'rgba(27,47,110,0.06)',
                          color: 'var(--brand-primary)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <FiExternalLink size={13} /> Pop out
                      </button>
                    )}
                    {selected.status === 'WAITING' && (
                      <>
                        <button onClick={handleReject} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-alt)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reject</button>
                        <button onClick={handleAccept} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--brand-secondary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Accept Chat</button>
                      </>
                    )}
                    {selected.status === 'ACTIVE' && (selected.agentId?._id === user?._id || selected.agentId === user?._id) && (
                      <button onClick={handleClose} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-alt)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Close Chat</button>
                    )}
                  </div>
                </div>

                {/* Audit Actions (Superadmin visibility) */}
                {user.role === 'superadmin' && selected.agentActions?.length > 0 && (
                   <div style={{ padding: '8px 20px', background: 'rgba(99,102,241,0.05)', borderBottom: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-secondary)' }}>
                     <strong style={{ color: 'var(--brand-primary)' }}>Audit Trail:</strong>
                     {selected.agentActions.map((a, i) => (
                       <span key={i} style={{ marginLeft: 8 }}>
                         [{a.action} by {a.adminName}]
                       </span>
                     ))}
                   </div>
                )}

                {/* Messages */}
                <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-base)' }}>
                  {messages.map((m, idx) => (
                    <ChatBubble key={m._id || idx} message={m} currentUserId={selected.userId?._id || 'guest'} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                {selected.status === 'ACTIVE' && (selected.agentId?._id === user?._id || selected.agentId === user?._id) ? (
                  <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                    <form onSubmit={handleSend} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                      <textarea
                        placeholder="Type a message..."
                        value={inputText} onChange={handleInputChange}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--border-color)', background: 'var(--bg-alt)', outline: 'none', fontSize: 14, color: 'var(--text-primary)', resize: 'none', minHeight: 44, maxHeight: 120 }}
                        rows={1}
                      />
                      <button type="submit" disabled={!inputText.trim()}
                        style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: inputText.trim() ? 'var(--brand-secondary)' : 'var(--bg-alt)', color: inputText.trim() ? '#fff' : 'var(--text-muted)', cursor: inputText.trim() ? 'pointer' : 'not-allowed' }}>
                        <FiSend size={18} />
                      </button>
                    </form>
                  </div>
                ) : selected.status === 'ACTIVE' ? (
                  <div style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-alt)', borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)' }}>
                    This chat is currently being handled by another agent.
                  </div>
                ) : selected.status === 'CLOSED' ? (
                   <div style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-alt)', borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)' }}>
                    This chat is closed.
                   </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ─── RIGHTMOST: Embedded Order Search Panel ─── */}
      {selected && !isMobile && (
        <div style={{ width: '380px', borderLeft: '1px solid var(--border-color)', background: 'var(--bg-surface)', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)', fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
            Search Database
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <SupportOrderPanel initialSearchQuery={selected.orderId || selected.userId?.email || selected.guestEmail} />
          </div>
        </div>
      )}
    </div>
  );
}
