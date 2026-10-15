import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { marketApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Select, Textarea } from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Modal';
import { useComplianceScan, ComplianceScanningOverlay, ComplianceBlockedDialog } from '@/components/ComplianceGate';

export default function MarketplaceTab() {
  const qc = useQueryClient();
  const { show } = useToast();
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [contactListing, setContactListing] = useState<any | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['market', q],
    queryFn: () => marketApi.list(q ? { q } : undefined),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search equipment…"
          className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
        />
        <Button onClick={() => setShowCreate(true)} className="px-3 py-2.5 text-xs whitespace-nowrap">
          <i className="fa-solid fa-plus mr-1" /> List Equipment
        </Button>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load the marketplace." onRetry={() => refetch()} />}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState icon="fa-store" title="No listings found" subtitle="Be the first to list medical equipment for sale." />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.map((l) => (
          <Card key={l.listing_id} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-purple-950 text-sm">{l.title}</h3>
              <Badge tone={l.listing_status === 'active' ? 'green' : 'slate'}>{l.listing_status}</Badge>
            </div>
            <p className="text-xs text-slate-500 mb-2 line-clamp-2">{l.description}</p>
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-700">{l.currency} {l.asking_price.toLocaleString()}</span>
              <Badge tone="slate">{l.condition.replace('_', ' ')}</Badge>
            </div>
            <Button variant="secondary" className="w-full mt-3 text-xs py-1.5" onClick={() => setContactListing(l)}>
              Contact Seller
            </Button>
          </Card>
        ))}
      </div>

      {showCreate && (
        <CreateListingModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['market'] });
          }}
        />
      )}
      {contactListing && (
        <ContactSellerModal listing={contactListing} onClose={() => setContactListing(null)} />
      )}
    </div>
  );
}

function CreateListingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { show } = useToast();
  const { scan, scanning, blockedResult, dismiss } = useComplianceScan('equipment_listing');
  const [form, setForm] = useState({ title: '', description: '', condition: 'good', asking_price: '', is_negotiable: true });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.title.trim() || !form.asking_price) return show('Title and asking price are required.', 'error');
    setSaving(true);
    try {
      const scanId = await scan(`${form.title}\n${form.description}`);
      if (!scanId) return;
      await marketApi.create({
        title: form.title,
        description: form.description,
        condition: form.condition,
        asking_price: Number(form.asking_price),
        is_negotiable: form.is_negotiable,
        compliance_scan_id: scanId,
      });
      show('Listing published.', 'success');
      onCreated();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not publish listing.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        title="List Equipment"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving || scanning}>{saving || scanning ? 'Checking…' : 'Scan & Publish'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
              <option value="new">New</option>
              <option value="like_new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
            </Select>
            <Input label="Asking Price (INR)" type="number" value={form.asking_price} onChange={(e) => setForm({ ...form, asking_price: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-purple-900">
            <input type="checkbox" checked={form.is_negotiable} onChange={(e) => setForm({ ...form, is_negotiable: e.target.checked })} /> Price negotiable
          </label>
          <p className="text-[11px] text-slate-500">
            <i className="fa-solid fa-shield-halved text-purple-500 mr-1" /> NMC guidelines prohibit doctor endorsements and superiority claims on listings — this is scanned automatically.
          </p>
        </div>
      </Modal>
      {scanning && <ComplianceScanningOverlay />}
      {blockedResult && <ComplianceBlockedDialog result={blockedResult} onClose={dismiss} />}
    </>
  );
}

function ContactSellerModal({ listing, onClose }: { listing: any; onClose: () => void }) {
  const { show } = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await marketApi.inquire(listing.listing_id, message);
      show('Message sent to seller.', 'success');
      onClose();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not send message.', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      title={`Contact Seller — ${listing.title}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={sending}>{sending ? 'Sending…' : 'Send'}</Button>
        </>
      }
    >
      <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="I'm interested in this listing…" />
    </Modal>
  );
}
