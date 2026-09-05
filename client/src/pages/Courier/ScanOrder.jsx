import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiPackage, FiTruck, FiAlertCircle, FiXCircle, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { formatOrderId } from '../../utils/formatOrderId';

const ScanOrder = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [orderId, setOrderId] = useState(searchParams.get('orderId') || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [assignedOrders, setAssignedOrders] = useState([]);

  useEffect(() => {
    if (user?.role === 'courier') {
      fetchAssignedOrders();
    }
  }, [user]);

  const fetchAssignedOrders = async () => {
    try {
      const res = await api.get('/api/courier/orders');
      setAssignedOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch assigned orders', err);
    }
  };

  useEffect(() => {
    if (searchParams.get('orderId') && user?.role === 'courier') {
      handleSearch(searchParams.get('orderId'));
      setIsScanning(false);
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (authLoading || !user || user.role !== 'courier' || !isScanning) return;

    const scanner = new Html5QrcodeScanner('qr-reader', {
      qrbox: { width: 250, height: 250 },
      fps: 5,
    }, false);

    scanner.render(
      (decodedText) => {
        setOrderId(decodedText);
        handleSearch(decodedText);
        setIsScanning(false);
        scanner.clear();
      },
      (err) => { /* ignore frame errors */ }
    );

    return () => {
      scanner.clear().catch(e => console.log('Scanner clear error', e));
    };
  }, [authLoading, user, isScanning]);

  const handleSearch = async (idToSearch) => {
    if (!idToSearch) return;
    setLoading(true);
    setOrder(null);
    try {
      const res = await api.get(`/api/courier/orders/${idToSearch}`);
      setOrder(res.data);
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        toast.error(err.response.data.message || 'Order not found or not assigned to you.');
      } else {
        toast.error('Failed to fetch order details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status) => {
    if (!order) return;
    setUpdating(true);
    try {
      const res = await api.put(`/api/courier/orders/${order._id}/status`, { status });
      setOrder(res.data);
      toast.success(`Order marked as ${status.replace(/_/g, ' ')}`);
      fetchAssignedOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (authLoading) return <div className="p-8 text-center">Loading...</div>;

  if (!user || user.role !== 'courier') {
    return <RestrictedAccess title="Courier Access Only" message="You must be logged in as a Courier to use the scanning feature." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="bg-[#1B2F6E] p-6 text-white rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-black mb-2">Courier Scanner</h1>
        <p className="text-sm opacity-80">Scan QR or enter order ID to update status</p>
      </div>

      <div className="max-w-md mx-auto p-4 mt-4">
        {isScanning && (
          <div className="mb-6 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div id="qr-reader" className="w-full rounded-xl overflow-hidden"></div>
          </div>
        )}
        
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="Enter Order ID"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(orderId);
                setIsScanning(false);
              }
            }}
            className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:border-[#F5A623]"
          />
          <button 
            onClick={() => {
              handleSearch(orderId);
              setIsScanning(false);
            }}
            className="px-4 bg-[#1B2F6E] text-white font-bold rounded-xl hover:bg-opacity-90"
          >
            Search
          </button>
          {!isScanning && (
            <button 
              onClick={() => {
                setOrder(null);
                setOrderId('');
                setIsScanning(true);
              }}
              className="px-4 bg-[#F5A623] text-[#1B2F6E] font-bold rounded-xl"
            >
              Scan Again
            </button>
          )}
        </div>

        {loading && <div className="text-center py-10"><FiRefreshCw className="animate-spin inline text-2xl text-[#F5A623]" /></div>}

        {order && (
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center border-b pb-4 mb-4 dark:border-gray-700">
              <div>
                <p className="text-xs text-gray-500 font-bold tracking-wider">ORDER ID</p>
                <p className="font-mono font-bold">#{formatOrderId(order)}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-1 text-xs font-bold rounded bg-blue-100 text-blue-800 border border-blue-200">
                  {order.paymentMethod}
                </span>
                {order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID' && (
                  <p className="text-red-500 font-black text-lg mt-1">Collect: ₹{order.totalPrice}</p>
                )}
              </div>
            </div>

            <div className="mb-6 text-sm">
              <p className="font-bold text-gray-800 dark:text-gray-200">{order.user?.name || order.shippingAddress?.name}</p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{order.shippingAddress?.street}</p>
              <p className="text-gray-600 dark:text-gray-400">{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.zipCode}</p>
              <p className="font-bold mt-2">Ph: {order.shippingAddress?.phone || order.user?.phone}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                disabled={updating || order.orderStatus === 'DELIVERED' || order.orderStatus === 'RETURNED'}
                onClick={() => updateStatus('PICKED_UP')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs disabled:opacity-50"
              >
                <FiPackage size={20} className="mb-1" /> Picked Up
              </button>
              
              <button 
                disabled={updating || order.orderStatus === 'DELIVERED' || order.orderStatus === 'RETURNED'}
                onClick={() => updateStatus('OUT_FOR_DELIVERY')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-bold text-xs disabled:opacity-50"
              >
                <FiTruck size={20} className="mb-1" /> Out for Delivery
              </button>
              
              <button 
                disabled={updating || order.orderStatus === 'DELIVERED' || order.orderStatus === 'RETURNED'}
                onClick={() => updateStatus('DELIVERED')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 font-bold text-xs disabled:opacity-50"
              >
                <FiCheckCircle size={20} className="mb-1" /> Delivered
              </button>

              <button 
                disabled={updating || order.orderStatus === 'DELIVERED' || order.orderStatus === 'RETURNED'}
                onClick={() => updateStatus('ATTEMPTED_FAILED')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 font-bold text-xs disabled:opacity-50"
              >
                <FiAlertCircle size={20} className="mb-1" /> Attempt Failed
              </button>
              
              <button 
                disabled={updating || order.orderStatus === 'DELIVERED' || order.orderStatus === 'RETURNED'}
                onClick={() => {
                  if(window.confirm('Mark this order as RETURNED? This will restock the inventory.')) {
                    updateStatus('RETURNED')
                  }
                }}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-xs col-span-2 disabled:opacity-50"
              >
                <FiXCircle size={20} className="mb-1" /> Mark as Returned
              </button>
            </div>
          </div>
        )}

        {!order && assignedOrders.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-[#1B2F6E] dark:text-white mb-4">Assigned Orders</h2>
            <div className="space-y-4">
              {assignedOrders.map(ao => (
                <div key={ao._id} onClick={() => {
                  setOrderId(ao._id);
                  handleSearch(ao._id);
                  setIsScanning(false);
                }} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono font-bold text-sm">#{formatOrderId(ao)}</span>
                    <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-800 rounded">{ao.orderStatus.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-sm font-medium">{ao.user?.name || ao.shippingAddress?.name || 'Customer'}</p>
                  <p className="text-xs text-gray-500">{ao.shippingAddress?.city}{ao.shippingAddress?.state ? `, ${ao.shippingAddress?.state}` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanOrder;
