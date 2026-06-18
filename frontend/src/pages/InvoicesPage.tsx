import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-yellow', verified: 'badge-blue', approved: 'badge-blue',
  paid: 'badge-green', rejected: 'badge-red',
};

export default function InvoicesPage() {
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['invoices'], queryFn: () => api.get('/invoices').then(r => r.data) });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/invoices/${id}/status`, { status }),
    onSuccess: () => { toast.success('Invoice updated'); qc.invalidateQueries({ queryKey: ['invoices'] }); },
  });

  const canUpdate = user?.role === 'finance' || user?.role === 'admin';
  const invoices = data?.data || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Invoices</h1>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>Invoice #</th><th>PO #</th><th>Vendor</th><th>Amount</th><th>Tax</th><th>Total</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {invoices.map((inv: { id: string; invoice_number: string; po_number: string; vendor_name: string; amount: number; tax_amount: number; total_amount: number; status: string }) => (
              <tr key={inv.id}>
                <td className="font-mono text-xs">{inv.invoice_number}</td>
                <td className="font-mono text-xs">{inv.po_number}</td>
                <td className="font-medium">{inv.vendor_name}</td>
                <td>₹{parseFloat(inv.amount as unknown as string).toLocaleString()}</td>
                <td>₹{parseFloat(inv.tax_amount as unknown as string).toLocaleString()}</td>
                <td className="font-semibold">₹{parseFloat(inv.total_amount as unknown as string).toLocaleString()}</td>
                <td><span className={STATUS_BADGE[inv.status] || 'badge-gray'}>{inv.status}</span></td>
                <td>
                  {canUpdate && inv.status === 'pending' && (
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => updateStatus.mutate({ id: inv.id, status: 'verified' })}>Verify</button>
                  )}
                  {canUpdate && inv.status === 'verified' && (
                    <button className="text-xs text-green-600 hover:underline" onClick={() => updateStatus.mutate({ id: inv.id, status: 'paid' })}>Mark Paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!invoices.length && <div className="text-center py-12 text-gray-400">No invoices</div>}
      </div>
    </div>
  );
}
