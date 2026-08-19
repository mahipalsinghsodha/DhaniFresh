// pages/ChangePassword.jsx — Redirects to Unified Account Dashboard (Tab: Password)
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const ChangePassword = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/profile?tab=password', { replace: true })
  }, [navigate])

  return null
}

export default ChangePassword
