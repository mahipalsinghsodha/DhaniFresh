import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiPercent, FiTruck, FiSave, FiToggleLeft, FiToggleRight, FiAlertCircle, FiMapPin, FiShield, FiLock } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/axios'
import OTPModal from '../../components/OTPModal'
import { useConfirm } from '../../context/ConfirmContext'
import RestrictedAccess from '../../components/RestrictedAccess'

/* ── Field component using CSS tokens ── */
const Field = ({ label, icon: Icon, name, value, onChange, suffix, helpText, error }) => (
  <div>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </label>
    <div style={{
      display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-input)',
      border: `1.5px solid ${error ? 'var(--danger)' : 'var(--border-color)'}`,
      overflow: 'hidden', transition: 'all 0.2s',
      boxShadow: error ? '0 0 0 3px rgba(229,62,62,0.12)' : 'none',
    }}
      onFocusCapture={e => { if (!error) { e.currentTarget.style.borderColor = 'var(--brand-secondary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,166,35,0.15)' } }}
      onBlurCapture={e => { e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border-color)'; e.currentTarget.style.boxShadow = error ? '0 0 0 3px rgba(229,62,62,0.12)' : 'none' }}
    >
      <div style={{ padding: '11px 12px', background: 'var(--bg-alt)', borderRight: '1.5px solid var(--border-color)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
        <Icon size={15} />
      </div>
      <input
        type="number" min="0"
        step={name === 'gstRate' ? '0.5' : '1'}
        value={value}
        onChange={e => onChange(name, Number(e.target.value))}
        style={{ flex: 1, padding: '11px 12px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', background: 'var(--bg-surface)', border: 'none', fontFamily: 'var(--font)', fontWeight: 600 }}
      />
      {suffix && (
        <span style={{ padding: '11px 12px', fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-alt)', borderLeft: '1.5px solid var(--border-color)' }}>
          {suffix}
        </span>
      )}
    </div>
    {helpText && !error && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{helpText}</p>}
    {error && (
      <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <FiAlertCircle size={11} />{error}
      </p>
    )}
  </div>
)

const AdminSettings = () => {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [settings, setSettings] = useState({
    gstRate: 5,
    gstEnabled: true,
    freeShippingThreshold: 500,
    shippingCharge: 50,
    serviceablePincodes: [],
    isMaintenanceMode: false,
    isComingSoon: false,
    comingSoonLaunchDate: '',
    companyDetails: {
      name: '',
      email: '',
      address: '',
      gstin: ''
    }
  })
  const [isServer2FAActive, setIsServer2FAActive] = useState(false)
  const [maskedOtpEmail, setMaskedOtpEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [pincodeInput, setPincodeInput] = useState('')
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false)

  useEffect(() => { fetchSettings() }, [])

  const fetchSettings = async () => {
    try {
      // Fetch settings from admin endpoint
      const res = await api.get('/api/settings/admin').catch(() => api.get('/api/settings'))
      setSettings({
        ...res.data,
        comingSoonLaunchDate: res.data.comingSoonLaunchDate ? new Date(res.data.comingSoonLaunchDate).toISOString().slice(0, 16) : ''
      })
      setIsServer2FAActive(Boolean(res.data.security?.twoFactorEnabled))
      setMaskedOtpEmail(res.data.security?.maskedEmail || '')
      setPincodeInput(res.data.serviceablePincodes?.join(', ') || '')
    } catch { toast.error('Failed to load settings') }
    finally { setLoading(false) }
  }

  const validate = () => {
    const e = {}
    if (settings.gstRate < 0 || settings.gstRate > 100) e.gstRate = 'GST must be 0–100%'
    if (settings.freeShippingThreshold < 0) e.freeShippingThreshold = 'Cannot be negative'
    if (settings.shippingCharge < 0) e.shippingCharge = 'Cannot be negative'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    // When 2FA is active in DB, prompt for OTP verification to save changes
    if (isServer2FAActive) {
      setIsOtpModalOpen(true)
    } else {
      applySave()
    }
  }

  const applySave = async (otp = null) => {
    setSaving(true)
    
    // Process pincodes
    const parsedPincodes = pincodeInput.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      
    try {
      const payload = { 
        ...settings, 
        serviceablePincodes: parsedPincodes,
        comingSoonLaunchDate: settings.isComingSoon && settings.comingSoonLaunchDate ? new Date(settings.comingSoonLaunchDate).toISOString() : null,
        ...(otp && { otp })
      }
      const res = await api.patch('/api/settings', payload)
      const newSettings = res.data.settings
      setSettings({
        ...newSettings,
        comingSoonLaunchDate: newSettings.comingSoonLaunchDate ? new Date(newSettings.comingSoonLaunchDate).toISOString().slice(0, 16) : ''
      })
      setPincodeInput(newSettings.serviceablePincodes?.join(', ') || '')
      setIsOtpModalOpen(false)
      toast.success('Settings saved successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings')
    } finally { setSaving(false) }
  }

  const handleFieldChange = (name, val) => {
    setSettings(p => ({ ...p, [name]: val }))
  }

  const handleSecurityChange = (key, val) => {
    setSettings(p => ({
      ...p,
      security: { ...(p.security || {}), [key]: val }
    }))
  }

  const handleCompanyChange = (key, val) => {
    setSettings(p => ({
      ...p,
      companyDetails: { ...(p.companyDetails || {}), [key]: val }
    }))
  }

  if (user?.role !== 'superadmin') {
    return <RestrictedAccess title="Root Authority Required" message="Only Super Administrators can modify platform settings." />
  }

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
          style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--brand-secondary)' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12, textAlign: 'center', fontWeight: 600 }}>Loading settings…</p>
      </div>
    </div>
  )

  const totalExample = 400 + (settings.gstEnabled ? 400 * settings.gstRate / 100 : 0) + (400 > settings.freeShippingThreshold ? 0 : settings.shippingCharge)

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>

      {/* ── Premium Admin Header ── */}
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.25) 0%, transparent 70%)', filter: 'blur(60px)', opacity: 0.7 }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full border mb-3"
            style={{ background: 'rgba(245,197,24,0.18)', color: 'var(--gold)', borderColor: 'rgba(245,197,24,0.35)' }}>
            ⚙ Admin Panel
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}>
            Platform Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.60)' }}>
            Configure GST rate and shipping charges. Changes apply to all new orders immediately.
          </p>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-5">
          
          {/* ── 2FA Security Status (Read-Only & Masked) ── */}
          {isServer2FAActive && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border-color)',
              borderRadius: 'var(--radius-card)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-sm)',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(56,161,105,0.12)',
                  color: 'var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <FiShield size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-display)' }}>
                      2-Factor Authentication Active
                    </h3>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 7px',
                      borderRadius: 10,
                      fontSize: 10,
                      fontWeight: 700,
                      background: 'rgba(56,161,105,0.12)',
                      color: 'var(--success)',
                      border: '1px solid rgba(56,161,105,0.3)'
                    }}>
                      ● Active
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                    Saving critical settings requires OTP sent to: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{maskedOtpEmail || 'Authorized Email'}</strong>
                  </p>
                </div>
              </div>
              <div style={{
                padding: '5px 10px',
                background: 'var(--bg-alt)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap'
              }}>
                <FiLock size={12} /> Database Protected
              </div>
            </div>
          )}

          {/* ── Site Status ── */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-alt)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>Site Status</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Manage maintenance and coming soon modes</p>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Maintenance Mode</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Show a "We'll be right back" page to all visitors.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings(p => ({ ...p, isMaintenanceMode: !p.isMaintenanceMode, isComingSoon: false }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid', ...(settings.isMaintenanceMode ? { background: 'rgba(229,62,62,0.1)', color: 'var(--danger)', borderColor: 'rgba(229,62,62,0.3)' } : { background: 'var(--bg-surface)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }) }}
                >
                  {settings.isMaintenanceMode ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />} {settings.isMaintenanceMode ? 'Active' : 'Off'}
                </button>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Coming Soon Mode</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Show a launch countdown and email capture.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings(p => ({ ...p, isComingSoon: !p.isComingSoon, isMaintenanceMode: false }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid', ...(settings.isComingSoon ? { background: 'rgba(49,130,206,0.1)', color: 'var(--info)', borderColor: 'rgba(49,130,206,0.3)' } : { background: 'var(--bg-surface)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }) }}
                  >
                    {settings.isComingSoon ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />} {settings.isComingSoon ? 'Active' : 'Off'}
                  </button>
                </div>
                {settings.isComingSoon && (
                  <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-alt)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Launch Date & Time</label>
                    <input 
                      type="datetime-local" 
                      value={settings.comingSoonLaunchDate}
                      onChange={e => handleFieldChange('comingSoonLaunchDate', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', outline: 'none', fontSize: 14 }}
                    />
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>When this date is reached, the site will automatically open to the public.</p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── GST Settings ── */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>GST Configuration</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Goods &amp; Services Tax applied to all orders</p>
              </div>
              {/* Toggle */}
              <button
                type="button"
                onClick={() => setSettings(p => ({ ...p, gstEnabled: !p.gstEnabled }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                  borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s', border: '1px solid',
                  ...(settings.gstEnabled
                    ? { background: 'rgba(56,161,105,0.08)', color: 'var(--success)', borderColor: 'rgba(56,161,105,0.25)' }
                    : { background: 'var(--bg-surface)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }
                  )
                }}
              >
                {settings.gstEnabled ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                {settings.gstEnabled ? 'GST Enabled' : 'GST Disabled'}
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <Field
                label="GST Rate" icon={FiPercent} name="gstRate"
                value={settings.gstRate} onChange={handleFieldChange} suffix="%"
                helpText="Standard rate for packaged food is 5%. Enter 0 to apply no GST."
                error={errors.gstRate}
              />
              {!settings.gstEnabled && (
                <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.20)', borderRadius: 10 }}>
                  <p style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiAlertCircle size={13} /> GST is currently disabled. No tax will be charged on orders.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Company Details (Invoice) ── */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-alt)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>Company Details (Invoice)</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>These details will appear on the generated PDF invoices</p>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Company Name</label>
                <input type="text" value={settings.companyDetails?.name || ''} onChange={e => handleCompanyChange('name', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', outline: 'none', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Contact Email</label>
                <input type="email" value={settings.companyDetails?.email || ''} onChange={e => handleCompanyChange('email', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', outline: 'none', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>GSTIN Number</label>
                <input type="text" value={settings.companyDetails?.gstin || ''} onChange={e => handleCompanyChange('gstin', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', outline: 'none', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Full Address</label>
                <textarea value={settings.companyDetails?.address || ''} onChange={e => handleCompanyChange('address', e.target.value)} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', outline: 'none', fontSize: 14 }} />
              </div>
            </div>
          </div>

          {/* ── Shipping Settings ── */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-alt)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>Shipping Configuration</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Free shipping threshold and default charge</p>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Field
                label="Free Shipping Above (₹)" icon={FiTruck} name="freeShippingThreshold"
                value={settings.freeShippingThreshold} onChange={handleFieldChange} suffix="₹"
                helpText="Orders above this subtotal get free shipping."
                error={errors.freeShippingThreshold}
              />
              <Field
                label="Shipping Charge (₹)" icon={FiTruck} name="shippingCharge"
                value={settings.shippingCharge} onChange={handleFieldChange} suffix="₹"
                helpText="Fixed charge for orders below the free shipping threshold."
                error={errors.shippingCharge}
              />
            </div>
          </div>

          {/* ── Pincode Settings ── */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-alt)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>Serviceable Pincodes</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Limit delivery to specific ZIP codes</p>
            </div>
            <div style={{ padding: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Allowed Pincodes (comma separated)
              </label>
              <div style={{
                display: 'flex', borderRadius: 'var(--radius-input)',
                border: '1.5px solid var(--border-color)', overflow: 'hidden',
              }}>
                <div style={{ padding: '12px', background: 'var(--bg-alt)', borderRight: '1.5px solid var(--border-color)', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start' }}>
                  <FiMapPin size={15} style={{ marginTop: 2 }} />
                </div>
                <textarea
                  value={pincodeInput}
                  onChange={e => setPincodeInput(e.target.value)}
                  placeholder="e.g. 110001, 400001, 560001"
                  rows={4}
                  style={{ flex: 1, padding: '12px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', background: 'var(--bg-surface)', border: 'none', resize: 'vertical' }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Leave empty to allow delivery to all pincodes globally.</p>
            </div>
          </div>
        </div>
        
        {/* Right Sidebar */}
        <div className="w-full lg:w-80 space-y-5">
          {/* ── Live Preview ── */}
          <div style={{ background: 'rgba(245,166,35,0.06)', border: '1.5px solid rgba(245,166,35,0.20)', borderRadius: 'var(--radius-card)', padding: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Live Preview
            </p>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Example subtotal', val: '₹400', color: 'var(--text-primary)' },
                ...(settings.gstEnabled && settings.gstRate > 0
                  ? [{ label: `GST (${settings.gstRate}%)`, val: `₹${(400 * settings.gstRate / 100).toFixed(2)}`, color: 'var(--text-primary)' }]
                  : []
                ),
                { label: 'Shipping', val: 400 > settings.freeShippingThreshold ? 'FREE' : `₹${settings.shippingCharge}`, color: 400 > settings.freeShippingThreshold ? 'var(--success)' : 'var(--text-primary)' },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: row.color, fontSize: 13 }}>{row.val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(245,166,35,0.25)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>Total</span>
                <span style={{ fontWeight: 800, color: 'var(--brand-secondary)', fontSize: 14 }}>₹{totalExample.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ── Save Button ── */}
          <button
            onClick={async () => { if (await confirm('Save changes to platform-wide tax and shipping?')) handleSave() }}
            disabled={saving}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', opacity: saving ? 0.7 : 1 }}
            id="save-settings-btn"
          >
            {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : <><FiSave size={16} /> Save Settings</>}
          </button>
        </div>
      </div>

      <OTPModal
        isOpen={isOtpModalOpen}
        onClose={() => setIsOtpModalOpen(false)}
        onSuccess={(otp) => applySave(otp)}
      />
    </div>
  )
}

export default AdminSettings
