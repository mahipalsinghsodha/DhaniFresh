import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import axios from 'axios'
import {
  FiPlus,
  FiPackage,
  FiShoppingBag,
  FiAlertCircle
} from 'react-icons/fi'

/* -------------------- COUNTER HOOK -------------------- */
const useCountUp = (end, duration = 600) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const increment = end / (duration / 16)

    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)

    return () => clearInterval(timer)
  }, [end, duration])

  return count
}

/* -------------------- MAIN COMPONENT -------------------- */
const AdminDashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchStats()
    } else {
      setLoading(false)
    }
  }, [user])

  const fetchStats = async () => {
    try {
      setLoading(true)

      const [productsRes, ordersRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/orders')
      ])

      const products = productsRes?.data || []
      const orders = ordersRes?.data?.orders || []

      const pendingOrders = orders.filter(
        order => !order.isPaid || !order.isDelivered
      ).length

      setStats({
        totalProducts: products.length,
        totalOrders: orders.length,
        pendingOrders
      })
    } catch (err) {
      console.error(err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  /* -------------------- GUARDS -------------------- */

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-6 rounded-xl max-w-md w-full">
          <h2 className="font-bold text-lg mb-2">Please Login</h2>
          <p>You must be logged in to access the admin panel.</p>
        </div>
      </div>
    )
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-red-100 border border-red-400 text-red-700 p-6 rounded-xl max-w-lg w-full">
          <h2 className="font-bold text-lg mb-2">Access Denied</h2>
          <p>You must be an admin to access this page.</p>

          <div className="mt-4 text-sm">
            <p>Your role: <strong>{user.role}</strong></p>
            <p>Email: <strong>{user.email}</strong></p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg font-semibold animate-pulse">
          Loading dashboard...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-red-50 border border-red-300 text-red-700 p-6 rounded-xl max-w-md w-full flex items-center gap-3">
          <FiAlertCircle className="text-2xl" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  /* -------------------- DASHBOARD -------------------- */

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold">
          Admin Dashboard
        </h1>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/admin/orders')}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <FiShoppingBag />
            Manage Orders
          </button>

          <button
            onClick={() => navigate('/admin/add-product')}
            className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
          >
            <FiPlus />
            Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={<FiPackage />}
        />

        <StatCard
          title="Pending Orders"
          value={stats.pendingOrders}
          icon={<FiAlertCircle />}
          highlight
        />

        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={<FiShoppingBag />}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold mb-5">
          Quick Actions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <QuickCard
            title="Add New Product"
            description="Create a new product in the store"
            icon={<FiPlus />}
            onClick={() => navigate('/admin/add-product')}
          />

          <QuickCard
            title="Manage Orders"
            description="View and update customer orders"
            icon={<FiShoppingBag />}
            onClick={() => navigate('/admin/orders')}
          />

          <QuickCard
            title="View Products"
            description="Browse all store products"
            icon={<FiPackage />}
            onClick={() => navigate('/products')}
          />
        </div>
      </div>
    </div>
  )
}

/* -------------------- UI COMPONENTS -------------------- */

const StatCard = ({ title, value, icon, highlight }) => {
  const animatedValue = useCountUp(value)

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition p-6 flex items-center justify-between">
      <div>
        <p className="text-gray-500 text-sm mb-1">{title}</p>
        <p className={`text-4xl font-bold ${highlight ? 'text-yellow-600' : 'text-gray-900'}`}>
          {animatedValue}
        </p>
      </div>

      <div className={`h-14 w-14 flex items-center justify-center rounded-full text-2xl
        ${highlight ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
        {icon}
      </div>
    </div>
  )
}

const QuickCard = ({ title, description, icon, onClick }) => (
  <button
    onClick={onClick}
    className="bg-gray-50 hover:bg-white border rounded-2xl p-6 text-left transition shadow-sm hover:shadow-md"
  >
    <div className="text-3xl text-blue-600 mb-3">
      {icon}
    </div>
    <h3 className="font-semibold text-lg mb-1">
      {title}
    </h3>
    <p className="text-sm text-gray-600">
      {description}
    </p>
  </button>
)

export default AdminDashboard
