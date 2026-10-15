import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { patientsApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Select } from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Modal';

export default function PatientProfileTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const profile = useQuery({ queryKey: ['patient-me'], queryFn: () => patientsApi.me() });
  const family = useQuery({ queryKey: ['family-members'], queryFn: () => patientsApi.familyMembers() });

  if (profile.isLoading) return <LoadingState label="Loading your profile…" />;
  if (profile.isError) return <ErrorState message="Could not load your profile." onRetry={() => profile.refetch()} />;
  const p = profile.data!;

  return (
    <div className="space-y-5">
      <Card className="p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-100 overflow-hidden flex items-center justify-center text-purple-700 text-xl">
          {p.profile_photo_url ? <img src={p.profile_photo_url} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user" />}
        </div>
        <div>
          <h2 className="font-bold text-purple-950">{p.first_name} {p.last_name}</h2>
          <p className="text-xs text-slate-500">{p.gender} {p.blood_group ? `· ${p.blood_group}` : ''}</p>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-purple-950 text-sm">Family Members</h3>
          <button className="text-xs text-purple-600 font-semibold" onClick={() => setShowAdd(true)}>
            <i className="fa-solid fa-plus mr-1" />Add
          </button>
        </div>
        {family.isLoading && <LoadingState />}
        {family.isError && <p className="text-xs text-rose-600">Could not load family members.</p>}
        {!family.isLoading && !family.isError && (!family.data || family.data.length === 0) && (
          <EmptyState icon="fa-people-roof" title="No family members yet" />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {family.data?.map((f) => (
            <div key={f.family_member_id} className="flex items-center gap-3 bg-purple-50/60 rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-purple-600">
                <i className="fa-solid fa-user" />
              </div>
              <div>
                <p className="text-sm font-semibold text-purple-950">{f.full_name}</p>
                <Badge tone="slate">{f.relationship}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {showAdd && (
        <AddFamilyMemberModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ['family-members'] });
          }}
        />
      )}
    </div>
  );
}

function AddFamilyMemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const [form, setForm] = useState({ full_name: '', age: '', gender: 'male', relationship: 'spouse' });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.full_name.trim() || !form.age) return show('Please fill in all fields.', 'error');
    setSaving(true);
    try {
      await patientsApi.addFamilyMember({
        full_name: form.full_name,
        age: Number(form.age),
        gender: form.gender as any,
        relationship: form.relationship as any,
      });
      show('Family member added.', 'success');
      onSaved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not add family member.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add Family Member"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Age" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
          <Select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <Select label="Relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
          <option value="spouse">Spouse</option>
          <option value="son">Son</option>
          <option value="daughter">Daughter</option>
          <option value="mother">Mother</option>
          <option value="father">Father</option>
          <option value="sibling">Sibling</option>
          <option value="other">Other</option>
        </Select>
      </div>
    </Modal>
  );
}
