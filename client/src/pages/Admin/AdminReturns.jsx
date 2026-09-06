import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPackage, FiCheckCircle, FiRefreshCw,
  FiX, FiSearch, FiChevronDown, FiAlertCircle, FiShield,
  FiMapPin, FiPhone, FiUser, FiCamera, FiVideo, FiTruck,
  FiExternalLink, FiMaximize2, FiCopy, FiCheck
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import RestrictedAccess from '../../components/RestrictedAccess'

const fmtINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`

const AdminReturns = () => {
  const { hasPermission } = useAuth()
  
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [syncing, setSyncing] = useState(false)

  // Resolve Return Modal
  const [resolveModal, setResolveModal] = useState(null)
  const [adminNote, setAdminNote] = useState('')
  const [resolveStatus, setResolveStatus] = useState('') // 'APPROVED' or 'REJECTED'
  const [bookReversePickup, setBookReversePickup] = useState(true)

  // Media Preview Lightbox
  const [previewImage, setPreviewImage] = useState(null)
  const [copiedPhone, setCopiedPhone] = useState(null)

  useEffect(() => { 
    if (hasPermission('orders')) fetchReturns(true) 
  }, [hasPermission])

  const fetchReturns = async (showLoad = false) => {
    if (showLoad) setLoading(true); else setSyncing(true)
    try {
      const res = await api.get('/api/orders/admin/returns')
      setOrders(res.data)
    } catch { toast.error('Failed to load returns') }
    finally { setLoading(false); setSyncing(false) }
  }

  const handleResolve = async (e) => {
    e.preventDefault()
    setSyncing(true)
    try {
      await api.put(`/api/orders/${resolveModal._id}/return-status`, {
        status: resolveStatus,
        adminNote,
        bookReversePickup: resolveStatus === 'APPROVED' ? bookReversePickup : false
      })
      toast.success(`Return ${resolveStatus.toLowerCase()} successfully`)
      setResolveModal(null)
      setAdminNote('')
      fetchReturns(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update return')
    } finally {
      setSyncing(false)
    }
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedPhone(id)
    toast.info('Copied to clipboard!')
    setTimeout(() => setCopiedPhone(null), 2000)
  }

  const filteredOrders = orders.filter(o => {
    const q = search.toLowerCase()
    return (
      !q ||
      o._id.toLowerCase().includes(q) ||
      (o.orderIdString || '').toLowerCase().includes(q) ||
      (o.user?.name || '').toLowerCase().includes(q) ||
      (o.returnRequest?.pickupAddress?.phone || '').includes(q) ||
      (o.returnRequest?.reason || '').toLowerCase().includes(q)
    )
  })

  if (!hasPermission('orders')) return <RestrictedAccess title="Access Restricted" message="You don't have permission to manage orders." />

  if (loading) return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>
      <div style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-8 w-48 shimmer rounded mb-2" />
          <div className="h-5 w-64 shimmer rounded" />
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', padding: 20 }} className="h-20 shimmer" />
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>
      {/* ── Premium Admin Header ── */}
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.25) 0%, transparent 70%)', filter: 'blur(60px)', opacity: 0.7 }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full border mb-3"
                style={{ background: 'rgba(245,197,24,0.18)', color: 'var(--gold)', borderColor: 'rgba(245,197,24,0.35)' }}>
                <FiShield size={10} /> Admin Returns Center
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}>
                Customer Returns & Reverse Pickups
              </h1>
              <p className="text-xs text-white/60 mt-1">
                Verify customer unboxing proof, inspect photos/videos, and approve returns with Shiprocket reverse courier booking.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
                <FiSearch size={14} style={{ color: 'rgba(255,255,255,0.55)' }} className="shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by order, customer, phone…"
                  className="bg-transparent outline-none text-xs sm:text-sm w-48 sm:w-60"
                  style={{ color: '#FFF', caretColor: 'var(--gold)', fontFamily: 'var(--font)' }}
                />
              </div>
              <button
                onClick={() => fetchReturns(true)}
                disabled={syncing}
                className="flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.80)' }}
              >
                <FiRefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Return List */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {filteredOrders.length === 0 ? (
          <div style={{ padding: '80px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg-alt)', color: 'var(--text-muted)' }}>
              <FiRefreshCw size={28} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>No return requests found</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {search ? `No results matching "${search}"` : `All caught up! There are no pending return requests.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(o => {
              const isExp = expandedId === o._id
              const req = o.returnRequest || {}
              const rStatus = req.status || 'PENDING'
              const pickup = req.pickupAddress || o.shippingAddress || {}
              const hasMedia = (req.images?.length > 0) || Boolean(req.video)
              
              const statusColors = {
                PENDING: { color: '#B45309', bg: 'rgba(245,166,35,0.12)', border: 'rgba(245,166,35,0.3)' },
                APPROVED: { color: '#047857', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
                REJECTED: { color: '#B91C1C', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' }
              }
              const sColor = statusColors[rStatus] || statusColors.PENDING

              return (
                <div
                  key={o._id}
                  className="rounded-2xl border transition-all overflow-hidden bg-white dark:bg-slate-900 shadow-xs"
                  style={{ borderColor: isExp ? 'var(--brand-secondary, #F5A623)' : 'var(--border-color, #E2E8F0)' }}
                >
                  {/* Summary Bar */}
                  <div className="p-4 sm:p-5 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(isExp ? null : o._id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">
                          #{o.orderIdString || o._id.slice(-8).toUpperCase()}
                        </span>
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border"
                          style={{ background: sColor.bg, color: sColor.color, borderColor: sColor.border }}
                        >
                          {rStatus}
                        </span>

                        {hasMedia && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <FiCamera size={10} /> {req.images?.length || 0} Photo(s) {req.video && '• 🎬 Video'}
                          </span>
                        )}

                        {req.reverseShipment?.awbCode && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <FiTruck size={10} /> AWB: {req.reverseShipment.awbCode}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {o.user?.name || pickup.name || 'Customer'}
                        </span>
                        <span>•</span>
                        <span>Reason: <strong className="text-amber-800 dark:text-amber-400">{req.reason}</strong></span>
                        <span>•</span>
                        <span>{new Date(req.requestedAt || o.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-display">
                        {fmtINR(o.totalPrice)}
                      </p>
                      <span className="text-[11px] text-slate-400">Refund Amount</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExpandedId(isExp ? null : o._id); }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 border border-slate-200 dark:border-slate-700 text-slate-500"
                    >
                      <motion.div animate={{ rotate: isExp ? 180 : 0 }}>
                        <FiChevronDown size={16} />
                      </motion.div>
                    </button>
                  </div>

                  {/* Expanded Inspector Panel */}
                  <AnimatePresence>
                    {isExp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-[#FAF8F5]/60 dark:bg-slate-950/60 p-5 sm:p-6"
                      >
                        <div className="grid lg:grid-cols-3 gap-6">

                          {/* Column 1: Customer Return Issue & Media Proof */}
                          <div className="lg:col-span-2 space-y-5">
                            
                            {/* Return Statement */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                  Customer Return Statement
                                </h4>
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                  {req.reason}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 leading-relaxed font-medium">
                                {req.description || req.reason || 'No additional note provided by customer.'}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Requested at: {new Date(req.requestedAt).toLocaleString('en-IN')}
                              </p>
                            </div>

                            {/* Proof Photos Gallery */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <FiCamera className="text-amber-600" /> Proof Photos ({req.images?.length || 0})
                              </h4>

                              {req.images && req.images.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  {req.images.map((imgUrl, i) => (
                                    <div
                                      key={i}
                                      onClick={() => setPreviewImage(imgUrl)}
                                      className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer"
                                    >
                                      <img src={imgUrl} alt={`Proof ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <FiMaximize2 size={16} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No photos were uploaded by customer.</p>
                              )}
                            </div>

                            {/* Proof Video Player */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <FiVideo className="text-amber-600" /> 45s Unboxing / Defect Video
                              </h4>

                              {req.video ? (
                                <div className="space-y-2">
                                  <video
                                    src={req.video}
                                    controls
                                    preload="metadata"
                                    className="w-full max-h-72 rounded-xl bg-black border border-slate-200"
                                  >
                                    Your browser does not support the video tag.
                                  </video>
                                  <div className="flex justify-end">
                                    <a
                                      href={req.video}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1"
                                    >
                                      Open in New Tab <FiExternalLink size={12} />
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No video was uploaded by customer.</p>
                              )}
                            </div>

                            {/* Reverse Shipment Booking Pill (If already booked) */}
                            {req.reverseShipment?.awbCode && (
                              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200/80 space-y-2 text-purple-950">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold flex items-center gap-1.5 text-purple-900">
                                    <FiTruck size={14} /> Shiprocket Reverse Pickup Scheduled
                                  </span>
                                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">
                                    {req.reverseShipment.status}
                                  </span>
                                </div>
                                <div className="grid sm:grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-purple-600 block text-[10px]">AWB Code</span>
                                    <strong className="font-mono">{req.reverseShipment.awbCode}</strong>
                                  </div>
                                  <div>
                                    <span className="text-purple-600 block text-[10px]">Courier Partner</span>
                                    <strong>{req.reverseShipment.courierName || 'Assigned Courier'}</strong>
                                  </div>
                                  <div>
                                    <span className="text-purple-600 block text-[10px]">Shipment ID</span>
                                    <strong className="font-mono">{req.reverseShipment.shipmentId || '—'}</strong>
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>

                          {/* Column 2: Pickup Address & Resolution Action */}
                          <div className="space-y-5">
                            
                            {/* Doorstep Pickup Address Card */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                  <FiMapPin className="text-amber-600" /> Pickup Location
                                </h4>
                                <span className="text-[10px] text-slate-400">For Courier Pickup</span>
                              </div>

                              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <strong className="text-slate-900 dark:text-white font-bold text-sm">
                                    {pickup.name || o.user?.name || 'Customer'}
                                  </strong>
                                  {pickup.phone && (
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(pickup.phone, o._id)}
                                      className="text-amber-700 hover:text-amber-900 flex items-center gap-1 font-bold text-[11px]"
                                      title="Copy phone"
                                    >
                                      {copiedPhone === o._id ? <FiCheck size={12} className="text-emerald-600" /> : <FiCopy size={12} />}
                                      {pickup.phone}
                                    </button>
                                  )}
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                  {pickup.street}<br />
                                  {pickup.city}, {pickup.district ? `${pickup.district}, ` : ''}{pickup.state} - <strong>{pickup.zipCode}</strong>
                                </p>
                              </div>
                            </div>

                            {/* Order Items */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Returned Items
                              </h4>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {(o.orderItems || []).map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                                    <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-slate-800 truncate">{item.name}</p>
                                      <p className="text-slate-500 text-[11px]">{item.quantity} × ₹{item.price}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Action Buttons / Admin Resolution Note */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Return Decision
                              </h4>

                              {rStatus === 'PENDING' ? (
                                <div className="space-y-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => { setResolveModal(o); setResolveStatus('APPROVED'); setBookReversePickup(true); }}
                                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                                  >
                                    <FiCheckCircle size={14} /> Approve Return & Process Refund
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setResolveModal(o); setResolveStatus('REJECTED'); }}
                                    className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                  >
                                    <FiX size={14} /> Reject Return Request
                                  </button>
                                </div>
                              ) : (
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-700">Decision:</span>
                                    <span className="font-extrabold uppercase" style={{ color: sColor.color }}>{rStatus}</span>
                                  </div>
                                  {req.adminNote && (
                                    <p className="text-slate-600">Note: {req.adminNote}</p>
                                  )}
                                  <p className="text-[10px] text-slate-400">
                                    Resolved on: {new Date(req.resolvedAt || o.updatedAt).toLocaleString('en-IN')}
                                  </p>
                                </div>
                              )}
                            </div>

                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Resolve Return Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {resolveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${resolveStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {resolveStatus === 'APPROVED' ? <FiCheckCircle size={16} /> : <FiAlertCircle size={16} />}
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-display">
                    {resolveStatus === 'APPROVED' ? 'Approve Return Request' : 'Reject Return Request'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setResolveModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <FiX size={16} />
                </button>
              </div>

              <form onSubmit={handleResolve} className="space-y-4">
                {resolveStatus === 'APPROVED' ? (
                  <>
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-1">
                      <p className="font-bold">Automatic Execution on Approval:</p>
                      <p>• <strong>Refund:</strong> Online net amount refunded via Razorpay + wallet used refunded to Daatasa Wallet.</p>
                      <p>• <strong>Inventory:</strong> Product stock restored to inventory.</p>
                      <p>• <strong>Status:</strong> Order status updated to <code>RETURNED</code>.</p>
                    </div>

                    {/* Shiprocket Reverse Pickup Option */}
                    <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <input
                        type="checkbox"
                        checked={bookReversePickup}
                        onChange={e => setBookReversePickup(e.target.checked)}
                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="text-xs">
                        <strong className="text-slate-900 font-bold block">Schedule Shiprocket Reverse Pickup</strong>
                        <span className="text-slate-500 text-[11px]">
                          Automatically dispatch courier to pick up the package from customer's doorstep address.
                        </span>
                      </div>
                    </label>
                  </>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900">
                    <p className="font-bold mb-1">Reject Return</p>
                    <p>The customer will be notified that their return request was rejected along with your explanation note.</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {resolveStatus === 'APPROVED' ? 'Admin Note / Return Instructions (Optional)' : 'Rejection Reason *'}
                  </label>
                  <textarea
                    required={resolveStatus === 'REJECTED'}
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                    placeholder={resolveStatus === 'APPROVED' ? 'e.g. Approved. Please pack jar securely for courier pickup.' : 'e.g. Return window expired / Seal was tampered / No defect seen in video'}
                    className="w-full p-3.5 border border-slate-200 rounded-2xl text-xs sm:text-sm bg-white focus:border-amber-500 outline-none resize-none"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setResolveModal(null)}
                    className="flex-1 py-3 font-bold rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={syncing}
                    className={`flex-1 py-3 font-bold rounded-2xl text-white text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 ${
                      resolveStatus === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {syncing ? 'Processing…' : `Confirm ${resolveStatus === 'APPROVED' ? 'Approval' : 'Rejection'}`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Photo Lightbox Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {previewImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-black"
              onClick={e => e.stopPropagation()}
            >
              <img src={previewImage} alt="Enlarged Proof" className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors"
              >
                <FiX size={18} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default AdminReturns
