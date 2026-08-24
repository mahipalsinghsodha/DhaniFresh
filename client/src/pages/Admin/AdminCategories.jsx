import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Tag, Image, Trash2, X, Save, ShieldCheck, Upload, Link, CheckCircle } from 'lucide-react'
import api from '../../api/axios'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import RestrictedAccess from '../../components/RestrictedAccess'

const emptyForm = { name: '', slug: '', description: '', image: '' }

/* ─── tiny ImagePicker component ─── */
const ImagePicker = ({ value, onChange }) => {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState('upload') // 'upload' | 'url'
  const [urlInput, setUrlInput] = useState(value || '')

  useEffect(() => {
    setUrlInput(value || '')
  }, [value])

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const token = localStorage.getItem('token')
      const res = await api.post('/api/upload', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      })
      const url = res.data?.url || res.data?.imageUrl || res.data?.path
      if (!url) throw new Error('No URL returned')
      onChange(url)
      toast.success('Image uploaded!')
    } catch (e) {
      const reader = new FileReader()
      reader.onload = (ev) => onChange(ev.target.result)
      reader.readAsDataURL(file)
      toast.info('Stored as preview (upload endpoint not available)')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const applyUrl = () => {
    onChange(urlInput.trim())
    if (urlInput.trim()) toast.success('Image URL applied')
  }

  return (
    <div>
      {/* Toggle segments */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--bg-alt)', borderRadius: 12, padding: 4, width: 'fit-content', border: `1px solid var(--border-color)` }}>
        {[
          { id: 'upload', icon: <Upload size={14} />, label: 'Upload Local' }, 
          { id: 'url', icon: <Link size={14} />, label: 'Asset URL' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setMode(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700,
              background: mode === tab.id ? 'var(--bg-surface)' : 'transparent',
              color: mode === tab.id ? 'var(--brand-secondary)' : 'var(--text-muted)',
              boxShadow: mode === tab.id ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s'
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Media Acquisition Zone */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>

        {/* Drop zone */}
        {mode === 'upload' && (
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{
              flex: 1, minHeight: 140, border: `2px dashed ${dragging ? 'var(--brand-secondary)' : 'var(--border-color)'}`,
              borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 10, cursor: uploading ? 'not-allowed' : 'pointer',
              background: dragging ? 'rgba(245,166,35,0.06)' : 'var(--bg-alt)',
              transition: 'all 0.2s', padding: 24,
            }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
            {uploading ? (
              <>
                <div style={{ width: 32, height: 32, border: `3.5px solid rgba(245,166,35,0.2)`, borderTopColor: 'var(--brand-secondary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Synchronizing...</span>
              </>
            ) : (
              <>
                <div style={{ width: 48, height: 48, background: 'var(--bg-surface)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', border: `1px solid var(--border-color)` }}>
                  <Upload size={22} style={{ color: 'var(--brand-secondary)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>Dispatch Media Asset</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginTop: 4, display: 'block' }}>Supports high-resolution PNG, JPG, WEBP</span>
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'url' && (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyUrl()}
                placeholder="https://cloud.cdn/asset.webp"
                style={{ flex: 1, padding: '14px 16px', border: `1.5px solid var(--border-color)`, borderRadius: 14, fontSize: 14, outline: 'none', fontFamily: 'var(--font)', color: 'var(--text-primary)', fontWeight: 500, background: 'var(--bg-surface)' }} 
                onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />
              <button onClick={applyUrl}
                style={{ padding: '14px 20px', background: 'var(--brand-secondary)', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13, fontFamily: 'var(--font)' }}>
                <CheckCircle size={16} /> VALIDATE
              </button>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Provide a primary node URL for the category visual metadata.</p>
          </div>
        )}

        {/* High-Fidelity Asset Preview */}
        <div style={{ width: 100, height: 100, borderRadius: 20, border: `1.5px solid var(--border-color)`, background: 'var(--bg-alt)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', boxShadow: 'var(--shadow-sm)' }}>
          {value ? (
            <>
              <img src={value} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
              <button onClick={() => { onChange(''); setUrlInput('') }}
                style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, background: 'rgba(15,23,42,0.8)', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                <X size={12} color="#fff" />
              </button>
            </>
          ) : (
            <Image size={32} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

/* ─── Main component ─── */
const AdminCategories = () => {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (hasPermission('categories')) fetchCategories()
  }, [hasPermission])

  const fetchCategories = async () => {
    if (!hasPermission('categories')) return
    try {
      const res = await api.get('/api/categories')
      setCategories(res.data)
    } catch (e) { toast.error("Failed to fetch categories") }
    finally { setLoading(false) }
  }

  const handleSelect = (cat) => {
    setSelectedCat(cat)
    setForm({ name: cat.name, slug: cat.slug, description: cat.description, image: cat.image || '' })
  }

  const handleCreateNew = () => {
    setSelectedCat('new')
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.description) return toast.error("Name, Slug, and Description are required")
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      if (selectedCat === 'new') {
        await api.post('/api/categories', form, { headers })
        toast.success("Category created!")
      } else {
        await api.put(`/api/categories/${selectedCat._id}`, form, { headers })
        toast.success("Category updated!")
      }
      fetchCategories()
      setSelectedCat(null)
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save category")
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!(await confirm("Are you sure you want to delete this category?"))) return
    try {
      const token = localStorage.getItem('token')
      await api.delete(`/api/categories/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      toast.success("Category deleted")
      fetchCategories()
      if (selectedCat?._id === id) setSelectedCat(null)
    } catch { toast.error("Failed to delete") }
  }

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  )

  if (!hasPermission('categories')) return (
    <RestrictedAccess 
      title="Categories Access Restricted" 
      message="You do not have the required permissions to manage category groups. Please contact your administrator." 
    />
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', fontFamily: 'var(--font)' }}>

      {/* ── Premium Admin Header ── */}
      <div style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', background: 'var(--gradient-hero)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 224, height: 224, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.6) 0%, transparent 70%)', filter: 'blur(50px)', opacity: 0.1, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div style={{ position: 'relative', zIndex: 10, padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(245,166,35,0.20)', border: '1px solid rgba(245,166,35,0.35)' }}>
              <ShieldCheck size={22} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gold)' }}>Admin Panel</span>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.02em' }}>Manage Categories</h1>
            </div>
          </div>
          <button onClick={handleCreateNew}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, transition: 'all 0.2s', cursor: 'pointer', background: 'var(--gold)', color: 'var(--navy)', border: 'none', boxShadow: '0 4px 14px rgba(245,166,35,0.45)' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            <Plus size={16} /> Add Category
          </button>
        </div>
      </div>

      {/* Split Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT: Category Index */}
        <div style={{ width: 380, background: 'var(--bg-surface)', borderRight: `1px solid var(--border-color)`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid var(--border-color)`, background: 'var(--bg-base)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Search index…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '12px 14px 12px 42px', background: 'var(--bg-surface)', border: `1.5px solid var(--border-color)`, borderRadius: 12, outline: 'none', fontFamily: 'var(--font)', fontSize: 13, color: 'var(--text-primary)', boxSizing: 'border-box', fontWeight: 500 }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>Synchronizing taxonomy…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>No categories found in index.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map(cat => {
                  const active = selectedCat && selectedCat !== 'new' && selectedCat._id === cat._id
                  return (
                    <div key={cat._id} onClick={() => handleSelect(cat)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: 14, padding: '12px', 
                        background: active ? 'rgba(245,166,35,0.06)' : 'var(--bg-surface)', 
                        border: `1.5px solid ${active ? 'var(--brand-secondary)' : 'var(--border-color)'}`, 
                        borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: active ? `var(--shadow-sm)` : 'none'
                      }}>
                      <div style={{ width: 48, height: 48, background: 'var(--bg-alt)', border: `1px solid var(--border-color)`, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {cat.image
                          ? <img src={cat.image} alt="cat" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Tag size={20} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: active ? 'var(--brand-secondary)' : 'var(--text-primary)', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>{cat.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>REF: /{cat.slug}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Edit Console */}
        <div style={{ flex: 1, background: 'var(--bg-base)', padding: '40px', overflowY: 'auto' }}>
          <AnimatePresence mode="wait">
            {!selectedCat ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <div style={{ width: 80, height: 80, background: 'var(--bg-alt)', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, border: `1.5px solid var(--border-color)` }}>
                  <Tag size={32} style={{ opacity: 0.3 }} color="var(--text-muted)" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-secondary)' }}>Inventory Node Required</div>
                <p style={{ fontSize: 14, marginTop: 6, fontWeight: 500 }}>Select a taxonomy node to modify its attributes.</p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                style={{ maxWidth: 720, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: 24, boxShadow: 'var(--shadow-lg)', border: `1px solid var(--border-color)`, overflow: 'hidden' }}>

                {/* Form header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 32px', borderBottom: `1px solid var(--border-color)`, background: 'var(--bg-alt)' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
                      {selectedCat === 'new' ? 'PROVISION NEW NODE' : 'MODIFY NODE ATTRIBUTES'}
                    </h2>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, marginTop: 4, textTransform: 'uppercase' }}>
                      {selectedCat === 'new' ? 'Awaiting configuration' : `REF ID: ${selectedCat._id.toUpperCase()}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {selectedCat !== 'new' && (
                      <button onClick={() => handleDelete(selectedCat._id)} title="Delete Category"
                        style={{ padding: 10, background: 'rgba(229,62,62,0.1)', color: 'var(--danger)', border: `1.5px solid rgba(229,62,62,0.25)`, borderRadius: 12, cursor: 'pointer', display: 'flex', transition: 'all 0.2s' }}>
                        <Trash2 size={18} />
                      </button>
                    )}
                    <button onClick={() => setSelectedCat(null)}
                      style={{ padding: 10, background: 'var(--bg-surface)', color: 'var(--text-muted)', border: `1.5px solid var(--border-color)`, borderRadius: 12, cursor: 'pointer', display: 'flex', transition: 'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-alt)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Form body */}
                <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 32 }}>

                  {/* Name + Slug */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.05em' }}>Canonical Label *</label>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Organic Dairy"
                        style={{ width: '100%', padding: '14px 16px', border: `1.5px solid var(--border-color)`, borderRadius: 14, fontSize: 14, outline: 'none', fontFamily: 'var(--font)', color: 'var(--text-primary)', boxSizing: 'border-box', fontWeight: 500 }} 
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.05em' }}>URL Routing SLUG *</label>
                      <input type="text" value={form.slug}
                        onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        placeholder="e.g. organic-dairy"
                        style={{ width: '100%', padding: '14px 16px', border: `1.5px solid var(--border-color)`, borderRadius: 14, fontSize: 14, outline: 'none', fontFamily: 'var(--font)', background: 'var(--bg-alt)', color: 'var(--text-secondary)', boxSizing: 'border-box', fontWeight: 700 }} 
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                      />
                    </div>
                  </div>

                  {/* Image Picker Widget */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>Visual Asset Configuration</label>
                    <ImagePicker
                      value={form.image}
                      onChange={url => setForm(f => ({ ...f, image: url }))}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.05em' }}>Node Narrative (SEO) *</label>
                    <textarea rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      style={{ width: '100%', padding: '16px 18px', border: `1.5px solid var(--border-color)`, borderRadius: 16, fontSize: 14, outline: 'none', fontFamily: 'var(--font)', resize: 'vertical', color: 'var(--text-primary)', boxSizing: 'border-box', fontWeight: 500, lineHeight: 1.6 }} 
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-secondary)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    />
                  </div>

                  {/* Action Orchestration */}
                  <button onClick={handleSave} disabled={saving}
                    style={{ width: '100%', padding: 18, background: 'var(--brand-secondary)', color: '#fff', border: 'none', borderRadius: 16, fontWeight: 900, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'var(--font)', opacity: saving ? 0.7 : 1, boxShadow: `0 8px 24px rgba(245,166,35,0.3)`, transition: 'all 0.2s' }}>
                    {saving ? 'Synchronizing Archive…' : <><Save size={20} /> Commit Taxonomy Change</>}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default AdminCategories