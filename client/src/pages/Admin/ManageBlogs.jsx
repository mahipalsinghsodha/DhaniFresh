import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { FiEdit2, FiTrash2, FiPlus, FiImage, FiToggleRight, FiToggleLeft } from 'react-icons/fi'
import { toast } from 'react-toastify'

const ManageBlogs = () => {
  const [blogs, setBlogs] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    author: 'Daatasa Team',
    tags: '',
    isActive: true,
    imageInput: ''
  })

  const fetchBlogs = () => {
    setLoading(true)
    api.get('/api/blogs/admin')
      .then(res => setBlogs(res.data))
      .catch(err => toast.error('Failed to load blogs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchBlogs()
  }, [])

  const handleEdit = (blog) => {
    setEditId(blog._id)
    setFormData({
      title: blog.title,
      slug: blog.slug,
      content: blog.content,
      author: blog.author,
      tags: blog.tags.join(', '),
      isActive: blog.isActive,
      imageInput: blog.images?.[0] || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this blog?')) return
    try {
      await api.delete(`/api/blogs/${id}`)
      toast.success('Blog deleted')
      fetchBlogs()
    } catch (err) {
      toast.error('Failed to delete blog')
    }
  }

  const handleToggleActive = async (blog) => {
    try {
      await api.put(`/api/blogs/${blog._id}`, { isActive: !blog.isActive })
      toast.success(`Blog ${blog.isActive ? 'deactivated' : 'activated'}`)
      fetchBlogs()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        images: formData.imageInput ? [formData.imageInput] : []
      }
      
      if (editId) {
        await api.put(`/api/blogs/${editId}`, payload)
        toast.success('Blog updated')
      } else {
        await api.post('/api/blogs', payload)
        toast.success('Blog created')
      }
      setShowModal(false)
      fetchBlogs()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save blog')
    }
  }

  const generateSlug = () => {
    if (!formData.title) return
    const slug = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    setFormData(prev => ({ ...prev, slug }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-brand-primary">Manage Blogs</h1>
        <button 
          onClick={() => {
            setEditId(null)
            setFormData({ title: '', slug: '', content: '', author: 'Daatasa Team', tags: '', isActive: true, imageInput: '' })
            setShowModal(true)
          }}
          className="btn btn-primary px-6 h-10 rounded-full flex items-center gap-2"
        >
          <FiPlus /> New Blog
        </button>
      </div>

      <div className="bg-white rounded-[1rem] shadow-sm border border-brand-primary/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--ivory)] border-b border-brand-primary/10 text-sm text-brand-primary">
                <th className="p-4 font-bold">Title & Slug</th>
                <th className="p-4 font-bold">Author</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-brand-text/50">Loading...</td></tr>
              ) : blogs.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-brand-text/50">No blogs found.</td></tr>
              ) : (
                blogs.map(blog => (
                  <tr key={blog._id} className="border-b border-brand-primary/5 hover:bg-[var(--ivory)]/50">
                    <td className="p-4">
                      <p className="font-bold text-brand-primary">{blog.title}</p>
                      <p className="text-xs text-brand-text/60">/{blog.slug}</p>
                    </td>
                    <td className="p-4 text-sm font-medium">{blog.author}</td>
                    <td className="p-4">
                      <button 
                        onClick={() => handleToggleActive(blog)}
                        className={`flex items-center gap-1.5 text-sm font-bold ${blog.isActive ? 'text-green-600' : 'text-gray-400'}`}
                      >
                        {blog.isActive ? <FiToggleRight size={20} /> : <FiToggleLeft size={20} />}
                        {blog.isActive ? 'Active' : 'Hidden'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(blog)} className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100"><FiEdit2 size={14} /></button>
                        <button onClick={() => handleDelete(blog._id)} className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100"><FiTrash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[1.5rem] w-full max-w-3xl my-8 shadow-xl border border-brand-primary/10 overflow-hidden">
            <div className="p-6 border-b border-brand-primary/10 flex justify-between items-center bg-[var(--ivory)]">
              <h2 className="text-xl font-bold font-display text-brand-primary">{editId ? 'Edit Blog' : 'Create Blog'}</h2>
              <button onClick={() => setShowModal(false)} className="text-2xl leading-none text-brand-text/50 hover:text-brand-primary">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-brand-primary mb-2">Title</label>
                  <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 h-12 rounded-xl bg-[var(--ivory)] border border-brand-primary/20 outline-none focus:border-brand-secondary" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-brand-primary mb-2 flex justify-between">
                    <span>Slug</span>
                    <button type="button" onClick={generateSlug} className="text-xs text-brand-secondary">Generate</button>
                  </label>
                  <input type="text" required value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full px-4 h-12 rounded-xl bg-[var(--ivory)] border border-brand-primary/20 outline-none focus:border-brand-secondary" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-brand-primary mb-2">Cover Image URL</label>
                <div className="flex gap-2">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-[var(--ivory)] flex items-center justify-center border border-brand-primary/20">
                    {formData.imageInput ? <img src={formData.imageInput} alt="preview" className="w-full h-full object-cover rounded-xl" /> : <FiImage className="text-brand-text/30" />}
                  </div>
                  <input type="url" placeholder="https://..." value={formData.imageInput} onChange={e => setFormData({...formData, imageInput: e.target.value})} className="flex-1 px-4 h-12 rounded-xl bg-[var(--ivory)] border border-brand-primary/20 outline-none focus:border-brand-secondary" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-brand-primary mb-2">Author</label>
                  <input type="text" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} className="w-full px-4 h-12 rounded-xl bg-[var(--ivory)] border border-brand-primary/20 outline-none focus:border-brand-secondary" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-brand-primary mb-2">Tags (comma separated)</label>
                  <input type="text" placeholder="Health, Ayurveda, Recipes" value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} className="w-full px-4 h-12 rounded-xl bg-[var(--ivory)] border border-brand-primary/20 outline-none focus:border-brand-secondary" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-brand-primary mb-2">Content (HTML allowed)</label>
                <textarea required rows="12" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="w-full p-4 rounded-xl bg-[var(--ivory)] border border-brand-primary/20 outline-none focus:border-brand-secondary font-mono text-sm"></textarea>
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-5 h-5 rounded border-brand-primary/20 text-brand-secondary focus:ring-brand-secondary" />
                <label htmlFor="isActive" className="text-sm font-bold text-brand-primary">Publish immediately</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-brand-primary/10">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 h-12 rounded-full font-bold text-brand-text/60 hover:bg-gray-100">Cancel</button>
                <button type="submit" className="btn btn-primary px-8 h-12 rounded-full font-bold">Save Blog</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManageBlogs
