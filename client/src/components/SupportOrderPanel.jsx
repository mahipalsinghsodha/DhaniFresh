import { useState, useEffect } from 'react'
import {
  FiSearch, FiUser, FiPhone, FiMail, FiPackage, FiShoppingBag,
  FiLayers, FiMapPin, FiCreditCard, FiCopy, FiCalendar, FiExternalLink, FiChevronLeft
} from 'react-icons/fi'
import api from '../api/axios'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { formatOrderId } from '../utils/formatOrderId'

export default function SupportOrderPanel({ initialSearchQuery = '' }) {
  const { user } = useAuth()
  
  // Search State
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [searchType, setSearchType] = useState('all')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState({ users: [], orders: [] })
  
  // Interaction states
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false)
  const [action, setAction] = useState('')
  const [actionValue, setActionValue] = useState('')
  const [processing, setProcessing] = useState(false)

  // Automatically search when initialSearchQuery changes (when a different chat is clicked)
  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery)
      setSearchType('email')
      triggerSearch(initialSearchQuery, 'email', true)
    }
  }, [initialSearchQuery])

  const triggerSearch = async (query, type, autoOpen = false) => {
    const trimmed = query?.trim()
    if (!trimmed) return
    setIsSearching(true)
    try {
      const res = await api.get(`/api/support/search?q=${encodeURIComponent(trimmed)}&type=${type}`)
      const data = res.data || { users: [], orders: [] }
      setResults(data)

      if (autoOpen && data.orders?.length === 1) {
        handleSelectOrder(data.orders[0])
      } else if (autoOpen && data.orders?.length > 1) {
        setSelectedOrder(null)
        toast.info(`Found ${data.orders.length} orders for ${trimmed}`)
      } else if (autoOpen && data.orders?.length === 0) {
        setSelectedOrder(null)
        toast.info(`No orders found for ${trimmed}`)
      } else {
        setSelectedOrder(null)
      }
    } catch (err) {
      toast.error('Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    triggerSearch(searchQuery, searchType, false)
  }

  const handleQuickSearchUser = (userEmail) => {
    if (!userEmail) return
    setSearchQuery(userEmail)
    setSearchType('email')
    triggerSearch(userEmail, 'email', true)
  }

  const handleSelectOrder = async (orderSummary) => {
    setSelectedOrder(orderSummary)
    if (!orderSummary?._id) return

    setLoadingOrderDetails(true)
    try {
      const res = await api.get(`/api/support/orders/${orderSummary._id}`)
      setSelectedOrder(res.data)
    } catch (err) {
      // Keep summary if full fetch fails
    } finally {
      setLoadingOrderDetails(false)
    }
  }

  const handleCopy = (text, label = 'Text') => {
    if (!text) return
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  const handleAction = async () => {
    if (!action || !selectedOrder) return toast.error('Please select an action')
    setProcessing(true)
    try {
      if (action === 'status') {
        if (!actionValue) throw new Error('Select a status')
        const res = await api.patch(`/api/support/orders/${selectedOrder._id}/status`, { status: actionValue })
        toast.success(`Order status updated to ${actionValue}`)
        setSelectedOrder(res.data)
        setResults(prev => ({
          ...prev,
          orders: prev.orders.map(o => o._id === res.data._id ? res.data : o)
        }))
      } else if (action === 'message') {
        if (!actionValue) throw new Error('Enter a message')
        await api.post('/api/support', {
          subject: `Support update for Order #${formatOrderId(selectedOrder)}`,
          category: 'ORDER_ISSUE',
          order: selectedOrder._id,
          message: actionValue
        })
        toast.success('Support ticket created successfully')
      }
      
      setAction('')
      setActionValue('')
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Action failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full overflow-hidden">
      {/* Search Header */}
      <div className="p-4 bg-white border-b border-slate-100 shrink-0">
        <form onSubmit={handleSearch} className="space-y-2.5">
          <div className="flex gap-2">
            <select 
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-brand-primary cursor-pointer"
            >
              <option value="all">Search All Fields</option>
              <option value="orderId">Order ID / Invoice</option>
              <option value="email">User / Guest Email</option>
              <option value="phone">User / Shipping Phone</option>
              <option value="name">Customer Name</option>
              <option value="paymentId">Payment / Razorpay ID</option>
              <option value="invoice">Invoice Number</option>
            </select>
          </div>
          <div className="relative">
            <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={
                searchType === 'email' ? 'Enter email address...' :
                searchType === 'phone' ? 'Enter phone number...' :
                searchType === 'name' ? 'Enter customer name...' :
                searchType === 'orderId' ? 'Enter Order ID or Email...' :
                searchType === 'paymentId' ? 'Enter Payment / Razorpay ID...' :
                searchType === 'invoice' ? 'Enter Invoice Number...' :
                'Search anything (ID, email, phone, name)...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-16 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-brand-primary transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 bg-brand-secondary text-white text-xs font-bold rounded-lg disabled:opacity-50 hover:bg-brand-primary transition-colors"
            >
              {isSearching ? '...' : 'Find'}
            </button>
          </div>
        </form>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {selectedOrder ? (
          /* ========================================================================= */
          /* ORDER DETAILS VIEW                                                        */
          /* ========================================================================= */
          <div className="animate-fade-in space-y-3">
            <button
              onClick={() => setSelectedOrder(null)}
              className="text-xs font-bold text-brand-primary flex items-center gap-1 hover:underline"
            >
              <FiChevronLeft size={14} /> Back to results
            </button>
            
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-sm text-slate-900 font-mono">
                      Order #{formatOrderId(selectedOrder)}
                    </h4>
                    <button
                      onClick={() => handleCopy(formatOrderId(selectedOrder), 'Order ID')}
                      className="text-slate-400 hover:text-brand-primary p-0.5"
                      title="Copy Order ID"
                    >
                      <FiCopy size={12} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(selectedOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                    {selectedOrder.paymentStatus}
                  </span>
                  {selectedOrder.orderStatus && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary uppercase">
                      {selectedOrder.orderStatus.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Customer & Address Details */}
              <div className="p-2.5 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <FiUser size={12} className="text-slate-400" /> {selectedOrder.user?.name || selectedOrder.shippingAddress?.name || 'Guest User'}
                </p>
                <p className="text-slate-500 flex items-center gap-1.5 truncate">
                  <FiMail size={12} className="text-slate-400" /> {selectedOrder.user?.email || selectedOrder.guestEmail || selectedOrder.shippingAddress?.email || 'N/A'}
                </p>
                {selectedOrder.shippingAddress?.phone && (
                  <p className="text-slate-500 flex items-center gap-1.5">
                    <FiPhone size={12} className="text-slate-400" /> {selectedOrder.shippingAddress.phone}
                  </p>
                )}
                {selectedOrder.shippingAddress?.city && (
                  <p className="text-slate-500 flex items-center gap-1.5">
                    <FiMapPin size={12} className="text-slate-400" /> {selectedOrder.shippingAddress.street}, {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.zipCode}
                  </p>
                )}
              </div>

              {/* Ordered items table */}
              {selectedOrder.orderItems?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <FiLayers size={11} /> Ordered Items ({selectedOrder.orderItems.length})
                  </p>
                  <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs max-h-48 overflow-y-auto">
                    {selectedOrder.orderItems.map((it, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between gap-2 bg-slate-50/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                            {it.image || it.product?.image ? (
                              <img src={it.image || it.product?.image} alt={it.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-slate-400">IMG</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{it.name}</p>
                            <p className="text-[10px] text-slate-500">Qty: {it.quantity} {it.weight ? `• ${it.weight}` : ''}</p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900 shrink-0">
                          ₹{(Number(it.price || 0) * (it.quantity || 1)).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial & Logistics Info */}
              <div className="p-2.5 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-100">
                <div className="flex justify-between text-slate-600">
                  <span>Payment Method:</span>
                  <span className="font-bold">{selectedOrder.paymentMethod || 'COD'}</span>
                </div>
                {selectedOrder.paymentInfo?.razorpay_payment_id && (
                  <div className="flex justify-between text-slate-500 font-mono text-[10px]">
                    <span>Razorpay ID:</span>
                    <span>{selectedOrder.paymentInfo.razorpay_payment_id}</span>
                  </div>
                )}
                {selectedOrder.invoiceNumber && (
                  <div className="flex justify-between text-slate-500 font-mono text-[10px]">
                    <span>Invoice No:</span>
                    <span>{selectedOrder.invoiceNumber}</span>
                  </div>
                )}
                {selectedOrder.trackingNumber && (
                  <div className="flex justify-between text-slate-500 font-mono text-[10px]">
                    <span>Tracking No:</span>
                    <span>{selectedOrder.trackingNumber}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900 text-sm">
                  <span>Total Amount:</span>
                  <span className="text-brand-primary">₹{Number(selectedOrder.totalPrice || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Take Support Action</label>
                <select 
                  value={action} 
                  onChange={(e) => { setAction(e.target.value); setActionValue(''); }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-brand-primary font-medium"
                >
                  <option value="">-- Select an Action --</option>
                  <option value="status">Change Payment Status</option>
                  <option value="message">Create Ticket for Order</option>
                </select>

                {action === 'status' && (
                  <select 
                    value={actionValue} 
                    onChange={(e) => setActionValue(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-brand-primary"
                  >
                    <option value="">-- Select New Status --</option>
                    <option value="PAID">PAID</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="FAILED">FAILED</option>
                    <option value="COD_CONFIRMED">COD CONFIRMED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                )}

                {action === 'message' && (
                  <textarea 
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Type a message or issue note to create ticket..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-brand-primary min-h-[60px] resize-none"
                  />
                )}

                <button 
                  onClick={handleAction}
                  disabled={processing || !action || !actionValue}
                  className="w-full py-2 bg-brand-secondary text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-brand-primary transition-colors"
                >
                  {processing ? 'Processing...' : 'Submit Action'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* SEARCH RESULTS LIST                                                       */
          /* ========================================================================= */
          <>
            {searchQuery && !isSearching && results.orders?.length === 0 && results.users?.length === 0 && (
              <div className="text-center py-10">
                <FiSearch size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-500">No results found for "{searchQuery}"</p>
              </div>
            )}

            {/* Orders list */}
            {results.orders?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <FiPackage /> Found Orders ({results.orders.length})
                </h3>
                <div className="space-y-2">
                  {results.orders.map(o => (
                    <div
                      key={o._id}
                      onClick={() => handleSelectOrder(o)}
                      className="p-3 bg-white border border-slate-200 shadow-xs hover:border-brand-primary/50 rounded-xl cursor-pointer transition-all space-y-1.5"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-slate-900 font-mono">
                          #{formatOrderId(o)}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                          {o.paymentStatus}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate">
                        <FiUser className="inline mr-1 text-slate-400" size={11} /> {o.user?.name || o.shippingAddress?.name || 'Guest'}
                      </p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        <span className="truncate max-w-[180px]">{o.user?.email || o.guestEmail || 'No email'}</span>
                        <span className="font-bold text-slate-900 text-xs">₹{Number(o.totalPrice || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users list */}
            {results.users?.length > 0 && (
              <div className="space-y-2 mt-4">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <FiUser /> Found Users ({results.users.length})
                </h3>
                <div className="space-y-2">
                  {results.users.map(u => (
                    <div key={u._id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-xs text-slate-800">{u.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <FiMail size={11} /> {u.email}
                          </p>
                          {u.phone && (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                              <FiPhone size={11} /> {u.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleQuickSearchUser(u.email)}
                        className="w-full py-2 bg-slate-100 hover:bg-brand-secondary hover:text-white rounded-lg text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <FiShoppingBag size={12} /> View Customer Orders
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
