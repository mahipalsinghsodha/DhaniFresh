import { Link } from 'react-router-dom'
import { FiStar } from 'react-icons/fi'

const ProductCard = ({ product }) => {
  return (
    <Link
      to={`/products/${product._id}`}
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition transform hover:scale-105"
    >
      <div className="relative">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-64 object-cover"
        />
        {product.featured && (
          <span className="absolute top-2 right-2 bg-primary-600 text-white px-2 py-1 rounded text-sm">
            Featured
          </span>
        )}
        <span className="absolute top-2 left-2 bg-white px-2 py-1 rounded text-sm font-semibold text-primary-600">
          {product.category.toUpperCase()}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{product.name}</h3>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <FiStar className="text-yellow-400 fill-current" />
            <span className="ml-1 text-sm">{product.rating.toFixed(1)}</span>
            <span className="text-gray-500 text-sm ml-1">({product.numReviews})</span>
          </div>
          <span className="text-sm text-gray-600">{product.weight}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-primary-600">₹{product.price}</span>
          {product.stock > 0 ? (
            <span className="text-green-600 text-sm">In Stock</span>
          ) : (
            <span className="text-red-600 text-sm">Out of Stock</span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
