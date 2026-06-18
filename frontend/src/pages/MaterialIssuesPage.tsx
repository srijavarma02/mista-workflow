import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-yellow', approved: 'badge-blue', issued: 'badge-green', cancelled: 'badge-red',
};

export default function MaterialIssuesPage() {
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['material-issues'], queryFn: () => api.get('/material-issues').then(r => r.data) });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.put(`/material-issues/${id}/approve`),
    onSuccess: () => { toast.success('Material issued and stock updated'); qc.invalidateQueries({ queryKey: ['material-issues'] }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const canApprove = user?.role === 'project_manager' || user?.role === 'admin';
  const issues = data?.data || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Material Issues</h1>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>Issue #</th><th>Project</th><th>Issued By</th><th>Received By</th><th>Issue Date</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {issues.map((i: { id: string; issue_number: string; project_name: string; issued_by_name: string; received_by_name: string; issue_date: string; status: string }) => (
              <tr key={i.id}>
                <td className="font-mono text-xs font-semibold">{i.issue_number}</td>
                <td>{i.project_name || '—'}</td>
                <td>{i.issued_by_name}</td>
                <td>{i.received_by_name}</td>
                <td>{new Date(i.issue_date).toLocaleDateString()}</td>
                <td><span className={STATUS_BADGE[i.status] || 'badge-gray'}>{i.status}</span></td>
                <td>
                  {canApprove && i.status === 'pending' && (
                    <button onClick={() => approveMutation.mutate(i.id)} className="btn-success text-xs py-1 px-2">
                      <CheckCircle className="w-3.5 h-3.5" /> Issue
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!issues.length && <div className="text-center py-12 text-gray-400">No material issues</div>}
      </div>
    </div>
  );
}
