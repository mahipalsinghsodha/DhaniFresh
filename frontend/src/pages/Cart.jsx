import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { FiTrash2, FiMinus, FiPlus } from 'react-icons/fi'
import { toast } from 'react-toastify'

const Cart = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [cart, setCart] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    fetchCart()
  }, [user])

  const fetchCart = async () => {
    try {
      const res = await axios.get('/api/cart')
      setCart(res.data)
    } catch (error) {
      console.error('Error fetching cart:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateQuantity = async (itemId, newQuantity,itemstock) => {
    if (newQuantity < 1) return
   console.log(itemstock)
      if (newQuantity > itemstock) {
        toast.error(`Only ${itemstock} item(s) available in stock`)
        return
     }

    try {
      
      await axios.put(`/api/cart/items/${itemId}`, { quantity: newQuantity })
      fetchCart()
    } catch (error) {
      console.error('Error updating cart:', error)
    }
  }

  const removeItem = async (itemId) => {
    try {
      await axios.delete(`/api/cart/items/${itemId}`)
      fetchCart()
    } catch (error) {
      console.error('Error removing item:', error)
    }
  }

  const calculateTotal = () => {
    if (!cart || !cart.items) return { subtotal: 0, tax: 0, shipping: 0, total: 0 }
    
    const subtotal = cart.items.reduce(
      (sum, item) => sum + (item.product?.price || 0) * item.quantity,
      0
    )
    const tax = subtotal * 0.18 // 18% GST
    const shipping = subtotal > 500 ? 0 : 50
    const total = subtotal + tax + shipping

    return { subtotal, tax, shipping, total }
  }

  const handleCheckout = () => {
    navigate('/checkout')
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

  const totals = calculateTotal()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl font-bold mb-8">Shopping Cart</h1>

      {!cart || cart.items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">Your cart is empty</p>
          <button
            onClick={() => navigate('/products')}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {cart.items.map((item) => (
            
              <div
                key={item._id}
                className="bg-white rounded-lg shadow-md p-6 mb-4 flex items-center space-x-4"
              >
                <img
                  src={item.product?.image}
                  alt={item.product?.name}
                  className="w-24 h-24 object-cover rounded"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{item.product?.name}</h3>
                  <p className="text-gray-600">{item.product?.weight}</p>
                  <p className="text-primary-600 font-bold">₹{item.product?.price}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => updateQuantity(item._id, item.quantity - 1,item.product.stock)}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <FiMinus />
                  </button>
                  <span className="px-4">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item._id, item.quantity + 1,item.product.stock)}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <FiPlus />
                  </button>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">₹{(item.product?.price || 0) * item.quantity}</p>
                  <button
                    onClick={() => removeItem(item._id)}
                    className="text-red-600 hover:text-red-700 mt-2"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-20">
              <h2 className="text-2xl font-bold mb-4">Order Summary</h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (18%):</span>
                  <span>₹{totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping:</span>
                  <span>{totals.shipping === 0 ? 'Free' : `₹${totals.shipping.toFixed(2)}`}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>₹{totals.total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Cart
