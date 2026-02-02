import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { FiPackage, FiPrinter } from 'react-icons/fi'

const Orders = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchOrders()
    }
  }, [user])

  const fetchOrders = async () => {
    try {
      const res = await axios.get('/api/orders/myorders')
      setOrders(res.data)
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

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
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total { text-align: right; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; color: #666; border-top: 2px solid #333; padding-top: 20px; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Ghee Store</h1>
            <h2>Invoice ${invoice.invoiceNumber}</h2>
          </div>
          <div class="invoice-info">
            <div>
              <h3>Bill To:</h3>
              <p>${invoice.customer.name}<br>
              ${invoice.customer.email}<br>
              ${invoice.customer.address?.street || ''}<br>
              ${invoice.customer.address?.city || ''}, ${invoice.customer.address?.state || ''} ${invoice.customer.address?.zipCode || ''}<br>
              ${invoice.customer.address?.country || ''}</p>
            </div>
            <div>
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
                <td colspan="3" class="total">Total:</td>
                <td>₹${invoice.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Payment Method: ${invoice.paymentMethod}</p>
          </div>
          <button onclick="window.print()" style="padding: 10px 20px; background: #f97316; color: white; border: none; border-radius: 5px; cursor: pointer;">Print Invoice</button>
        </body>
        </html>
      `)
      printWindow.document.close()
    } catch (error) {
      console.error('Error generating invoice:', error)
      alert('Failed to generate invoice')
    }
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-center text-gray-500">Please log in to view your orders</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl font-bold mb-8">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <FiPackage className="mx-auto text-6xl text-gray-400 mb-4" />
          <p className="text-gray-500 text-lg">You have no orders yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order._id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Order #{order._id.slice(-8)}</h3>
                  <p className="text-gray-600 text-sm">
                    Placed on {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-primary-600">₹{order.totalPrice.toFixed(2)}</p>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    order.isDelivered
                      ? 'bg-green-100 text-green-800'
                      : order.isPaid
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.isDelivered ? 'Delivered' : order.isPaid ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                {order.orderItems.map((item) => (
                  <div key={item._id} className="flex items-center space-x-4 mb-4">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-gray-600 text-sm">Quantity: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">₹{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 flex justify-end">
                <button
                  onClick={() => printInvoice(order._id)}
                  className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                >
                  <FiPrinter />
                  <span>Print Invoice</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Orders
