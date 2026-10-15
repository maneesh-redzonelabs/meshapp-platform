import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { doctorsApi, Affiliation, Achievement, Publication, uploadsApi } from '@/lib/api';
import { ApiError } from '@/lib/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Textarea } from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Modal';
import { useComplianceScan, ComplianceScanningOverlay, ComplianceBlockedDialog } from '@/components/ComplianceGate';

export default function ProfileTab() {
  const { user } = useAuth();
  const doctorId = user!.user_id;
  const qc = useQueryClient();
  const { show } = useToast();

  const profile = useQuery({ queryKey: ['doctor', doctorId], queryFn: () => doctorsApi.me() });
  const affiliations = useQuery({ queryKey: ['affiliations', doctorId], queryFn: () => doctorsApi.affiliations(doctorId) });
  const achievements = useQuery({ queryKey: ['achievements', doctorId], queryFn: () => doctorsApi.achievements(doctorId) });
  const publications = useQuery({ queryKey: ['publications', doctorId], queryFn: () => doctorsApi.publications(doctorId) });

  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'affiliation' | 'achievement' | 'publication' | 'verify'>(null);

  async function saveBio() {
    if (bioDraft === null) return;
    try {
      await doctorsApi.updateMe({ bio: bioDraft });
      qc.invalidateQueries({ queryKey: ['doctor', doctorId] });
      setBioDraft(null);
      show('About section updated.', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not save your about section.', 'error');
    }
  }

  if (profile.isLoading) return <LoadingState label="Loading your profile…" />;
  if (profile.isError) return <ErrorState message="Could not load your profile." onRetry={() => profile.refetch()} />;
  const doc = profile.data!;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-purple-100 overflow-hidden flex items-center justify-center text-purple-600 text-2xl shrink-0">
            {doc.profile_selfie_url ? <img src={doc.profile_selfie_url} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user-doctor" />}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-purple-950">{doc.full_name}</h2>
              <Badge tone={doc.verification_status === 'verified' ? 'green' : 'amber'}>{doc.verification_status}</Badge>
              <Badge tone={doc.subscription_tier === 'premium' ? 'purple' : 'slate'}>{doc.subscription_tier}</Badge>
            </div>
            <p className="text-sm text-slate-500">{doc.speciality_name} {doc.subspeciality_name ? `· ${doc.subspeciality_name}` : ''}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              <span><i className="fa-solid fa-star text-amber-400 mr-1" />{doc.rating_avg?.toFixed(1) ?? 'N/A'} ({doc.rating_count})</span>
              <span>Profile {doc.profile_completeness_pct}% complete</span>
            </div>
          </div>
          {doc.subscription_tier !== 'premium' && (
            <Button variant="secondary" onClick={() => setModal('verify')}>
              <i className="fa-solid fa-circle-check mr-1.5" /> Get Verified (Premium)
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-purple-950 text-sm">About</h3>
          {bioDraft === null ? (
            <button className="text-xs text-purple-600 font-semibold" onClick={() => setBioDraft(doc.bio || '')}>
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button className="text-xs text-slate-500" onClick={() => setBioDraft(null)}>Cancel</button>
              <button className="text-xs text-purple-600 font-semibold" onClick={saveBio}>Save</button>
            </div>
          )}
        </div>
        {bioDraft === null ? (
          <p className="text-sm text-slate-600 whitespace-pre-line">{doc.bio || 'No about text added yet.'}</p>
        ) : (
          <Textarea rows={4} value={bioDraft} onChange={(e) => setBioDraft(e.target.value)} />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-purple-950 text-sm">Affiliations</h3>
            <button className="text-xs text-purple-600 font-semibold" onClick={() => setModal('affiliation')}>
              <i className="fa-solid fa-plus mr-1" />Add
            </button>
          </div>
          <ListBody
            items={affiliations.data}
            isLoading={affiliations.isLoading}
            isError={affiliations.isError}
            empty="No affiliations added yet."
            render={(a: Affiliation) => (
              <div key={a.affiliation_id} className="text-sm text-slate-700 py-1.5 border-b border-purple-50 last:border-0">
                <span className="font-semibold">{a.job_title}</span> at {a.hospital_name}
                <span className="text-xs text-slate-400 ml-1">({a.from_year}–{a.is_current ? 'Present' : a.to_year})</span>
              </div>
            )}
          />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-purple-950 text-sm">Team Members</h3>
          </div>
          <TeamInvite />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-purple-950 text-sm">Achievements</h3>
            <button className="text-xs text-purple-600 font-semibold" onClick={() => setModal('achievement')}>
              <i className="fa-solid fa-plus mr-1" />Add
            </button>
          </div>
          <ListBody
            items={achievements.data}
            isLoading={achievements.isLoading}
            isError={achievements.isError}
            empty="No achievements added yet."
            render={(a: Achievement) => (
              <div key={a.achievement_id} className="text-sm text-slate-700 py-1.5 border-b border-purple-50 last:border-0">
                {a.achievement_text} {a.achievement_year && <span className="text-xs text-slate-400">({a.achievement_year})</span>}
              </div>
            )}
          />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-purple-950 text-sm">Publications</h3>
            <button className="text-xs text-purple-600 font-semibold" onClick={() => setModal('publication')}>
              <i className="fa-solid fa-plus mr-1" />Add
            </button>
          </div>
          <ListBody
            items={publications.data}
            isLoading={publications.isLoading}
            isError={publications.isError}
            empty="No publications added yet."
            render={(p: Publication) => (
              <div key={p.publication_id} className="text-sm text-slate-700 py-1.5 border-b border-purple-50 last:border-0">
                <span className="font-semibold">{p.title}</span>
                {p.journal_name && <span className="text-xs text-slate-400"> — {p.journal_name} ({p.publication_year})</span>}
              </div>
            )}
          />
        </Card>
      </div>

      {modal === 'affiliation' && (
        <AddAffiliationModal
          onClose={() => setModal(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['affiliations', doctorId] });
            setModal(null);
          }}
        />
      )}
      {modal === 'achievement' && (
        <AddAchievementModal
          onClose={() => setModal(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['achievements', doctorId] });
            setModal(null);
          }}
        />
      )}
      {modal === 'publication' && (
        <AddPublicationModal
          onClose={() => setModal(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['publications', doctorId] });
            setModal(null);
          }}
        />
      )}
      {modal === 'verify' && <PremiumVerificationModal onClose={() => setModal(null)} />}
    </div>
  );
}

function ListBody<T>({
  items,
  isLoading,
  isError,
  empty,
  render,
}: {
  items?: T[];
  isLoading: boolean;
  isError: boolean;
  empty: string;
  render: (item: T) => React.ReactNode;
}) {
  if (isLoading) return <LoadingState />;
  if (isError) return <p className="text-xs text-rose-600">Could not load.</p>;
  if (!items || items.length === 0) return <EmptyState icon="fa-inbox" title={empty} />;
  return <div>{items.map(render)}</div>;
}

function AddAffiliationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const [form, setForm] = useState({ job_title: '', hospital_name: '', from_year: '', to_year: '', is_current: true });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.job_title || !form.hospital_name || !form.from_year) return show('Please fill in all fields.', 'error');
    setSaving(true);
    try {
      await doctorsApi.addAffiliation({
        job_title: form.job_title,
        hospital_name: form.hospital_name,
        from_year: Number(form.from_year),
        to_year: form.is_current ? null : Number(form.to_year),
        is_current: form.is_current,
      });
      show('Affiliation added.', 'success');
      onSaved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not add affiliation.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add Affiliation"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Job Title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
        <Input label="Hospital / Institution" value={form.hospital_name} onChange={(e) => setForm({ ...form, hospital_name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="From Year" type="number" value={form.from_year} onChange={(e) => setForm({ ...form, from_year: e.target.value })} />
          <label className="flex items-center gap-2 text-xs font-semibold text-purple-900 mt-6">
            <input type="checkbox" checked={form.is_current} onChange={(e) => setForm({ ...form, is_current: e.target.checked })} /> Currently working here
          </label>
        </div>
        {!form.is_current && <Input label="To Year" type="number" value={form.to_year} onChange={(e) => setForm({ ...form, to_year: e.target.value })} />}
      </div>
    </Modal>
  );
}

function AddAchievementModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const { scan, scanning, blockedResult, dismiss } = useComplianceScan('doctor_achievement');
  const [text, setText] = useState('');
  const [year, setYear] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!text.trim()) return show('Please describe the achievement.', 'error');
    setSaving(true);
    try {
      const scanId = await scan(text);
      if (!scanId) return;
      await doctorsApi.addAchievement({
        achievement_text: text,
        achievement_year: year ? Number(year) : undefined,
        awarding_body: body || undefined,
        compliance_scan_id: scanId,
      });
      show('Achievement added.', 'success');
      onSaved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not add achievement.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        title="Add Achievement"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving || scanning}>{saving || scanning ? 'Checking…' : 'Scan & Save'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea label="Achievement" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Awarded Best Research Paper at..." />
          <Input label="Awarding Body (optional)" value={body} onChange={(e) => setBody(e.target.value)} />
          <Input label="Year (optional)" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          <p className="text-[11px] text-slate-500">
            <i className="fa-solid fa-shield-halved text-purple-500 mr-1" />
            Scanned automatically for NMC advertising/ethics compliance before publishing.
          </p>
        </div>
      </Modal>
      {scanning && <ComplianceScanningOverlay />}
      {blockedResult && <ComplianceBlockedDialog result={blockedResult} onClose={dismiss} />}
    </>
  );
}

function AddPublicationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const { scan, scanning, blockedResult, dismiss } = useComplianceScan('doctor_publication');
  const [form, setForm] = useState({ title: '', journal_name: '', publication_year: '', pubmed_id: '', doi: '', publication_url: '' });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.title.trim()) return show('Please enter the publication title.', 'error');
    setSaving(true);
    try {
      const scanId = await scan(form.title);
      if (!scanId) return;
      await doctorsApi.addPublication({
        title: form.title,
        journal_name: form.journal_name || undefined,
        publication_year: form.publication_year ? Number(form.publication_year) : undefined,
        pubmed_id: form.pubmed_id || undefined,
        doi: form.doi || undefined,
        publication_url: form.publication_url || undefined,
        compliance_scan_id: scanId,
      });
      show('Publication added.', 'success');
      onSaved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not add publication.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        title="Add Publication"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving || scanning}>{saving || scanning ? 'Checking…' : 'Scan & Save'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Journal" value={form.journal_name} onChange={(e) => setForm({ ...form, journal_name: e.target.value })} />
            <Input label="Year" type="number" value={form.publication_year} onChange={(e) => setForm({ ...form, publication_year: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="PubMed ID (optional)" value={form.pubmed_id} onChange={(e) => setForm({ ...form, pubmed_id: e.target.value })} />
            <Input label="DOI (optional)" value={form.doi} onChange={(e) => setForm({ ...form, doi: e.target.value })} />
          </div>
          <Input label="URL (optional)" value={form.publication_url} onChange={(e) => setForm({ ...form, publication_url: e.target.value })} />
        </div>
      </Modal>
      {scanning && <ComplianceScanningOverlay />}
      {blockedResult && <ComplianceBlockedDialog result={blockedResult} onClose={dismiss} />}
    </>
  );
}

function TeamInvite() {
  const { show } = useToast();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  async function invite() {
    if (!value.trim()) return;
    setSending(true);
    try {
      await doctorsApi.addTeamMember({ email_or_mobile: value });
      show('Invite sent.', 'success');
      setValue('');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not send invite.', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Colleague's email or mobile"
        className="flex-1 bg-purple-50/70 border border-purple-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
      />
      <Button onClick={invite} disabled={sending} className="px-3 py-0 text-xs">Invite</Button>
    </div>
  );
}

function PremiumVerificationModal({ onClose }: { onClose: () => void }) {
  const { show } = useToast();
  const [regNo, setRegNo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!regNo.trim() || !file) return show('NMC registration number and a document are both required.', 'error');
    setSubmitting(true);
    try {
      const uploadId = await uploadsApi.uploadFile(file, 'nmc_registration');
      await doctorsApi.submitVerificationDocument({ document_type: 'nmc_registration', upload_id: uploadId });
      show('Verification documents submitted for review.', 'success');
      onClose();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not submit verification documents.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Premium Verification"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for Review'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Verified, premium doctors appear in patient search results and unlock subscription features.</p>
        <Input label="NMC Registration Number" value={regNo} onChange={(e) => setRegNo(e.target.value)} />
        <div>
          <label className="block text-xs font-semibold text-purple-900 mb-1">Registration Document</label>
          <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-xs" />
        </div>
      </div>
    </Modal>
  );
}
