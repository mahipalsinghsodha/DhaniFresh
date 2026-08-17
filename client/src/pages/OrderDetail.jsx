import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiPrinter, FiX, FiRefreshCcw, FiExternalLink, FiHelpCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api/axios';
import OrderTimeline from '../components/OrderTimeline';
import { formatOrderId } from '../utils/formatOrderId';
import { useSocket } from '../hooks/useSocket';

const fmtINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const socket = useSocket();

  useEffect(() => {
    fetchOrder();
    
    if (socket) {
      socket.emit('joinOrderRoom', id);
      const handleUpdate = (updatedOrder) => {
        if (updatedOrder._id === id) {
          setOrder(updatedOrder);
          toast.info('Order status updated!');
        }
      };
      socket.on('orderStatusUpdated', handleUpdate);
      return () => {
        socket.off('orderStatusUpdated', handleUpdate);
      };
    }
  }, [id, socket]);

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/api/orders/${id}`);
      setOrder(res.data);
    } catch (err) {
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      const res = await api.get(`/api/invoices/${id}/download`, {
        responseType: 'blob' // Important for file downloads
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${order?.invoiceNumber || order?._id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Could not download invoice. Make sure order is confirmed.');
    }
  };

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/api/orders/${id}/cancel`, { reason });
      toast.success(res.data.message || 'Order cancelled successfully');
      setCancelModal(false);
      setReason('');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancellation failed');
    } finally {
      setSubmitting(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen py-10 px-4 flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--brand-primary)' }}></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen py-10 px-4 text-center" style={{ background: 'var(--bg-base)' }}>
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Order not found</h2>
        <Link to="/orders" className="text-blue-500 hover:underline">Back to Orders</Link>
      </div>
    );
  }

  const isVoid = ['CANCELLED', 'FAILED'].includes(order.paymentStatus);
  const isCancellable = !order.isDelivered && !isVoid;
  const isReturnable = order.isDelivered && !order.returnRequest?.status && ((Date.now() - new Date(order.deliveredAt).getTime()) / (1000 * 60 * 60 * 24) <= 7);

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        
        <Link to="/orders" className="inline-flex items-center gap-2 hover:underline font-medium" style={{ color: 'var(--text-muted)' }}>
          <FiArrowLeft /> Back to Orders
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Order #{formatOrderId(order)}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Placed on {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleDownloadInvoice} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
              <FiPrinter /> Invoice
            </button>
            {isCancellable && (
              <button onClick={() => setCancelModal(true)} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <FiX /> Cancel Order
              </button>
            )}
            {isReturnable && (
              <Link to={`/orders/${order._id}/return`} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <FiRefreshCcw /> Request Return
              </Link>
            )}
            <Link to="/support" className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2" style={{ background: 'var(--brand-gradient)', color: '#fff', border: '1px solid var(--border-color)' }}>
              <FiHelpCircle /> Need Help?
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Timeline */}
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Tracking</h2>
              <OrderTimeline order={order} />
              
              {order.trackingNumber && (
                <div className="mt-6 p-4 rounded-xl flex items-center justify-between" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                  <div>
                    <p className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>Tracking Info</p>
                    <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{order.shippingProvider}: <span className="font-mono">{order.trackingNumber}</span></p>
                  </div>
                  <a href={`https://www.google.com/search?q=${order.shippingProvider}+tracking+${order.trackingNumber}`} target="_blank" rel="noreferrer" className="text-sm flex items-center gap-1 hover:underline" style={{ color: 'var(--brand-primary)' }}>
                    Track <FiExternalLink />
                  </a>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Items</h2>
              <div className="space-y-4">
                {(order.orderItems || []).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Qty: {item.quantity} × {fmtINR(item.price)}</p>
                    </div>
                    <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {fmtINR(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="space-y-6">
            
            {/* Summary */}
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Items</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmtINR(order.itemsPrice)}</span></div>
                {order.discount > 0 && (
                  <div className="flex justify-between"><span className="text-green-500">Discount ({order.coupon?.code})</span><span className="text-green-500 font-semibold">-{fmtINR(order.discount)}</span></div>
                )}
                <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Tax ({(order.gstRate || 0)}%)</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmtINR(order.taxPrice)}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Shipping</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{order.shippingPrice === 0 ? 'FREE' : fmtINR(order.shippingPrice)}</span></div>
                <div className="flex justify-between pt-3 border-t mt-3" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Total</span>
                  <span className={`font-black text-lg ${isVoid ? 'line-through opacity-50' : ''}`} style={{ color: 'var(--text-primary)' }}>{fmtINR(order.totalPrice)}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <p className="text-xs uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Payment Method</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{order.paymentMethod}</p>
              </div>
            </div>

            {/* Address */}
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Shipping Address</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                <strong className="block text-base mb-1" style={{ color: 'var(--text-primary)' }}>{order.shippingAddress?.name || order.user?.name}</strong>
                {order.shippingAddress?.street}, {order.shippingAddress?.city}<br />
                {order.shippingAddress?.district && `${order.shippingAddress.district}, `}{order.shippingAddress?.state} - {order.shippingAddress?.zipCode}<br />
                <span className="mt-2 block">Phone: {order.shippingAddress?.phone}</span>
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-2">Cancel Order</h3>
            <p className="text-sm text-gray-500 mb-4">Please let us know why you are cancelling this order.</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for cancellation (optional)" className="w-full p-3 border rounded-xl mb-4 bg-gray-50 dark:bg-gray-900" rows={3}></textarea>
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(false)} className="flex-1 py-3 font-semibold rounded-xl border hover:bg-gray-50 dark:hover:bg-gray-700">Go Back</button>
              <button onClick={handleCancel} disabled={submitting} className="flex-1 py-3 font-bold rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                {submitting ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
};

export default OrderDetail;
