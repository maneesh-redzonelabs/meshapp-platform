import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Modal';

export default function PatientAppointmentsTab() {
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [videoModalFor, setVideoModalFor] = useState<any | null>(null);
  const [prescriptionFor, setPrescriptionFor] = useState<any | null>(null);
  const { show } = useToast();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['appointments', tab],
    queryFn: () =>
      appointmentsApi.list({
        status: tab === 'upcoming' ? 'requested,confirmed' : 'completed',
      }),
  });

  async function cancel(id: string) {
    try {
      await appointmentsApi.cancel(id, 'Patient requested cancellation');
      show('Appointment cancelled.', 'success');
      refetch();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not cancel appointment.', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['upcoming', 'completed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize ${tab === t ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 border border-purple-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load your appointments." onRetry={() => refetch()} />}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState icon="fa-calendar-days" title={`No ${tab} appointments`} />
      )}

      <div className="space-y-3">
        {data?.map((a) => (
          <Card key={a.appointment_id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-purple-950 text-sm">{a.doctor_name || 'Doctor'}</p>
                <p className="text-xs text-slate-500">{a.appointment_date} at {a.start_time}</p>
              </div>
              <Badge tone={a.status === 'confirmed' ? 'green' : a.status === 'completed' ? 'slate' : 'amber'}>{a.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {tab === 'upcoming' && (
                <>
                  {a.appointment_type === 'video_call' && (
                    <Button className="px-3 py-1.5 text-xs" onClick={() => setVideoModalFor(a)}>
                      <i className="fa-solid fa-video mr-1" /> Video Call
                    </Button>
                  )}
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => cancel(a.appointment_id)}>
                    Cancel
                  </Button>
                </>
              )}
              {tab === 'completed' && (
                <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setPrescriptionFor(a)}>
                  See Prescription
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {videoModalFor && <VideoCallModal appointment={videoModalFor} onClose={() => setVideoModalFor(null)} />}
      {prescriptionFor && <PrescriptionModal appointment={prescriptionFor} onClose={() => setPrescriptionFor(null)} />}
    </div>
  );
}

function VideoCallModal({ appointment, onClose }: { appointment: any; onClose: () => void }) {
  return (
    <Modal title="Video Call" onClose={onClose}>
      <div className="aspect-video bg-slate-900 rounded-xl flex flex-col items-center justify-center text-white gap-3">
        <i className="fa-solid fa-video text-3xl" />
        <p className="text-sm">Video session with {appointment.doctor_name || 'your doctor'}</p>
        <p className="text-xs text-slate-400">Video SDK integration is stubbed in this build — the real session token is minted by `POST /appointments/:id/video-session`.</p>
      </div>
    </Modal>
  );
}

function PrescriptionModal({ appointment, onClose }: { appointment: any; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['prescription', appointment.appointment_id],
    queryFn: () => appointmentsApi.prescription(appointment.appointment_id),
  });

  return (
    <Modal title="Prescription" onClose={onClose}>
      {isLoading && <LoadingState />}
      {isError && <p className="text-sm text-rose-600">No prescription available for this appointment yet.</p>}
      {data && (
        <div className="space-y-3 text-sm">
          {data.diagnosis && <div><span className="font-semibold text-purple-900">Diagnosis: </span>{data.diagnosis}</div>}
          {data.medications && data.medications.length > 0 && (
            <div>
              <p className="font-semibold text-purple-900 mb-1">Medications</p>
              <div className="space-y-1">
                {data.medications.map((m, i) => (
                  <div key={i} className="text-xs bg-purple-50 rounded-lg px-3 py-2">
                    {m.name} — {m.dosage}, {m.frequency}, {m.duration}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.advice && <div><span className="font-semibold text-purple-900">Advice: </span>{data.advice}</div>}
          {data.follow_up_date && <div><span className="font-semibold text-purple-900">Follow-up: </span>{data.follow_up_date}</div>}
        </div>
      )}
    </Modal>
  );
}
