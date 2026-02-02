// import { useState, useEffect, useRef } from 'react'
// import { useAuth } from '../../context/AuthContext'
// import axios from 'axios'
// import { FiPackage, FiCheckCircle, FiTruck, FiDollarSign, FiRefreshCw, FiBell, FiPrinter, FiCheckSquare, FiSquare } from 'react-icons/fi'

// const ManageOrders = () => {
//   const { user } = useAuth()
//   const [orders, setOrders] = useState([])
//   const [loading, setLoading] = useState(true)
//   const [filter, setFilter] = useState('all')
//   const [selectedOrders, setSelectedOrders] = useState([])
//   const [newOrdersCount, setNewOrdersCount] = useState(0)
//   const [showNotification, setShowNotification] = useState(false)
//   const intervalRef = useRef(null)
//   const lastOrderCountRef = useRef(0)

//   useEffect(() => {
//     if (user && user.role === 'admin') {
//       fetchOrders()
//       // Auto-refresh every 10 seconds
//       intervalRef.current = setInterval(() => {
//         checkForNewOrders()
//       }, 10000)
//     }

//     return () => {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//       }
//     }
//   }, [user])

//   const fetchOrders = async () => {
//     try {
//       const res = await axios.get('/api/orders')
//       const orderData = res.data.orders || res.data || []
//       setOrders(orderData)
      
//       const newCount = res.data.newOrdersCount !== undefined 
//         ? res.data.newOrdersCount 
//         : orderData.filter(
//             o => !o.isPaid && new Date(o.createdAt) > new Date(Date.now() - 5 * 60 * 1000)
//           ).length
      
//       if (newCount > lastOrderCountRef.current && lastOrderCountRef.current > 0) {
//         setShowNotification(true)
//         setTimeout(() => setShowNotification(false), 5000)
//       }
      
//       setNewOrdersCount(newCount)
//       lastOrderCountRef.current = newCount
//     } catch (error) {
//       console.error('Error fetching orders:', error)
//     } finally {
//       setLoading(false)
//     }
//   }

//   const checkForNewOrders = async () => {
//     try {
//       const res = await axios.get('/api/orders')
//       const orderData = res.data.orders || res.data || []
//       const currentCount = res.data.newOrdersCount !== undefined 
//         ? res.data.newOrdersCount 
//         : orderData.filter(
//             o => !o.isPaid && new Date(o.createdAt) > new Date(Date.now() - 5 * 60 * 1000)
//           ).length
      
//       if (currentCount > lastOrderCountRef.current && lastOrderCountRef.current > 0) {
//         setShowNotification(true)
//         setTimeout(() => setShowNotification(false), 5000)
//       }
      
//       setOrders(orderData)
//       setNewOrdersCount(currentCount)
//       lastOrderCountRef.current = currentCount
//     } catch (error) {
//       console.error('Error checking new orders:', error)
//     }
//   }

//   const markAsPaid = async (orderId) => {
//     try {
//       await axios.put(`/api/orders/${orderId}/pay`)
//       fetchOrders()
//     } catch (error) {
//       console.error('Error marking as paid:', error)
//       alert('Failed to update order status')
//     }
//   }

//   const markAsDelivered = async (orderId) => {
//     try {
//       await axios.put(`/api/orders/${orderId}/deliver`)
//       fetchOrders()
//     } catch (error) {
//       console.error('Error marking as delivered:', error)
//       alert('Failed to update order status')
//     }
//   }

//   const handleSelectOrder = (orderId) => {
//     setSelectedOrders(prev =>
//       prev.includes(orderId)
//         ? prev.filter(id => id !== orderId)
//         : [...prev, orderId]
//     )
//   }

//   const handleSelectAll = () => {
//     const filteredIds = filteredOrders.map(o => o._id)
//     if (selectedOrders.length === filteredIds.length) {
//       setSelectedOrders([])
//     } else {
//       setSelectedOrders(filteredIds)
//     }
//   }

//   const bulkMarkAsPaid = async () => {
//     if (selectedOrders.length === 0) {
//       alert('Please select orders to update')
//       return
//     }
    
//     try {
//       await axios.put('/api/orders/bulk/update', {
//         orderIds: selectedOrders,
//         action: 'pay'
//       })
//       setSelectedOrders([])
//       fetchOrders()
//       alert(`${selectedOrders.length} orders marked as paid successfully!`)
//     } catch (error) {
//       console.error('Error bulk updating:', error)
//       alert('Failed to update orders')
//     }
//   }

//   const bulkMarkAsDelivered = async () => {
//     if (selectedOrders.length === 0) {
//       alert('Please select orders to update')
//       return
//     }
    
//     try {
//       await axios.put('/api/orders/bulk/update', {
//         orderIds: selectedOrders,
//         action: 'deliver'
//       })
//       setSelectedOrders([])
//       fetchOrders()
//       alert(`${selectedOrders.length} orders marked as delivered successfully!`)
//     } catch (error) {
//       console.error('Error bulk updating:', error)
//       alert('Failed to update orders')
//     }
//   }

//   const printInvoice = async (orderId) => {
//     try {
//       const res = await axios.get(`/api/invoices/${orderId}`)
//       const invoice = res.data
      
//       const printWindow = window.open('', '_blank')
//       printWindow.document.write(`
//         <!DOCTYPE html>
//         <html>
//         <head>
//           <title>Invoice ${invoice.invoiceNumber}</title>
//           <style>
//             body { font-family: Arial, sans-serif; padding: 20px; }
//             .header { text-align: center; margin-bottom: 30px; }
//             .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
//             table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
//             th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
//             th { background-color: #f2f2f2; }
//             .total { text-align: right; font-weight: bold; }
//             .footer { margin-top: 30px; text-align: center; color: #666; }
//             @media print { button { display: none; } }
//           </style>
//         </head>
//         <body>
//           <div class="header">
//             <h1>Ghee Store</h1>
//             <h2>Invoice ${invoice.invoiceNumber}</h2>
//           </div>
//           <div class="invoice-info">
//             <div>
//               <h3>Bill To:</h3>
//               <p>${invoice.customer.name}<br>
//               ${invoice.customer.email}<br>
//               ${invoice.customer.address?.street || ''}<br>
//               ${invoice.customer.address?.city || ''}, ${invoice.customer.address?.state || ''} ${invoice.customer.address?.zipCode || ''}<br>
//               ${invoice.customer.address?.country || ''}</p>
//             </div>
//             <div>
//               <p><strong>Invoice Date:</strong> ${new Date(invoice.date).toLocaleDateString()}</p>
//               <p><strong>Order ID:</strong> ${invoice.orderId}</p>
//               <p><strong>Payment Status:</strong> ${invoice.paymentStatus}</p>
//               <p><strong>Delivery Status:</strong> ${invoice.deliveryStatus}</p>
//             </div>
//           </div>
//           <table>
//             <thead>
//               <tr>
//                 <th>Item</th>
//                 <th>Quantity</th>
//                 <th>Price</th>
//                 <th>Total</th>
//               </tr>
//             </thead>
//             <tbody>
//               ${invoice.items.map(item => `
//                 <tr>
//                   <td>${item.name}</td>
//                   <td>${item.quantity}</td>
//                   <td>₹${item.price.toFixed(2)}</td>
//                   <td>₹${item.total.toFixed(2)}</td>
//                 </tr>
//               `).join('')}
//             </tbody>
//             <tfoot>
//               <tr>
//                 <td colspan="3" class="total">Subtotal:</td>
//                 <td>₹${invoice.subtotal.toFixed(2)}</td>
//               </tr>
//               <tr>
//                 <td colspan="3" class="total">Tax (18%):</td>
//                 <td>₹${invoice.tax.toFixed(2)}</td>
//               </tr>
//               <tr>
//                 <td colspan="3" class="total">Shipping:</td>
//                 <td>₹${invoice.shipping.toFixed(2)}</td>
//               </tr>
//               <tr>
//                 <td colspan="3" class="total">Total:</td>
//                 <td>₹${invoice.total.toFixed(2)}</td>
//               </tr>
//             </tfoot>
//           </table>
//           <div class="footer">
//             <p>Thank you for your business!</p>
//             <p>Payment Method: ${invoice.paymentMethod}</p>
//           </div>
//           <button onclick="window.print()">Print Invoice</button>
//         </body>
//         </html>
//       `)
//       printWindow.document.close()
//     } catch (error) {
//       console.error('Error generating invoice:', error)
//       alert('Failed to generate invoice')
//     }
//   }

//   const printMultipleInvoices = async () => {
//     if (selectedOrders.length === 0) {
//       alert('Please select orders to print invoices')
//       return
//     }

//     try {
//       const res = await axios.post('/api/invoices/bulk', { orderIds: selectedOrders })
//       const invoices = res.data.invoices

//       invoices.forEach((invoice, index) => {
//         setTimeout(() => {
//           const printWindow = window.open('', '_blank')
//           printWindow.document.write(`
//             <!DOCTYPE html>
//             <html>
//             <head>
//               <title>Invoice ${invoice.invoiceNumber}</title>
//               <style>
//                 body { font-family: Arial, sans-serif; padding: 20px; }
//                 .header { text-align: center; margin-bottom: 30px; }
//                 .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
//                 table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
//                 th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
//                 th { background-color: #f2f2f2; }
//                 .total { text-align: right; font-weight: bold; }
//                 .footer { margin-top: 30px; text-align: center; color: #666; }
//                 @media print { button { display: none; } }
//               </style>
//             </head>
//             <body>
//               <div class="header">
//                 <h1>Ghee Store</h1>
//                 <h2>Invoice ${invoice.invoiceNumber}</h2>
//               </div>
//               <div class="invoice-info">
//                 <div>
//                   <h3>Bill To:</h3>
//                   <p>${invoice.customer.name}<br>
//                   ${invoice.customer.email}<br>
//                   ${invoice.customer.address?.street || ''}<br>
//                   ${invoice.customer.address?.city || ''}, ${invoice.customer.address?.state || ''} ${invoice.customer.address?.zipCode || ''}<br>
//                   ${invoice.customer.address?.country || ''}</p>
//                 </div>
//                 <div>
//                   <p><strong>Invoice Date:</strong> ${new Date(invoice.date).toLocaleDateString()}</p>
//                   <p><strong>Order ID:</strong> ${invoice.orderId}</p>
//                   <p><strong>Payment Status:</strong> ${invoice.paymentStatus}</p>
//                   <p><strong>Delivery Status:</strong> ${invoice.deliveryStatus}</p>
//                 </div>
//               </div>
//               <table>
//                 <thead>
//                   <tr>
//                     <th>Item</th>
//                     <th>Quantity</th>
//                     <th>Price</th>
//                     <th>Total</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   ${invoice.items.map(item => `
//                     <tr>
//                       <td>${item.name}</td>
//                       <td>${item.quantity}</td>
//                       <td>₹${item.price.toFixed(2)}</td>
//                       <td>₹${item.total.toFixed(2)}</td>
//                     </tr>
//                   `).join('')}
//                 </tbody>
//                 <tfoot>
//                   <tr>
//                     <td colspan="3" class="total">Subtotal:</td>
//                     <td>₹${invoice.subtotal.toFixed(2)}</td>
//                   </tr>
//                   <tr>
//                     <td colspan="3" class="total">Tax (18%):</td>
//                     <td>₹${invoice.tax.toFixed(2)}</td>
//                   </tr>
//                   <tr>
//                     <td colspan="3" class="total">Shipping:</td>
//                     <td>₹${invoice.shipping.toFixed(2)}</td>
//                   </tr>
//                   <tr>
//                     <td colspan="3" class="total">Total:</td>
//                     <td>₹${invoice.total.toFixed(2)}</td>
//                   </tr>
//                 </tfoot>
//               </table>
//               <div class="footer">
//                 <p>Thank you for your business!</p>
//                 <p>Payment Method: ${invoice.paymentMethod}</p>
//               </div>
//               <button onclick="window.print()">Print Invoice</button>
//             </body>
//             </html>
//           `)
//           printWindow.document.close()
//         }, index * 500)
//       })
//     } catch (error) {
//       console.error('Error generating invoices:', error)
//       alert('Failed to generate invoices')
//     }
//   }

//   const getStatusBadge = (order) => {
//     if (order.isDelivered) {
//       return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">Delivered</span>
//     } else if (order.isPaid) {
//       return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">Paid</span>
//     } else {
//       return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">Pending</span>
//     }
//   }

//   const filteredOrders = orders.filter(order => {
//     if (filter === 'all') return true
//     if (filter === 'pending') return !order.isPaid && !order.isDelivered
//     if (filter === 'paid') return order.isPaid && !order.isDelivered
//     if (filter === 'delivered') return order.isDelivered
//     return true
//   })

//   if (!user || user.role !== 'admin') {
//     return (
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
//         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
//           <p className="font-bold">Access Denied</p>
//           <p>You must be an admin to manage orders.</p>
//         </div>
//       </div>
//     )
//   }

//   if (loading) {
//     return (
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
//         <div className="text-center">
//           <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//       {/* New Order Notification */}
//       {showNotification && (
//         <div className="fixed top-20 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center space-x-2 animate-bounce">
//           <FiBell className="text-xl" />
//           <span className="font-semibold">New Order Received! 🎉</span>
//         </div>
//       )}

//       <div className="flex justify-between items-center mb-8">
//         <div>
//           <h1 className="text-4xl font-bold">Manage Orders</h1>
//           {newOrdersCount > 0 && (
//             <p className="text-yellow-600 font-semibold mt-2 flex items-center space-x-2">
//               <FiBell />
//               <span>{newOrdersCount} new order(s) in last 5 minutes</span>
//             </p>
//           )}
//         </div>
//         <button
//           onClick={fetchOrders}
//           className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
//         >
//           <FiRefreshCw />
//           <span>Refresh</span>
//         </button>
//       </div>

//       {/* Bulk Actions */}
//       {selectedOrders.length > 0 && (
//         <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
//           <span className="font-semibold text-blue-800">
//             {selectedOrders.length} order(s) selected
//           </span>
//           <div className="flex space-x-2">
//             <button
//               onClick={bulkMarkAsPaid}
//               className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
//             >
//               <FiDollarSign />
//               <span>Mark All as Paid</span>
//             </button>
//             <button
//               onClick={bulkMarkAsDelivered}
//               className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
//             >
//               <FiTruck />
//               <span>Mark All as Delivered</span>
//             </button>
//             <button
//               onClick={printMultipleInvoices}
//               className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
//             >
//               <FiPrinter />
//               <span>Print All Invoices</span>
//             </button>
//             <button
//               onClick={() => setSelectedOrders([])}
//               className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
//             >
//               Clear Selection
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Filter Buttons */}
//       <div className="mb-6 flex flex-wrap gap-2">
//         <button
//           onClick={() => setFilter('all')}
//           className={`px-4 py-2 rounded-lg font-semibold transition ${
//             filter === 'all'
//               ? 'bg-primary-600 text-white'
//               : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
//           }`}
//         >
//           All Orders ({orders.length})
//         </button>
//         <button
//           onClick={() => setFilter('pending')}
//           className={`px-4 py-2 rounded-lg font-semibold transition ${
//             filter === 'pending'
//               ? 'bg-primary-600 text-white'
//               : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
//           }`}
//         >
//           Pending ({orders.filter(o => !o.isPaid && !o.isDelivered).length})
//         </button>
//         <button
//           onClick={() => setFilter('paid')}
//           className={`px-4 py-2 rounded-lg font-semibold transition ${
//             filter === 'paid'
//               ? 'bg-primary-600 text-white'
//               : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
//           }`}
//         >
//           Paid ({orders.filter(o => o.isPaid && !o.isDelivered).length})
//         </button>
//         <button
//           onClick={() => setFilter('delivered')}
//           className={`px-4 py-2 rounded-lg font-semibold transition ${
//             filter === 'delivered'
//               ? 'bg-primary-600 text-white'
//               : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
//           }`}
//         >
//           Delivered ({orders.filter(o => o.isDelivered).length})
//         </button>
//       </div>

//       {/* Orders List */}
//       {filteredOrders.length === 0 ? (
//         <div className="text-center py-12 bg-white rounded-lg shadow-md">
//           <FiPackage className="mx-auto text-6xl text-gray-400 mb-4" />
//           <p className="text-gray-500 text-lg">No orders found</p>
//         </div>
//       ) : (
//         <div className="space-y-6">
//           <div className="bg-white rounded-lg shadow-md p-4 mb-4">
//             <button
//               onClick={handleSelectAll}
//               className="flex items-center space-x-2 text-gray-700 hover:text-primary-600"
//             >
//               {selectedOrders.length === filteredOrders.length ? (
//                 <FiCheckSquare className="text-xl" />
//               ) : (
//                 <FiSquare className="text-xl" />
//               )}
//               <span className="font-semibold">Select All</span>
//             </button>
//           </div>

//           {filteredOrders.map((order) => (
//             <div key={order._id} className="bg-white rounded-lg shadow-md p-6">
//               <div className="flex items-start space-x-4 mb-4">
//                 <button
//                   onClick={() => handleSelectOrder(order._id)}
//                   className="mt-1"
//                 >
//                   {selectedOrders.includes(order._id) ? (
//                     <FiCheckSquare className="text-xl text-primary-600" />
//                   ) : (
//                     <FiSquare className="text-xl text-gray-400" />
//                   )}
//                 </button>
//                 <div className="flex-1">
//                   <div className="flex items-center space-x-4 mb-2">
//                     <h3 className="font-semibold text-lg">Order #{order._id.slice(-8)}</h3>
//                     {getStatusBadge(order)}
//                   </div>
//                   <div className="text-sm text-gray-600 space-y-1">
//                     <p><strong>Customer:</strong> {order.user?.name || 'N/A'} ({order.user?.email || 'N/A'})</p>
//                     <p><strong>Placed:</strong> {new Date(order.createdAt).toLocaleString()}</p>
//                     <p><strong>Payment:</strong> {order.paymentMethod}</p>
//                     {order.shippingAddress && (
//                       <div className="mt-2">
//                         <p><strong>Shipping Address:</strong></p>
//                         <p className="ml-4">
//                           {order.shippingAddress.street}, {order.shippingAddress.city}, 
//                           {order.shippingAddress.state} {order.shippingAddress.zipCode}, 
//                           {order.shippingAddress.country}
//                         </p>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//                 <div className="text-right ml-4">
//                   <p className="font-bold text-2xl text-primary-600 mb-2">
//                     ₹{order.totalPrice.toFixed(2)}
//                   </p>
//                   <div className="text-sm text-gray-600 space-y-1">
//                     <p>Items: ₹{order.itemsPrice.toFixed(2)}</p>
//                     <p>Tax: ₹{order.taxPrice.toFixed(2)}</p>
//                     <p>Shipping: ₹{order.shippingPrice.toFixed(2)}</p>
//                   </div>
//                 </div>
//               </div>

//               {/* Order Items */}
//               <div className="border-t pt-4 mb-4">
//                 <h4 className="font-semibold mb-3">Order Items:</h4>
//                 <div className="space-y-2">
//                   {order.orderItems.map((item) => (
//                     <div key={item._id} className="flex items-center space-x-4 bg-gray-50 p-3 rounded">
//                       <img
//                         src={item.image}
//                         alt={item.name}
//                         className="w-16 h-16 object-cover rounded"
//                       />
//                       <div className="flex-1">
//                         <p className="font-semibold">{item.name}</p>
//                         <p className="text-gray-600 text-sm">Quantity: {item.quantity}</p>
//                       </div>
//                       <p className="font-semibold">₹{(item.price * item.quantity).toFixed(2)}</p>
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               {/* Action Buttons */}
//               <div className="border-t pt-4 flex flex-wrap gap-2">
//                 <button
//                   onClick={() => printInvoice(order._id)}
//                   className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
//                 >
//                   <FiPrinter />
//                   <span>Print Invoice</span>
//                 </button>
//                 {!order.isPaid && (
//                   <button
//                     onClick={() => markAsPaid(order._id)}
//                     className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
//                   >
//                     <FiDollarSign />
//                     <span>Mark as Paid</span>
//                   </button>
//                 )}
//                 {order.isPaid && !order.isDelivered && (
//                   <button
//                     onClick={() => markAsDelivered(order._id)}
//                     className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
//                   >
//                     <FiTruck />
//                     <span>Mark as Delivered</span>
//                   </button>
//                 )}
//                 {order.isPaid && (
//                   <span className="flex items-center space-x-2 text-green-600 px-4 py-2">
//                     <FiCheckCircle />
//                     <span>Paid on {new Date(order.paidAt).toLocaleDateString()}</span>
//                   </span>
//                 )}
//                 {order.isDelivered && (
//                   <span className="flex items-center space-x-2 text-blue-600 px-4 py-2">
//                     <FiTruck />
//                     <span>Delivered on {new Date(order.deliveredAt).toLocaleDateString()}</span>
//                   </span>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   )
// }

// export default ManageOrders
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import axios from 'axios'
import { FiPackage, FiCheckCircle, FiTruck, FiDollarSign, FiRefreshCw, FiBell, FiPrinter, FiCheckSquare, FiSquare, FiX } from 'react-icons/fi'

const ManageOrders = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedOrders, setSelectedOrders] = useState([])
  const [newOrdersCount, setNewOrdersCount] = useState(0)
  const [showNotification, setShowNotification] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const intervalRef = useRef(null)
  const lastOrderCountRef = useRef(0)

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchOrders()
      // Auto-refresh every 10 seconds
      intervalRef.current = setInterval(() => {
        checkForNewOrders()
      }, 10000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user])

  const fetchOrders = async () => {
    try {
      const res = await axios.get('/api/orders')
      const orderData = res.data.orders || res.data || []
      setOrders(orderData)
      
      const newCount = res.data.newOrdersCount !== undefined 
        ? res.data.newOrdersCount 
        : orderData.filter(
            o => !o.isPaid && new Date(o.createdAt) > new Date(Date.now() - 5 * 60 * 1000)
          ).length
      
      if (newCount > lastOrderCountRef.current && lastOrderCountRef.current > 0) {
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 5000)
      }
      
      setNewOrdersCount(newCount)
      lastOrderCountRef.current = newCount
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkForNewOrders = async () => {
    try {
      const res = await axios.get('/api/orders')
      const orderData = res.data.orders || res.data || []
      const currentCount = res.data.newOrdersCount !== undefined 
        ? res.data.newOrdersCount 
        : orderData.filter(
            o => !o.isPaid && new Date(o.createdAt) > new Date(Date.now() - 5 * 60 * 1000)
          ).length
      
      if (currentCount > lastOrderCountRef.current && lastOrderCountRef.current > 0) {
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 5000)
      }
      
      setOrders(orderData)
      setNewOrdersCount(currentCount)
      lastOrderCountRef.current = currentCount
    } catch (error) {
      console.error('Error checking new orders:', error)
    }
  }

  const markAsPaid = async (orderId) => {
    try {
      await axios.put(`/api/orders/${orderId}/pay`)
      fetchOrders()
    } catch (error) {
      console.error('Error marking as paid:', error)
      alert('Failed to update order status')
    }
  }

  const markAsDelivered = async (orderId) => {
    try {
      await axios.put(`/api/orders/${orderId}/deliver`)
      fetchOrders()
    } catch (error) {
      console.error('Error marking as delivered:', error)
      alert('Failed to update order status')
    }
  }

  const handleSelectOrder = (orderId) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const handleSelectAll = () => {
    const filteredIds = filteredOrders.map(o => o._id)
    if (selectedOrders.length === filteredIds.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(filteredIds)
    }
  }

  const bulkMarkAsPaid = async () => {
    if (selectedOrders.length === 0) {
      alert('Please select orders to update')
      return
    }
    
    try {
      await axios.put('/api/orders/bulk/update', {
        orderIds: selectedOrders,
        action: 'pay'
      })
      setSelectedOrders([])
      fetchOrders()
      alert(`${selectedOrders.length} orders marked as paid successfully!`)
    } catch (error) {
      console.error('Error bulk updating:', error)
      alert('Failed to update orders')
    }
  }

  const bulkMarkAsDelivered = async () => {
    if (selectedOrders.length === 0) {
      alert('Please select orders to update')
      return
    }
    
    try {
      await axios.put('/api/orders/bulk/update', {
        orderIds: selectedOrders,
        action: 'deliver'
      })
      setSelectedOrders([])
      fetchOrders()
      alert(`${selectedOrders.length} orders marked as delivered successfully!`)
    } catch (error) {
      console.error('Error bulk updating:', error)
      alert('Failed to update orders')
    }
  }

  // Helper function to generate invoice HTML
  const generateInvoiceHTML = (invoice) => {
    return `
      <div class="invoice-page">
        <div class="header">
          <h1>Ghee Store</h1>
          <h2>Invoice ${invoice.invoiceNumber}</h2>
        </div>
        <div class="invoice-info">
          <div class="bill-to">
            <h3>Bill To:</h3>
            <p>${invoice.customer.name}<br>
            ${invoice.customer.email}<br>
            ${invoice.customer.address?.street || ''}<br>
            ${invoice.customer.address?.city || ''}, ${invoice.customer.address?.state || ''} ${invoice.customer.address?.zipCode || ''}<br>
            ${invoice.customer.address?.country || ''}</p>
          </div>
          <div class="invoice-details">
            <p><strong>Invoice Date:</strong> ${new Date(invoice.date).toLocaleDateString()}</p>
            <p><strong>Order ID:</strong> ${invoice.orderId}</p>
            <p><strong>Payment Status:</strong> ${invoice.paymentStatus}</p>
            <p><strong>Delivery Status:</strong> ${invoice.deliveryStatus}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>₹${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="total">Subtotal:</td>
              <td>₹${invoice.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="3" class="total">Tax (18%):</td>
              <td>₹${invoice.tax.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="3" class="total">Shipping:</td>
              <td>₹${invoice.shipping.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="3" class="total"><strong>Total:</strong></td>
              <td><strong>₹${invoice.total.toFixed(2)}</strong></td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Payment Method: ${invoice.paymentMethod}</p>
        </div>
      </div>
    `
  }

  // Print single invoice
  const printInvoice = async (orderId) => {
    try {
      const res = await axios.get(`/api/invoices/${orderId}`)
      const invoice = res.data
      
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              max-width: 210mm;
              margin: 0 auto;
            }
            
            .invoice-page {
              page-break-after: always;
              padding: 20px;
            }
            
            .invoice-page:last-child {
              page-break-after: auto;
            }
            
            .header { 
              text-align: center; 
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            
            .header h1 {
              font-size: 28px;
              color: #333;
              margin-bottom: 5px;
            }
            
            .header h2 {
              font-size: 20px;
              color: #666;
            }
            
            .invoice-info { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 30px;
              gap: 20px;
            }
            
            .bill-to, .invoice-details {
              flex: 1;
            }
            
            .bill-to h3 {
              margin-bottom: 10px;
              color: #333;
            }
            
            .bill-to p, .invoice-details p {
              line-height: 1.6;
              color: #555;
            }
            
            .invoice-details {
              text-align: right;
            }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px;
            }
            
            th, td { 
              border: 1px solid #ddd; 
              padding: 12px 8px; 
              text-align: left;
            }
            
            th { 
              background-color: #f8f9fa;
              font-weight: bold;
              color: #333;
            }
            
            tbody tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            
            tfoot tr {
              background-color: #fff;
            }
            
            tfoot tr:last-child {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            
            .total { 
              text-align: right; 
              font-weight: bold;
            }
            
            .footer { 
              margin-top: 40px; 
              text-align: center; 
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
            
            .footer p {
              margin: 5px 0;
            }
            
            .print-button {
              display: block;
              margin: 20px auto;
              padding: 12px 30px;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 5px;
              font-size: 16px;
              cursor: pointer;
            }
            
            .print-button:hover {
              background-color: #0056b3;
            }
            
            /* Print styles */
            @media print {
              body {
                padding: 0;
              }
              
              .print-button {
                display: none;
              }
              
              .invoice-page {
                padding: 0;
                page-break-after: always;
              }
              
              .invoice-page:last-child {
                page-break-after: auto;
              }
            }
            
            /* Responsive styles */
            @media screen and (max-width: 768px) {
              body {
                padding: 10px;
              }
              
              .invoice-info {
                flex-direction: column;
              }
              
              .invoice-details {
                text-align: left;
                margin-top: 15px;
              }
              
              table {
                font-size: 14px;
              }
              
              th, td {
                padding: 8px 4px;
              }
              
              .header h1 {
                font-size: 22px;
              }
              
              .header h2 {
                font-size: 16px;
              }
            }
          </style>
        </head>
        <body>
          ${generateInvoiceHTML(invoice)}
          <button class="print-button" onclick="window.print()">Print Invoice</button>
        </body>
        </html>
      `)
      printWindow.document.close()
    } catch (error) {
      console.error('Error generating invoice:', error)
      alert('Failed to generate invoice')
    }
  }

  // Print multiple invoices in one print job
  const printMultipleInvoices = async () => {
    if (selectedOrders.length === 0) {
      alert('Please select orders to print invoices')
      return
    }

    try {
      const res = await axios.post('/api/invoices/bulk', { orderIds: selectedOrders })
      const invoices = res.data.invoices

      // Generate all invoice HTML
      const allInvoicesHTML = invoices.map(invoice => generateInvoiceHTML(invoice)).join('')

      // Open single print window with all invoices
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoices (${invoices.length} invoices)</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              max-width: 210mm;
              margin: 0 auto;
            }
            
            .invoice-page {
              page-break-after: always;
              padding: 20px;
              margin-bottom: 40px;
            }
            
            .invoice-page:last-child {
              page-break-after: auto;
              margin-bottom: 0;
            }
            
            .header { 
              text-align: center; 
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            
            .header h1 {
              font-size: 28px;
              color: #333;
              margin-bottom: 5px;
            }
            
            .header h2 {
              font-size: 20px;
              color: #666;
            }
            
            .invoice-info { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 30px;
              gap: 20px;
            }
            
            .bill-to, .invoice-details {
              flex: 1;
            }
            
            .bill-to h3 {
              margin-bottom: 10px;
              color: #333;
            }
            
            .bill-to p, .invoice-details p {
              line-height: 1.6;
              color: #555;
            }
            
            .invoice-details {
              text-align: right;
            }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px;
            }
            
            th, td { 
              border: 1px solid #ddd; 
              padding: 12px 8px; 
              text-align: left;
            }
            
            th { 
              background-color: #f8f9fa;
              font-weight: bold;
              color: #333;
            }
            
            tbody tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            
            tfoot tr {
              background-color: #fff;
            }
            
            tfoot tr:last-child {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            
            .total { 
              text-align: right; 
              font-weight: bold;
            }
            
            .footer { 
              margin-top: 40px; 
              text-align: center; 
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
            
            .footer p {
              margin: 5px 0;
            }
            
            .print-info {
              position: fixed;
              top: 10px;
              right: 10px;
              background-color: #007bff;
              color: white;
              padding: 10px 15px;
              border-radius: 5px;
              font-weight: bold;
            }
            
            .print-button {
              display: block;
              margin: 20px auto;
              padding: 12px 30px;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 5px;
              font-size: 16px;
              cursor: pointer;
            }
            
            .print-button:hover {
              background-color: #0056b3;
            }
            
            /* Print styles */
            @media print {
              body {
                padding: 0;
              }
              
              .print-button, .print-info {
                display: none;
              }
              
              .invoice-page {
                padding: 0;
                margin-bottom: 0;
                page-break-after: always;
              }
              
              .invoice-page:last-child {
                page-break-after: auto;
              }
            }
            
            /* Responsive styles */
            @media screen and (max-width: 768px) {
              body {
                padding: 10px;
              }
              
              .invoice-info {
                flex-direction: column;
              }
              
              .invoice-details {
                text-align: left;
                margin-top: 15px;
              }
              
              table {
                font-size: 14px;
              }
              
              th, td {
                padding: 8px 4px;
              }
              
              .header h1 {
                font-size: 22px;
              }
              
              .header h2 {
                font-size: 16px;
              }
              
              .print-info {
                position: static;
                margin: 10px;
                text-align: center;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-info">${invoices.length} Invoice(s) Ready to Print</div>
          ${allInvoicesHTML}
          <button class="print-button" onclick="window.print()">Print All Invoices (${invoices.length})</button>
        </body>
        </html>
      `)
      printWindow.document.close()
    } catch (error) {
      console.error('Error generating invoices:', error)
      alert('Failed to generate invoices')
    }
  }

  const getStatusBadge = (order) => {
    if (order.isDelivered) {
      return <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs sm:text-sm font-semibold">Delivered</span>
    } else if (order.isPaid) {
      return <span className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-semibold">Paid</span>
    } else {
      return <span className="px-2 sm:px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs sm:text-sm font-semibold">Pending</span>
    }
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    if (filter === 'pending') return !order.isPaid && !order.isDelivered
    if (filter === 'paid') return order.isPaid && !order.isDelivered
    if (filter === 'delivered') return order.isDelivered
    return true
  })

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Access Denied</p>
          <p className="text-sm sm:text-base">You must be an admin to manage orders.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      {/* New Order Notification */}
      {showNotification && (
        <div className="fixed top-16 sm:top-20 right-2 sm:right-4 bg-green-500 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-lg shadow-lg z-50 flex items-center space-x-2 animate-bounce max-w-xs sm:max-w-none">
          <FiBell className="text-lg sm:text-xl flex-shrink-0" />
          <span className="font-semibold text-sm sm:text-base">New Order! 🎉</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Manage Orders</h1>
          {newOrdersCount > 0 && (
            <p className="text-yellow-600 font-semibold mt-2 flex items-center space-x-2 text-sm sm:text-base">
              <FiBell className="flex-shrink-0" />
              <span>{newOrdersCount} new order(s)</span>
            </p>
          )}
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center space-x-2 bg-primary-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-primary-700 text-sm sm:text-base w-full sm:w-auto justify-center"
        >
          <FiRefreshCw className="flex-shrink-0" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Bulk Actions - Mobile Floating Button */}
      {selectedOrders.length > 0 && (
        <>
          {/* Mobile: Floating Action Button */}
          <div className="md:hidden fixed bottom-4 right-4 z-40">
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="bg-primary-600 text-white rounded-full p-4 shadow-lg flex items-center space-x-2"
            >
              <span className="font-bold">{selectedOrders.length}</span>
              {showBulkActions ? <FiX className="text-xl" /> : <FiCheckSquare className="text-xl" />}
            </button>
          </div>

          {/* Mobile: Bulk Actions Modal */}
          {showBulkActions && (
            <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
              <div className="bg-white rounded-t-2xl w-full p-4 space-y-3 animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold text-lg">
                    {selectedOrders.length} Selected
                  </span>
                  <button onClick={() => setShowBulkActions(false)}>
                    <FiX className="text-2xl" />
                  </button>
                </div>
                
                <button
                  onClick={() => {
                    bulkMarkAsPaid()
                    setShowBulkActions(false)
                  }}
                  className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700"
                >
                  <FiDollarSign />
                  <span>Mark All as Paid</span>
                </button>
                
                <button
                  onClick={() => {
                    bulkMarkAsDelivered()
                    setShowBulkActions(false)
                  }}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700"
                >
                  <FiTruck />
                  <span>Mark All as Delivered</span>
                </button>
                
                <button
                  onClick={() => {
                    printMultipleInvoices()
                    setShowBulkActions(false)
                  }}
                  className="w-full flex items-center justify-center space-x-2 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700"
                >
                  <FiPrinter />
                  <span>Print All ({selectedOrders.length})</span>
                </button>
                
                <button
                  onClick={() => {
                    setSelectedOrders([])
                    setShowBulkActions(false)
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Desktop: Bulk Actions Bar */}
          <div className="hidden md:flex bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 items-center justify-between flex-wrap gap-3">
            <span className="font-semibold text-blue-800">
              {selectedOrders.length} order(s) selected
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={bulkMarkAsPaid}
                className="flex items-center space-x-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 text-sm sm:text-base"
              >
                <FiDollarSign className="flex-shrink-0" />
                <span className="hidden sm:inline">Mark All as Paid</span>
                <span className="sm:hidden">Paid</span>
              </button>
              <button
                onClick={bulkMarkAsDelivered}
                className="flex items-center space-x-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
              >
                <FiTruck className="flex-shrink-0" />
                <span className="hidden sm:inline">Mark All as Delivered</span>
                <span className="sm:hidden">Delivered</span>
              </button>
              <button
                onClick={printMultipleInvoices}
                className="flex items-center space-x-2 bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-700 text-sm sm:text-base"
              >
                <FiPrinter className="flex-shrink-0" />
                <span>Print ({selectedOrders.length})</span>
              </button>
              <button
                onClick={() => setSelectedOrders([])}
                className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm sm:text-base"
              >
                Clear
              </button>
            </div>
          </div>
        </>
      )}

      {/* Filter Buttons */}
      <div className="mb-4 sm:mb-6">
        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg font-semibold transition text-sm sm:text-base whitespace-nowrap ${
              filter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All ({orders.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg font-semibold transition text-sm sm:text-base whitespace-nowrap ${
              filter === 'pending'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pending ({orders.filter(o => !o.isPaid && !o.isDelivered).length})
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg font-semibold transition text-sm sm:text-base whitespace-nowrap ${
              filter === 'paid'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Paid ({orders.filter(o => o.isPaid && !o.isDelivered).length})
          </button>
          <button
            onClick={() => setFilter('delivered')}
            className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg font-semibold transition text-sm sm:text-base whitespace-nowrap ${
              filter === 'delivered'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Delivered ({orders.filter(o => o.isDelivered).length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-white rounded-lg shadow-md">
          <FiPackage className="mx-auto text-4xl sm:text-6xl text-gray-400 mb-4" />
          <p className="text-gray-500 text-base sm:text-lg">No orders found</p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Select All */}
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-2 text-gray-700 hover:text-primary-600"
            >
              {selectedOrders.length === filteredOrders.length ? (
                <FiCheckSquare className="text-lg sm:text-xl flex-shrink-0" />
              ) : (
                <FiSquare className="text-lg sm:text-xl flex-shrink-0" />
              )}
              <span className="font-semibold text-sm sm:text-base">Select All</span>
            </button>
          </div>

          {/* Order Cards */}
          {filteredOrders.map((order) => (
            <div key={order._id} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              {/* Order Header */}
              <div className="flex items-start space-x-3 sm:space-x-4 mb-4">
                <button
                  onClick={() => handleSelectOrder(order._id)}
                  className="mt-1 flex-shrink-0"
                >
                  {selectedOrders.includes(order._id) ? (
                    <FiCheckSquare className="text-lg sm:text-xl text-primary-600" />
                  ) : (
                    <FiSquare className="text-lg sm:text-xl text-gray-400" />
                  )}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                    <h3 className="font-semibold text-base sm:text-lg truncate">
                      Order #{order._id.slice(-8)}
                    </h3>
                    {getStatusBadge(order)}
                  </div>
                  
                  <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                    <p className="truncate">
                      <strong>Customer:</strong> {order.user?.name || 'N/A'}
                    </p>
                    <p className="truncate">
                      <strong>Email:</strong> {order.user?.email || 'N/A'}
                    </p>
                    <p><strong>Placed:</strong> {new Date(order.createdAt).toLocaleString()}</p>
                    <p><strong>Payment:</strong> {order.paymentMethod}</p>
                  </div>
                </div>
                
                {/* Price - Desktop */}
                <div className="hidden sm:block text-right ml-4 flex-shrink-0">
                  <p className="font-bold text-xl md:text-2xl text-primary-600 mb-2">
                    ₹{order.totalPrice.toFixed(2)}
                  </p>
                  <div className="text-xs md:text-sm text-gray-600 space-y-1">
                    <p>Items: ₹{order.itemsPrice.toFixed(2)}</p>
                    <p>Tax: ₹{order.taxPrice.toFixed(2)}</p>
                    <p>Ship: ₹{order.shippingPrice.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Price - Mobile */}
              <div className="sm:hidden bg-gray-50 rounded p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Total Amount:</span>
                  <span className="font-bold text-xl text-primary-600">
                    ₹{order.totalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Items:</span>
                    <span>₹{order.itemsPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>₹{order.taxPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping:</span>
                    <span>₹{order.shippingPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div className="mb-4 p-3 bg-gray-50 rounded text-xs sm:text-sm">
                  <p className="font-semibold mb-1">Shipping Address:</p>
                  <p className="text-gray-600">
                    {order.shippingAddress.street}, {order.shippingAddress.city}, 
                    {order.shippingAddress.state} {order.shippingAddress.zipCode}, 
                    {order.shippingAddress.country}
                  </p>
                </div>
              )}

              {/* Order Items */}
              <div className="border-t pt-4 mb-4">
                <h4 className="font-semibold mb-3 text-sm sm:text-base">Order Items:</h4>
                <div className="space-y-2">
                  {order.orderItems.map((item) => (
                    <div key={item._id} className="flex items-center space-x-3 sm:space-x-4 bg-gray-50 p-2 sm:p-3 rounded">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm sm:text-base truncate">{item.name}</p>
                        <p className="text-gray-600 text-xs sm:text-sm">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-sm sm:text-base flex-shrink-0">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t pt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => printInvoice(order._id)}
                  className="flex items-center justify-center space-x-2 bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm flex-1 sm:flex-none"
                >
                  <FiPrinter className="flex-shrink-0" />
                  <span>Print</span>
                </button>
                
                {!order.isPaid && (
                  <button
                    onClick={() => markAsPaid(order._id)}
                    className="flex items-center justify-center space-x-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm flex-1 sm:flex-none"
                  >
                    <FiDollarSign className="flex-shrink-0" />
                    <span>Mark Paid</span>
                  </button>
                )}
                
                {order.isPaid && !order.isDelivered && (
                  <button
                    onClick={() => markAsDelivered(order._id)}
                    className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm flex-1 sm:flex-none"
                  >
                    <FiTruck className="flex-shrink-0" />
                    <span>Mark Delivered</span>
                  </button>
                )}
                
                {order.isPaid && (
                  <span className="flex items-center space-x-2 text-green-600 px-3 sm:px-4 py-2 text-xs sm:text-sm">
                    <FiCheckCircle className="flex-shrink-0" />
                    <span className="hidden sm:inline">Paid on {new Date(order.paidAt).toLocaleDateString()}</span>
                    <span className="sm:hidden">Paid</span>
                  </span>
                )}
                
                {order.isDelivered && (
                  <span className="flex items-center space-x-2 text-blue-600 px-3 sm:px-4 py-2 text-xs sm:text-sm">
                    <FiTruck className="flex-shrink-0" />
                    <span className="hidden sm:inline">Delivered on {new Date(order.deliveredAt).toLocaleDateString()}</span>
                    <span className="sm:hidden">Delivered</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add custom CSS for hiding scrollbar */}
      <style jsx>{`
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

export default ManageOrders