import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../context/ConfirmContext'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import {
  FiUser, FiMapPin, FiPlus, FiEdit2, FiTrash2,
  FiX, FiHome, FiBriefcase, FiStar,
  FiChevronRight, FiPackage, FiLogOut, FiCheck,
  FiAlertCircle, FiPhone, FiChevronDown, FiLock
} from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'

const STATES = [
  'Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam',
  'Bihar','Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir',
  'Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry',
  'Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
]

const emptyAddr = {
  label: 'Home', name: '', phone: '', street: '',
  city: '', district: '', state: '', zipCode: '', country: 'India', isDefault: false,
}

// ── Shared Floating Input System ────────────────────────────────
const FloatingInput = ({ id, label, type = 'text', value, onChange, icon: Icon, rightElement, autoComplete, required, disabled, maxLength, inputMode }) => {
  const [focused, setFocused] = useState(false)

  return (
    <div className="relative w-full">
      <label htmlFor={id} className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200"
            style={{ color: focused ? 'var(--gold)' : 'var(--text-muted)' }}>
            <Icon size={16} />
          </div>
        )}
        <input
          id={id} type={type} value={value} onChange={onChange}
          autoComplete={autoComplete} required={required} disabled={disabled}
          maxLength={maxLength} inputMode={inputMode} placeholder={`Enter ${label.toLowerCase()}`}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full rounded-[1rem] text-sm font-medium outline-none transition-all placeholder:text-brand-text/30"
          style={{
            height: '52px',
            paddingLeft: Icon ? '42px' : '14px',
            paddingRight: rightElement ? '44px' : '14px',
            background: disabled ? 'var(--ivory)' : (focused ? '#FFFFFF' : 'var(--ivory)'),
            border: `1px solid ${focused ? 'var(--brand-secondary)' : 'rgba(27, 47, 110, 0.2)'}`,
            color: 'var(--brand-primary)',
            boxShadow: focused ? '0 0 0 1px var(--brand-secondary)' : 'none',
            opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
        {rightElement && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    </div>
  )
}

const FloatingSelect = ({ id, label, value, onChange, required, children, icon: Icon }) => {
  const [focused, setFocused] = useState(false)

  return (
    <div className="relative w-full">
      <label htmlFor={id} className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200"
            style={{ color: focused ? 'var(--gold)' : 'var(--text-muted)' }}>
            <Icon size={16} />
          </div>
        )}
        <select
          id={id} value={value} onChange={onChange} required={required}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full rounded-[1rem] text-sm font-medium outline-none transition-all appearance-none"
          style={{
            height: '52px',
            paddingLeft: Icon ? '42px' : '14px', paddingRight: '44px',
            background: focused ? '#FFFFFF' : 'var(--ivory)',
            border: `1px solid ${focused ? 'var(--brand-secondary)' : 'rgba(27, 47, 110, 0.2)'}`,
            color: 'var(--brand-primary)',
            boxShadow: focused ? '0 0 0 1px var(--brand-secondary)' : 'none',
          }}
        >
          {children}
        </select>
        <FiChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  )
}

const Addresses = () => {
  const { user, logout } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [addresses, setAddresses] = useState([])
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [addrForm, setAddrForm]   = useState(emptyAddr)
  const [addrLoading, setAddrLoading] = useState(false)
  const [pinLoading, setPinLoading]   = useState(false)
  const [pinError, setPinError]       = useState('')

  useEffect(() => {
    if (user) {
      fetchAddresses()
    }
  }, [user])

  const fetchAddresses = async () => {
    try {
      const res = await api.get('/api/auth/me')
      setAddresses(res.data.addresses || [])
    } catch {}
  }

  // ── PIN lookup with auto-fill ──────────────────────────────────────────────
  const handlePinChange = async (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6)
    setPinError('')
    setAddrForm(p => ({ ...p, zipCode: cleaned }))
    if (cleaned.length === 6) {
      setPinLoading(true)
      try {
        const res = await api.get(`/api/pincode/${cleaned}`)
        const data = res.data
        if (data[0]?.Status === 'Success' && data[0].PostOffice?.length) {
          const po = data[0].PostOffice[0]
          setAddrForm(p => ({
            ...p,
            zipCode: cleaned,
            state:    po.State,
            district: po.District,
            city:     po.Division || po.District,
          }))
          toast.success(`PIN found: ${po.District}, ${po.State}`)
        } else {
          setPinError('PIN code not found. Please fill details manually.')
        }
      } catch {
        setPinError('Could not fetch PIN data. Please fill manually.')
      } finally {
        setPinLoading(false)
      }
    }
  }

  const handleAddrSubmit = async (e) => {
    e.preventDefault()
    if (!/^[6-9][0-9]{9}$/.test(addrForm.phone)) {
      toast.error('Enter a valid 10-digit mobile number')
      return
    }
    if (!/^[0-9]{6}$/.test(addrForm.zipCode)) {
      toast.error('Enter a valid 6-digit PIN code')
      return
    }
    setAddrLoading(true)
    try {
      const res = editId
        ? await api.put(`/api/auth/addresses/${editId}`, addrForm)
        : await api.post('/api/auth/addresses', addrForm)
      setAddresses(res.data.addresses)
      setShowForm(false)
      setEditId(null)
      setAddrForm(emptyAddr)
      toast.success(editId ? 'Address updated!' : 'Address saved!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save address')
    } finally {
      setAddrLoading(false)
    }
  }

  const handleDeleteAddress = async (id) => {
    if (!(await confirm('Delete this address?'))) return
    try {
      const res = await api.delete(`/api/auth/addresses/${id}`)
      setAddresses(res.data.addresses)
      toast.success('Address removed')
    } catch {
      toast.error('Could not delete address')
    }
  }

  const handleSetDefault = async (id) => {
    try {
      const res = await api.patch(`/api/auth/addresses/${id}/default`)
      setAddresses(res.data.addresses)
      toast.success('Default address updated')
    } catch {
      toast.error('Failed to set default')
    }
  }

  const openEdit = (addr) => {
    setAddrForm(addr)
    setEditId(addr._id)
    setShowForm(true)
    setPinError('')
  }

  const openNew = () => {
    setAddrForm(emptyAddr)
    setEditId(null)
    setShowForm(true)
    setPinError('')
  }

  if (!user) return null

  return (
    <div className="min-h-screen pb-16 bg-[var(--ivory)] font-sans text-brand-text">

      {/* ── Page header ── */}
      <div className="bg-white border-b border-brand-primary/10 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 py-12 text-center">
          <h1 className="text-4xl font-bold font-display text-brand-primary">My Addresses</h1>
          <p className="text-base mt-3 text-brand-text/60 font-medium">Manage your delivery addresses</p>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* ── Left sidebar ── */}
          <div className="space-y-6">

            {/* Avatar card */}
            <div className="rounded-[2rem] p-8 text-center shadow-sm bg-white border border-brand-primary/10">
              <div className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center text-4xl font-bold mx-auto mb-5 shadow-sm bg-brand-primary text-white">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <p className="text-xl font-bold font-display text-brand-primary">{user.name}</p>
              <p className="text-sm mt-1 text-brand-text/60">{user.email}</p>
              <span className={`inline-block mt-4 px-4 py-1.5 text-xs font-bold rounded-full uppercase tracking-widest ${
                  user.role === 'admin' || user.role === 'superadmin'
                    ? 'bg-purple-100 text-purple-700'
                    : user.role === 'courier'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-brand-primary/5 text-brand-primary'
                }`}>
                {user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : user.role === 'courier' ? 'Courier' : 'Customer'}
              </span>
            </div>

            {/* Nav links */}
            <div className="rounded-[2rem] overflow-hidden shadow-sm bg-white border border-brand-primary/10">
              {[
                { label: 'Profile', icon: FiUser, to: '/profile' },
                { label: 'My Addresses', icon: FiMapPin, to: '/addresses', active: true },
                { label: 'My Orders', icon: FiPackage, to: '/orders' },
                { label: 'Change Password', icon: FiLock, to: '/change-password' },
                { label: 'Sign Out', icon: FiLogOut, danger: true, action: () => { logout(); navigate('/') } },
              ].map((item, i, arr) => (
                <button
                  key={i}
                  onClick={item.action || (() => navigate(item.to))}
                  className="w-full flex items-center justify-between px-6 py-5 text-sm font-bold transition-all hover:bg-[var(--ivory)]"
                  style={{ 
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(27, 47, 110, 0.05)' : 'none', 
                    color: item.danger ? '#ef4444' : (item.active ? 'var(--brand-secondary)' : 'var(--brand-primary)'),
                    background: item.active ? 'var(--ivory)' : 'transparent'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className={item.danger ? 'text-red-500' : (item.active ? 'text-brand-secondary' : 'text-brand-text/40')} />
                    {item.label}
                  </div>
                  {!item.active && <FiChevronRight size={18} className="text-brand-text/30" />}
                </button>
              ))}
            </div>
          </div>

          {/* ── Right main content ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* ── Addresses ── */}
            <div className="rounded-[2rem] p-8 lg:p-10 shadow-sm bg-white border border-brand-primary/10">
              <div className="flex items-center justify-between mb-8 border-b border-brand-primary/5 pb-4">
                <h2 className="text-xl font-bold font-display text-brand-primary flex items-center gap-3">
                  <FiMapPin size={20} className="text-brand-secondary" /> Saved Addresses
                </h2>
                {!showForm && (
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={openNew} 
                    className="btn btn-primary px-5 h-10 rounded-full flex items-center gap-2 text-sm"
                  >
                    <FiPlus size={16} /> Add Address
                  </motion.button>
                )}
              </div>

              <AnimatePresence mode="wait">

                {/* ── Address Form ── */}
                {showForm && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-[1.5rem] p-6 mb-6 bg-[var(--ivory)] border border-brand-primary/10"
                  >
                    <div className="flex items-center justify-between mb-6 border-b border-brand-primary/5 pb-3">
                      <h3 className="text-base font-bold text-brand-primary">{editId ? 'Edit Address' : 'New Address'}</h3>
                      <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} className="text-brand-text/40 hover:text-red-500 transition-colors">
                        <FiX size={20} />
                      </button>
                    </div>

                    <form onSubmit={handleAddrSubmit} className="space-y-5">

                      {/* Label selector */}
                      <div>
                        <label className="block text-sm font-semibold mb-3 text-brand-text/70">Address Type</label>
                        <div className="flex gap-4">
                          {['Home', 'Work', 'Other'].map(l => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => setAddrForm(p => ({ ...p, label: l }))}
                              className={`flex-1 py-3 rounded-full text-sm font-bold transition-all ${
                                addrForm.label === l
                                  ? 'bg-brand-primary text-white shadow-sm'
                                  : 'bg-white text-brand-text/60 border border-brand-primary/10 hover:border-brand-primary/30'
                              }`}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <FloatingInput
                            id="addr_name"
                            label="Recipient Name"
                            icon={FiUser}
                            required
                            value={addrForm.name}
                            onChange={e => setAddrForm(p => ({ ...p, name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <FloatingInput
                            id="addr_phone"
                            label="Phone Number"
                            icon={FiPhone}
                            type="tel"
                            required
                            maxLength={10}
                            inputMode="numeric"
                            value={addrForm.phone}
                            onChange={e => setAddrForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                          />
                          {addrForm.phone && !/^[6-9][0-9]{9}$/.test(addrForm.phone) && addrForm.phone.length === 10 && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                              <FiAlertCircle size={11} /> Invalid number
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <FloatingInput
                          id="addr_street"
                          label="Street Address (House no., street, area)"
                          icon={FiMapPin}
                          required
                          value={addrForm.street}
                          onChange={e => setAddrForm(p => ({ ...p, street: e.target.value }))}
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <div className="relative">
                            <FloatingInput
                              id="addr_pin"
                              label="PIN Code"
                              type="text"
                              required
                              maxLength={6}
                              inputMode="numeric"
                              value={addrForm.zipCode}
                              onChange={e => handlePinChange(e.target.value)}
                              rightElement={
                                pinLoading ? (
                                  <div className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-500 rounded-full animate-spin" />
                                ) : (!pinLoading && addrForm.zipCode.length === 6 && !pinError && addrForm.city ? (
                                  <FiCheck className="text-green-500" size={16} />
                                ) : null)
                              }
                            />
                          </div>
                          {pinError && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                              <FiAlertCircle size={11} /> {pinError}
                            </p>
                          )}
                          {!pinError && addrForm.city && addrForm.zipCode.length === 6 && (
                            <p className="text-xs text-green-600 mt-1">✓ Auto-filled from PIN</p>
                          )}
                        </div>
                        <div>
                          <FloatingInput
                            id="addr_city"
                            label="City"
                            type="text"
                            required
                            value={addrForm.city}
                            onChange={e => setAddrForm(p => ({ ...p, city: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <FloatingInput
                            id="addr_district"
                            label="District"
                            type="text"
                            value={addrForm.district}
                            onChange={e => setAddrForm(p => ({ ...p, district: e.target.value }))}
                          />
                        </div>
                        <div>
                          <FloatingSelect
                            id="addr_state"
                            label="State"
                            required
                            value={addrForm.state}
                            onChange={e => setAddrForm(p => ({ ...p, state: e.target.value }))}
                          >
                            <option value="" disabled hidden></option>
                            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                          </FloatingSelect>
                        </div>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer p-4 rounded-[1rem] bg-white border border-brand-primary/10 hover:border-brand-primary/30 transition-colors">
                        <input
                          type="checkbox"
                          checked={addrForm.isDefault}
                          onChange={e => setAddrForm(p => ({ ...p, isDefault: e.target.checked }))}
                          className="w-5 h-5 rounded cursor-pointer text-brand-primary focus:ring-brand-primary"
                        />
                        <span className="text-sm font-bold text-brand-text/70">Set as my default address</span>
                      </label>

                      <div className="flex gap-4 pt-4">
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit" disabled={addrLoading} 
                          className="flex-1 btn btn-primary h-14 rounded-full flex items-center justify-center gap-2"
                        >
                          {addrLoading ? 'Saving...' : editId ? 'Update Address' : 'Save Address'}
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="button" onClick={() => { setShowForm(false); setEditId(null) }} 
                          className="px-8 h-14 rounded-full flex items-center justify-center font-bold bg-white text-brand-text border border-brand-primary/20 hover:bg-brand-primary/5 transition-colors"
                        >
                          Cancel
                        </motion.button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* ── Address list ── */}
                {!showForm && (
                  addresses.length > 0 ? (
                    <div className="space-y-4">
                      {addresses.map(addr => (
                        <motion.div
                          key={addr._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`p-6 rounded-[1.5rem] flex flex-col sm:flex-row justify-between items-start gap-4 transition-all ${
                            addr.isDefault
                              ? 'bg-brand-primary/5 border border-brand-primary/20'
                              : 'bg-[var(--ivory)] border border-brand-primary/5'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="p-2 rounded-xl bg-white shadow-sm border border-brand-primary/5 text-brand-primary">
                                {addr.label === 'Home' ? <FiHome size={14} /> : addr.label === 'Work' ? <FiBriefcase size={14} /> : <FiMapPin size={14} />}
                              </div>
                              <span className="text-base font-bold font-display text-brand-primary">{addr.name}</span>
                              {addr.isDefault && (
                                <span className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest bg-brand-primary text-white">Default</span>
                              )}
                            </div>
                            <p className="text-sm leading-relaxed text-brand-text/60 font-medium pl-11">
                              {addr.street}<br />
                              {addr.city}{addr.district && `, ${addr.district}`} – {addr.zipCode}<br />
                              {addr.state} · {addr.phone}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {!addr.isDefault && (
                              <button onClick={() => handleSetDefault(addr._id)} title="Set as default" className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-brand-text/40 hover:text-brand-secondary hover:bg-brand-primary/5 transition-colors">
                                <FiStar size={16} />
                              </button>
                            )}
                            <button onClick={() => openEdit(addr)} title="Edit" className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-brand-text/40 hover:text-brand-primary hover:bg-brand-primary/5 transition-colors">
                              <FiEdit2 size={16} />
                            </button>
                            <button onClick={() => handleDeleteAddress(addr._id)} title="Delete" className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-red-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center rounded-[2rem] border-2 border-dashed border-brand-primary/10 bg-[var(--ivory)]">
                      <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center bg-white text-brand-primary/40">
                        <FiMapPin size={32} />
                      </div>
                      <p className="text-xl font-bold font-display text-brand-primary">No addresses saved yet</p>
                      <p className="text-sm mt-2 mb-8 text-brand-text/60 font-medium">Add an address for faster checkout</p>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={openNew} 
                        className="mx-auto btn btn-primary px-8 h-12 rounded-full flex items-center gap-2"
                      >
                        <FiPlus size={16} /> Add your first address
                      </motion.button>
                    </div>
                  )
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default Addresses
