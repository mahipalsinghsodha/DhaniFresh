import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPackage, FiCheckCircle, FiTruck, FiRefreshCw,
  FiPrinter, FiX, FiSearch, FiChevronDown, FiTag,
  FiUser, FiMapPin, FiCalendar, FiAlertCircle, FiShield,
  FiBox, FiCheckSquare, FiSquare, FiDownload
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import RestrictedAccess from '../../components/RestrictedAccess'
import { useSocket } from '../../hooks/useSocket'
import { useConfirm } from '../../context/ConfirmContext'
import { formatOrderId } from '../../utils/formatOrderId'
import Pagination from '../../components/Pagination'

const fmtINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`
const qrUrl = (data, size = 120) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=6`

const getStatus = (o) => {
  if (o.isDelivered || o.orderStatus === 'DELIVERED') return { label: 'Delivered', color: 'var(--success)', bg: 'rgba(56,161,105,0.08)', border: 'rgba(56,161,105,0.25)' }
  if (o.orderStatus === 'CANCELLED' || o.paymentStatus === 'CANCELLED') return { label: 'Cancelled', color: 'var(--text-muted)', bg: 'var(--bg-alt)', border: 'var(--border-color)' }
  if (o.paymentStatus === 'FAILED') return { label: 'Failed', color: 'var(--danger)', bg: 'rgba(229,62,62,0.08)', border: 'rgba(229,62,62,0.25)' }
  if (o.paymentStatus === 'RETURN_APPROVED') return { label: 'Returned', color: 'var(--warning)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' }
  if (o.orderStatus === 'OUT_FOR_DELIVERY') return { label: 'Out for Delivery', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)' }
  if (['SHIPPED', 'PICKED_UP', 'ASSIGNED_TO_COURIER'].includes(o.orderStatus) || !!o.trackingNumber) return { label: 'Shipped', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.25)' }
  if (o.orderStatus === 'ACCEPTED') return { label: 'Accepted', color: 'var(--brand-secondary)', bg: 'rgba(30,58,138,0.08)', border: 'rgba(30,58,138,0.25)' }
  return { label: 'Pending Acceptance', color: 'var(--warning)', bg: 'rgba(245,166,35,0.12)', border: 'rgba(245,166,35,0.25)' }
}

const StatusBadge = ({ order }) => {
  const s = getStatus(order)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
      borderRadius: 99, fontSize: 11, fontWeight: 800, background: s.bg, color: s.color, border: `1.5px solid ${s.border}`
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  )
}

const INV_CSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#fff;color:#111827}.inv{max-width:760px;margin:0 auto;padding:40px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #F5A623;padding-bottom:16px;margin-bottom:24px}.brand{font-size:22px;font-weight:800;color:#1B2F6E}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#f9fafb;padding:10px;text-align:left;font-size:12px}td{padding:10px;font-size:13px;border-bottom:1px solid #f3f4f6}.total{font-size:16px;font-weight:700;color:#F5A623}@media print{button{display:none}}`
const openPrint = (body, title) => {
  const w = window.open('', '_blank')
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${INV_CSS}</style></head><body>${body}<button onclick="window.print()" style="margin:20px;padding:10px 24px;background:#1B2F6E;color:#fff;border:none;border-radius:8px;cursor:pointer">Print</button></body></html>`)
  w.document.close()
}
const invoiceHTML = (o) => `<div class="inv"><div class="head"><div><div class="brand">Daatasa</div><div style="color:#6b7280;font-size:13px">Premium Quality</div></div><div style="text-align:right"><div style="font-size:16px;font-weight:700">TAX INVOICE</div><div style="color:#F5A623;font-weight:700">#${o._id.slice(-10).toUpperCase()}</div><div style="font-size:12px;color:#6b7280">${new Date(o.createdAt).toLocaleDateString('en-IN')}</div></div></div><div style="display:flex;justify-content:space-between;margin-bottom:24px"><div><p style="font-size:11px;color:#9ca3af;font-weight:700;margin-bottom:6px">SHIP TO</p><strong>${o.user?.name||'Customer'}</strong><br/>${o.shippingAddress?.street||''}, ${o.shippingAddress?.city||''}<br/>${o.shippingAddress?.state||''} - ${o.shippingAddress?.zipCode||''}</div><img src="${qrUrl(`ORDER:${o._id}`,90)}" width="80" height="80"/></div><table><thead><tr><th>Item</th><th>Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead><tbody>${(o.orderItems||[]).map(i=>`<tr><td>${i.name}</td><td>${i.quantity}</td><td style="text-align:right">₹${Number(i.price).toFixed(2)}</td><td style="text-align:right">₹${(i.price*i.quantity).toFixed(2)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">Subtotal</td><td style="text-align:right">₹${Number(o.itemsPrice||0).toFixed(2)}</td></tr><tr><td colspan="3">Tax</td><td style="text-align:right">₹${Number(o.taxPrice||0).toFixed(2)}</td></tr><tr><td colspan="3">Shipping</td><td style="text-align:right">₹${Number(o.shippingPrice||0).toFixed(2)}</td></tr><tr class="total"><td colspan="3"><strong>Total</strong></td><td style="text-align:right"><strong>₹${Number(o.totalPrice||0).toFixed(2)}</strong></td></tr></tfoot></table></div>`

const shippingLabelHTML = (o) => {
  const qrLink = `${window.location.origin}/courier/scan?orderId=${o._id}`;
  return `<div style="width: 4in; height: 6in; padding: 20px; border: 2px solid #000; font-family: sans-serif; position: relative; margin: 0 auto;">
    <h1 style="font-size: 24px; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 10px; margin: 0 0 20px 0; display: flex; justify-content: space-between;">
      <span>DAATASA</span>
      <span style="font-size: 14px; font-weight: bold; padding: 4px 8px; border: 2px solid #000; border-radius: 4px;">${o.paymentMethod === 'COD' ? 'COD' : 'PREPAID'}</span>
    </h1>
    <div style="font-size: 16px; margin-bottom: 20px;">
      <p style="font-size: 12px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">Ship To:</p>
      <p style="font-weight: 900; font-size: 18px; margin: 0;">${o.user?.name || o.shippingAddress?.name || 'Customer'}</p>
      <p style="margin: 4px 0 0 0;">${o.shippingAddress?.street || ''}</p>
      <p style="margin: 4px 0 0 0;">${o.shippingAddress?.city || ''}, ${o.shippingAddress?.state || ''} - <strong>${o.shippingAddress?.zipCode || ''}</strong></p>
      <p style="margin: 4px 0 0 0;">Ph: ${o.shippingAddress?.phone || o.user?.phone || 'N/A'}</p>
    </div>
    <div style="border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 15px 0; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <p style="font-size: 12px; font-weight: bold; margin: 0 0 4px 0;">ORDER #${formatOrderId(o)}</p>
        <p style="font-size: 12px; margin: 0 0 4px 0;">Date: ${new Date(o.createdAt).toLocaleDateString('en-IN')}</p>
        <p style="font-size: 12px; margin: 0 0 4px 0;">Items: ${o.orderItems?.length || 0}</p>
        <p style="font-size: 14px; font-weight: 900; margin: 10px 0 0 0;">Collect Amount: ${o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID' ? '₹' + Number(o.totalPrice).toFixed(2) : '₹0.00'}</p>
      </div>
      <img src="${qrUrl(qrLink, 120)}" width="100" height="100" style="border: 2px solid #000; padding: 4px;" />
    </div>
    <div style="font-size: 12px;">
      <p style="font-weight: bold; margin: 0 0 4px 0;">Return Address:</p>
      <p style="margin: 0;">Daatasa Organics, 123 Main St, City, State - 123456</p>
    </div>
    <div style="position: absolute; bottom: 20px; width: calc(100% - 40px); text-align: center; font-size: 12px; font-weight: bold;">
      Scan QR to update status
    </div>
  </div>`;
}


const ManageOrders = () => {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const socket = useSocket()
  
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  
  const [limit, setLimit] = useState(20)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)

  const [selectedOrders, setSelectedOrders] = useState(new Set())

  const [cancelModal, setCancelModal] = useState(null)
  const [trackingModal, setTrackingModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [trackingNum, setTrackingNum] = useState('')
  const [shippingProv, setShippingProv] = useState('')

  const getDaysAgo = (days) => {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString().split('T')[0]
  }

  const downloadInvoice = async (orderId) => {
    try {
      const res = await api.get(`/api/invoices/${orderId}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `INV-${orderId.slice(-8).toUpperCase()}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) { 
      toast.error('Could not download invoice') 
    }
  }
  const [startDate, setStartDate] = useState(getDaysAgo(30))
  const [endDate, setEndDate] = useState(getDaysAgo(0))

  const fetchOrders = async (
    showLoad = false,
    pg = page,
    currentLimit = limit,
    currentFilter = filter,
    currentSearch = search,
    start = startDate,
    end = endDate
  ) => {
    if (showLoad) setLoading(true); else setSyncing(true)
    try {
      const res = await api.get(`/api/orders?page=${pg}&limit=${currentLimit}&filter=${currentFilter}&search=${encodeURIComponent(currentSearch)}&startDate=${start}&endDate=${end}`)
      setOrders(res.data.orders || [])
      if (res.data.pages !== undefined) setTotalPages(res.data.pages)
      if (res.data.total !== undefined) setTotalOrders(res.data.total)
      if (res.data.page && res.data.page !== pg) {
        setPage(res.data.page)
      }
    } catch { 
      toast.error('Failed to load orders') 
    } finally { 
      setLoading(false)
      setSyncing(false) 
    }
  }

  useEffect(() => { 
    if (hasPermission('orders')) {
      fetchOrders(orders.length === 0, page, limit, filter, search, startDate, endDate)
    }
  }, [hasPermission, page, limit, filter, search])

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/api/orders/export/csv', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'orders_export.csv')
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
    } catch {
      toast.error('Failed to export orders')
    }
  }

  const markPaid = async (id) => {
    if (!(await confirm('Mark this order as PAID?'))) return
    try { await api.put(`/api/orders/${id}/pay`); fetchOrders(false, page); toast.success('Order marked as paid') }
    catch { toast.error('Failed to update') }
  }

  const markAccepted = async (id) => {
    if (!(await confirm('Accept this order?'))) return
    try { await api.put(`/api/orders/${id}/accept`); fetchOrders(false, page); toast.success('Order accepted') }
    catch { toast.error('Failed to accept order') }
  }

  const markDelivered = async (id) => {
    if (!(await confirm('Mark this order as DELIVERED? This cannot be undone.'))) return
    try { await api.put(`/api/orders/${id}/deliver`); fetchOrders(false, page); toast.success('Order marked as delivered') }
    catch { toast.error('Failed to update') }
  }

  const handleCancel = async (reason) => {
    setSubmitting(true)
    try { await api.post(`/api/orders/${cancelModal._id}/cancel`, { reason }); toast.success('Order cancelled'); setCancelModal(null); fetchOrders(false, page) }
    catch { toast.error('Cancellation failed') }
    finally { setSubmitting(false) }
  }

  const handleAddTracking = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.put(`/api/orders/${trackingModal._id}/ship`, { trackingNumber: trackingNum, shippingProvider: shippingProv })
      toast.success('Tracking info added and order shipped!')
      setTrackingModal(null)
      setTrackingNum('')
      setShippingProv('')
      fetchOrders(false, page)
    } catch { toast.error('Failed to add tracking') }
    finally { setSubmitting(false) }
  }

  const handleApproveReturn = async (id) => {
    if (!(await confirm('Approve this return? A refund will be initiated if paid online.'))) return
    setSyncing(true)
    try {
      await api.put(`/api/admin/return-requests/${id}`, { status: 'APPROVED' })
      toast.success('Return approved & refund initiated')
      fetchOrders(false, page)
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to approve return') }
    finally { setSyncing(false) }
  }

  const handleShipWithShiprocket = async (id) => {
    if (!(await confirm('Dispatch this order via Shiprocket (Delhivery / BlueDart)? This will assign courier, generate AWB tracking, and mark as Shipped.'))) return
    setSyncing(true)
    try {
      const res = await api.post(`/api/shiprocket/ship/${id}`)
      toast.success(res.data.message || 'Dispatched via Shiprocket successfully!')
      fetchOrders(false, page)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch via Shiprocket')
    } finally {
      setSyncing(false)
    }
  }

  const handleBulkAction = async (action) => {
    if (selectedOrders.size === 0) return
    if (action === 'print') {
      const labelsHtml = Array.from(selectedOrders).map(id => {
        const o = orders.find(x => x._id === id);
        return o ? shippingLabelHTML(o) : '';
      }).join('<div style="page-break-after: always;"></div>');
      openPrint(labelsHtml, 'Bulk Shipping Labels');
      setSelectedOrders(new Set());
      return;
    }

    const actionText = action === 'pay' ? 'PAID' : action === 'accept' ? 'ACCEPTED' : 'DELIVERED'
    if (!(await confirm(`Mark ${selectedOrders.size} orders as ${actionText}?`))) return
    
    setSyncing(true)
    try {
      await api.put('/api/orders/bulk/update', { orderIds: Array.from(selectedOrders), action })
      toast.success(`Orders marked as ${actionText.toLowerCase()}`)
      setSelectedOrders(new Set())
      fetchOrders(false, page)
    } catch { toast.error('Bulk update failed') }
    finally { setSyncing(false) }
  }

  const toggleSelection = (id) => {
    const newSet = new Set(selectedOrders)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedOrders(newSet)
  }

  const toggleAll = () => {
    if (selectedOrders.size === filteredOrders.length) setSelectedOrders(new Set())
    else setSelectedOrders(new Set(filteredOrders.map(o => o._id)))
  }

  const isVoid = (o) => ['CANCELLED', 'FAILED'].includes(o.paymentStatus)

  const filteredOrders = orders;

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
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', padding: 20 }} className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 shimmer rounded" />
              <div className="h-3 w-48 shimmer rounded" />
            </div>
            <div className="h-6 w-20 shimmer rounded-full" />
            <div className="h-8 w-24 shimmer rounded-xl" />
          </div>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full border mb-3"
                style={{ background: 'rgba(245,197,24,0.18)', color: 'var(--gold)', borderColor: 'rgba(245,197,24,0.35)' }}>
                <FiShield size={10} /> Admin Panel
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}>Manage Orders</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.80)' }}>
                <FiCalendar size={14} className="shrink-0" />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent outline-none text-xs" style={{ color: '#FFF' }} />
                <span>to</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent outline-none text-xs" style={{ color: '#FFF' }} />
                <button onClick={() => {
                  const s = new Date(startDate);
                  const e = new Date(endDate);
                  if (e < s) return toast.error('End date cannot be before start date');
                  const diffTime = Math.abs(e - s);
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                  if (diffDays > 365) return toast.error('Date range cannot exceed 1 year (365 days)');
                  setPage(1);
                  fetchOrders(true, 1, filter, search, startDate, endDate);
                }} className="ml-2 font-bold px-2 py-1 rounded bg-[var(--gold)] text-black text-xs">Apply</button>
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
                <FiSearch size={14} style={{ color: 'rgba(255,255,255,0.55)' }} className="shrink-0" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search orders…"
                  className="bg-transparent outline-none text-sm w-32 sm:w-48" style={{ color: '#FFF', caretColor: 'var(--gold)', fontFamily: 'var(--font)' }} />
              </div>
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#FFF' }}>
                <FiDownload size={14} /> <span className="hidden xl:inline">Export</span>
              </button>
              <button onClick={() => fetchOrders(true, page, limit, filter, search, startDate, endDate)} disabled={syncing}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.80)' }}>
                <FiRefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { v: 'all',       l: 'All' },
              { v: 'pending',   l: 'Pending' },
              { v: 'accepted',  l: 'Accepted' },
              { v: 'cod',       l: 'COD' },
              { v: 'paid',      l: 'Paid' },
              { v: 'delivered', l: 'Delivered' },
              { v: 'cancelled', l: 'Cancelled' },
            ].map(({ v, l }) => (
              <button key={v} onClick={() => { setFilter(v); setPage(1); }}
                className="whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                style={filter === v
                  ? { background: 'var(--gold)', color: 'var(--navy)', border: 'none' }
                  : { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.75)' }
                }>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedOrders.size > 0 && (() => {
        const selectedList = orders.filter(o => selectedOrders.has(o._id));
        const hasPending = selectedList.some(o => o.orderStatus === 'PENDING_ACCEPTANCE' && !isVoid(o));
        const hasUnpaid = selectedList.some(o => !o.isPaid && !isVoid(o));
        const hasUndelivered = selectedList.some(o => !o.isDelivered && !isVoid(o) && (o.orderStatus === 'ACCEPTED' || o.orderStatus === 'SHIPPED'));
        const hasValid = selectedList.some(o => !isVoid(o));

        return (
          <div className="sticky top-[72px] z-30 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3 mb-2 bg-white dark:bg-gray-800 shadow-sm border-b rounded-b-2xl flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
              {selectedOrders.size} order(s) selected
            </span>
            <div className="flex flex-wrap gap-2">
              {hasPending && (
                <button onClick={() => handleBulkAction('accept')} className="btn btn-primary text-xs px-3 py-1.5 h-auto">Accept Orders</button>
              )}
              {hasValid && (
                <button onClick={() => handleBulkAction('print')} className="btn btn-secondary text-xs px-3 py-1.5 h-auto">Print Labels</button>
              )}
              {hasUnpaid && (
                <button onClick={() => handleBulkAction('pay')} className="btn btn-secondary text-xs px-3 py-1.5 h-auto">Mark Paid</button>
              )}
              {hasUndelivered && (
                <button onClick={() => handleBulkAction('deliver')} className="btn btn-secondary text-xs px-3 py-1.5 h-auto">Mark Delivered</button>
              )}
              <button onClick={() => setSelectedOrders(new Set())} className="btn text-xs px-3 py-1.5 h-auto ml-2"><FiX /></button>
            </div>
          </div>
        );
      })()}

      {/* Order List */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Select All Checkbox */}
        {filteredOrders.length > 0 && (
          <div className="flex items-center gap-3 mb-4 px-2">
            <button onClick={toggleAll} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              {selectedOrders.size === filteredOrders.length ? <FiCheckSquare size={18} /> : <FiSquare size={18} />}
            </button>
            <span className="text-sm font-bold text-[var(--text-muted)]">Select All</span>
          </div>
        )}

        {filteredOrders.length === 0 ? (
          <div style={{ padding: '80px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg-alt)', color: 'var(--text-muted)' }}>
              <FiPackage size={28} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>No orders found</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {search ? `No results for "${search}"` : `No ${filter === 'all' ? '' : filter} orders yet`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(o => {
              const isExp = expandedId === o._id
              const isSelected = selectedOrders.has(o._id)
              return (
                <div key={o._id} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: `1.5px solid ${isExp || isSelected ? 'var(--brand-secondary)' : 'var(--border-color)'}`, boxShadow: 'var(--shadow-sm)', overflow: 'hidden', transition: 'all 0.2s' }}>
                  {/* Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-4" style={{ padding: '16px 20px' }}>
                    
                    <div className="flex items-center justify-between sm:w-auto w-full">
                      <button onClick={() => toggleSelection(o._id)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        {isSelected ? <FiCheckSquare size={18} color="var(--brand-secondary)" /> : <FiSquare size={18} />}
                      </button>
                      
                      {/* Mobile chevron on right */}
                      <button onClick={() => setExpandedId(isExp ? null : o._id)}
                        className="sm:hidden"
                        style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0, border: 'none', cursor: 'pointer', ...(isExp ? { background: 'var(--brand-secondary)', color: '#fff' } : { background: 'var(--bg-alt)', color: 'var(--text-muted)' }) }}>
                        <motion.div animate={{ rotate: isExp ? 180 : 0 }}><FiChevronDown size={15} /></motion.div>
                      </button>
                    </div>

                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpandedId(isExp ? null : o._id)}>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>#{formatOrderId(o)}</span>
                        <StatusBadge order={o} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-alt)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border-color)' }}>{o.paymentMethod}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1"><FiUser size={11} style={{ color: 'var(--brand-secondary)' }} />{o.user?.name || 'Customer'}</span>
                        <span className="flex items-center gap-1"><FiCalendar size={11} style={{ color: 'var(--brand-secondary)' }} />{new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className="flex items-center gap-1"><FiTag size={11} style={{ color: 'var(--brand-secondary)' }} />{o.orderItems?.length || 0} items</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4" style={{ flexShrink: 0 }}>
                      <p style={{ fontSize: 18, fontWeight: 900, color: isVoid(o) ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isVoid(o) ? 'line-through' : 'none', fontFamily: 'var(--font-display)' }}>
                        {fmtINR(o.totalPrice)}
                      </p>
                      {/* Desktop chevron */}
                      <button onClick={() => setExpandedId(isExp ? null : o._id)}
                        className="hidden sm:flex"
                        style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0, border: 'none', cursor: 'pointer', ...(isExp ? { background: 'var(--brand-secondary)', color: '#fff' } : { background: 'var(--bg-alt)', color: 'var(--text-muted)' }) }}>
                        <motion.div animate={{ rotate: isExp ? 180 : 0 }}><FiChevronDown size={15} /></motion.div>
                      </button>
                    </div>
                  </div>

                  {/* Expanded */}
                  <AnimatePresence>
                    {isExp && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ padding: 20, borderTop: '1px solid var(--border-color)', background: 'var(--bg-alt)' }}>
                          <div className="grid lg:grid-cols-2 gap-6">
                            {/* Left: Items */}
                            <div>
                              <h4 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Order Items</h4>
                              <div className="space-y-2">
                                {(o.orderItems || []).map((item, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)' }}>
                                    <img src={item.image} alt={item.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.quantity} × ₹{item.price}</p>
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0 }}>{fmtINR(item.price * item.quantity)}</span>
                                  </div>
                                ))}
                              </div>

                              {o.trackingNumber && (
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                                  <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">Tracking Info</p>
                                  <p className="text-sm font-medium">{o.shippingProvider} - <span className="font-mono">{o.trackingNumber}</span></p>
                                </div>
                              )}
                              
                              {o.returnRequest && o.returnRequest.status === 'PENDING' && (
                                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                                  <p className="text-sm font-bold text-orange-800">Return Requested</p>
                                  <p className="text-xs text-orange-600 mt-1">Reason: {o.returnRequest.reason}</p>
                                  <button onClick={() => handleApproveReturn(o._id)} className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600">
                                    Approve Return
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Right: Details */}
                            <div className="space-y-4">
                              {/* Address */}
                              <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                  <FiMapPin size={13} style={{ color: 'var(--brand-secondary)' }} />
                                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Delivery Address</span>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                  {o.user?.name && <strong style={{ display: 'block', fontWeight: 700, marginBottom: 2 }}>{o.user.name}</strong>}
                                  {o.shippingAddress?.street}, {o.shippingAddress?.city}<br />
                                  {o.shippingAddress?.state} - {o.shippingAddress?.zipCode}
                                </p>
                              </div>

                              {/* Price */}
                              <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)' }}>
                                <div className="space-y-2 text-sm">
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Subtotal</span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmtINR(o.itemsPrice)}</span></div>
                                  {o.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--success)' }}>Discount</span><span style={{ color: 'var(--success)', fontWeight: 600 }}>-{fmtINR(o.discount)}</span></div>}
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Shipping</span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{o.shippingPrice === 0 ? 'FREE' : fmtINR(o.shippingPrice)}</span></div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-color)', marginTop: 8 }}>
                                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 15 }}>Total</span>
                                    <span style={{ fontWeight: 900, fontSize: 15, color: isVoid(o) ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isVoid(o) ? 'line-through' : 'none' }}>{fmtINR(o.totalPrice)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                                <button onClick={() => downloadInvoice(o._id)} className="btn btn-secondary text-xs h-auto py-2">
                                  <FiPrinter size={13} /> Invoice
                                </button>
                                <button onClick={() => openPrint(shippingLabelHTML(o), `Label #${formatOrderId(o)}`)} className="btn btn-secondary text-xs h-auto py-2">
                                  <FiTag size={13} /> Shipping Label
                                </button>
                                {o.orderStatus === 'PENDING_ACCEPTANCE' && !isVoid(o) && (
                                  <button onClick={() => markAccepted(o._id)} style={{ padding: '8px 14px', background: 'var(--brand-secondary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <FiCheckCircle size={13} /> Accept Order
                                  </button>
                                )}
                                {!o.isPaid && !isVoid(o) && (
                                  <button onClick={() => markPaid(o._id)} style={{ padding: '8px 14px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <FiCheckCircle size={13} /> Mark Paid
                                  </button>
                                )}
                                {['ACCEPTED', 'SHIPPED', 'PICKED_UP', 'ASSIGNED_TO_COURIER', 'OUT_FOR_DELIVERY'].includes(o.orderStatus) && !o.isDelivered && !isVoid(o) && (
                                  <>
                                    {!o.awbCode && !o.trackingNumber && (
                                      <>
                                        <button onClick={() => handleShipWithShiprocket(o._id)} style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)' }}>
                                          <FiTruck size={13} /> 🚀 Ship with Shiprocket
                                        </button>
                                        <button onClick={() => setTrackingModal(o)} style={{ padding: '8px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                          <FiBox size={13} /> Manual Tracking
                                        </button>
                                      </>
                                    )}
                                    <button onClick={() => markDelivered(o._id)} style={{ padding: '8px 14px', background: 'var(--info)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                      <FiCheckCircle size={13} /> Mark Delivered
                                    </button>
                                  </>
                                )}
                                {!o.isDelivered && !isVoid(o) && (
                                  <button onClick={() => setCancelModal(o)} style={{ padding: '8px 14px', background: 'rgba(229,62,62,0.1)', color: 'var(--danger)', border: '1.5px solid rgba(229,62,62,0.25)', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <FiX size={13} /> Cancel
                                  </button>
                                )}
                              </div>
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

        {/* Responsive Smart Pagination with Rows Per Page selector */}
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalOrders}
          pageSize={limit}
          pageSizeOptions={[20, 50, 100, 200, 500, 1000]}
          onPageChange={(newPage) => setPage(newPage)}
          onPageSizeChange={(newLimit) => {
            setLimit(newLimit)
            setPage(1)
          }}
          itemName="orders"
        />

      </div>

      {/* Cancel Modal */}
      <AnimatePresence>
        {cancelModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(27,47,110,0.45)', backdropFilter: 'blur(12px)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 440, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 44, height: 44, background: 'rgba(229,62,62,0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiAlertCircle size={20} style={{ color: 'var(--danger)' }} /></div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>Cancel Order</h3>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>#{cancelModal._id.slice(-8).toUpperCase()}</p>
                  </div>
                </div>
                <button onClick={() => setCancelModal(null)} style={{ padding: 8, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-alt)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}><FiX size={16} /></button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>This will cancel the order and trigger a refund if it was paid online.</p>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Reason</label>
              <select id="cancelReason" style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', marginBottom: 24, fontFamily: 'var(--font)' }}>
                <option>Customer requested cancellation</option>
                <option>Administrative decision</option>
                <option>Item out of stock</option>
                <option>Suspected fraud</option>
              </select>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setCancelModal(null)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Keep Order</button>
                <button disabled={submitting} onClick={() => handleCancel(document.getElementById('cancelReason').value)}
                  style={{ flex: 1.5, padding: '12px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1, transition: 'all 0.2s', fontFamily: 'var(--font)' }}>
                  {submitting ? 'Cancelling…' : 'Confirm Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tracking Modal */}
      <AnimatePresence>
        {trackingModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(27,47,110,0.45)', backdropFilter: 'blur(12px)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 440, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>Add Tracking Info</h3>
                <button onClick={() => setTrackingModal(null)} style={{ padding: 8, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 8 }}><FiX size={16} /></button>
              </div>
              <form onSubmit={handleAddTracking} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Shipping Provider</label>
                  <input required value={shippingProv} onChange={e=>setShippingProv(e.target.value)} type="text" placeholder="e.g. BlueDart, Delhivery" className="w-full p-3 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tracking Number</label>
                  <input required value={trackingNum} onChange={e=>setTrackingNum(e.target.value)} type="text" placeholder="Tracking Number" className="w-full p-3 border rounded-xl" />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button type="button" onClick={() => setTrackingModal(null)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                  <button type="submit" disabled={submitting}
                    style={{ flex: 1.5, padding: '12px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? 'Saving…' : 'Save & Ship'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default ManageOrders
