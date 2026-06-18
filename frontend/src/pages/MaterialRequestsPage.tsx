import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, XCircle, X, Search } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

interface MaterialMasterOption {
  id: string;
  material_code: string;
  material_name: string;
  category: string;
  unit_of_measurement: string;
  available_qty: number;
  reserved_qty: number;
  physical_qty: number;
  inventory_id: string | null;
}

type MRFItem = {
  id: string;
  request_number: string;
  material_name: string;
  material_code?: string;
  unit: string;
  quantity: number;
  project_name: string;
  required_date: string;
  priority: string;
  status: string;
  requester_name: string;
  current_stock?: number;
  reserved_qty?: number;
  available_qty?: number;
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-gray', submitted: 'badge-yellow', approved: 'badge-blue',
  rejected: 'badge-red', fulfilled: 'badge-green', partially_fulfilled: 'badge-blue',
};
const PRIORITY_BADGE: Record<string, string> = {
  low: 'badge-gray', normal: 'badge-blue', high: 'badge-yellow', urgent: 'badge-red',
};

export default function MaterialRequestsPage() {
  const user = useAuthStore(s => s.user);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [searchMaterial, setSearchMaterial] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialMasterOption | null>(null);
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [approvalModal, setApprovalModal] = useState<{
    id: string;
    request_number: string;
    material_name: string;
    quantity: number;
    unit: string;
    current_stock: number;
    reserved_qty: number;
    available_qty: number;
  } | null>(null);
  const [approveQty, setApproveQty] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const qc = useQueryClient();

  const [form, setForm] = useState({
    project_id: '', material_master_id: '', inventory_id: '',
    material_code: '', material_name: '', unit: '', quantity: '',
    required_date: '', priority: 'normal', remarks: '',
    current_stock: 0, reserved_qty: 0, available_qty: 0,
  });

  const { data: mrfs } = useQuery<{ success: boolean; data: MRFItem[] }>({
    queryKey: ['mrfs', statusFilter],
    queryFn: () => api.get('/material-requests', { params: { status: statusFilter || undefined } }).then(r => r.data),
  });

  const { data: materialMasters } = useQuery<{ success: boolean; data: MaterialMasterOption[] }>({
    queryKey: ['materialMasters', searchMaterial],
    queryFn: () => api.get('/material-masters', { params: { search: searchMaterial || undefined } }).then(r => r.data),
    enabled: showForm,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/material-requests', data),
    onSuccess: () => { toast.success('MRF submitted'); qc.invalidateQueries({ queryKey: ['mrfs'] }); setShowForm(false); setForm({
      project_id: '', material_master_id: '', inventory_id: '', material_code: '', material_name: '', unit: '', quantity: '',
      required_date: '', priority: 'normal', remarks: '', current_stock: 0, reserved_qty: 0, available_qty: 0,
    }); setSearchMaterial(''); setSelectedMaterial(null); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, approved_quantity, remarks }: { id: string; approved_quantity: number; remarks?: string }) =>
      api.put(`/material-requests/${id}/approve`, { approved_quantity, remarks }),
    onSuccess: () => { toast.success('MRF approved'); qc.invalidateQueries({ queryKey: ['mrfs'] }); setApprovalModal(null); setApproveQty(''); setApprovalRemarks(''); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      api.put(`/material-requests/${id}/reject`, { remarks }),
    onSuccess: () => { toast.success('MRF rejected'); qc.invalidateQueries({ queryKey: ['mrfs'] }); setRejectId(null); setRejectRemarks(''); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const canCreate = user?.role === 'site_engineer' || user?.role === 'admin';
  const canApprove = user?.role === 'project_manager' || user?.role === 'admin';

  const materialItems = (materialMasters?.data as MaterialMasterOption[]) || [];
  const items = (mrfs?.data as MRFItem[]) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Material Requests (MRF)</h1>
          <p className="text-gray-500 text-sm">{items.length} requests</p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> New MRF
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'submitted', 'approved', 'rejected', 'fulfilled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${statusFilter === s ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Request #</th><th>Material</th><th>Code</th><th>UOM</th><th>Qty</th><th>Current</th><th>Available</th><th>Project</th>
              <th>Required By</th><th>Priority</th><th>Status</th><th>Requester</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: MRFItem) => (
              <tr key={item.id}>
                <td className="font-mono text-xs font-semibold">{item.request_number}</td>
                <td className="font-medium">{item.material_name}</td>
                <td className="text-xs text-gray-600">{item.material_code || '—'}</td>
                <td className="text-xs text-gray-600">{item.unit || '—'}</td>
                <td>{parseFloat(item.quantity as unknown as string).toLocaleString()}</td>
                <td>{item.current_stock != null ? parseFloat(item.current_stock as unknown as string).toLocaleString() : '—'}</td>
                <td>{item.available_qty != null ? parseFloat(item.available_qty as unknown as string).toLocaleString() : '—'}</td>
                <td className="text-sm text-gray-600">{item.project_name}</td>
                <td className="text-sm">{new Date(item.required_date).toLocaleDateString()}</td>
                <td><span className={PRIORITY_BADGE[item.priority] || 'badge-gray'}>{item.priority}</span></td>
                <td><span className={STATUS_BADGE[item.status] || 'badge-gray'}>{item.status}</span></td>
                <td className="text-sm text-gray-600">{item.requester_name}</td>
                <td>
                  {canApprove && item.status === 'submitted' && (
                    <div className="flex gap-1">
                      <button onClick={() => {
                        setApprovalModal({
                          id: item.id,
                          request_number: item.request_number,
                          material_name: item.material_name,
                          quantity: Number(item.quantity),
                          unit: item.unit,
                          current_stock: Number(item.current_stock ?? 0),
                          reserved_qty: Number(item.reserved_qty ?? 0),
                          available_qty: Number(item.available_qty ?? 0),
                        });
                        setApproveQty(String(item.quantity));
                        setApprovalRemarks('');
                      }} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => setRejectId(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Reject">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="text-center py-12 text-gray-400">No material requests</div>}
      </div>

      {/* Create MRF Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">New Material Requisition Form</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div>
                <label className="label">Project *</label>
                <select className="input" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} required>
                  <option value="">Select project</option>
                  {(projects?.data || []).map((p: { id: string; name: string; code: string }) => (
                    <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Material *</label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="input pl-9"
                      placeholder="Search and select a material master"
                      value={searchMaterial}
                      onChange={(e) => {
                        setSearchMaterial(e.target.value);
                        setShowMaterialDropdown(true);
                        setSelectedMaterial(null);
                        setForm({ ...form, material_master_id: '', inventory_id: '', material_code: '', material_name: '', unit: '', current_stock: 0, reserved_qty: 0, available_qty: 0 });
                      }}
                      onFocus={() => setShowMaterialDropdown(true)}
                    />
                  </div>
                  {showMaterialDropdown && (
                    <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                      {materialItems.length > 0 ? materialItems.map((item: MaterialMasterOption) => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-gray-50"
                          onClick={() => {
                            setSelectedMaterial(item);
                            setShowMaterialDropdown(false);
                            setSearchMaterial(`${item.material_code} - ${item.material_name}`);
                            setForm({
                              ...form,
                              project_id: form.project_id,
                              material_master_id: item.id,
                              inventory_id: item.inventory_id ?? '',
                              material_code: item.material_code,
                              material_name: item.material_name,
                              unit: item.unit_of_measurement,
                              current_stock: item.available_qty,
                              reserved_qty: item.reserved_qty,
                              available_qty: item.available_qty,
                            });
                          }}
                        >
                          <div className="font-medium">{item.material_name}</div>
                          <div className="text-xs text-gray-500">{item.material_code} · {item.category} · {item.unit_of_measurement}</div>
                        </button>
                      )) : (
                        <div className="p-4 text-sm text-gray-500">No matching material master items found.</div>
                      )}
                    </div>
                  )}
                </div>
                {selectedMaterial && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="label">Material Code</label>
                      <input className="input" value={selectedMaterial.material_code} disabled />
                    </div>
                    <div>
                      <label className="label">Category</label>
                      <input className="input" value={selectedMaterial.category} disabled />
                    </div>
                    <div>
                      <label className="label">Material Name</label>
                      <input className="input" value={selectedMaterial.material_name} disabled />
                    </div>
                    <div>
                      <label className="label">Unit</label>
                      <input className="input" value={selectedMaterial.unit_of_measurement} disabled />
                    </div>
                  </div>
                )}
              </div>
              {selectedMaterial && selectedMaterial.inventory_id ? (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-2xl border border-slate-200 p-4 text-sm">
                  <div>
                    <div className="text-gray-500">Current Stock</div>
                    <div className="font-medium">{selectedMaterial.available_qty.toLocaleString()} {selectedMaterial.unit_of_measurement}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Reserved</div>
                    <div className="font-medium">{selectedMaterial.reserved_qty.toLocaleString()} {selectedMaterial.unit_of_measurement}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-500">Available</div>
                    <div className="font-medium">{selectedMaterial.available_qty.toLocaleString()} {selectedMaterial.unit_of_measurement}</div>
                  </div>
                </div>
              ) : selectedMaterial ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                  No inventory record is linked to this material. The request can still be created, but stock availability is not available.
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Quantity *</label>
                  <input type="number" className="input" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} min="0.001" step="any" required />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <input className="input" value={form.unit} disabled />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Required Date *</label>
                  <input type="date" className="input" value={form.required_date} onChange={e => setForm({ ...form, required_date: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Low</option><option value="normal">Normal</option>
                    <option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Remarks</label>
                <textarea className="input" rows={2} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={createMutation.isPending || !form.material_master_id}>Submit MRF</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">Approve Material Request</h2>
                <p className="text-sm text-gray-500">{approvalModal.material_name} • {approvalModal.request_number}</p>
              </div>
              <button onClick={() => setApprovalModal(null)}><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p className="text-gray-500">Requested</p>
                <p className="font-medium">{approvalModal.quantity.toLocaleString()} {approvalModal.unit}</p>
              </div>
              <div>
                <p className="text-gray-500">Available</p>
                <p className="font-medium">{approvalModal.available_qty.toLocaleString()} {approvalModal.unit}</p>
              </div>
              <div>
                <p className="text-gray-500">Reserved</p>
                <p className="font-medium">{approvalModal.reserved_qty.toLocaleString()} {approvalModal.unit}</p>
              </div>
              <div>
                <p className="text-gray-500">Current Stock</p>
                <p className="font-medium">{approvalModal.current_stock.toLocaleString()} {approvalModal.unit}</p>
              </div>
            </div>

            <div>
              <label className="label">Approved Quantity</label>
              <input
                type="number"
                className="input"
                value={approveQty}
                onChange={(e) => setApproveQty(e.target.value)}
                min="0.001"
                step="any"
              />
            </div>
            <div>
              <label className="label">Remarks (optional)</label>
              <textarea
                className="input"
                rows={3}
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder="Reason for quantity modification or approval notes"
              />
            </div>
            {parseFloat(approveQty || '0') > approvalModal.available_qty && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                Approved quantity exceeds available stock. The system will reserve available quantity and generate a purchase request for the shortage.
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                className="btn-primary flex-1 justify-center"
                onClick={() => approveMutation.mutate({ id: approvalModal.id, approved_quantity: Number(approveQty), remarks: approvalRemarks || undefined })}
                disabled={!approveQty || approveMutation.isPending}
              >
                Approve
              </button>
              <button className="btn-secondary" onClick={() => setApprovalModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Rejection Reason</h2>
            <textarea className="input" rows={3} placeholder="Provide reason for rejection..." value={rejectRemarks} onChange={e => setRejectRemarks(e.target.value)} />
            <div className="flex gap-3 mt-4">
              <button className="btn-danger flex-1 justify-center" disabled={!rejectRemarks}
                onClick={() => rejectMutation.mutate({ id: rejectId, remarks: rejectRemarks })}>
                Reject MRF
              </button>
              <button className="btn-secondary" onClick={() => { setRejectId(null); setRejectRemarks(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
