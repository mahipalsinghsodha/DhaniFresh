import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { toast } from 'react-toastify'
import { FiGift, FiUser, FiMail, FiMessageSquare } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const GiftCards = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    amount: 500,
    senderName: user ? user.name : '',
    recipientName: '',
    recipientEmail: '',
    message: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  useEffect(() => {
    // Dynamically load Razorpay script
    if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const amounts = [500, 1000, 2000, 5000]

  const handleAmountClick = (amt) => {
    setFormData(prev => ({ ...prev, amount: amt }))
    setCustomAmount('')
  }

  const handleCustomAmountChange = (e) => {
    const val = e.target.value.replace(/\D/g, '')
    setCustomAmount(val)
    if (val && parseInt(val) >= 100) {
      setFormData(prev => ({ ...prev, amount: parseInt(val) }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.amount < 100) return toast.error('Minimum amount is ₹100')
    if (!formData.senderName || !formData.recipientName || !formData.recipientEmail) {
      return toast.error('Please fill all required fields')
    }

    setLoading(true)
    try {
      // 1. Create order
      const { data: order } = await api.post('/api/giftcards/purchase', formData)
      
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'dummy', 
        amount: order.amount,
        currency: order.currency,
        name: 'Daatasa',
        description: 'Gift Card Purchase',
        order_id: order.orderId,
        handler: async function (response) {
          try {
            // 2. Verify payment
            await api.post('/api/giftcards/verify', {
              ...response,
              ...formData
            })
            toast.success('Gift card purchased successfully! It has been emailed to the recipient.')
            setFormData({
              amount: 500, senderName: user ? user.name : '', recipientName: '', recipientEmail: '', message: ''
            })
            setCustomAmount('')
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment verification failed')
          }
        },
        prefill: {
          name: formData.senderName,
          email: user ? user.email : '',
        },
        theme: { color: '#1B2F6E' },
        modal: {
          ondismiss: () => {
            setLoading(false)
            toast.info('Payment cancelled')
          }
        }
      }

      if (process.env.NODE_ENV === 'development' && (!options.key || options.key === 'dummy')) {
         // Simulate successful payment if no razorpay key
         toast.info('Simulating payment for development')
         await api.post('/api/giftcards/verify', {
           razorpay_order_id: order.orderId,
           razorpay_payment_id: 'dummy_payment_id',
           razorpay_signature: 'dummy_signature',
           ...formData
         })
         toast.success('Gift card purchased successfully! (Simulated)')
         setLoading(false)
      } else {
         const rzp = new window.Razorpay(options)
         rzp.on('payment.failed', function (response) {
           toast.error(response.error.description || 'Payment failed')
           setLoading(false)
         })
         rzp.open()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate purchase')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--ivory)] font-sans pb-20">
      <Helmet>
        <title>Gift Cards — Daatasa</title>
        <meta name="description" content="Send the gift of pure Bilona ghee to your loved ones." />
      </Helmet>

      {/* Header */}
      <div className="relative overflow-hidden py-20 bg-brand-primary text-white text-center">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay" />
        <div className="max-w-[800px] mx-auto px-6 relative z-10">
          <div className="w-16 h-16 rounded-full bg-white/10 mx-auto flex items-center justify-center mb-6">
            <FiGift size={32} className="text-brand-secondary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">Give the Gift of Health</h1>
          <p className="text-white/80">Daatasa e-Gift Cards are delivered instantly via email and can be redeemed on any product.</p>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-[2rem] p-6 sm:p-10 shadow-sm border border-brand-primary/10">
          
          <div className="aspect-[1.6/1] bg-gradient-to-tr from-brand-primary to-brand-primary/80 rounded-2xl p-6 text-white mb-10 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl"></div>
            <div>
              <p className="text-white/70 text-sm font-bold tracking-widest uppercase mb-1">Daatasa</p>
              <p className="font-display text-2xl font-bold">e-Gift Card</p>
            </div>
            <div className="flex justify-between items-end">
              <p className="text-4xl font-display font-bold text-brand-secondary">₹{formData.amount}</p>
              <FiGift size={32} className="text-white/30" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-brand-primary mb-3">Select Amount</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {amounts.map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleAmountClick(amt)}
                    className={`py-3 rounded-xl font-bold border transition-colors ${
                      formData.amount === amt && !customAmount
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'bg-[var(--ivory)] text-brand-primary border-brand-primary/10 hover:border-brand-primary/30'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Or enter custom amount (Min ₹100)" 
                value={customAmount}
                onChange={handleCustomAmountChange}
                className="w-full h-12 px-4 rounded-xl bg-[var(--ivory)] border border-brand-primary/10 text-brand-primary outline-none focus:border-brand-secondary font-medium"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-brand-primary mb-2">Sender's Name</label>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/40" />
                  <input type="text" required value={formData.senderName} onChange={e => setFormData({...formData, senderName: e.target.value})} className="w-full h-12 pl-10 pr-4 rounded-xl bg-[var(--ivory)] border border-brand-primary/10 outline-none focus:border-brand-secondary" placeholder="Your name" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-brand-primary mb-2">Recipient's Name</label>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/40" />
                  <input type="text" required value={formData.recipientName} onChange={e => setFormData({...formData, recipientName: e.target.value})} className="w-full h-12 pl-10 pr-4 rounded-xl bg-[var(--ivory)] border border-brand-primary/10 outline-none focus:border-brand-secondary" placeholder="Their name" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-brand-primary mb-2">Recipient's Email</label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/40" />
                <input type="email" required value={formData.recipientEmail} onChange={e => setFormData({...formData, recipientEmail: e.target.value})} className="w-full h-12 pl-10 pr-4 rounded-xl bg-[var(--ivory)] border border-brand-primary/10 outline-none focus:border-brand-secondary" placeholder="Where should we send it?" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-brand-primary mb-2">Personal Message (Optional)</label>
              <div className="relative">
                <FiMessageSquare className="absolute left-4 top-4 text-brand-text/40" />
                <textarea rows="3" value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} className="w-full py-3 pl-10 pr-4 rounded-xl bg-[var(--ivory)] border border-brand-primary/10 outline-none focus:border-brand-secondary resize-none" placeholder="Add a sweet note..."></textarea>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full btn btn-primary h-14 rounded-xl font-bold flex items-center justify-center gap-2">
              {loading ? 'Processing...' : `Pay ₹${formData.amount}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default GiftCards
