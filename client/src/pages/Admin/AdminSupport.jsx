import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMessageSquare, FiSend, FiSearch, FiArrowLeft, FiLifeBuoy,
  FiExternalLink, FiToggleRight, FiToggleLeft, FiShield, FiClock,
  FiUsers, FiMapPin, FiPhone, FiGlobe, FiEye, FiCopy, FiCheck,
  FiUser, FiMail
} from "react-icons/fi";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import RestrictedAccess from "../../components/RestrictedAccess";
import { toast } from "react-toastify";
import { useSocket } from "../../hooks/useSocket";
import ChatBubble from "../../components/chat/ChatBubble";
import SupportOrderPanel from "../../components/SupportOrderPanel";

const STATUS_CFG = {
  ROUTING: { label: "Ringing", dot: "#f59e0b", text: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
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

const formatWorkTime = (sec = 0) => {
  if (!sec || sec < 60) return `${sec || 0}s`;
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m % 60}m`;
};

export default function AdminSupport({ onPopOutSession, suppressIncomingModal = false }) {
  const { user, hasPermission } = useAuth();
  const { isConnected, connect, emit, on, off } = useSocket();
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [filter, setFilter] = useState(user?.role === 'support' ? "ACTIVE" : "ALL");
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 1024);
  const [loading, setLoading] = useState(true);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [isAgentLive, setIsAgentLive] = useState(user?.supportStats?.isLive !== false);
  const [agentStats, setAgentStats] = useState(user?.supportStats || {});
  const typingTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const [onlineAgents, setOnlineAgents] = useState([]);
  const [copiedField, setCopiedField] = useState('');
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  const fetchOnlineAgents = useCallback(async () => {
    try {
      const res = await api.get('/api/chat/agents/online');
      setOnlineAgents(res.data?.agents || []);
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchOnlineAgents();
      const interval = setInterval(fetchOnlineAgents, 15000);
      return () => clearInterval(interval);
    }
  }, [isSuperAdmin, fetchOnlineAgents]);

  const handleCopyText = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopiedField(''), 2000);
  };

  // Responsive layout
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Fetch Initial Sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/api/chat/sessions?limit=100');
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
      if (!session || !session.sessionId) return;
      setSessions(prev => {
        const safe = Array.isArray(prev) ? prev : [];
        const filtered = safe.filter(s => s.sessionId !== session.sessionId);
        return [session, ...filtered];
      });
    };

    const handleSessionUpdate = (data) => {
      if (!data || !data.sessionId) return;
      setSessions(prev => {
        const safe = Array.isArray(prev) ? prev : [];
        const exists = safe.some(s => s.sessionId === data.sessionId);
        if (exists) {
          return safe.map(s => s.sessionId === data.sessionId ? { ...s, ...data } : s);
        } else {
          return [data, ...safe];
        }
      });
      if (selected?.sessionId === data.sessionId) {
        setSelected(prev => ({ ...prev, ...data }));
      }
    };

    const handleMessage = (msg) => {
      if (!msg || !msg.sessionId) return;
      setSessions(prev => (Array.isArray(prev) ? prev : []).map(s => s.sessionId === msg.sessionId ? { ...s, lastMessage: msg } : s));
      if (selected?.sessionId === msg.sessionId) {
        setMessages(prev => {
          const safe = Array.isArray(prev) ? prev : [];
          if (safe.some(m => m._id === msg._id)) return safe;
          return [...safe, msg];
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
    on('agent:live_status_updated', ({ isLive }) => {
      setIsAgentLive(isLive);
      toast.info(isLive ? '🟢 You are now Online & Taking Chats' : '⚪ You are now Offline');
    });
    on('agent:stats_updated', ({ supportStats }) => {
      if (supportStats) {
        setAgentStats(supportStats);
        if (typeof supportStats.isLive === 'boolean') {
          setIsAgentLive(supportStats.isLive);
        }
      }
    });
    on('agent:rejection_limit_reached', ({ message }) => {
      setIsAgentLive(false);
      toast.warn(message || '⚠️ Daily Rejection Limit Reached (1/1 today). Set to Offline.');
    });
    on('admin:agent_presence_change', fetchOnlineAgents);

    return () => {
      off('admin:new_session', handleNewSession);
      off('admin:session_update', handleSessionUpdate);
      off('admin:session_rejected', handleSessionUpdate);
      off('chat:message', handleMessage);
      off('chat:user_typing', handleUserTyping);
      off('agent:live_status_updated');
      off('agent:stats_updated');
      off('agent:rejection_limit_reached');
      off('admin:agent_presence_change', fetchOnlineAgents);
    };
  }, [hasPermission, on, off, connect, selected?.sessionId]);

  const toggleLiveStatus = () => {
    const nextStatus = !isAgentLive;
    setIsAgentLive(nextStatus);
    emit('agent:toggle_live_status', { isLive: nextStatus });
  };

  const handleIncomingChatAccepted = (incomingSessionId) => {
    fetchSessions();
    setSelected(sessions.find(s => s.sessionId === incomingSessionId) || { sessionId: incomingSessionId, status: 'ACTIVE' });
  };

  useEffect(() => {
    const handleIncomingEvent = (e) => {
      const incomingSessionId = e.detail?.sessionId;
      if (incomingSessionId) {
        handleIncomingChatAccepted(incomingSessionId);
      }
    };
    window.addEventListener('support:incoming_accepted', handleIncomingEvent);
    return () => window.removeEventListener('support:incoming_accepted', handleIncomingEvent);
  }, [sessions]);

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
    emit('agent:accept_incoming', { sessionId: selected.sessionId });
    setSelected(prev => ({ ...prev, status: 'ACTIVE', agentId: user._id }));
  };

  const handleReject = () => {
    if (!selected) return;
    emit('agent:reject_incoming', { sessionId: selected.sessionId });
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

  const myId = String(user?._id || user?.id || '');
  const safeSessions = Array.isArray(sessions) ? sessions : [];

  const filtered = safeSessions.filter(s => {
    const sessionAgentId = String(s?.agentId?._id || s?.agentId || '');
    const isMyChat = sessionAgentId === myId;

    // For support agent (non-superadmin):
    // 1. ACTIVE chats: Only show chats assigned to THIS agent
    if (!isSuperAdmin && s?.status === 'ACTIVE' && !isMyChat) {
      return false;
    }

    // 2. WAITING / ROUTING: Don't show if rejected or timed out by me
    const isRejectedByMe = s?.routingAttempts?.some(
      r => String(r?.agentId?._id || r?.agentId) === myId && (r?.action === 'REJECTED' || r?.action === 'MISSED_TIMEOUT')
    ) || s?.agentActions?.some(
      a => a?.action === 'REJECTED' && String(a?.adminId) === myId
    );

    if (!isSuperAdmin && (s?.status === 'WAITING' || s?.status === 'ROUTING') && isRejectedByMe) {
      return false;
    }

    // 3. CLOSED chats: Support agents only see their own closed chats
    if (!isSuperAdmin && s?.status === 'CLOSED' && !isMyChat) {
      return false;
    }

    const matchF = filter === "ALL" || s?.status === filter;
    const q = (search || '').toLowerCase();
    const matchS = !q || 
      s?.guestName?.toLowerCase().includes(q) || 
      s?.guestEmail?.toLowerCase().includes(q) || 
      s?.userId?.name?.toLowerCase().includes(q) || 
      s?.userId?.email?.toLowerCase().includes(q) || 
      s?.agentId?.name?.toLowerCase().includes(q) || 
      s?.userPhone?.toLowerCase().includes(q) || 
      s?.sessionId?.toLowerCase().includes(q);

    return matchF && matchS;
  });

  const counts = {
    waiting: safeSessions.filter(s => {
      const isRejectedByMe = s?.routingAttempts?.some(
        r => String(r?.agentId?._id || r?.agentId) === myId && (r?.action === 'REJECTED' || r?.action === 'MISSED_TIMEOUT')
      ) || s?.agentActions?.some(
        a => a?.action === 'REJECTED' && String(a?.adminId) === myId
      );
      return (s?.status === 'WAITING' || s?.status === 'ROUTING') && (isSuperAdmin || !isRejectedByMe);
    }).length,
    active: safeSessions.filter(s => {
      const sessionAgentId = String(s?.agentId?._id || s?.agentId || '');
      return s?.status === 'ACTIVE' && (isSuperAdmin || sessionAgentId === myId);
    }).length,
  };

  const showSidebar = !isMobile || !selected;
  const showChat = !isMobile || !!selected;

  return (
    <div style={{ display: 'flex', overflow: 'hidden', background: 'var(--bg-base)', height: 'calc(100vh - 106px)' }}>
      {/* ─── LEFT: Session List ─── */}
      {showSidebar && (
        <div style={{ width: isMobile ? '100%' : 360, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, background: 'rgba(245,166,35,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiLifeBuoy size={18} style={{ color: 'var(--brand-secondary)' }} />
                </div>
                <div>
                  <h1 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Live Support</h1>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {counts.waiting > 0 ? <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{counts.waiting} waiting</span> : 'Queue empty'}
                    {counts.active > 0 && <span style={{ margin: '0 4px' }}>·</span>}
                    {counts.active > 0 && <span style={{ color: 'var(--success)', fontWeight: 600 }}>{counts.active} active</span>}
                  </p>
                </div>
              </div>

              {/* Agent Live Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {!isConnected && (
                  <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }} title="Connecting to live dispatch server">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Connecting...
                  </span>
                )}
                <button
                  onClick={toggleLiveStatus}
                  disabled={!isConnected}
                  title={!isConnected ? "Connecting to dispatch server..." : (isAgentLive ? "Click to set status to Offline" : "Click to set status to Online")}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                    borderRadius: 99, fontSize: 11, fontWeight: 800, cursor: isConnected ? 'pointer' : 'not-allowed', border: '1px solid',
                    background: (isConnected && isAgentLive) ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                    borderColor: (isConnected && isAgentLive) ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.3)',
                    color: (isConnected && isAgentLive) ? '#10b981' : '#64748b',
                    opacity: isConnected ? 1 : 0.75
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: (isConnected && isAgentLive) ? '#10b981' : '#94a3b8' }} className={(isConnected && isAgentLive) ? 'animate-pulse' : ''} />
                  {(isConnected && isAgentLive) ? 'Online' : 'Offline'}
                </button>
              </div>
            </div>

            {/* Agent Live Performance Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12, padding: '8px 10px', background: 'var(--bg-alt)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today Work</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FiClock size={11} /> {formatWorkTime(agentStats?.dailyStats?.workSeconds || 0)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Login Time</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }} title="Today's Session Login Timestamp">
                  <FiClock size={11} className="text-emerald-500" />
                  {user?.lastLogin ? new Date(user.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active Now'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today Accepted</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                  {agentStats?.dailyStats?.accepted || 0}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rating ⭐</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>
                  {agentStats?.avgRating || 5} <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>({agentStats?.ratingCount || 0})</span>
                </span>
              </div>
            </div>

            {/* Super Admin Live Staff Presence Overview */}
            {isSuperAdmin && (
              <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FiUsers size={13} /> Active Staff ({safeOnlineAgents.length})
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
                    {safeOnlineAgents.filter(a => a?.isLive !== false).length} Live
                  </span>
                </div>
                {safeOnlineAgents.length === 0 ? (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No support agents online right now</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {safeOnlineAgents.map(a => (
                      <span
                        key={a?._id || Math.random()}
                        title={`${a?.name || 'Agent'} (${a?.email || ''}) · ${a?.isLive !== false ? 'Live' : 'Away'}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 8px',
                          borderRadius: 8,
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: a?.isLive !== false ? '#10b981' : '#94a3b8' }} />
                        {(a?.name || 'Agent').split(' ')[0]}
                        {a?.socketCount > 1 && <span style={{ opacity: 0.6, fontSize: 9 }}>({a.socketCount})</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {((agentStats?.dailyStats?.rejected || 0) + (agentStats?.dailyStats?.missed || 0)) >= 1 && !isSuperAdmin && (
              <div style={{ marginBottom: 12, padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 10, fontWeight: 700 }}>
                ⚠️ Daily 1-rejection limit reached. Status set to Offline.
              </div>
            )}

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <FiSearch size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search chats..."
                style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'var(--bg-alt)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: 12, outline: 'none', color: 'var(--text-primary)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }} className="no-scrollbar">
              {(isSuperAdmin ? [
                { v: 'ALL', label: 'All' },
                { v: 'WAITING', label: 'Waiting', count: counts.waiting },
                { v: 'ACTIVE', label: 'Active', count: counts.active },
                { v: 'CLOSED', label: 'Closed' },
              ] : [
                { v: 'ACTIVE', label: 'My Active Chats', count: counts.active },
                { v: 'CLOSED', label: 'Resolved History' },
              ]).map(f => (
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
                          {isSuperAdmin && selected.agentId && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', fontSize: 10, fontWeight: 700 }}>
                              <FiEye size={11} /> Handled by: {selected.agentId.name || 'Agent'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {selected.userId?.email || selected.guestEmail} · {selected.category}
                          {selected.orderId && ` · Order #${selected.orderId.slice(-6).toUpperCase()}`}
                          {selected.currentPage && (
                            <span style={{ marginLeft: 6, color: '#4f46e5', fontFamily: 'monospace', fontWeight: 700 }}>
                              [{selected.currentPage}]
                            </span>
                          )}
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

      {/* ─── RIGHTMOST: Customer Context & Embedded Order Search Panel ─── */}
      {selected && !isMobile && (
        <div style={{ width: '380px', borderLeft: '1px solid var(--border-color)', background: 'var(--bg-surface)', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Customer Full Context Card */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiUser size={14} /> Customer Context
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(245,166,35,0.12)', color: 'var(--brand-secondary)' }}>
                {selected.deviceInfo?.isMobile ? 'Mobile' : 'Desktop'}
              </span>
            </div>

            {/* Current Active Page */}
            <div style={{ marginBottom: 10, padding: '8px 12px', background: 'var(--bg-alt)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                Current Active Page
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#4f46e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selected.currentPage || '/'}
                </span>
                {selected.currentPage && (
                  <a
                    href={selected.currentPage}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, textDecoration: 'none' }}
                  >
                    View <FiExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>

            {/* Customer Details & Address */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {/* Phone */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FiPhone size={12} /> Phone:
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {selected.userPhone || selected.userId?.phone || 'Not provided'}
                  {(selected.userPhone || selected.userId?.phone) && (
                    <button
                      onClick={() => handleCopyText(selected.userPhone || selected.userId?.phone, 'Phone')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                      title="Copy phone"
                    >
                      {copiedField === 'Phone' ? <FiCheck size={12} color="#10b981" /> : <FiCopy size={12} />}
                    </button>
                  )}
                </span>
              </div>

              {/* Email */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FiMail size={12} /> Email:
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selected.userId?.email || selected.guestEmail || 'Guest'}
                  {(selected.userId?.email || selected.guestEmail) && (
                    <button
                      onClick={() => handleCopyText(selected.userId?.email || selected.guestEmail, 'Email')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                      title="Copy email"
                    >
                      {copiedField === 'Email' ? <FiCheck size={12} color="#10b981" /> : <FiCopy size={12} />}
                    </button>
                  )}
                </span>
              </div>

              {/* Delivery Address */}
              <div style={{ marginTop: 4, padding: '8px 12px', background: 'var(--bg-alt)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <FiMapPin size={11} className="text-rose-500" /> Delivery Address
                </span>
                <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.4, margin: 0 }}>
                  {selected.userAddress
                    ? [selected.userAddress.street, selected.userAddress.city, selected.userAddress.state, selected.userAddress.postalCode].filter(Boolean).join(', ')
                    : selected.userId?.addresses?.[0]
                    ? [selected.userId.addresses[0].street, selected.userId.addresses[0].city, selected.userId.addresses[0].state, selected.userId.addresses[0].zipCode || selected.userId.addresses[0].postalCode].filter(Boolean).join(', ')
                    : 'No saved address found'}
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 20px 8px', background: 'var(--bg-surface)', fontWeight: 800, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>
            Order History & Database
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <SupportOrderPanel initialSearchQuery={selected.orderId || selected.userId?.email || selected.guestEmail} />
          </div>
        </div>
      )}
    </div>
  );
}
