import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { FiStar, FiShoppingCart } from 'react-icons/fi'

const ProductDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)

  useEffect(() => {
    fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      const res = await axios.get(`/api/products/${id}`)
      setProduct(res.data)
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditProduct = () => {
  navigate(`/products/edit/${product._id}`)
}
  const handleAddToCart = async () => {
    if (!user) {
      navigate('/login')
      return
    }

    try {
      await axios.post('/api/cart/items', {
        productId: product._id,
        quantity: quantity
      })
      setAddedToCart(true)
      setTimeout(() => setAddedToCart(false), 3000)
    } catch (error) {
      console.error('Error adding to cart:', error)
      alert('Failed to add to cart')
    }
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

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-center text-gray-500">Product not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Image */}
        <div>
          <img
            src={product.image}
            alt={product.name}
            className="w-full rounded-lg shadow-lg"
          />
        </div>

        {/* Product Info */}
        <div>
          <div className="mb-4">
            <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-semibold">
              {product.category.toUpperCase()}
            </span>
          </div>
          <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
          <div className="flex items-center mb-4">
            <FiStar className="text-yellow-400 fill-current" />
            <span className="ml-2 text-lg">{product.rating.toFixed(1)}</span>
            <span className="text-gray-500 ml-2">({product.numReviews} reviews)</span>
          </div>
          <p className="text-gray-600 mb-6 text-lg">{product.description}</p>

          <div className="border-t border-b py-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600">Weight:</span>
              <span className="font-semibold">{product.weight}</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600">Stock:</span>
              <span className={product.stock > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                {product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Price:</span>
              <span className="text-3xl font-bold text-primary-600">₹{product.price}</span>
            </div>
          </div>
          {user?.role === 'admin' && (
             <button
               onClick={handleEditProduct}
               className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded"
             >
                          Edit Product
             </button>
           )}
          {product.stock > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="text-gray-700 font-semibold">Quantity:</label>
                <div className="flex items-center border rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="px-6 py-2">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="px-4 py-2 hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={addedToCart}
                className={`w-full py-3 rounded-lg font-semibold transition flex items-center justify-center space-x-2 ${
                  addedToCart
                    ? 'bg-green-600 text-white'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                <FiShoppingCart />
                <span>{addedToCart ? 'Added to Cart!' : 'Add to Cart'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductDetail
