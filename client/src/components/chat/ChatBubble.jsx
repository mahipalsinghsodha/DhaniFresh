// frontend/src/components/chat/ChatBubble.jsx
// Renders a single chat message bubble
// Supports: USER, AGENT, BOT, SYSTEM message types
// Supports: TEXT, IMAGE, ORDER_CARD, QUICK_REPLY message types

import { formatDistanceToNow } from 'date-fns'
import { Package, Truck, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react'

const STATUS_MAP = {
  DELIVERED:          { bg: 'rgba(16,185,129,0.12)', text: '#10b981', border: 'rgba(16,185,129,0.3)', label: 'Delivered', icon: CheckCircle2 },
  OUT_FOR_DELIVERY:   { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)', label: 'Out for Delivery', icon: Truck },
  SHIPPED:            { bg: 'rgba(99,102,241,0.12)', text: '#6366f1', border: 'rgba(99,102,241,0.3)', label: 'Shipped (In Transit)', icon: Package },
  PICKED_UP:          { bg: 'rgba(99,102,241,0.12)', text: '#6366f1', border: 'rgba(99,102,241,0.3)', label: 'Shipped', icon: Package },
  ASSIGNED_TO_COURIER:{ bg: 'rgba(99,102,241,0.12)', text: '#6366f1', border: 'rgba(99,102,241,0.3)', label: 'Assigned to Courier', icon: Package },
  PROCESSING:         { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: 'Processing', icon: Clock },
  ACCEPTED:           { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: 'Order Accepted', icon: Clock },
  CONFIRMED:          { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: 'Confirmed', icon: Clock },
  PENDING_ACCEPTANCE: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: 'Order Placed', icon: Clock },
  PAID:               { bg: 'rgba(16,185,129,0.12)', text: '#10b981', border: 'rgba(16,185,129,0.3)', label: 'Paid', icon: CheckCircle2 },
  PENDING:            { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: 'Pending', icon: Clock },
  CANCELLED:          { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', border: 'rgba(239,68,68,0.3)', label: 'Cancelled', icon: XCircle },
  FAILED:             { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', border: 'rgba(239,68,68,0.3)', label: 'Failed', icon: AlertTriangle },
  RETURNED:           { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', border: 'rgba(168,85,247,0.3)', label: 'Returned', icon: Package },
}

// ── Helper: Format Markdown text (bold **text**, bullets •, newlines) ─────────
function FormattedText({ text, isUser = false }) {
  if (!text) return null

  const lines = text.split('\n')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} style={{ height: '6px' }} />
        }

        // Parse **bold** markers within this line
        const parts = []
        const regex = /\*\*(.*?)\*\*/g
        let lastIdx = 0
        let match

        while ((match = regex.exec(line)) !== null) {
          if (match.index > lastIdx) {
            parts.push(line.substring(lastIdx, match.index))
          }
          parts.push(
            <strong
              key={`b-${lineIdx}-${match.index}`}
              style={{
                fontWeight: 700,
                color: isUser ? '#ffffff' : 'inherit',
              }}
            >
              {match[1]}
            </strong>
          )
          lastIdx = match.index + match[0].length
        }

        if (lastIdx < line.length) {
          parts.push(line.substring(lastIdx))
        }

        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-')

        return (
          <div
            key={lineIdx}
            style={{
              paddingLeft: isBullet ? '2px' : '0px',
              lineHeight: 1.55,
            }}
          >
            {parts}
          </div>
        )
      })}
    </div>
  )
}

export default function ChatBubble({ message, currentUserId, onQuickReply }) {
  const { senderType, senderName, content, messageType, metadata, createdAt } = message

  const isUser   = senderType === 'USER'
  const isSystem = senderType === 'SYSTEM'
  const isBot    = senderType === 'BOT'

  const timeAgo = createdAt
    ? formatDistanceToNow(new Date(createdAt), { addSuffix: true })
    : ''

  // ── System message (centered, muted) ──────────────────────────────────────
  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        <span style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          background: 'var(--bg-alt)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '4px 14px',
          display: 'inline-block',
          fontFamily: 'var(--font)',
          fontWeight: 500,
        }}>
          {content}
        </span>
      </div>
    )
  }

  // ── Avatar for bot/agent ───────────────────────────────────────────────────
  const avatar = isBot ? '🫙' : '👤'

  // Quick reply options can come from QUICK_REPLY message or ORDER_CARD metadata
  const quickReplyOptions = (messageType === 'QUICK_REPLY' || messageType === 'ORDER_CARD') && metadata?.options?.length > 0
    ? metadata.options
    : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: '8px',
    }}>
      {/* Avatar (only for bot/agent) */}
      {!isUser && (
        <div style={{
          width: '34px', height: '34px',
          borderRadius: '50%',
          background: isBot ? 'var(--brand-gradient)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', color: '#fff',
          flexShrink: 0,
          boxShadow: 'var(--shadow-sm)',
        }}>
          {avatar}
        </div>
      )}

      <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: '5px' }}>
        {/* Sender name */}
        {!isUser && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '4px', fontWeight: 600, fontFamily: 'var(--font)' }}>
            {senderName}
          </span>
        )}

        {/* ── Order Card ──────────────────────────────────────────────────── */}
        {messageType === 'ORDER_CARD' && metadata?.orderId ? (
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1.5px solid var(--border-color, rgba(0,0,0,0.08))',
            borderRadius: '16px',
            padding: '16px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          }}>
            {/* Header: Order ID & Status Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Order
                </span>
                <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  #{String(metadata.orderId).slice(-6).toUpperCase()}
                </div>
              </div>

              {(() => {
                const s = STATUS_MAP[metadata.status] || STATUS_MAP[metadata.paymentStatus] || { bg: 'var(--bg-alt)', text: 'var(--text-muted)', border: 'transparent', label: metadata.statusLabel || metadata.status, icon: Package }
                const IconComponent = s.icon || Package
                return (
                  <span style={{
                    background: s.bg,
                    color: s.text,
                    border: `1px solid ${s.border}`,
                    borderRadius: '20px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <IconComponent size={12} />
                    {s.label}
                  </span>
                )
              })()}
            </div>

            {/* Tracking Banner if available */}
            {metadata.trackingNumber && (
              <div style={{
                marginBottom: '12px',
                padding: '8px 12px',
                background: 'rgba(245,166,35,0.06)',
                border: '1px solid rgba(245,166,35,0.25)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={14} style={{ color: 'var(--gold, #d97706)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>{metadata.shippingProvider || 'Courier'}:</span>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{metadata.trackingNumber}</strong>
                </div>
              </div>
            )}

            {/* Items Preview */}
            {metadata.items?.length > 0 && (
              <div style={{
                marginBottom: '12px',
                padding: '10px',
                background: 'var(--bg-alt, rgba(0,0,0,0.02))',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                {metadata.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      {item.image ? (
                        <img src={item.image} alt={item.name} style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(245,166,35,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>🫙</div>
                      )}
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                        {item.name}
                      </span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>
                      Qty: {item.quantity || 1}
                    </span>
                  </div>
                ))}
                {metadata.items.length > 3 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>
                    +{metadata.items.length - 3} more items
                  </span>
                )}
                {metadata.totalPrice != null && (
                  <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Amount</span>
                    <span style={{ color: 'var(--text-primary)' }}>₹{Number(metadata.totalPrice).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Content text rendered with bold markdown support */}
            {content && (
              <div style={{
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                lineHeight: 1.55,
                fontFamily: 'var(--font)',
                wordBreak: 'break-word',
              }}>
                <FormattedText text={content} isUser={false} />
              </div>
            )}
          </div>
        ) : messageType === 'IMAGE' ? (
          <div style={{
            background: isUser ? 'var(--brand-gradient)' : isBot ? 'var(--bg-alt)' : 'var(--bg-surface)',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            padding: '4px',
            boxShadow: isUser ? 'var(--shadow-brand)' : 'var(--shadow-sm)',
            border: !isUser && !isBot ? '1.5px solid var(--border-color)' : 'none',
          }}>
            <img src={content} alt="Attachment" style={{ maxWidth: '240px', maxHeight: '300px', borderRadius: '14px', objectFit: 'cover', display: 'block' }} />
          </div>
        ) : (
          /* ── Regular text bubble rendered with bold markdown support ─────── */
          <div style={{
            background: isUser
              ? 'var(--brand-gradient)'
              : isBot
                ? 'var(--bg-alt)'
                : 'var(--bg-surface)',
            color: isUser ? '#fff' : 'var(--text-primary)',
            borderRadius: isUser
              ? '18px 18px 4px 18px'
              : '18px 18px 18px 4px',
            padding: '11px 16px',
            fontSize: '14px',
            lineHeight: 1.55,
            boxShadow: isUser ? 'var(--shadow-brand)' : 'var(--shadow-sm)',
            border: !isUser && !isBot ? '1.5px solid var(--border-color)' : 'none',
            wordBreak: 'break-word',
            fontFamily: 'var(--font)',
          }}>
            <FormattedText text={content} isUser={isUser} />
          </div>
        )}

        {/* ── Quick Reply Action Buttons ────────────────────────────────────── */}
        {quickReplyOptions && onQuickReply && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '6px', width: '100%' }}>
            {quickReplyOptions.map((opt, i) => (
              <button
                key={i}
                onClick={() => onQuickReply(opt)}
                style={{
                  background: 'var(--bg-surface, #ffffff)',
                  border: '1.5px solid var(--brand-secondary, #f59e0b)',
                  color: 'var(--brand-secondary, #d97706)',
                  borderRadius: '20px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 2px 6px rgba(245,158,11,0.08)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(245,158,11,0.12)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--bg-surface, #ffffff)'
                  e.currentTarget.style.transform = 'none'
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '4px', paddingRight: '4px', fontFamily: 'var(--font)' }}>
          {timeAgo}
        </span>
      </div>
    </div>
  )
}
