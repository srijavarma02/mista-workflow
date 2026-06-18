import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, X } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export default function VendorsPage() {
  const user = useAuthStore(s => s.user);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', contact_person: '', email: '', phone: '', address: '', gst_number: '' });
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['vendors'], queryFn: () => api.get('/vendors').then(r => r.data) });
  const { data: performance } = useQuery({ queryKey: ['vendor-performance'], queryFn: () => api.get('/vendors/performance').then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => api.post('/vendors', d),
    onSuccess: () => { toast.success('Vendor created'); qc.invalidateQueries({ queryKey: ['vendors'] }); setShowForm(false); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const canEdit = user?.role === 'procurement' || user?.role === 'admin';
  const vendors = data?.data || [];
  const perfMap = new Map((performance?.data || []).map((p: { id: string; total_orders: number; delivered_orders: number; avg_delivery_days: number }) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendors</h1>
        {canEdit && <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Vendor</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map((v: { id: string; name: string; contact_person: string; email: string; phone: string; performance_score: number }) => {
          const perf = perfMap.get(v.id) as { total_orders: number; delivered_orders: number } | undefined;
          return (
            <div key={v.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{v.name}</h3>
                  <p className="text-sm text-gray-500">{v.contact_person}</p>
                </div>
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-semibold text-yellow-700">{parseFloat(v.performance_score as unknown as string).toFixed(1)}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                {v.email && <p>📧 {v.email}</p>}
                {v.phone && <p>📞 {v.phone}</p>}
              </div>
              {perf && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-600">
                  <span>{perf.total_orders} orders</span>
                  <span className="text-green-600">{perf.delivered_orders} delivered</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!vendors.length && <div className="text-center py-12 text-gray-400 card">No vendors registered</div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add Vendor</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div><label className="label">Vendor Name *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="label">Contact Person</label><input className="input" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">GST Number</label><input className="input" value={form.gst_number} onChange={e => setForm({ ...form, gst_number: e.target.value })} /></div>
              <div><label className="label">Address</label><textarea className="input" rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="flex gap-3"><button type="submit" className="btn-primary flex-1 justify-center" disabled={createMutation.isPending}>Add Vendor</button><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
