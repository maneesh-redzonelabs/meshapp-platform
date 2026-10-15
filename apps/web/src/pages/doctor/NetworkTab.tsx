import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { networkApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui/Primitives';

const CATEGORIES = [
  { key: '', label: 'All' },
  { key: 'ug_batch', label: 'UG Batch' },
  { key: 'pg_batch', label: 'PG Batch' },
  { key: 'super_spec', label: 'Super Spec' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'juniors_seniors', label: 'Juniors/Seniors' },
  { key: 'coworkers', label: 'Coworkers' },
  { key: 'team', label: 'Team' },
  { key: 'general', label: 'General' },
];

export default function NetworkTab() {
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const qc = useQueryClient();
  const { show } = useToast();

  const params: Record<string, string> = {};
  if (category) params.category = category;
  if (q) params.q = q;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['network', category, q],
    queryFn: () => networkApi.list(params),
  });

  async function respond(id: string, action: 'accept' | 'reject') {
    try {
      if (action === 'accept') await networkApi.accept(id);
      else await networkApi.reject(id);
      qc.invalidateQueries({ queryKey: ['network'] });
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update connection.', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search doctors by name…"
          className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              category === c.key ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load your network." onRetry={() => refetch()} />}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState icon="fa-users" title="No connections yet" subtitle="Connect with peers to grow your professional network." />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.map((conn) => (
          <Card key={conn.connection_id} className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 overflow-hidden shrink-0">
              {conn.peer_photo ? <img src={conn.peer_photo} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user-doctor" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-purple-950 truncate">{conn.peer_name || 'Unknown'}</p>
              <Badge tone={conn.status === 'accepted' ? 'green' : conn.status === 'pending' ? 'amber' : 'slate'}>{conn.status}</Badge>
            </div>
            {conn.status === 'pending' && (
              <div className="flex flex-col gap-1">
                <Button className="px-2 py-1 text-[11px]" onClick={() => respond(conn.connection_id, 'accept')}>Accept</Button>
                <Button variant="secondary" className="px-2 py-1 text-[11px]" onClick={() => respond(conn.connection_id, 'reject')}>Reject</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
