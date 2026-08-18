import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSmartphone, FiX, FiRefreshCw } from 'react-icons/fi';
import api from '../api/axios';
import { toast } from 'react-toastify';

const CheckoutOTPModal = ({ isOpen, onClose, onSuccess, targetPhone }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRefs = useRef([]);

  // Automatically request OTP when modal opens
  useEffect(() => {
    if (isOpen && targetPhone) {
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        setTimeout(() => inputRefs.current[0].focus(), 100);
      }
      sendOtp(true);
    }
  }, [isOpen, targetPhone]);

  const sendOtp = async (isInitial = false) => {
    try {
      if (!isInitial) setSending(true);
      await api.post('/api/otp/send', { phone: targetPhone });
      if (!isInitial) toast.success(`A new OTP has been sent to ${targetPhone}.`);
    } catch (err) {
      toast.error('Failed to send OTP. Please check the phone number.');
      if (isInitial) onClose(); // close if we can't even send it
    } finally {
      if (!isInitial) setSending(false);
    }
  };

  const handleChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').slice(0, 6).split('');
    if (pastedData.some(isNaN)) return;
    
    const newOtp = [...otp];
    pastedData.forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    
    // Focus last filled input
    const focusIndex = Math.min(pastedData.length, 5);
    if (focusIndex < 6) inputRefs.current[focusIndex].focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      return toast.error('Please enter the 6-digit OTP');
    }
    setLoading(true);
    try {
      await api.post('/api/otp/verify', { phone: targetPhone, otpCode: otpString });
      // Verification successful, call onSuccess
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(27,47,110,0.6)', backdropFilter: 'blur(8px)'
      }}>
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 420,
            padding: 32, boxShadow: 'var(--shadow-xl)', position: 'relative'
          }}
        >
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 8 }}>
            <FiX size={20} />
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FiSmartphone size={28} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: '0 0 8px' }}>
              Verify Phone Number
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              To confirm your Cash on Delivery order, please enter the 6-digit OTP sent to <strong style={{ color: 'var(--text-primary)' }}>{targetPhone}</strong>.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }} onPaste={handlePaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={e => handleChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  style={{
                    width: 44, height: 52, fontSize: 24, fontWeight: 700, textAlign: 'center',
                    background: 'var(--bg-alt)', border: '1.5px solid var(--border-color)', borderRadius: 12,
                    color: 'var(--text-primary)', outline: 'none', transition: 'all 0.2s',
                    boxShadow: digit ? '0 0 0 2px rgba(34, 197, 94, 0.1)' : 'none'
                  }}
                  onFocus={e => e.target.style.borderColor = '#22c55e'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otp.join('').length !== 6}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, opacity: (loading || otp.join('').length !== 6) ? 0.7 : 1, background: '#22c55e', borderColor: '#22c55e' }}
            >
              {loading ? 'Verifying...' : 'Verify & Place Order'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button
              type="button"
              onClick={() => sendOtp(false)}
              disabled={sending}
              style={{
                background: 'none', border: 'none', color: '#22c55e', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: sending ? 0.7 : 1
              }}
            >
              <FiRefreshCw size={12} className={sending ? 'animate-spin' : ''} />
              {sending ? 'Sending...' : 'Resend OTP'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CheckoutOTPModal;
