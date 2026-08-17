import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiBriefcase, FiPhone, FiMail } from 'react-icons/fi';
import api from '../../api/axios';

export default function ManageB2B() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    try {
      const res = await api.get('/api/contact/b2b');
      setInquiries(res.data);
    } catch (error) {
      toast.error('Failed to fetch B2B inquiries');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/api/contact/b2b/${id}/status`, { status: newStatus });
      toast.success('Status updated successfully');
      fetchInquiries();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-700';
      case 'CONTACTED': return 'bg-yellow-100 text-yellow-700';
      case 'CONVERTED': return 'bg-green-100 text-green-700';
      case 'CLOSED': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
            <FiBriefcase /> B2B Inquiries
          </h1>
          <p className="text-slate-500 mt-1">Manage bulk and wholesale orders</p>
        </div>
        <div className="bg-brand-primary/10 text-brand-primary font-bold px-4 py-2 rounded-xl">
          Total: {inquiries.length}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {inquiries.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No B2B inquiries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-100">
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Client Info</th>
                  <th className="p-4 font-semibold">Quantity / Req</th>
                  <th className="p-4 font-semibold">Message</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inq) => (
                  <tr key={inq._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                      {new Date(inq.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{inq.name}</div>
                      {inq.company && <div className="text-xs text-brand-secondary font-medium">{inq.company}</div>}
                      <div className="text-xs text-slate-500 mt-1 flex flex-col gap-0.5">
                        <span className="flex items-center gap-1"><FiPhone size={10} /> {inq.phone}</span>
                        {inq.email && <span className="flex items-center gap-1"><FiMail size={10} /> {inq.email}</span>}
                      </div>
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                      {inq.quantity}
                    </td>
                    <td className="p-4 text-sm text-slate-600 min-w-[200px]">
                      {inq.message}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(inq.status)}`}>
                        {inq.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <select
                        value={inq.status}
                        onChange={(e) => handleStatusChange(inq._id, e.target.value)}
                        className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand-primary"
                      >
                        <option value="NEW">New</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="CONVERTED">Converted</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
