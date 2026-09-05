import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhoneCall, FiPhoneOff, FiUser, FiPackage, FiClock, FiAlertCircle, FiHelpCircle, FiPhone, FiMapPin } from 'react-icons/fi';
import { useSocket } from '../../hooks/useSocket';

export default function IncomingChatModal({ onAcceptChat }) {
  const { on, off, emit } = useSocket();
  const [incomingCall, setIncomingCall] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const audioContextRef = useRef(null);
  const intervalRef = useRef(null);
  const soundIntervalRef = useRef(null);
  const incomingCallRef = useRef(null);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  // Pre-unlock Web Audio on first user interaction on the page
  useEffect(() => {
    const unlockAudio = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      } catch (e) {}
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // Request notification permission if supported
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Play Web Audio Chime without external MP3 dependencies
  const playRingtone = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      
      const now = ctx.currentTime;
      // Tone 1: 587.33 (D5) -> 880 (A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.setValueAtTime(880.00, now + 0.12);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Tone 2 (second chime): 783.99 (G5) -> 1046.50 (C6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.22);
      osc2.frequency.setValueAtTime(1046.50, now + 0.34);
      gain2.gain.setValueAtTime(0.0001, now);
      gain2.gain.setValueAtTime(0.3, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.65);
    } catch (e) {
      // Autoplay fallback
    }
  };

  useEffect(() => {
    const handleRing = (data) => {
      setIncomingCall(data);
      incomingCallRef.current = data;
      const totalSec = data.timeoutSeconds || 30;
      setTimeLeft(totalSec);

      // Start ringing sound interval
      playRingtone();
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = setInterval(playRingtone, 2000);

      // Trigger Desktop Notification if permitted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Incoming Support Call 📞', {
            body: `${data.customerName || 'A customer'} needs support right now!`,
            icon: '/logo_circle.png',
            tag: data.sessionId,
            requireInteraction: true,
          });
        } catch (e) {}
      }

      // Start Countdown
      if (intervalRef.current) clearInterval(intervalRef.current);
      const expiry = new Date(data.expiresAt).getTime();
      
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(intervalRef.current);
          clearInterval(soundIntervalRef.current);
          setIncomingCall(null);
          incomingCallRef.current = null;
        }
      }, 500);
    };

    const handleDismiss = (data) => {
      const cur = incomingCallRef.current;
      if (!cur || cur.sessionId === data.sessionId) {
        clearInterval(intervalRef.current);
        clearInterval(soundIntervalRef.current);
        setIncomingCall(null);
        incomingCallRef.current = null;
      }
    };

    on('agent:incoming_chat_ring', handleRing);
    on('agent:dismiss_ring', handleDismiss);

    return () => {
      off('agent:incoming_chat_ring', handleRing);
      off('agent:dismiss_ring', handleDismiss);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    };
  }, [on, off]);

  const handleAccept = () => {
    if (!incomingCall) return;
    const sId = incomingCall.sessionId;
    emit('agent:accept_incoming', { sessionId: sId });
    clearInterval(intervalRef.current);
    clearInterval(soundIntervalRef.current);
    setIncomingCall(null);
    if (onAcceptChat) {
      onAcceptChat(sId);
    }
  };

  const handleDecline = () => {
    if (!incomingCall) return;
    emit('agent:reject_incoming', { sessionId: incomingCall.sessionId });
    emit('agent:reject_session', { sessionId: incomingCall.sessionId });
    clearInterval(intervalRef.current);
    clearInterval(soundIntervalRef.current);
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  const totalSec = incomingCall.timeoutSeconds || 30;
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / totalSec) * 100));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-amber-200/80 overflow-hidden"
          style={{ boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.25)' }}
        >
          {/* Top Ring Header */}
          <div className="relative bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wider">Incoming Support Chat</span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full text-xs font-bold font-mono">
                <FiClock size={12} className="animate-spin text-amber-200" />
                <span>{timeLeft}s</span>
              </div>
            </div>

            {/* Countdown Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
              <motion.div
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Body Information */}
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 font-bold text-xl shadow-inner shrink-0">
                {incomingCall.customerName?.charAt(0).toUpperCase() || 'C'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-800 truncate">
                  {incomingCall.customerName}
                </h3>
                {incomingCall.customerEmail && (
                  <p className="text-xs text-slate-500 truncate">{incomingCall.customerEmail}</p>
                )}
                {incomingCall.customerPhone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <FiPhone size={11} className="text-amber-500" /> {incomingCall.customerPhone}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Category: {incomingCall.category}
                  </span>
                  {incomingCall.order && (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                      <FiPackage size={11} /> Order #{incomingCall.order.orderIdString || String(incomingCall.order._id).slice(-6).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Context details: Page & Address */}
            <div className="space-y-1.5">
              {incomingCall.currentPage && (
                <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <span className="font-semibold text-slate-500 text-[11px]">Active Page:</span>
                  <span className="font-mono text-indigo-600 font-bold truncate text-[11px]">{incomingCall.currentPage}</span>
                </div>
              )}
              {incomingCall.customerAddress && (
                <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <FiMapPin size={12} className="text-rose-500 shrink-0" />
                  <span className="text-[11px] text-slate-600 truncate">
                    {[incomingCall.customerAddress.street, incomingCall.customerAddress.city, incomingCall.customerAddress.state, incomingCall.customerAddress.postalCode].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Notice info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5 text-xs text-slate-600">
              <FiAlertCircle className="text-amber-500 shrink-0" size={15} />
              <span>Auto-routes to the next available agent if not accepted within 30 seconds.</span>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleDecline}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <FiPhoneOff size={16} /> Decline / Pass
              </button>
              <button
                onClick={handleAccept}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] animate-pulse"
              >
                <FiPhoneCall size={16} /> Accept Chat
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
