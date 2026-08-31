// client/src/components/chat/ChatBubble.jsx
// ── Ultra-Premium Daatasa In-App Support Message Bubble & Action Chips ────────
import { formatDistanceToNow } from 'date-fns'
import {
  Package, Truck, CheckCircle2, Clock, AlertTriangle,
  XCircle, Headphones, Bot, Sparkles, RotateCcw,
  ShoppingBag, HelpCircle, ArrowRight
} from 'lucide-react'

const STATUS_MAP = {
  DELIVERED:          { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)', label: 'Delivered', icon: CheckCircle2 },
  OUT_FOR_DELIVERY:   { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.3)', label: 'Out for Delivery', icon: Truck },
  SHIPPED:            { bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.3)', label: 'Shipped', icon: Truck },
  PICKED_UP:          { bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.3)', label: 'In Transit', icon: Truck },
  ASSIGNED_TO_COURIER:{ bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.3)', label: 'Courier Assigned', icon: Package },
  PROCESSING:         { bg: 'rgba(217, 165, 32, 0.14)', text: '#b45309', border: 'rgba(217, 165, 32, 0.35)', label: 'Processing', icon: Clock },
  ACCEPTED:           { bg: 'rgba(217, 165, 32, 0.14)', text: '#b45309', border: 'rgba(217, 165, 32, 0.35)', label: 'Accepted', icon: Clock },
  CONFIRMED:          { bg: 'rgba(217, 165, 32, 0.14)', text: '#b45309', border: 'rgba(217, 165, 32, 0.35)', label: 'Confirmed', icon: Clock },
  PENDING_ACCEPTANCE: { bg: 'rgba(217, 165, 32, 0.14)', text: '#b45309', border: 'rgba(217, 165, 32, 0.35)', label: 'Order Placed', icon: Clock },
  PAID:               { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)', label: 'Paid', icon: CheckCircle2 },
  PENDING:            { bg: 'rgba(217, 165, 32, 0.14)', text: '#b45309', border: 'rgba(217, 165, 32, 0.35)', label: 'Pending', icon: Clock },
  CANCELLED:          { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)', label: 'Cancelled', icon: XCircle },
  FAILED:             { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)', label: 'Failed', icon: AlertTriangle },
  RETURNED:           { bg: 'rgba(168, 85, 247, 0.12)', text: '#9333ea', border: 'rgba(168, 85, 247, 0.3)', label: 'Returned', icon: RotateCcw },
}

// ── Helper: Format Markdown text (bold **text**, bullets •, newlines) ─────────
function FormattedText({ text, isUser = false }) {
  if (!text) return null

  const lines = text.split('\n')

  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} className="h-1" />
        }

        // Parse **bold** markers
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
              className={isUser ? "font-bold text-white" : "font-bold text-gray-900 dark:text-white"}
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
            className={`leading-relaxed text-[13.5px] ${isBullet ? 'pl-2 text-gray-700 dark:text-gray-300' : ''}`}
          >
            {parts}
          </div>
        )
      })}
    </div>
  )
}

function cleanOptionText(text) {
  if (!text) return ''
  // Strip leading emojis and whitespace
  return text.replace(/^[\p{Emoji}\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '').trim()
}

export default function ChatBubble({ message, onQuickReply }) {
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
      <div className="text-center py-1.5 my-1">
        <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-full px-3.5 py-1 inline-block font-medium shadow-2xs">
          {content}
        </span>
      </div>
    )
  }

  // Quick reply options from metadata
  const quickReplyOptions = (messageType === 'QUICK_REPLY' || messageType === 'ORDER_CARD') && metadata?.options?.length > 0
    ? metadata.options
    : null

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Bot / Agent Avatar */}
      {!isUser && (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs text-white ${
          isBot ? 'bg-gradient-to-br from-amber-500 to-amber-700' : 'bg-gradient-to-br from-blue-600 to-indigo-700'
        }`}>
          {isBot ? <Bot size={16} /> : <Headphones size={15} />}
        </div>
      )}

      <div className={`max-w-[90%] sm:max-w-[82%] flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Sender name label */}
        {!isUser && (
          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-400 pl-1">
            {senderName || (isBot ? 'Daatasa Assistant' : 'Support Agent')}
          </span>
        )}

        {/* ── Order Card in Chat ─────────────────────────────────────────── */}
        {messageType === 'ORDER_CARD' && metadata?.orderId ? (
          <div className="bg-white dark:bg-gray-800/95 border border-amber-200/80 dark:border-gray-700 rounded-2xl p-4 w-full shadow-sm">
            {/* Header: Order ID & Status Badge */}
            <div className="flex justify-between items-center pb-2.5 mb-2.5 border-b border-gray-100 dark:border-gray-700/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Package size={15} />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold block leading-tight">
                    Order Summary
                  </span>
                  <div className="font-mono text-sm font-extrabold text-gray-900 dark:text-white">
                    #{String(metadata.orderId).slice(-6).toUpperCase()}
                  </div>
                </div>
              </div>

              {(() => {
                const s = STATUS_MAP[metadata.status] || STATUS_MAP[metadata.paymentStatus] || {
                  bg: 'rgba(217, 165, 32, 0.12)',
                  text: '#b45309',
                  border: 'rgba(217, 165, 32, 0.3)',
                  label: metadata.statusLabel || metadata.status,
                  icon: Package
                }
                const IconComponent = s.icon || Package
                return (
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 border shadow-2xs"
                    style={{ background: s.bg, color: s.text, borderColor: s.border }}
                  >
                    <IconComponent size={12} />
                    {s.label}
                  </span>
                )
              })()}
            </div>

            {/* Tracking banner if present */}
            {metadata.trackingNumber && (
              <div className="mb-3 p-2.5 px-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/50 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-gray-600 dark:text-gray-300 font-medium">{metadata.shippingProvider || 'Courier'}:</span>
                  <strong className="font-mono text-gray-900 dark:text-white font-bold">{metadata.trackingNumber}</strong>
                </div>
              </div>
            )}

            {/* Items preview list */}
            {metadata.items?.length > 0 && (
              <div className="mb-3 p-3 bg-gray-50/90 dark:bg-gray-900/60 rounded-xl flex flex-col gap-2 border border-gray-100 dark:border-gray-800">
                {metadata.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-8 h-8 rounded-lg object-cover border border-gray-200 dark:border-gray-700 shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-amber-100/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-bold shrink-0 border border-amber-200 dark:border-amber-800">
                          🫙
                        </div>
                      )}
                      <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[170px] sm:max-w-[200px]">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium">
                        Qty: {item.quantity || 1}
                      </span>
                      {item.price && (
                        <span className="font-bold text-gray-800 dark:text-gray-200 text-xs">
                          ₹{Number(item.price).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {metadata.totalPrice != null && (
                  <div className="border-t border-gray-200/80 dark:border-gray-700/80 pt-2 mt-1 flex justify-between items-center font-bold text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Order Total</span>
                    <span className="text-amber-800 dark:text-amber-400 text-sm font-black">
                      ₹{typeof metadata.totalPrice === 'number'
                        ? metadata.totalPrice.toLocaleString('en-IN')
                        : String(metadata.totalPrice).replace(/[^0-9.]/g, '')
                          ? Number(String(metadata.totalPrice).replace(/,/g, '')).toLocaleString('en-IN')
                          : metadata.totalPrice}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Content text */}
            {content && (
              <div className="text-gray-800 dark:text-gray-200 text-[13.5px] pt-1">
                <FormattedText text={content} isUser={false} />
              </div>
            )}
          </div>
        ) : messageType === 'IMAGE' ? (
          <div className={`p-1 rounded-2xl shadow-xs ${isUser ? 'bg-amber-600' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
            <img src={content} alt="Attachment" className="max-w-[240px] max-h-[280px] rounded-xl object-cover block" />
          </div>
        ) : (
          /* ── Regular text bubble ─────────────────────────────────────── */
          <div className={`p-3.5 px-4 text-[13.5px] rounded-2xl shadow-xs leading-relaxed ${
            isUser
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-br-xs'
              : 'bg-white dark:bg-gray-800/95 text-gray-900 dark:text-gray-100 border border-gray-200/80 dark:border-gray-700/80 rounded-bl-xs'
          }`}>
            <FormattedText text={content} isUser={isUser} />
          </div>
        )}

        {/* ── Quick Reply Action Buttons (Uniform Clean Pill Buttons, Text Only) ─ */}
        {quickReplyOptions && onQuickReply && (
          <div className="flex flex-wrap gap-2 mt-2 w-full">
            {quickReplyOptions.map((opt, i) => {
              const cleanLabel = cleanOptionText(opt)

              return (
                <button
                  key={i}
                  onClick={() => onQuickReply(opt)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-slate-700 hover:border-amber-500 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50/50 dark:hover:bg-slate-700/50 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center text-center"
                >
                  <span>{cleanLabel || opt}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-gray-400 px-1 font-medium">
          {timeAgo}
        </span>
      </div>
    </div>
  )
}
