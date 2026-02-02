import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import ProductCard from '../components/ProductCard'

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get('category') || 'all'
  )

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  /* -------------------- DEBOUNCE -------------------- */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 500) // ⏱️ debounce delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  /* -------------------- API CALL -------------------- */
  useEffect(() => {
    fetchProducts()
  }, [selectedCategory, debouncedSearch])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = {}

      if (selectedCategory !== 'all') {
        params.category = selectedCategory
      }

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch
      }

      const res = await axios.get('/api/products', { params })
      setProducts(res.data)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    category === 'all'
      ? setSearchParams({})
      : setSearchParams({ category })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">
        Our Ghee Products
      </h1>

      {/* Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap gap-4 justify-center">
          {['all', 'a1', 'a2'].map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-6 py-2 rounded-lg font-semibold ${
                selectedCategory === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="max-w-md mx-auto">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Products */}
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : products.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No products found
        </div>
      )}
    </div>
  )
}

export default Products
