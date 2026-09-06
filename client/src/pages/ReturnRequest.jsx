import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiArrowLeft, FiRefreshCcw, FiAlertCircle, FiCamera,
  FiVideo, FiTrash2, FiMapPin, FiPhone, FiUser,
  FiCheckCircle, FiUploadCloud, FiPackage
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';

const REASONS = [
  'Defective/Damaged product',
  'Received wrong item',
  'Quality not as expected',
  'Seal broken / Packaging leakage',
  'Item arrived too late',
  'Other'
];

const STATES = [
  'Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar',
  'Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka',
  'Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya',
  'Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'
];

const ReturnRequest = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [reason, setReason] = useState(REASONS[0]);
  const [description, setDescription] = useState('');
  
  // Pickup Address
  const [pickupAddress, setPickupAddress] = useState({
    name: '',
    phone: '',
    street: '',
    city: '',
    district: '',
    state: '',
    zipCode: ''
  });

  // Proof Media
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/api/orders/${id}`);
      const o = res.data;
      setOrder(o);

      // Pre-fill pickup address from shipping address
      if (o.shippingAddress) {
        setPickupAddress({
          name: o.shippingAddress.name || '',
          phone: (o.shippingAddress.phone || '').replace(/\D/g, '').slice(-10),
          street: o.shippingAddress.street || '',
          city: o.shippingAddress.city || '',
          district: o.shippingAddress.district || '',
          state: o.shippingAddress.state || '',
          zipCode: o.shippingAddress.zipCode || ''
        });
      }
    } catch (err) {
      toast.error('Failed to load order details');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (images.length + files.length > 4) {
      toast.error('You can upload a maximum of 4 proof photos');
      return;
    }

    setUploadingMedia(true);
    try {
      const uploadPromises = files.map(async (file) => {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} exceeds 10MB limit`);
        }
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/api/upload/return-proof/single', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setImages(prev => [...prev, ...uploadedUrls].slice(0, 4));
      toast.success('Photos uploaded successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setUploadingMedia(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (max 35MB for ~45s mobile clip)
    if (file.size > 35 * 1024 * 1024) {
      toast.error('Video size exceeds 35MB limit. Please upload a shorter clip (around 30–45 seconds).');
      return;
    }

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/upload/return-proof/single', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setVideo(res.data.url);
      toast.success('Video proof uploaded successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload video');
    } finally {
      setUploadingMedia(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const removeImage = (indexToRemove) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const removeVideo = () => {
    setVideo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason) {
      toast.error('Please select a return reason');
      return;
    }

    if (!description.trim()) {
      toast.error('Please provide a short description of the issue');
      return;
    }

    if (!pickupAddress.name?.trim() || !pickupAddress.street?.trim() || !pickupAddress.city?.trim() || !pickupAddress.zipCode?.trim()) {
      toast.error('Please fill in complete pickup address details for courier pickup');
      return;
    }

    const cleanPhone = String(pickupAddress.phone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9][0-9]{9}$/.test(cleanPhone)) {
      toast.error('Please provide a valid 10-digit Indian contact number for pickup executive');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        reason,
        description: description.trim(),
        images,
        video,
        pickupAddress: {
          ...pickupAddress,
          phone: cleanPhone
        }
      };

      const res = await api.post(`/api/orders/${id}/return-request`, payload);
      toast.success(res.data.message || 'Return request submitted successfully!');
      navigate(`/orders/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-16 flex flex-col items-center justify-center bg-[var(--bg-base)]">
        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-500">Loading order details…</p>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-[#FBF9F5] text-slate-800">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to={`/orders/${id}`}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <FiArrowLeft size={16} /> Back to Order #{order.orderIdString || order._id.slice(-8).toUpperCase()}
          </Link>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800">
            7-Day Return Policy
          </span>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/80 overflow-hidden">
          
          {/* Header */}
          <div className="flex items-start gap-4 pb-6 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
              <FiRefreshCcw size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 font-display">
                Request Return & Refund
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Fill in pickup details and upload photos or a short video so our verification team can approve your reverse pickup.
              </p>
            </div>
          </div>

          {/* Order Item Preview Pill */}
          <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-amber-600">
                {order.orderItems?.[0]?.image ? (
                  <img src={order.orderItems[0].image} alt="Product" className="w-full h-full object-cover" />
                ) : (
                  <FiPackage size={20} />
                )}
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-900">
                  {order.orderItems?.[0]?.name}
                  {order.orderItems?.length > 1 && ` + ${order.orderItems.length - 1} more item(s)`}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Order Total: <strong className="text-slate-800">₹{order.totalPrice}</strong>
                  {order.walletUsed > 0 && ` (Wallet: ₹${order.walletUsed})`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full">
                Delivered on {new Date(order.deliveredAt || order.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">

            {/* 1. Reason Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                1. Select Reason for Return <span className="text-red-500">*</span>
              </label>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {REASONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`p-3.5 rounded-xl text-left text-xs sm:text-sm font-semibold transition-all border outline-none flex items-center justify-between cursor-pointer ${
                      reason === r
                        ? 'bg-amber-50/80 border-amber-500 text-amber-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>{r}</span>
                    {reason === r && <FiCheckCircle size={16} className="text-amber-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Issue Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                2. Explain the Issue <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Please describe what is wrong with the package or product (e.g. damaged seal, glass broken, wrong weight)..."
                className="w-full p-4 rounded-2xl border border-slate-200 text-xs sm:text-sm bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* 3. Pickup Address Confirmation */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFDF8] border border-amber-200/70 space-y-4">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <FiMapPin className="text-amber-600" />
                <span>3. Doorstep Pickup Address & Contact</span>
              </div>
              <p className="text-xs text-slate-500">
                Our courier executive will collect the return package from this address. You can modify it if pickup is at a different location.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Contact Name *</label>
                  <div className="relative">
                    <FiUser className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
                    <input
                      type="text"
                      required
                      value={pickupAddress.name}
                      onChange={e => setPickupAddress({ ...pickupAddress, name: e.target.value })}
                      placeholder="Full Name"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mobile Number for Pickup Executive *</label>
                  <div className="relative">
                    <FiPhone className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
                    <input
                      type="tel"
                      required
                      value={pickupAddress.phone}
                      onChange={e => setPickupAddress({ ...pickupAddress, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      placeholder="10-digit mobile"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Street Address / House No. / Landmark *</label>
                <input
                  type="text"
                  required
                  value={pickupAddress.street}
                  onChange={e => setPickupAddress({ ...pickupAddress, street: e.target.value })}
                  placeholder="e.g. Flat 302, Royal Residency, Opp. City Mall"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Pincode *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pickupAddress.zipCode}
                    onChange={e => setPickupAddress({ ...pickupAddress, zipCode: e.target.value.replace(/\D/g, '') })}
                    placeholder="6 digits"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={pickupAddress.city}
                    onChange={e => setPickupAddress({ ...pickupAddress, city: e.target.value })}
                    placeholder="City"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">District</label>
                  <input
                    type="text"
                    value={pickupAddress.district}
                    onChange={e => setPickupAddress({ ...pickupAddress, district: e.target.value })}
                    placeholder="District"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">State *</label>
                  <select
                    required
                    value={pickupAddress.state}
                    onChange={e => setPickupAddress({ ...pickupAddress, state: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:border-amber-500 outline-none"
                  >
                    <option value="">Select State</option>
                    {STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Proof Photos Upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  4. Upload Proof Photos (Up to 4 images)
                </label>
                <span className="text-[11px] text-slate-400">{images.length}/4 uploaded</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Include photos of the product bottle/jar, box packaging, and the specific damage or batch code.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group bg-slate-100">
                    <img src={url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                      title="Remove photo"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                ))}

                {images.length < 4 && (
                  <button
                    type="button"
                    disabled={uploadingMedia}
                    onClick={() => imageInputRef.current?.click()}
                    className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/30 flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-amber-600 group-hover:border-amber-200 mb-2 transition-colors">
                      <FiCamera size={18} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-amber-900">+ Add Photo</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">JPG, PNG (Max 10MB)</span>
                  </button>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {/* 5. Proof Video Upload (45 Seconds) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  5. Upload Proof Video (Optional — 30 to 45 Seconds Unboxing / Defect Clip)
                </label>
                {video && <span className="text-[11px] text-emerald-600 font-bold">✓ Video Attached</span>}
              </div>
              <p className="text-xs text-slate-500 mb-3">
                A brief 30–45 second mobile video showing unboxing, leak, or defect accelerates instant approval.
              </p>

              {video ? (
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <FiVideo size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Attached Video Clip</p>
                      <a
                        href={video}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-amber-600 hover:underline font-semibold"
                      >
                        Click to Preview Video ↗
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeVideo}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-colors flex items-center gap-1.5"
                  >
                    <FiTrash2 size={13} /> Remove Video
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => videoInputRef.current?.click()}
                  className="p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/30 flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-amber-600 group-hover:border-amber-200 mb-2 transition-colors">
                    <FiUploadCloud size={22} />
                  </div>
                  <p className="text-xs font-bold text-slate-700 group-hover:text-amber-900">
                    Click to Upload 30-45s Video
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">MP4, WebM, MOV (Max 35MB)</p>
                </div>
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/mov"
                className="hidden"
                onChange={handleVideoUpload}
              />
            </div>

            {/* Terms Info Box */}
            <div className="bg-amber-50/90 border border-amber-200/70 rounded-2xl p-4 flex gap-3 text-amber-900">
              <FiAlertCircle className="shrink-0 mt-0.5 text-amber-600" size={18} />
              <div className="text-xs leading-relaxed space-y-1">
                <p className="font-bold">What happens next?</p>
                <p className="text-amber-800/90">
                  1. Our support team will verify your uploaded photos/video within 24 hours.<br />
                  2. Once approved, our courier partner will arrive at your pickup address.<br />
                  3. Your full refund (Wallet / Bank account) is processed seamlessly.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate(`/orders/${id}`)}
                className="py-3.5 px-6 font-bold text-xs sm:text-sm rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || uploadingMedia}
                className="flex-1 py-3.5 px-6 font-bold text-xs sm:text-sm rounded-2xl text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                style={{
                  background: 'linear-gradient(135deg, #F5A623 0%, #D97706 100%)',
                  boxShadow: '0 4px 14px rgba(217, 119, 6, 0.25)'
                }}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Submitting Request…</span>
                  </>
                ) : uploadingMedia ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Uploading Media…</span>
                  </>
                ) : (
                  <span>Submit Return Request</span>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default ReturnRequest;
