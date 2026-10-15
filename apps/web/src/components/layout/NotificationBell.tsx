import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { Button, EmptyState, LoadingState } from '../ui/Primitives';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 60_000,
  });

  const unreadCount = data?.filter((n) => !n.is_read).length ?? 0;

  async function markAllRead() {
    await notificationsApi.markAllRead();
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 flex items-center justify-center"
        aria-label="Notifications"
      >
        <i className="fa-solid fa-bell" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-purple-100 z-50">
            <div className="px-4 py-3 border-b border-purple-100 flex items-center justify-between">
              <span className="font-bold text-sm text-purple-950">Notifications</span>
              <button onClick={markAllRead} className="text-xs text-purple-600 font-semibold hover:underline">
                Mark all read
              </button>
            </div>
            {isLoading && <LoadingState />}
            {isError && <div className="p-4 text-xs text-rose-600">Couldn&apos;t load notifications.</div>}
            {!isLoading && !isError && (!data || data.length === 0) && (
              <EmptyState icon="fa-bell-slash" title="You're all caught up" />
            )}
            {data?.map((n) => (
              <div key={n.notification_id} className={`px-4 py-3 border-b border-purple-50 text-sm ${!n.is_read ? 'bg-purple-50/50' : ''}`}>
                {n.title && <p className="font-semibold text-purple-900">{n.title}</p>}
                <p className="text-slate-600 text-xs">{n.message}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
