import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

export default function AuditPage() {
  const { data } = useQuery({ queryKey: ['audit'], queryFn: () => api.get('/audit').then(r => r.data) });
  const logs = data?.data || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>IP Address</th></tr>
          </thead>
          <tbody>
            {logs.map((l: { id: string; created_at: string; user_name: string; user_email: string; action: string; entity_type: string; entity_id: string; ip_address: string }) => (
              <tr key={l.id}>
                <td className="text-xs text-gray-500">{new Date(l.created_at).toLocaleString()}</td>
                <td>
                  <p className="text-sm font-medium">{l.user_name || 'System'}</p>
                  <p className="text-xs text-gray-400">{l.user_email}</p>
                </td>
                <td><span className={`badge ${l.action === 'DELETE' ? 'badge-red' : l.action === 'CREATE' ? 'badge-green' : 'badge-blue'}`}>{l.action}</span></td>
                <td className="text-xs text-gray-600">{l.entity_type} {l.entity_id ? `· ${l.entity_id.substring(0, 8)}...` : ''}</td>
                <td className="text-xs text-gray-500 font-mono">{l.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length && <div className="text-center py-12 text-gray-400">No audit logs</div>}
      </div>
    </div>
  );
}
