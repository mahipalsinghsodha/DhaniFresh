import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FiX, FiRotateCcw, FiCreditCard, FiRefreshCw,
  FiTruck, FiCheck, FiAlertTriangle
} from 'react-icons/fi'
import { formatOrderId } from '../utils/formatOrderId'

const REASONS = [
  'Changed my mind',
  'Ordered by mistake',
  'Found a better price / deal',
  'Delivery time is too long',
  'Other'
]

export default function CancelOrderModal({ order, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState('Changed my mind')
  const [customReason, setCustomReason] = useState('')

  if (!order) return null

  // Multi-source refund calculations
  const walletRefund = Number(order.walletUsed || 0) > 0
    ? Number(order.walletUsed)
    : (order.paymentMethod === 'Wallet' && order.isPaid ? Number(order.totalPrice || 0) : 0)

  const netPayable = Math.max(
    0,
    Number(order.totalPrice || 0) - Number(order.walletUsed || 0) - Number(order.giftCard?.amountUsed || 0)
  )
  const onlineRefund = (order.paymentMethod === 'Online' && order.isPaid && netPayable > 0)
    ? netPayable
    : 0

  const giftCardRefund = Number(order.giftCard?.amountUsed || 0)
  const isCOD = order.paymentMethod === 'COD'

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    if (loading) return
    const finalReason = reason === 'Other' ? (customReason.trim() || 'Other reason') : reason
    onConfirm(finalReason)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-lg overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-rose-50 text-rose-600 border border-rose-100/80 shadow-xs shrink-0">
              <FiAlertTriangle size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 font-display">Cancel Order?</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600">
                  #{formatOrderId(order)}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Please review your refund settlement summary.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-40"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Refund Details */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
              Refund & Settlement Breakdown
            </label>

            {walletRefund > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FiRotateCcw size={15} className="stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">Daatasa Wallet Credit</span>
                    <span className="text-xs font-extrabold text-emerald-700 font-mono">₹{walletRefund.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700/90 mt-0.5">
                    Will be credited <strong className="font-bold underline decoration-emerald-400">instantly</strong> back to your Daatasa Wallet.
                  </p>
                </div>
              </div>
            )}

            {onlineRefund > 0 && (
              <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/70 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FiCreditCard size={15} className="stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900">Bank / Original Payment Method</span>
                    <span className="text-xs font-extrabold text-blue-700 font-mono">₹{onlineRefund.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-blue-700/90 mt-0.5">
                    Refund initiated to your UPI/Card. Usually reflects in <strong className="font-bold">5–7 business days</strong>.
                  </p>
                </div>
              </div>
            )}

            {giftCardRefund > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FiRefreshCw size={15} className="stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">Gift Card Restored</span>
                    <span className="text-xs font-extrabold text-amber-800 font-mono">₹{giftCardRefund.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-amber-700/90 mt-0.5">
                    Amount restored to your Gift Card balance ({order.giftCard?.code}).
                  </p>
                </div>
              </div>
            )}

            {isCOD && walletRefund === 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FiTruck size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-900 block">Cash on Delivery</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    No payment was collected yet, so no monetary refund is necessary. Stock will be restored to inventory.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
              Why are you cancelling? <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {REASONS.map(r => {
                const isSelected = reason === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`w-full p-3 rounded-xl text-left text-xs sm:text-sm font-semibold transition-all flex items-center justify-between border ${
                      isSelected
                        ? 'bg-amber-50/60 border-amber-400 text-amber-900 shadow-xs'
                        : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{r}</span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <FiCheck size={11} className="stroke-[3]" />}
                    </div>
                  </button>
                )
              })}
            </div>

            {reason === 'Other' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Please describe your reason for cancellation..."
                  rows={2}
                  maxLength={200}
                  className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all bg-slate-50 text-slate-800 resize-none"
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-3 bg-slate-50/80 border-t border-slate-100 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="w-full py-3 px-4 text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 active:scale-[0.98]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Nevermind, Keep
          </button>
          <button
            type="button"
            disabled={loading || (reason === 'Other' && !customReason.trim())}
            onClick={handleSubmit}
            className="w-full py-3 px-4 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            style={{
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.25)'
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Confirm Cancel</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
