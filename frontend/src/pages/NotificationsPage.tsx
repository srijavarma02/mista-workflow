import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../api/client';

const TYPE_STYLE: Record<string, string> = {
  success: 'border-l-4 border-green-400 bg-green-50',
  warning: 'border-l-4 border-yellow-400 bg-yellow-50',
  error:   'border-l-4 border-red-400 bg-red-50',
  info:    'border-l-4 border-blue-400 bg-blue-50',
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications').then(r => r.data) });
  const markAll = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data || [];
  const unread = data?.unreadCount || 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="w-6 h-6" /> Notifications</h1>
          <p className="text-gray-500 text-sm">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button className="btn-secondary text-sm" onClick={() => markAll.mutate()}>
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.map((n: { id: string; title: string; message: string; type: string; is_read: boolean; created_at: string }) => (
          <div key={n.id} className={`p-4 rounded-xl ${TYPE_STYLE[n.type] || 'bg-gray-50'} ${!n.is_read ? 'opacity-100' : 'opacity-60'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{n.title}</p>
                <p className="text-sm text-gray-700 mt-0.5">{n.message}</p>
              </div>
              {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
            </div>
            <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleString()}</p>
          </div>
        ))}
        {!notifications.length && (
          <div className="card text-center py-12 text-gray-400">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}
