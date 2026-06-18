import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, AlertTriangle, BookOpen, X } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

interface InventoryItem {
  id: string; item_code: string; material_name: string; category: string;
  unit: string; available_qty: number; reserved_qty: number; reorder_level: number;
  unit_cost: number; warehouse_location: string;
}

const INITIAL_FORM = {
  item_code: '', material_name: '', category: '', unit: '',
  available_qty: 0, reorder_level: 0, warehouse_location: '', unit_cost: 0, hsn_code: '',
};

export default function InventoryPage() {
  const user = useAuthStore(s => s.user);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [showLedger, setShowLedger] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const qc = useQueryClient();

  const canEdit = user?.role === 'admin' || user?.role === 'stores_executive';

  const { data } = useQuery({
    queryKey: ['inventory', search, category, page],
    queryFn: () => api.get('/inventory', { params: { search, category, page, limit: 20 } }).then(r => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => api.get('/inventory/categories').then(r => r.data),
  });

  const { data: lowStock } = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: () => api.get('/inventory/low-stock').then(r => r.data),
  });

  const { data: ledger } = useQuery({
    queryKey: ['ledger', showLedger],
    queryFn: () => api.get(`/inventory/${showLedger}/ledger`).then(r => r.data),
    enabled: !!showLedger,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof INITIAL_FORM) => api.post('/inventory', data),
    onSuccess: () => { toast.success('Item created'); qc.invalidateQueries({ queryKey: ['inventory'] }); setShowForm(false); setForm(INITIAL_FORM); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof INITIAL_FORM> }) => api.put(`/inventory/${id}`, data),
    onSuccess: () => { toast.success('Item updated'); qc.invalidateQueries({ queryKey: ['inventory'] }); setEditItem(null); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const items: InventoryItem[] = data?.data || [];
  const pagination = data?.pagination;

  const stockBg = (item: InventoryItem) =>
    item.available_qty <= item.reorder_level ? 'bg-red-50' : 'bg-white';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm">
            {pagination?.total || 0} items · {lowStock?.data?.length || 0} low stock
          </p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => { setShowForm(true); setForm(INITIAL_FORM); }}>
            <Plus className="w-4 h-4" /> Add Item
          </button>
        )}
      </div>

      {/* Low Stock Alert */}
      {(lowStock?.data?.length || 0) > 0 && (
        <div className="flex items-start gap-3 p-4 bg-warning-50 border border-yellow-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-800 text-sm">Low Stock Alert</p>
            <p className="text-yellow-700 text-sm">
              {lowStock?.data?.length} item(s) are at or below reorder level and need procurement attention.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search items..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-48" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {(categories?.data || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Item Code</th><th>Material Name</th><th>Category</th>
              <th>Unit</th><th>Available</th><th>Reserved</th>
              <th>Reorder Lvl</th><th>Unit Cost</th><th>Location</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className={stockBg(item)}>
                <td className="font-mono text-xs">{item.item_code}</td>
                <td className="font-medium">
                  {item.material_name}
                  {item.available_qty <= item.reorder_level && (
                    <span className="ml-2 badge-red">Low</span>
                  )}
                </td>
                <td>{item.category}</td>
                <td>{item.unit}</td>
                <td className={item.available_qty <= item.reorder_level ? 'text-red-600 font-bold' : 'text-green-700 font-semibold'}>
                  {parseFloat(item.available_qty as unknown as string).toLocaleString()}
                </td>
                <td>{parseFloat(item.reserved_qty as unknown as string).toLocaleString()}</td>
                <td>{parseFloat(item.reorder_level as unknown as string).toLocaleString()}</td>
                <td>₹{parseFloat(item.unit_cost as unknown as string).toLocaleString()}</td>
                <td className="text-xs text-gray-500">{item.warehouse_location}</td>
                <td>
                  <div className="flex gap-2">
                    <button onClick={() => setShowLedger(item.id)} className="text-blue-600 hover:underline text-xs">
                      <BookOpen className="w-3.5 h-3.5" />
                    </button>
                    {canEdit && (
                      <button onClick={() => setEditItem(item)} className="text-gray-600 hover:underline text-xs">Edit</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="text-center py-12 text-gray-400">No inventory items found</div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 text-sm rounded-lg ${p === page ? 'bg-primary-700 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>{p}</button>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showForm || editItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editItem ? 'Edit Item' : 'Add Inventory Item'}</h2>
              <button onClick={() => { setShowForm(false); setEditItem(null); }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (editItem) updateMutation.mutate({ id: editItem.id, data: form });
              else createMutation.mutate(form);
            }} className="space-y-4">
              {!editItem && (
                <div>
                  <label className="label">Item Code *</label>
                  <input className="input" value={form.item_code} onChange={e => setForm({ ...form, item_code: e.target.value })} required />
                </div>
              )}
              <div>
                <label className="label">Material Name *</label>
                <input className="input" value={form.material_name}
                  onChange={e => setForm({ ...form, material_name: e.target.value })}
                  defaultValue={editItem?.material_name} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category *</label>
                  <input className="input" value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    defaultValue={editItem?.category} required />
                </div>
                <div>
                  <label className="label">Unit *</label>
                  <input className="input" value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    defaultValue={editItem?.unit} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Reorder Level</label>
                  <input type="number" className="input" value={form.reorder_level}
                    onChange={e => setForm({ ...form, reorder_level: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Unit Cost (₹)</label>
                  <input type="number" className="input" value={form.unit_cost}
                    onChange={e => setForm({ ...form, unit_cost: parseFloat(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="label">Warehouse Location</label>
                <input className="input" value={form.warehouse_location}
                  onChange={e => setForm({ ...form, warehouse_location: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 justify-center"
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {editItem ? 'Update' : 'Create'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditItem(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {showLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Stock Ledger</h2>
              <button onClick={() => setShowLedger(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Qty</th><th>Balance</th><th>Reference</th></tr>
                </thead>
                <tbody>
                  {(ledger?.data || []).map((e: { id: string; created_at: string; transaction_type: string; quantity: number; balance_after: number; reference_type: string }) => (
                    <tr key={e.id}>
                      <td className="text-xs">{new Date(e.created_at).toLocaleDateString()}</td>
                      <td><span className={e.transaction_type === 'inward' || e.transaction_type === 'return' ? 'badge-green' : 'badge-red'}>{e.transaction_type}</span></td>
                      <td className={parseFloat(e.quantity as unknown as string) > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {parseFloat(e.quantity as unknown as string) > 0 ? '+' : ''}{parseFloat(e.quantity as unknown as string).toFixed(2)}
                      </td>
                      <td className="font-medium">{parseFloat(e.balance_after as unknown as string).toFixed(2)}</td>
                      <td className="text-xs text-gray-500">{e.reference_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(ledger?.data?.length) && <div className="text-center py-8 text-gray-400">No ledger entries</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
