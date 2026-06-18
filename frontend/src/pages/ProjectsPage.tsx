import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import api from '../api/client';

export default function ProjectsPage() {
  const { data } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/projects').then(r => r.data) });
  const projects = data?.data || [];

  const statusBg: Record<string, string> = {
    active: 'bg-green-100 text-green-800', completed: 'bg-gray-100 text-gray-800',
    on_hold: 'bg-yellow-100 text-yellow-800', cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Projects</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p: { id: string; code: string; name: string; location: string; status: string; manager_name: string; budget: number }) => (
          <div key={p.id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-700" />
              </div>
              <span className={`badge ${statusBg[p.status]}`}>{p.status.replace('_', ' ')}</span>
            </div>
            <h3 className="font-semibold text-gray-900">{p.name}</h3>
            <p className="text-xs font-mono text-gray-400 mt-0.5">{p.code}</p>
            {p.location && <p className="text-sm text-gray-500 mt-2">📍 {p.location}</p>}
            {p.manager_name && <p className="text-sm text-gray-500">👤 {p.manager_name}</p>}
            {p.budget && <p className="text-sm font-medium text-primary-700 mt-2">Budget: ₹{parseFloat(p.budget as unknown as string).toLocaleString()}</p>}
          </div>
        ))}
      </div>
      {!projects.length && <div className="card text-center py-12 text-gray-400">No projects found</div>}
    </div>
  );
}
