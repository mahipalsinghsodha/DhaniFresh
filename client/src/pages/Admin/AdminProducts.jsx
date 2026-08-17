import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlus, FiSearch, FiBox, FiTrash2, FiSave,
  FiToggleLeft, FiToggleRight, FiArrowLeft, FiTag, FiUpload, FiImage
} from 'react-icons/fi'
import api from '../../api/axios'
import { toast } from 'react-toastify'
import CustomDropdown from '../../components/CustomDropdown'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import RestrictedAccess from '../../components/RestrictedAccess'
import Papa from 'papaparse'

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
      onChange({ target: { name, value: res.data.url, type: 'text' } })
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.message || err.message))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input 
        type="url" name={name} value={value} onChange={onChange}
        placeholder={placeholder} style={{ ...style, paddingRight: 40 }} 
        onFocus={onFocus} onBlur={onBlur} 
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
        <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
      </label>
    </div>
  )
}

const WEIGHT_OPTIONS = ['250g', '500g', '1kg', '3kg', '5kg', '10kg', '15kg']

const AdminProducts = () => {
  const navigate = useNavigate()
  const { hasPermission, loading: authLoading } = useAuth()
  const confirm = useConfirm()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [form, setForm] = useState({})
  const [gstRate, setGstRate] = useState(0)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvData, setCsvData] = useState([])
  const [csvFile, setCsvFile] = useState(null)

  useEffect(() => {
    if (!authLoading && hasPermission('products')) fetchData()
  }, [hasPermission, authLoading])

  const fetchData = async () => {
    try {
      const [pRes, cRes, sRes] = await Promise.all([
        api.get('/api/products?all=true&limit=1000'), 
        api.get('/api/categories'),
        api.get('/api/settings')
      ])
      setProducts(pRes.data.products)
      setCategories(cRes.data)
      setGstRate(sRes.data.gstEnabled ? sRes.data.gstRate : 0)
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (prod) => {
    setSelectedProduct(prod)
    setForm({
      name: prod.name,
      description: prod.description,
      price: prod.price,
      mrp: prod.mrp ?? '',
      stock: prod.stock,
      category: prod.category,
      weight: prod.weight || '',
      isActive: prod.isActive ?? true,
      image: prod.image || '',
      imageLeft: prod.imageLeft || '',
      imageRight: prod.imageRight || '',
      imageTop: prod.imageTop || '',
      imagePackage: prod.imagePackage || '',
      variants: prod.variants || [],
    })
  }

  const handleSave = async () => {
    if (!form.name || !form.category) return toast.error('Name and category are required');
    if (!(await confirm(`Save changes to "${form.name}"?`))) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        price: Number(form.price || 0),
        stock: Number(form.stock || 0),
        mrp: form.mrp ? Number(form.mrp) : undefined,
        variants: form.variants?.map(v => ({
          ...v,
          price: Number(v.price),
          mrp: v.mrp ? Number(v.mrp) : undefined,
          stock: Number(v.stock)
        })) || []
      }
      await api.put(`/api/products/${selectedProduct._id}`, payload)
      toast.success('Product updated successfully')
      fetchData()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleAddVariant = () => {
    setForm(prev => ({ ...prev, variants: [...(prev.variants || []), { weight: '500g', price: '', mrp: '', stock: '' }] }))
  }

  const handleVariantChange = (index, field, value) => {
    setForm(prev => {
      const newVariants = [...(prev.variants || [])]
      newVariants[index][field] = value
      return { ...prev, variants: newVariants }
    })
  }

  const handleRemoveVariant = (index) => {
    setForm(prev => {
      const newVariants = [...(prev.variants || [])]
      newVariants.splice(index, 1)
      return { ...prev, variants: newVariants }
    })
  }

  const handleDelete = async (id) => {
    if (!(await confirm('Delete this product permanently?'))) return
    try {
      await api.delete(`/api/products/${id}`)
      toast.success('Product deleted')
      fetchData()
      if (selectedProduct?._id === id) setSelectedProduct(null)
    } catch {
      toast.error('Failed to delete product')
    }
  }

  const handleImportCSV = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setCsvHeaders(Object.keys(results.data[0]))
          setCsvData(results.data.slice(0, 5)) // show first 5 rows
          setCsvFile(file)
          setCsvPreviewOpen(true)
        } else {
          toast.error('CSV file is empty or invalid.')
        }
        e.target.value = ''
      },
      error: (error) => {
        toast.error('Failed to parse CSV: ' + error.message)
        e.target.value = ''
      }
    })
  }

  const confirmCSVImport = async () => {
    if (!csvFile) return
    const formData = new FormData()
    formData.append('file', csvFile)
    setImporting(true)
    setCsvPreviewOpen(false)
    try {
      const res = await api.post('/api/products/import/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success(`Import complete! ${res.data.successCount} imported. ${res.data.errorCount} failed.`)
      if (res.data.errors?.length) {
        console.error('Import Errors:', res.data.errors)
        toast.warning('Check console for import errors')
      }
      fetchData()
    } catch {
      toast.error('Failed to import CSV')
    } finally {
      setImporting(false)
      setCsvFile(null)
    }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  )

  const categoryOptions = categories.map(c => ({
    value: c.slug,
    label: c.name,
    icon: c.image ? <img src={c.image} alt={c.name} style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'cover' }} /> : <span style={{ fontSize: 14 }}>{c.emoji || '🏷️'}</span>
  }))

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-base)' }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--brand-secondary)' }} />
    </div>
  )

  if (!hasPermission('products')) return (
    <RestrictedAccess title="Access Restricted" message="You don't have permission to manage products." />
  )

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>

      {/* ── Premium Admin Header ── */}
      <div style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 224, height: 224, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.6) 0%, transparent 70%)', filter: 'blur(50px)', opacity: 0.1, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1280, margin: '0 auto', padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(245,166,35,0.20)', border: '1px solid rgba(245,166,35,0.35)' }}>
              <FiBox size={18} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', margin: 0 }}>Manage Products</h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0, marginTop: 2 }}>{products.length} products in catalogue</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => {
              const headers = ['name', 'description', 'price', 'mrp', 'category', 'stock', 'weight', 'isActive', 'featured', 'launchDate', 'image', 'imageLeft', 'imageRight', 'imageTop', 'imagePackage'];
              const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + ['Sample Ghee', 'Pure description', '500', '600', 'a2', '100', '500g', 'true', 'false', '2026-10-15T12:00', 'https://...', 'https://...', 'https://...', 'https://...', 'https://...'].join(",");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "product_import_template.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, fontSize: 14, fontWeight: 700, transition: 'all 0.2s', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid rgba(255,255,255,0.2)' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              Template
            </button>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, fontSize: 14, fontWeight: 700, transition: 'all 0.2s', background: 'rgba(255,255,255,0.15)', color: '#FFF' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              {importing ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" /> : <FiUpload size={15} />}
              <span className="hidden sm:inline">{importing ? 'Importing...' : 'Import CSV'}</span>
              <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} disabled={importing} />
            </label>
            <button onClick={() => navigate('/admin/add-product')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, fontSize: 14, fontWeight: 700, transition: 'all 0.2s', cursor: 'pointer', background: 'var(--gold)', color: 'var(--navy)', border: 'none', boxShadow: '0 4px 14px rgba(245,166,35,0.45)' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <FiPlus size={15} /> Add Product
            </button>
          </div>
        </div>
      </div>

      {/* Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT: Product List */}
        <div className={selectedProduct ? 'hidden lg:flex' : 'flex'} style={{ width: '100%', maxWidth: 380, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', flexDirection: 'column', flexShrink: 0 }}>
          {/* Search */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-alt)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-input)', padding: '10px 12px' }}>
              <FiSearch size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)', width: '100%', fontFamily: 'var(--font)' }}
              />
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--brand-secondary)' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No products found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(p => {
                  const isActive = selectedProduct?._id === p._id
                  return (
                    <div
                      key={p._id}
                      onClick={() => handleSelect(p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radius-card)', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid',
                        ...(isActive ? { background: 'rgba(245,166,35,0.08)', borderColor: 'rgba(245,166,35,0.25)' } : { background: 'transparent', borderColor: 'transparent' }),
                        opacity: p.isActive === false ? 0.6 : 1
                      }}
                      onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = 'var(--bg-alt)' }}
                      onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-alt)', flexShrink: 0 }}>
                        <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isActive ? 'var(--brand-secondary)' : 'var(--text-primary)', margin: 0 }}>{p.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>₹{p.price?.toLocaleString('en-IN')}</span>
                          {p.weight && <span style={{ fontSize: 10, background: 'rgba(245,166,35,0.1)', color: 'var(--brand-secondary)', border: '1px solid rgba(245,166,35,0.2)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{p.weight}</span>}
                          {p.isActive === false && <span style={{ fontSize: 10, background: 'var(--bg-alt)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Inactive</span>}
                          {p.launchDate && new Date(p.launchDate) > new Date() && <span style={{ fontSize: 10, background: 'rgba(245,166,35,0.1)', color: 'var(--brand-secondary)', border: '1px solid rgba(245,166,35,0.2)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Coming Soon</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Edit Panel */}
        <div className={!selectedProduct ? 'hidden lg:flex' : 'flex'} style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', flexDirection: 'column' }}>
          <AnimatePresence mode="wait">
            {!selectedProduct ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
              >
                <div style={{ width: 64, height: 64, background: 'var(--bg-alt)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <FiBox size={24} style={{ color: 'var(--border-color)' }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Select a product to edit</p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedProduct._id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ width: '100%', maxWidth: 960 }}
              >
                {/* Mobile Back */}
                <button onClick={() => setSelectedProduct(null)} className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: 16, transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <FiArrowLeft size={14} /> Back to products
                </button>

                {/* Product Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-alt)', flexShrink: 0 }}>
                      <img src={selectedProduct.image} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>{selectedProduct.name}</h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(49,130,206,0.08)', color: 'var(--info)', border: '1px solid rgba(49,130,206,0.25)', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                          <FiTag size={10} /> {selectedProduct.category}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: '1px solid', ...(form.isActive ? { background: 'rgba(56,161,105,0.08)', color: 'var(--success)', borderColor: 'rgba(56,161,105,0.25)' } : { background: 'rgba(229,62,62,0.08)', color: 'var(--danger)', borderColor: 'rgba(229,62,62,0.25)' }) }}>
                          {form.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => navigate(`/admin/products/${selectedProduct._id}/images`)}
                      title="Manage all product images"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', color: 'var(--brand-secondary)', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,166,35,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,166,35,0.1)'}
                    >
                      <FiImage size={14} /> Images
                    </button>
                    <button onClick={() => handleDelete(selectedProduct._id)} style={{ padding: 10, color: 'var(--text-muted)', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(229,62,62,0.1)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Edit Form */}
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Product Name</label>
                      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</label>
                      <CustomDropdown
                        options={categoryOptions}
                        value={form.category}
                        onChange={val => setForm({ ...form, category: val })}
                        placeholder="Select category"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Base Price (₹)</label>
                      <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                      {form.price > 0 && gstRate > 0 && (
                        <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>
                          Includes ₹{(Number(form.price) - (Number(form.price) / (1 + gstRate / 100))).toFixed(2)} GST ({gstRate}%)
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Base MRP (₹)</label>
                      <input type="number" value={form.mrp} onChange={e => setForm({ ...form, mrp: e.target.value })} placeholder="Optional" style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Base Stock Quantity</label>
                      <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weight / Size</label>
                      <select
                        value={form.weight || ''}
                        onChange={e => setForm({ ...form, weight: e.target.value })}
                        style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)', cursor: 'pointer' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                      >
                        <option value="" disabled>Select weight</option>
                        {WEIGHT_OPTIONS.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Product Variants</label>
                      <button type="button" onClick={handleAddVariant} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>+ Add Variant</button>
                    </div>
                    {form.variants?.map((v, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, marginBottom: 12, alignItems: 'center', background: 'var(--bg-alt)', padding: 12, borderRadius: 8 }}>
                        <div>
                          <select value={v.weight} onChange={e => handleVariantChange(i, 'weight', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, outline: 'none' }}>
                            {WEIGHT_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                          </select>
                        </div>
                        <div>
                          <input type="number" placeholder="Price" value={v.price} onChange={e => handleVariantChange(i, 'price', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, outline: 'none' }} />
                        </div>
                        <div>
                          <input type="number" placeholder="MRP" value={v.mrp} onChange={e => handleVariantChange(i, 'mrp', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, outline: 'none' }} />
                        </div>
                        <div>
                          <input type="number" placeholder="Stock" value={v.stock} onChange={e => handleVariantChange(i, 'stock', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, outline: 'none' }} />
                        </div>
                        <button type="button" onClick={() => handleRemoveVariant(i)} style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 8 }}>X</button>
                      </div>
                    ))}
                    {(!form.variants || form.variants.length === 0) && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No variants added. Product will use the base price, MRP, and stock.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Launch Date (Coming Soon)</label>
                      <input type="datetime-local" value={form.launchDate ? new Date(form.launchDate).toISOString().slice(0, 16) : ''} onChange={e => setForm({ ...form, launchDate: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                    </div>
                    <div></div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      rows={4}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)', resize: 'none' }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Main Image URL</label>
                      <ImageUploadInput name="image" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="https://..." style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Left Side Image</label>
                      <ImageUploadInput name="imageLeft" value={form.imageLeft} onChange={e => setForm({ ...form, imageLeft: e.target.value })} placeholder="https://..." style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Right Side Image</label>
                      <ImageUploadInput name="imageRight" value={form.imageRight} onChange={e => setForm({ ...form, imageRight: e.target.value })} placeholder="https://..." style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Image</label>
                      <ImageUploadInput name="imageTop" value={form.imageTop} onChange={e => setForm({ ...form, imageTop: e.target.value })} placeholder="https://..." style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Package Image</label>
                      <ImageUploadInput name="imagePackage" value={form.imagePackage} onChange={e => setForm({ ...form, imagePackage: e.target.value })} placeholder="https://..." style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font)' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--bg-alt)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-alt)'}>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = !form.isActive;
                        if (await confirm(`Mark product as ${next ? 'ACTIVE' : 'INACTIVE'}? ${next ? 'Customers will see it.' : 'It will be hidden from the store.'}`)) {
                          setForm({ ...form, isActive: next })
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      {form.isActive
                        ? <FiToggleRight size={28} style={{ color: 'var(--success)' }} />
                        : <FiToggleLeft size={28} style={{ color: 'var(--text-muted)' }} />
                      }
                    </button>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Product Visibility</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>{form.isActive ? 'Visible to customers in the store' : 'Hidden from the store'}</p>
                    </div>
                  </label>

                  <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                    <button onClick={() => setSelectedProduct(null)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                      Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', opacity: saving ? 0.7 : 1 }}>
                      {saving ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : <FiSave size={15} />}
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* CSV Preview Modal */}
      <AnimatePresence>
        {csvPreviewOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCsvPreviewOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} style={{ position: 'relative', width: '95%', maxWidth: '85vw', background: 'var(--bg-surface)', borderRadius: 24, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
              <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-alt)' }}>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Preview CSV Import</h3>
                <p style={{ margin: 0, marginTop: 4, fontSize: 14, color: 'var(--text-muted)' }}>Showing the first 5 rows of your uploaded file. Please verify the columns.</p>
              </div>
              <div style={{ padding: 24, overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr>
                      {csvHeaders.map(h => <th key={h} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        {csvHeaders.map(h => <td key={h} style={{ padding: '12px 16px', color: 'var(--text-primary)', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '20px 32px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-alt)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button onClick={() => setCsvPreviewOpen(false)} className="btn btn-secondary" style={{ padding: '10px 20px', borderRadius: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>Cancel</button>
                <button onClick={confirmCSVImport} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: 'var(--gold)', color: 'var(--navy)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(245,166,35,0.3)' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <FiUpload size={16} /> Confirm & Import
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AdminProducts
// force ts update