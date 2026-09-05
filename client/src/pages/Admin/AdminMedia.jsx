import { useState, useEffect, useCallback } from 'react'
import {
  FiUploadCloud, FiTrash2, FiCopy, FiCheck, FiImage, FiRefreshCw, FiExternalLink
} from 'react-icons/fi'
import api from '../../api/axios'
import { toast } from 'react-toastify'
import { useDropzone } from 'react-dropzone'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import RestrictedAccess from '../../components/RestrictedAccess'

const AdminMedia = () => {
  const { user, hasPermission, loading: authLoading } = useAuth()
  const confirm = useConfirm()
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const fetchImages = async (cursor = null) => {
    try {
      const endpoint = cursor ? `/api/upload/images?next_cursor=${cursor}` : '/api/upload/images'
      const res = await api.get(endpoint)
      if (cursor) {
        setImages(prev => [...prev, ...res.data.images])
      } else {
        setImages(res.data.images)
      }
      setNextCursor(res.data.next_cursor)
    } catch (err) {
      toast.error('Failed to fetch images')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (!authLoading && hasPermission('products')) {
      fetchImages()
    }
  }, [authLoading, hasPermission])

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return
    setUploading(true)
    const formData = new FormData()
    acceptedFiles.forEach(file => formData.append('images', file))

    try {
      await api.post('/api/upload/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success(`${acceptedFiles.length} images uploaded!`)
      fetchImages() // Refresh list
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] }
  })

  const handleDelete = async (public_id) => {
    if (!(await confirm('Are you sure you want to permanently delete this image from Cloudinary?'))) return
    try {
      await api.delete('/api/upload/images', { data: { public_id } })
      toast.success('Image deleted')
      setImages(images.filter(img => img.public_id !== public_id))
    } catch (err) {
      toast.error('Failed to delete image')
    }
  }

  const copyToClipboard = (url, public_id) => {
    navigator.clipboard.writeText(url)
    setCopiedId(public_id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('URL copied to clipboard!')
  }

  if (authLoading) return null
  if (!['admin', 'superadmin', 'support'].includes(user?.role) && !hasPermission('products')) {
    return <RestrictedAccess />
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>
            Media Library
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
            Manage all product images uploaded to Cloudinary
          </p>
        </div>
        <button
          onClick={() => fetchImages()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)',
            border: '1px solid var(--border-color)', color: 'var(--text-primary)',
            padding: '10px 16px', borderRadius: 12, cursor: 'pointer', fontWeight: 600
          }}
        >
          <FiRefreshCw size={16} /> Refresh
        </button>
      </div>

      <div
        {...getRootProps()}
        style={{
          background: isDragActive ? 'rgba(245,166,35,0.05)' : 'var(--bg-card)',
          border: `2px dashed ${isDragActive ? 'var(--brand-secondary)' : 'var(--border-color)'}`,
          borderRadius: 20, padding: '48px 32px', textAlign: 'center', cursor: 'pointer',
          marginBottom: 32, transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
        }}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 40, height: 40, border: '4px solid var(--border-color)', borderTopColor: 'var(--brand-secondary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--brand-secondary)', margin: 0 }}>Uploading images...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(245,166,35,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiUploadCloud size={32} color="var(--brand-secondary)" />
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                {isDragActive ? 'Drop images here!' : 'Click or drag images to upload'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
                Supports JPG, PNG, WEBP, GIF up to 5MB. You can upload multiple files at once.
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiImage /> Uploaded Images ({images.length})
        </h2>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <div style={{ width: 32, height: 32, border: '4px solid var(--border-color)', borderTopColor: 'var(--brand-secondary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : images.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
            <FiImage size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p style={{ fontSize: 16, fontWeight: 600 }}>No images found</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
              {images.map((img) => (
                <div
                  key={img.public_id}
                  style={{
                    position: 'relative', borderRadius: 16, overflow: 'hidden',
                    border: '1px solid var(--border-color)', background: 'var(--bg-alt)',
                    aspectRatio: '1', group: 'img-card'
                  }}
                  onMouseEnter={e => e.currentTarget.lastElementChild.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.lastElementChild.style.opacity = '0'}
                >
                  <img
                    src={img.secure_url}
                    alt={img.public_id}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                  
                  <div
                    style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      padding: 16, opacity: 0, transition: 'opacity 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ color: '#fff', fontSize: 10, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
                        {new Date(img.created_at).toLocaleDateString()}
                      </span>
                      <a href={img.secure_url} target="_blank" rel="noreferrer" style={{ color: '#fff', padding: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 8 }}>
                        <FiExternalLink size={14} />
                      </a>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => copyToClipboard(img.secure_url, img.public_id)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          background: copiedId === img.public_id ? '#10B981' : 'var(--brand-secondary)',
                          color: copiedId === img.public_id ? '#fff' : 'var(--navy)',
                          border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        {copiedId === img.public_id ? <FiCheck size={14} /> : <FiCopy size={14} />}
                        {copiedId === img.public_id ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleDelete(img.public_id)}
                        style={{
                          background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none',
                          borderRadius: 8, padding: '8px 12px', cursor: 'pointer'
                        }}
                        title="Delete Image"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {nextCursor && (
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <button
                  onClick={() => { setLoadingMore(true); fetchImages(nextCursor); }}
                  disabled={loadingMore}
                  style={{
                    background: 'var(--bg-alt)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', padding: '12px 24px', borderRadius: 12,
                    fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8
                  }}
                >
                  {loadingMore ? <div style={{ width: 16, height: 16, border: '2px solid var(--text-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : null}
                  Load More Images
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default AdminMedia
