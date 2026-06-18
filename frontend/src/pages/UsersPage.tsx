import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, UserCheck, UserX } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';

const ROLES = ['admin','site_engineer','project_manager','stores_executive','procurement','qaqc','finance'];

export default function UsersPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'site_engineer', department: '', phone: '' });
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => api.post('/users', d),
    onSuccess: () => { toast.success('User created'); qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => api.put(`/users/${id}`, { is_active }),
    onSuccess: () => { toast.success('User updated'); qc.invalidateQueries({ queryKey: ['users'] }); },
  });

  const users = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add User</button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Last Login</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u: { id: string; name: string; email: string; role: string; department: string; last_login: string; is_active: boolean }) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td className="text-sm text-gray-600">{u.email}</td>
                <td><span className="badge-blue">{u.role.replace(/_/g, ' ')}</span></td>
                <td className="text-sm text-gray-500">{u.department || '—'}</td>
                <td className="text-xs text-gray-500">{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                <td><span className={u.is_active ? 'badge-green' : 'badge-red'}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <button onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                    className="p-1 text-gray-500 hover:text-gray-800" title={u.is_active ? 'Deactivate' : 'Activate'}>
                    {u.is_active ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-green-600" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add User</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div><label className="label">Full Name *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
              <div><label className="label">Password *</label><input type="password" className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
              <div><label className="label">Role *</label>
                <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Department</label><input className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="flex gap-3"><button type="submit" className="btn-primary flex-1 justify-center" disabled={createMutation.isPending}>Create User</button><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
