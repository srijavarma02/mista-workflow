import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export default function MaterialReturnsPage() {
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['returns'], queryFn: () => api.get('/material-returns').then(r => r.data) });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.put(`/material-returns/${id}/accept`),
    onSuccess: () => { toast.success('Return accepted and stock updated'); qc.invalidateQueries({ queryKey: ['returns'] }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const canAccept = user?.role === 'stores_executive' || user?.role === 'admin';
  const returns = data?.data || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Material Returns</h1>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>Return #</th><th>Returned By</th><th>Return Date</th><th>Reason</th><th>Condition</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {returns.map((r: { id: string; return_number: string; returned_by_name: string; return_date: string; reason: string; condition: string; status: string }) => (
              <tr key={r.id}>
                <td className="font-mono text-xs font-semibold">{r.return_number}</td>
                <td>{r.returned_by_name}</td>
                <td>{new Date(r.return_date).toLocaleDateString()}</td>
                <td className="text-sm text-gray-600 max-w-32 truncate">{r.reason || '—'}</td>
                <td>{r.condition && <span className={r.condition === 'good' ? 'badge-green' : 'badge-yellow'}>{r.condition}</span>}</td>
                <td><span className={r.status === 'received' ? 'badge-green' : r.status === 'rejected' ? 'badge-red' : 'badge-yellow'}>{r.status}</span></td>
                <td>
                  {canAccept && r.status === 'pending' && (
                    <button onClick={() => acceptMutation.mutate(r.id)} className="btn-success text-xs py-1 px-2">
                      <CheckCircle className="w-3.5 h-3.5" /> Accept
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!returns.length && <div className="text-center py-12 text-gray-400">No material returns</div>}
      </div>
    </div>
  );
}
