import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-yellow', inspected: 'badge-blue', accepted: 'badge-green',
  rejected: 'badge-red', partial: 'badge-yellow',
};

export default function GRNsPage() {
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['grns'], queryFn: () => api.get('/grns').then(r => r.data) });

  const finaliseMutation = useMutation({
    mutationFn: (id: string) => api.put(`/grns/${id}/finalise`),
    onSuccess: () => { toast.success('GRN finalised and stock updated'); qc.invalidateQueries({ queryKey: ['grns'] }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const canFinalise = user?.role === 'stores_executive' || user?.role === 'admin';
  const grns = data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Goods Receipt Notes (GRN)</h1>
        <p className="text-gray-500 text-sm">{grns.length} records</p>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>GRN #</th><th>PO #</th><th>Vendor</th><th>Received Date</th><th>Received By</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {grns.map((g: { id: string; grn_number: string; po_number: string; vendor_name: string; received_date: string; received_by_name: string; status: string }) => (
              <tr key={g.id}>
                <td className="font-mono text-xs font-semibold">{g.grn_number}</td>
                <td className="font-mono text-xs">{g.po_number}</td>
                <td className="font-medium">{g.vendor_name}</td>
                <td>{new Date(g.received_date).toLocaleDateString()}</td>
                <td className="text-sm text-gray-600">{g.received_by_name}</td>
                <td><span className={STATUS_BADGE[g.status] || 'badge-gray'}>{g.status}</span></td>
                <td>
                  {canFinalise && g.status === 'inspected' && (
                    <button onClick={() => finaliseMutation.mutate(g.id)} className="btn-success text-xs py-1 px-2">
                      <CheckCircle className="w-3.5 h-3.5" /> Finalise
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!grns.length && <div className="text-center py-12 text-gray-400">No GRNs recorded</div>}
      </div>
    </div>
  );
}
