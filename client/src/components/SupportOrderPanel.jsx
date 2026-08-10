import { useState, useEffect } from 'react'
import { FiSearch, FiUser, FiPhone, FiMail } from 'react-icons/fi'
import api from '../api/axios'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'

export default function SupportOrderPanel({ initialSearchQuery = '' }) {
  const { user } = useAuth()
  
  // Search State
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [searchType, setSearchType] = useState('all')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState({ users: [], orders: [] })
  
  // Interaction states
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [action, setAction] = useState('')
  const [actionValue, setActionValue] = useState('')
  const [processing, setProcessing] = useState(false)

  // Automatically search when initialSearchQuery changes (when a different chat is clicked)
  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery)
      setSearchType('email') // Auto-select Email from dropdown
      triggerSearch(initialSearchQuery, 'email')
    }
  }, [initialSearchQuery])

  const triggerSearch = async (query, type) => {
    if (!query.trim()) return
    setIsSearching(true)
    try {
      const res = await api.get(`/api/support/search?q=${encodeURIComponent(query)}&type=${type}`)
      setResults(res.data)
      setSelectedOrder(null)
    } catch (err) {
      toast.error('Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    triggerSearch(searchQuery, searchType)
  }

  const handleAction = async () => {
    if (!action || !selectedOrder) return toast.error('Please select an action')
    setProcessing(true)
    try {
      if (action === 'status') {
        if (!actionValue) throw new Error('Select a status')
        await api.patch(`/api/support/orders/${selectedOrder._id}/status`, { status: actionValue })
        toast.success(`Order status updated to ${actionValue}`)
        setSelectedOrder(prev => ({ ...prev, paymentStatus: actionValue })) // optimistic
      } else if (action === 'message') {
        if (!actionValue) throw new Error('Enter a message')
        await api.post('/api/support', {
          subject: `Support update for Order #${selectedOrder._id.slice(-8).toUpperCase()}`,
          category: 'ORDER_ISSUE',
          order: selectedOrder._id,
          message: actionValue
        })
        toast.success('Ticket created for user')
      }
      
      setAction('')
      setActionValue('')
    } catch (err) {
      toast.error(err.message || 'Action failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full overflow-hidden">
      <div className="p-4 bg-white border-b border-slate-100 shrink-0">
        <form onSubmit={handleSearch}>
          <div className="flex gap-2 mb-3">
            <select 
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:border-brand-primary"
            >
              <option value="all">Search All Fields</option>
              <option value="email">User Email</option>
              <option value="phone">User Phone</option>
              <option value="orderId">Order ID</option>
              <option value="paymentId">Payment ID</option>
              <option value="invoice">Invoice No</option>
            </select>
          </div>
          <div className="relative">
            <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={
                searchType === 'email' ? 'Enter email address...' :
                searchType === 'phone' ? 'Enter phone number...' :
                searchType === 'orderId' ? 'Enter Order ID...' :
                searchType === 'paymentId' ? 'Enter Payment ID...' :
                searchType === 'invoice' ? 'Enter Invoice Number...' :
                'Search anything...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-primary transition-all shadow-sm"
            />
            <button type="submit" disabled={isSearching} className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-brand-secondary text-white text-xs font-bold rounded-lg disabled:opacity-50 hover:bg-brand-primary transition-colors">
              {isSearching ? '...' : 'Find'}
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {selectedOrder ? (
          <div className="animate-fade-in">
            <button onClick={() => setSelectedOrder(null)} className="text-xs font-bold text-brand-primary mb-4 flex items-center gap-1 hover:underline">
              &larr; Back to results
            </button>
            
            <div className="p-4 bg-white border border-slate-200 rounded-xl mb-4 shadow-sm">
              <h4 className="font-bold text-sm text-slate-800 mb-2">Order #{selectedOrder._id.slice(-8).toUpperCase()}</h4>
              <p className="text-xs text-slate-600 mb-1">Customer: <b>{selectedOrder.user?.name}</b></p>
              <p className="text-xs text-slate-600 mb-1">Amount: <b>₹{selectedOrder.totalPrice}</b></p>
              <p className="text-xs text-slate-600 mb-3">Status: <b>{selectedOrder.paymentStatus}</b></p>
              
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Take Action</label>
              <div className="relative mb-3">
                <select 
                  value={action} 
                  onChange={(e) => { setAction(e.target.value); setActionValue(''); }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-primary font-medium"
                >
                  <option value="">-- Select an Action --</option>
                  <option value="status">Change Order Status</option>
                  <option value="message">Create Ticket</option>
                </select>
              </div>

              {action === 'status' && (
                <div className="mb-3">
                    <select 
                    value={actionValue} 
                    onChange={(e) => setActionValue(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-primary"
                  >
                    <option value="">-- Select New Status --</option>
                    <option value="PAID">PAID</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="FAILED">FAILED</option>
                    <option value="COD_CONFIRMED">COD CONFIRMED</option>
                  </select>
                </div>
              )}

              {action === 'message' && (
                <div className="mb-3">
                  <textarea 
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Type a message to start a ticket..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-primary min-h-[80px] resize-none"
                  />
                </div>
              )}

              <button 
                onClick={handleAction}
                disabled={processing || !action || !actionValue}
                className="w-full py-2.5 bg-brand-secondary text-white rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-brand-primary transition-colors mt-2"
              >
                {processing ? 'Processing...' : 'Submit Action'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {searchQuery && !isSearching && results.orders.length === 0 && results.users.length === 0 && (
              <div className="text-center py-10">
                <FiSearch size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm font-medium text-slate-500">No results found for "{searchQuery}"</p>
              </div>
            )}

            {results.orders.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Latest Orders ({Math.min(results.orders.length, 5)})</h3>
                <div className="space-y-3">
                  {results.orders.slice(0, 5).map(o => (
                    <div key={o._id} onClick={() => setSelectedOrder(o)} className="p-3 bg-white border border-slate-200 shadow-sm hover:border-brand-primary/40 rounded-xl cursor-pointer transition-all">
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-bold text-sm text-slate-800 font-monospace">#{o._id.slice(-8).toUpperCase()}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                          {o.paymentStatus}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500"><FiUser className="inline mr-1" /> {o.user?.name || 'Guest'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.users.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 mt-6">Found Users ({results.users.length})</h3>
                <div className="space-y-3">
                  {results.users.map(u => (
                    <div key={u._id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <p className="font-bold text-sm text-slate-800 mb-1">{u.name}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5"><FiMail size={12} /> {u.email}</p>
                      {u.phone && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5"><FiPhone size={12} /> {u.phone}</p>}
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
