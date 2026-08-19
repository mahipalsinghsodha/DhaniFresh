// pages/Addresses.jsx — Redirects to Unified Account Dashboard (Tab: Addresses)
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const Addresses = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/profile?tab=addresses', { replace: true })
  }, [navigate])

  return null
}

export default Addresses
