import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiShoppingCart, FiUser, FiLogOut, FiMenu, FiX } from 'react-icons/fi'
import { useState, useEffect } from 'react'
import axios from 'axios'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [cartCount, setCartCount] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (user) {
      fetchCartCount()
    }
  }, [user])

  const fetchCartCount = async () => {
    try {
      const res = await axios.get('/api/cart')
      const count = res.data.items.reduce((sum, item) => sum + item.quantity, 0)
      setCartCount(count)
    } catch (error) {
      console.error('Error fetching cart:', error)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
    setIsMobileMenuOpen(false)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2" onClick={closeMobileMenu}>
            <span className="text-xl sm:text-2xl font-bold text-primary-600">🥛 Ghee Store</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <Link to="/" className="text-gray-700 hover:text-primary-600 transition">
              Home
            </Link>
            <Link to="/products" className="text-gray-700 hover:text-primary-600 transition">
              Products
            </Link>
            {user ? (
              <>
                <Link to="/cart" className="relative text-gray-700 hover:text-primary-600 transition">
                  <FiShoppingCart className="text-xl" />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <Link to="/orders" className="text-gray-700 hover:text-primary-600 transition">
                  Orders
                </Link>
                {user.role === 'admin' && (
                  <Link to="/admin" className="text-gray-700 hover:text-primary-600 transition font-semibold">
                    Admin
                  </Link>
                )}
                <Link to="/profile" className="text-gray-700 hover:text-primary-600 transition">
                  <FiUser className="text-xl" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-700 hover:text-primary-600 transition"
                >
                  <FiLogOut className="text-xl" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-primary-600 transition">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button & Cart Icon */}
          <div className="flex md:hidden items-center space-x-4">
            {user && (
              <Link to="/cart" className="relative text-gray-700" onClick={closeMobileMenu}>
                <FiShoppingCart className="text-xl" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-700 hover:text-primary-600 transition"
            >
              {isMobileMenuOpen ? <FiX className="text-2xl" /> : <FiMenu className="text-2xl" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="px-4 pt-2 pb-4 space-y-3 bg-white border-t">
          <Link
            to="/"
            className="block text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition"
            onClick={closeMobileMenu}
          >
            Home
          </Link>
          <Link
            to="/products"
            className="block text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition"
            onClick={closeMobileMenu}
          >
            Products
          </Link>
          {user ? (
            <>
              <Link
                to="/orders"
                className="block text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition"
                onClick={closeMobileMenu}
              >
                Orders
              </Link>
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className="block text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition font-semibold"
                  onClick={closeMobileMenu}
                >
                  Admin Panel
                </Link>
              )}
              <Link
                to="/profile"
                className="block text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition"
                onClick={closeMobileMenu}
              >
                <div className="flex items-center space-x-2">
                  <FiUser className="text-lg" />
                  <span>Profile</span>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-left text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition"
              >
                <div className="flex items-center space-x-2">
                  <FiLogOut className="text-lg" />
                  <span>Logout</span>
                </div>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="block text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition"
                onClick={closeMobileMenu}
              >
                Login
              </Link>
              <Link
                to="/register"
                className="block bg-primary-600 text-white text-center px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                onClick={closeMobileMenu}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar