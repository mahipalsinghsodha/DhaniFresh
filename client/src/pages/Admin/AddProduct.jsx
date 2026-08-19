import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import { FiPackage, FiAlertCircle, FiLock, FiStar, FiUpload } from 'react-icons/fi'
import CustomDropdown from '../../components/CustomDropdown'
import RestrictedAccess from '../../components/RestrictedAccess'

/* ── Field wrapper ── */
const Field = ({ label, required, hint, half, children }) => (
  <div style={{ gridColumn: half ? 'span 1' : 'span 2' }}>
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 800,
      color: 'var(--text-muted)', marginBottom: 8,
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
    </label>
    {children}
    {hint && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.5 }}>{hint}</p>}
  </div>
)

/* ── Shared input focus handlers ── */
const handleFocus = e => {
  e.target.style.borderColor = 'var(--brand-secondary)'
  e.target.style.boxShadow = '0 0 0 3px rgba(245,166,35,0.16), 0 2px 8px rgba(245,166,35,0.10)'
}
const handleBlur = e => {
  e.target.style.borderColor = 'var(--border-color)'
  e.target.style.boxShadow = 'none'
}

/* ── Shared input style ── */
const inputStyle = {
  width: '100%',
  border: '1.5px solid var(--border-color)',
  borderRadius: 'var(--radius-input)',
  padding: '12px 14px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'var(--font)',
  boxSizing: 'border-box',
  background: 'var(--bg-surface)',
  transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
  fontWeight: 500,
}

/* ── Custom Image Upload Input ── */
const ImageUploadInput = ({ name, value, onChange, placeholder, style, onFocus, onBlur }) => {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('image', file)
    try {
      const res = await api.post('/api/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      // Trigger onChange manually to update parent state
      onChange({ target: { name, value: res.data.url, type: 'text' } })
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.message || err.message))
    } finally {
      setUploading(false)
      e.target.value = '' // Reset input so same file can be selected again
    }
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type="url"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...style, paddingRight: 40 }}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <label style={{
        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
        cursor: uploading ? 'not-allowed' : 'pointer', color: 'var(--brand-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
        borderRadius: 8, background: 'rgba(245,166,35,0.1)'
      }}>
        {uploading ? (
          <div className="w-3 h-3 border-2 border-t-transparent border-[var(--brand-secondary)] rounded-full animate-spin" />
        ) : (
          <FiUpload size={14} />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  )
}

const AddProduct = () => {
  const { user, hasPermission, loading: authLoading } = useAuth()
  const navigate   = useNavigate()
  const { id }     = useParams()
  const isEdit     = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [fetchingConfig, setFetchingConfig] = useState(true)
  const [error, setError]     = useState('')
  const [categories, setCategories] = useState([])
  const [gstRate, setGstRate] = useState(0)
  const [formData, setFormData] = useState({
    name: '', description: '', category: '',
    price: '', mrp: '', stock: '', weight: '500g', image: '', imageLeft: '', imageRight: '', imageTop: '', imagePackage: '', featured: false, launchDate: '',
    variants: []
  })

  const WEIGHT_OPTIONS = ['100g', '200g', '250g', '500g', '1kg', '2kg', '3kg', '5kg', '10kg', '15kg']

  useEffect(() => {
    if (authLoading) {
      return // Wait until auth is settled before fetching data
    }
    const init = async () => {
      try {
        const [catRes, setRes] = await Promise.all([
          api.get('/api/categories'),
          api.get('/api/settings')
        ])
        setCategories(catRes.data)
        setGstRate(setRes.data.gstEnabled ? setRes.data.gstRate : 0)
        
        if (isEdit) {
          const res = await api.get(`/api/products/${id}`)
          setFormData(res.data)
        } else if (catRes.data.length > 0) {
          setFormData(prev => ({ ...prev, category: catRes.data[0].slug }))
        }
      } catch(e) {
        setError('Failed to fetch data')
      } finally {
        setFetchingConfig(false)
      }
    }
    init()
  }, [id, isEdit, authLoading])

  const handleChange = e => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleAddVariant = () => {
    setFormData(prev => ({ ...prev, variants: [...(prev.variants || []), { weight: '500g', price: '', mrp: '', stock: '', b2bMinQty: 0, b2bSetQty: 0 }] }))
  }

  const handleVariantChange = (index, field, value) => {
    setFormData(prev => {
      const newVariants = [...(prev.variants || [])]
      newVariants[index][field] = value
      return { ...prev, variants: newVariants }
    })
  }

  const handleRemoveVariant = (index) => {
    setFormData(prev => {
      const newVariants = [...(prev.variants || [])]
      newVariants.splice(index, 1)
      return { ...prev, variants: newVariants }
    })
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = { 
        ...formData, 
        price: Number(formData.price || 0), 
        stock: Number(formData.stock || 0),
        mrp: formData.mrp ? Number(formData.mrp) : undefined,
        variants: formData.variants?.map(v => ({
          ...v,
          price: Number(v.price),
          mrp: v.mrp ? Number(v.mrp) : undefined,
          stock: Number(v.stock),
          b2bMinQty: Number(v.b2bMinQty || 0),
          b2bSetQty: Number(v.b2bSetQty || 0)
        })) || []
      }
      // Let the Axios interceptor attach the auth token automatically (no manual headers needed)
      if (isEdit) {
        await api.put(`/api/products/${id}`, payload)
      } else {
        await api.post('/api/products', payload)
      }
      navigate('/admin/products')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  /* ── Guard states ── */
  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-base)' }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--brand-secondary)' }} />
    </div>
  )

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 24, padding: '48px 36px', maxWidth: 420, width: '100%',
        boxShadow: 'var(--shadow-lg)', textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'rgba(245,166,35,0.10)', border: '1.5px solid rgba(245,166,35,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
        }}>
          <FiLock size={28} style={{ color: 'var(--brand-secondary)' }} />
        </div>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
          Access Restricted
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
          Authentication is required to access the admin panel.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          id="addproduct-login-btn"
        >
          Sign In
        </button>
      </div>
    </div>
  )

  if (user.role !== 'admin' && user.role !== 'superadmin') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 24, padding: '48px 36px', maxWidth: 420, width: '100%',
        boxShadow: 'var(--shadow-lg)', textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'rgba(229,62,62,0.08)', border: '1.5px solid rgba(229,62,62,0.16)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
        }}>
          <FiAlertCircle size={28} style={{ color: 'var(--danger)' }} />
        </div>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
          Insufficient Permissions
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 0 }}>
          Your account does not have admin privileges to access this section.
        </p>
      </div>
    </div>
  )

  if (!hasPermission('products')) return (
    <RestrictedAccess
      title="Inventory Restricted"
      message="You do not have the required permissions to create or modify store products. Please consult your administrator."
    />
  )

  if (fetchingConfig) return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-base)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
          style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--brand-secondary)' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 600 }}>Loading...</p>
      </div>
    </div>
  )

  const categoryOptions = categories.map(c => ({
    value: c.slug,
    label: c.name,
    icon: c.image
      ? <img src={c.image} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} />
      : '🗂️'
  }))

  /* ── Main form ── */
  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-base)' }}>

      {/* ── Premium Admin Header ── */}
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none opacity-10"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.6) 0%, transparent 70%)', filter: 'blur(50px)' }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative z-10 max-w-[800px] mx-auto px-4 sm:px-6 py-6 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(245,166,35,0.20)', border: '1px solid rgba(245,166,35,0.35)' }}>
            <FiPackage size={22} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider mb-0.5" style={{ color: 'var(--gold)' }}>Product Management</p>
            <h1 className="text-xl font-extrabold text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {isEdit ? 'Edit Product' : 'Add New Product'}
            </h1>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px 80px' }}>
        <div className="rounded-3xl p-8 sm:p-10" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl mb-8" style={{
              background: 'rgba(229,62,62,0.07)', border: '1.5px solid rgba(229,62,62,0.20)',
              color: 'var(--danger)', fontSize: 14, fontWeight: 600,
            }}>
              <FiAlertCircle size={18} className="shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 32px' }}>

              {/* Product Name */}
              <Field label="Product Name" required>
                <input type="text" name="name" value={formData.name} onChange={handleChange}
                  required placeholder="e.g., Pure Organic Bilona Ghee"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* Description */}
              <Field label="Description" required>
                <textarea name="description" value={formData.description} onChange={handleChange}
                  required rows={5} placeholder="Describe the product — origin, health benefits, quality..."
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 120, lineHeight: 1.6, padding: '12px 14px' }}
                  onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* Category */}
              <Field label="Category" required half>
                <CustomDropdown
                  options={categoryOptions}
                  value={formData.category}
                  onChange={(val) => setFormData({ ...formData, category: val })}
                  placeholder="Select category"
                />
              </Field>

              {/* Weight / Size */}
              <Field label="Weight / Size" required half>
                <select
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  required
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto', height: 48 }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                >
                  <option value="" disabled>Select weight</option>
                  {WEIGHT_OPTIONS.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </Field>

              {/* Price */}
              <Field label="Base Price (₹)" half>
                <input type="number" name="price" value={formData.price} onChange={handleChange}
                  min="0" step="0.01" placeholder="0.00"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                {formData.price > 0 && gstRate > 0 && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--success)', fontWeight: 700 }}>
                    <FiAlertCircle style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-top' }} />
                    Includes ₹{(Number(formData.price) - (Number(formData.price) / (1 + gstRate / 100))).toFixed(2)} GST ({gstRate}%)
                  </p>
                )}
              </Field>

              {/* MRP */}
              <Field label="Base MRP (₹)" half>
                <input type="number" name="mrp" value={formData.mrp} onChange={handleChange}
                  min="0" step="0.01" placeholder="0.00"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* Stock */}
              <Field label="Base Stock (Units)" half>
                <input type="number" name="stock" value={formData.stock} onChange={handleChange}
                  min="0" placeholder="0"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* B2B Configuration */}
              <Field label="B2B Min Qty" half hint="Minimum qty a B2B user must order.">
                <input type="number" name="b2bMinQty" value={formData.b2bMinQty} onChange={handleChange}
                  min="0" placeholder="0"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>
              <Field label="B2B Set/Carton Qty" half hint="Quantity increment size (e.g., box of 20).">
                <input type="number" name="b2bSetQty" value={formData.b2bSetQty} onChange={handleChange}
                  min="0" placeholder="0"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* Variants */}
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Product Variants</label>
                  <button type="button" onClick={handleAddVariant} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>+ Add Variant</button>
                </div>
                {formData.variants?.map((v, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 12, alignItems: 'center', background: 'var(--bg-alt)', padding: 12, borderRadius: 8 }}>
                    <div>
                      <select value={v.weight} onChange={e => handleVariantChange(i, 'weight', e.target.value)} style={{ ...inputStyle, padding: '8px', height: 'auto', fontSize: 13 }}>
                        {WEIGHT_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </div>
                    <div>
                      <input type="number" placeholder="Price" value={v.price} onChange={e => handleVariantChange(i, 'price', e.target.value)} style={{ ...inputStyle, padding: '8px', fontSize: 13 }} />
                    </div>
                    <div>
                      <input type="number" placeholder="MRP" value={v.mrp} onChange={e => handleVariantChange(i, 'mrp', e.target.value)} style={{ ...inputStyle, padding: '8px', fontSize: 13 }} />
                    </div>
                    <div>
                      <input type="number" placeholder="Stock" value={v.stock} onChange={e => handleVariantChange(i, 'stock', e.target.value)} style={{ ...inputStyle, padding: '8px', fontSize: 13 }} />
                    </div>
                    <div>
                      <input type="number" placeholder="B2B Min" value={v.b2bMinQty} onChange={e => handleVariantChange(i, 'b2bMinQty', e.target.value)} style={{ ...inputStyle, padding: '8px', fontSize: 13 }} />
                    </div>
                    <div>
                      <input type="number" placeholder="B2B Set" value={v.b2bSetQty} onChange={e => handleVariantChange(i, 'b2bSetQty', e.target.value)} style={{ ...inputStyle, padding: '8px', fontSize: 13 }} />
                    </div>
                    <button type="button" onClick={() => handleRemoveVariant(i)} style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 8 }}>X</button>
                  </div>
                ))}
                {(!formData.variants || formData.variants.length === 0) && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No variants added. The product will use the base price, MRP, and stock.</p>
                )}
              </div>

              {/* Launch Date */}
              <Field label="Launch Date (Coming Soon)" hint="If set in the future, product will appear as 'Coming Soon'." half>
                <input type="datetime-local" name="launchDate" value={formData.launchDate ? new Date(formData.launchDate).toISOString().slice(0, 16) : ''} onChange={handleChange}
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* Main Image URL */}
              <Field label="Main Image URL" hint="Primary product image. Provide URL or upload file.">
                <ImageUploadInput name="image" value={formData.image || ''} onChange={handleChange}
                  placeholder="https://..."
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* Left Side Image URL */}
              <Field label="Left Side Image URL" half>
                <ImageUploadInput name="imageLeft" value={formData.imageLeft || ''} onChange={handleChange}
                  placeholder="https://..."
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* Right Side Image URL */}
              <Field label="Right Side Image URL" half>
                <ImageUploadInput name="imageRight" value={formData.imageRight || ''} onChange={handleChange}
                  placeholder="https://..."
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* Top Image URL */}
              <Field label="Top Image URL" half>
                <ImageUploadInput name="imageTop" value={formData.imageTop || ''} onChange={handleChange}
                  placeholder="https://..."
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* Package Image URL */}
              <Field label="Package Image URL" half>
                <ImageUploadInput name="imagePackage" value={formData.imagePackage || ''} onChange={handleChange}
                  placeholder="https://..."
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>

              {/* Featured toggle */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
                  background: formData.featured ? 'rgba(245,166,35,0.08)' : 'var(--bg-alt)',
                  border: `1.5px solid ${formData.featured ? 'rgba(245,166,35,0.35)' : 'var(--border-color)'}`,
                  borderRadius: 16, padding: '20px', transition: 'all 0.2s',
                }}>
                  <input type="checkbox" name="featured" id="featured"
                    checked={formData.featured} onChange={handleChange}
                    style={{ width: 18, height: 18, accentColor: 'var(--brand-secondary)', cursor: 'pointer' }} />
                  <div>
                    <p style={{
                      margin: 0, fontSize: 15, fontWeight: 800,
                      color: formData.featured ? 'var(--brand-secondary)' : 'var(--text-primary)',
                    }}>
                      <FiStar size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                      Featured Product
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                      Show this product in the homepage featured section.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border-color)', margin: '32px 0' }} />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', opacity: loading ? 0.7 : 1 }}
                id="addproduct-submit-btn"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                  : isEdit ? 'Save Changes' : 'Add Product'
                }
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/products')}
                className="btn btn-secondary"
                id="addproduct-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AddProduct
