import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { medicoLegalApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Select, Textarea } from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Modal';

export default function MedicoLegalTab() {
  const qc = useQueryClient();
  const [showAsk, setShowAsk] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['medico-legal'], queryFn: () => medicoLegalApi.list() });

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
        <div className="flex items-center gap-3 mb-2">
          <i className="fa-solid fa-scale-balanced text-xl" />
          <h3 className="font-bold">Free-Tier Medico-Legal Help</h3>
        </div>
        <p className="text-sm text-purple-100">
          Every doctor gets complimentary consultation minutes with a verified medico-legal expert for malpractice allegations, consent
          reviews, notice replies and hospital compliance questions.
        </p>
        <Button variant="secondary" className="mt-3 bg-white text-purple-700" onClick={() => setShowAsk(true)}>
          Ask for Help
        </Button>
      </Card>

      <h3 className="font-bold text-purple-950">My Requests</h3>
      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load your requests." onRetry={() => refetch()} />}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState icon="fa-folder-open" title="No requests yet" subtitle="Submit a request and an expert will reach out." />
      )}
      <div className="space-y-3">
        {data?.map((r) => (
          <Card key={r.request_id} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-sm text-purple-950">{r.subject}</h4>
              <Badge tone={r.status === 'resolved' || r.status === 'closed' ? 'green' : 'amber'}>{r.status.replace('_', ' ')}</Badge>
            </div>
            <p className="text-xs text-slate-500">{r.category.replace(/_/g, ' ')}</p>
          </Card>
        ))}
      </div>

      {showAsk && (
        <AskHelpModal
          onClose={() => setShowAsk(false)}
          onSaved={() => {
            setShowAsk(false);
            qc.invalidateQueries({ queryKey: ['medico-legal'] });
          }}
        />
      )}
    </div>
  );
}

function AskHelpModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!subject.trim() || !description.trim()) return show('Please fill in subject and description.', 'error');
    setSaving(true);
    try {
      await medicoLegalApi.create({ category, subject, description });
      show('Request submitted. An expert will be assigned shortly.', 'success');
      onSaved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not submit request.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Ask for Medico-Legal Help"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="malpractice_allegation">Malpractice Allegation</option>
          <option value="consent_review">Consent Review</option>
          <option value="notice_reply">Notice Reply</option>
          <option value="hospital_compliance">Hospital Compliance</option>
          <option value="general">General</option>
        </Select>
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Textarea label="Description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        <p className="text-[11px] text-slate-500">Your description is encrypted and treated as attorney-client privileged.</p>
      </div>
    </Modal>
  );
}
