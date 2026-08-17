import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Package, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/axios';

const B2B = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    quantity: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/contact/b2b', formData);
      setSuccess(true);
      toast.success('Inquiry submitted successfully!');
      setFormData({ name: '', email: '', phone: '', company: '', quantity: '', message: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit inquiry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--ivory)] pt-20 pb-20">
      <Helmet>
        <title>Wholesale & B2B Inquiries – Daatasa</title>
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-primary">
            <Package size={32} />
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-extrabold text-brand-primary mb-4">Bulk Orders & Wholesale</h1>
          <p className="text-brand-text/60 text-lg">Partner with us for your corporate gifting, events, or retail needs.</p>
        </div>

        <div className="bg-white rounded-[2rem] border border-brand-primary/10 shadow-sm p-6 sm:p-10">
          {success ? (
            <div className="text-center py-10">
              <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-brand-primary mb-2">Inquiry Sent!</h2>
              <p className="text-brand-text/60 mb-6">Thank you for your interest. Our team will get back to you shortly.</p>
              <button onClick={() => setSuccess(false)} className="btn btn-primary px-8 rounded-full">Send Another Inquiry</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-text/60 mb-2">Contact Name *</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full h-12 px-4 rounded-[1rem] border border-brand-primary/20 focus:border-brand-secondary outline-none transition-colors bg-white" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-text/60 mb-2">Phone Number *</label>
                  <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full h-12 px-4 rounded-[1rem] border border-brand-primary/20 focus:border-brand-secondary outline-none transition-colors bg-white" placeholder="+91 XXXXX XXXXX" />
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-text/60 mb-2">Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full h-12 px-4 rounded-[1rem] border border-brand-primary/20 focus:border-brand-secondary outline-none transition-colors bg-white" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-text/60 mb-2">Company Name</label>
                  <input type="text" name="company" value={formData.company} onChange={handleChange} className="w-full h-12 px-4 rounded-[1rem] border border-brand-primary/20 focus:border-brand-secondary outline-none transition-colors bg-white" placeholder="Your Business" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-text/60 mb-2">Required Quantity (Approx) *</label>
                <input required type="text" name="quantity" value={formData.quantity} onChange={handleChange} className="w-full h-12 px-4 rounded-[1rem] border border-brand-primary/20 focus:border-brand-secondary outline-none transition-colors bg-white" placeholder="e.g., 50 Liters, 100 Jars" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-text/60 mb-2">Message / Requirements *</label>
                <textarea required name="message" value={formData.message} onChange={handleChange} rows="4" className="w-full px-4 py-3 rounded-[1rem] border border-brand-primary/20 focus:border-brand-secondary outline-none transition-colors resize-none bg-white" placeholder="Tell us about your requirements..."></textarea>
              </div>

              <button type="submit" disabled={loading} className="w-full h-14 btn btn-primary rounded-full flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-50 transition-all">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={18} />}
                {loading ? 'Submitting...' : 'Submit Inquiry'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default B2B;
