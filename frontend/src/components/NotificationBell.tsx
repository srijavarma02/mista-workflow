import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30000,
  });

  const markAll = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.unreadCount || 0;
  const notifications: Notification[] = data?.data || [];

  const typeColor: Record<string, string> = {
    success: 'bg-green-50 border-l-4 border-green-400',
    warning: 'bg-yellow-50 border-l-4 border-yellow-400',
    error:   'bg-red-50 border-l-4 border-red-400',
    info:    'bg-blue-50 border-l-4 border-blue-400',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-primary-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unread > 0 && (
              <button onClick={() => markAll.mutate()} className="text-xs text-primary-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No notifications</p>
            ) : (
              notifications.slice(0, 15).map((n) => (
                <div
                  key={n.id}
                  className={`p-3 ${typeColor[n.type] || 'bg-gray-50'} ${!n.is_read ? 'opacity-100' : 'opacity-60'}`}
                >
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
}
