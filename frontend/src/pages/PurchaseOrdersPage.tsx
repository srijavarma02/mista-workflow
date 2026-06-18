import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-gray', sent: 'badge-blue', confirmed: 'badge-yellow',
  partially_delivered: 'badge-yellow', delivered: 'badge-green', cancelled: 'badge-red',
};

export default function PurchaseOrdersPage() {
  const user = useAuthStore(s => s.user);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vendor_id: '', delivery_date: '', notes: '', items: [{ inventory_id: '', quantity: '', unit_price: '' }] });
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['pos'], queryFn: () => api.get('/purchase-orders').then(r => r.data) });
  const { data: vendors } = useQuery({ queryKey: ['vendors'], queryFn: () => api.get('/vendors').then(r => r.data) });
  const { data: inventory } = useQuery({ queryKey: ['inventory-all'], queryFn: () => api.get('/inventory', { params: { limit: 200 } }).then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => api.post('/purchase-orders', { ...d, items: d.items.map(i => ({ ...i, quantity: parseFloat(i.quantity), unit_price: parseFloat(i.unit_price) })) }),
    onSuccess: () => { toast.success('PO created'); qc.invalidateQueries({ queryKey: ['pos'] }); setShowForm(false); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/purchase-orders/${id}/status`, { status }),
    onSuccess: () => { toast.success('PO updated'); qc.invalidateQueries({ queryKey: ['pos'] }); },
  });

  const canCreate = user?.role === 'procurement' || user?.role === 'admin';
  const pos = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        {canCreate && <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New PO</button>}
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>PO #</th><th>Vendor</th><th>Total Amount</th><th>Delivery Date</th><th>Status</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {pos.map((po: { id: string; po_number: string; vendor_name: string; total_amount: number; delivery_date: string; status: string; created_at: string }) => (
              <tr key={po.id}>
                <td className="font-mono text-xs font-semibold">{po.po_number}</td>
                <td className="font-medium">{po.vendor_name}</td>
                <td>₹{parseFloat(po.total_amount as unknown as string).toLocaleString()}</td>
                <td>{po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : '—'}</td>
                <td><span className={STATUS_BADGE[po.status] || 'badge-gray'}>{po.status}</span></td>
                <td className="text-sm text-gray-500">{new Date(po.created_at).toLocaleDateString()}</td>
                <td>
                  {canCreate && po.status === 'draft' && (
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => updateStatus.mutate({ id: po.id, status: 'sent' })}>Send</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pos.length && <div className="text-center py-12 text-gray-400">No purchase orders</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Create Purchase Order</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div>
                <label className="label">Vendor *</label>
                <select className="input" value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })} required>
                  <option value="">Select vendor</option>
                  {(vendors?.data || []).map((v: { id: string; name: string }) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Delivery Date</label>
                <input type="date" className="input" value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Line Items *</label>
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
                    <select className="input text-sm" value={item.inventory_id} onChange={e => { const items = [...form.items]; items[idx].inventory_id = e.target.value; setForm({ ...form, items }); }}>
                      <option value="">Select material</option>
                      {(inventory?.data || []).map((i: { id: string; material_name: string; item_code: string }) => <option key={i.id} value={i.id}>{i.item_code} – {i.material_name}</option>)}
                    </select>
                    <input type="number" className="input text-sm" placeholder="Qty" value={item.quantity} onChange={e => { const items = [...form.items]; items[idx].quantity = e.target.value; setForm({ ...form, items }); }} />
                    <input type="number" className="input text-sm" placeholder="Unit Price ₹" value={item.unit_price} onChange={e => { const items = [...form.items]; items[idx].unit_price = e.target.value; setForm({ ...form, items }); }} />
                  </div>
                ))}
                <button type="button" className="text-sm text-primary-600 hover:underline" onClick={() => setForm({ ...form, items: [...form.items, { inventory_id: '', quantity: '', unit_price: '' }] })}>+ Add Line Item</button>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={createMutation.isPending}>Create PO</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
