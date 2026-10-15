import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { communityApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Textarea } from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Modal';

export default function CommunityTab() {
  const qc = useQueryClient();
  const { show } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['communities'], queryFn: () => communityApi.list() });

  async function toggleMembership(id: string, isMember?: boolean) {
    try {
      if (isMember) await communityApi.leave(id);
      else await communityApi.join(id);
      qc.invalidateQueries({ queryKey: ['communities'] });
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update membership.', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-purple-950">Communities</h2>
        <Button onClick={() => setShowCreate(true)} className="px-3 py-2 text-xs">
          <i className="fa-solid fa-plus mr-1" /> New Community
        </Button>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load communities." onRetry={() => refetch()} />}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState icon="fa-users-rectangle" title="No communities yet" subtitle="Create or join a community to collaborate with peers." />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.map((c) => (
          <Card key={c.community_id} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-purple-950 text-sm">{c.community_name}</h3>
              {!c.is_public && <Badge tone="amber">Private</Badge>}
            </div>
            <p className="text-xs text-slate-500 mb-3 line-clamp-2">{c.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{c.member_count} members</span>
              <Button
                variant={c.is_member ? 'secondary' : 'primary'}
                className="px-3 py-1.5 text-xs"
                onClick={() => toggleMembership(c.community_id, c.is_member)}
              >
                {c.is_member ? 'Leave' : 'Join'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {showCreate && (
        <CreateCommunityModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['communities'] });
          }}
        />
      )}
    </div>
  );
}

function CreateCommunityModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { show } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return show('Please name your community.', 'error');
    setSaving(true);
    try {
      await communityApi.create({ community_name: name, description, is_public: isPublic });
      show('Community created.', 'success');
      onCreated();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not create community.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Create Community"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Community Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="flex items-center gap-2 text-xs font-semibold text-purple-900">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Public community
        </label>
      </div>
    </Modal>
  );
}
