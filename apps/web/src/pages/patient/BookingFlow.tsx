import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi, doctorsApi, patientsApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Select } from '@/components/ui/Primitives';

type Step = 'details' | 'schedule' | 'payment' | 'confirmed';

export default function BookingFlow() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const [step, setStep] = useState<Step>('details');

  const doctor = useQuery({ queryKey: ['doctor', doctorId], queryFn: () => doctorsApi.getById(doctorId!) });
  const locations = useQuery({ queryKey: ['locations', doctorId], queryFn: () => doctorsApi.locations(doctorId!) });
  const familyMembers = useQuery({ queryKey: ['family-members'], queryFn: () => patientsApi.familyMembers() });

  const [familyMemberId, setFamilyMemberId] = useState('');
  const [mode, setMode] = useState<'in_person' | 'video_call'>('in_person');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [booking, setBooking] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState<any>(null);

  const slots = useQuery({
    queryKey: ['available-times', doctorId, date],
    queryFn: () => doctorsApi.availableTimes(doctorId!, date),
    enabled: step === 'schedule',
  });

  const primaryLocation = locations.data?.[0];
  const fee = mode === 'video_call' ? primaryLocation?.consultation_fee_video : primaryLocation?.consultation_fee_inperson;
  const platformFee = fee ? Math.round(fee * 0.05) : 0;
  const total = (fee ?? 0) + platformFee;

  async function confirmBooking() {
    if (!familyMemberId || !slot || !primaryLocation) return show('Please complete all booking details.', 'error');
    setBooking(true);
    try {
      const result = await appointmentsApi.book({
        doctor_id: doctorId!,
        location_id: primaryLocation.location_id,
        family_member_id: familyMemberId,
        appointment_date: date,
        start_time: slot,
        appointment_type: mode,
      });
      setConfirmedAppointment(result);
      // Mock payment confirmation (gateway integration is out of scope for this web client pass)
      if ((result as any).payment_id) {
        await appointmentsApi.get(result.appointment_id).catch(() => null);
      }
      setStep('confirmed');
      show('Appointment booked successfully!', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not book this appointment.', 'error');
    } finally {
      setBooking(false);
    }
  }

  if (doctor.isLoading) return <LoadingState label="Loading doctor details…" />;
  if (doctor.isError) return <ErrorState message="Could not load this doctor's profile." onRetry={() => doctor.refetch()} />;
  const doc = doctor.data!;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Card className="p-4 flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-purple-100 overflow-hidden flex items-center justify-center text-purple-700">
          {doc.profile_selfie_url ? <img src={doc.profile_selfie_url} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user-doctor" />}
        </div>
        <div>
          <p className="font-bold text-purple-950">{doc.full_name}</p>
          <p className="text-xs text-slate-500">{doc.speciality_name}</p>
          {primaryLocation && <p className="text-xs text-slate-400">{primaryLocation.clinic_hospital_name}</p>}
        </div>
      </Card>

      {step === 'details' && (
        <Card className="p-5 space-y-4">
          <Select label="Booking For" value={familyMemberId} onChange={(e) => setFamilyMemberId(e.target.value)}>
            <option value="">Select family member</option>
            {familyMembers.data?.map((f) => (
              <option key={f.family_member_id} value={f.family_member_id}>
                {f.full_name} ({f.relationship})
              </option>
            ))}
          </Select>
          <div>
            <span className="block text-xs font-semibold text-purple-900 mb-1">Consultation Mode</span>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('in_person')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border ${mode === 'in_person' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-purple-200 text-purple-700'}`}
              >
                <i className="fa-solid fa-hospital mr-1.5" /> In-Person
              </button>
              <button
                onClick={() => setMode('video_call')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border ${mode === 'video_call' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-purple-200 text-purple-700'}`}
              >
                <i className="fa-solid fa-video mr-1.5" /> Video Call
              </button>
            </div>
          </div>
          <Button className="w-full" disabled={!familyMemberId} onClick={() => setStep('schedule')}>
            Continue to Scheduling
          </Button>
        </Card>
      )}

      {step === 'schedule' && (
        <Card className="p-5 space-y-4">
          <div>
            <span className="block text-xs font-semibold text-purple-900 mb-1">Select Date</span>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => { setDate(e.target.value); setSlot(null); }}
              className="w-full bg-purple-50/70 border border-purple-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            />
          </div>
          {slots.isLoading && <LoadingState label="Loading available slots…" />}
          {slots.isError && <ErrorState message="Could not load time slots." onRetry={() => slots.refetch()} />}
          {slots.data && (
            <div className="space-y-3">
              {(['morning', 'afternoon', 'evening'] as const).map((period) => {
                const items = (slots.data as any)[period] as string[] | undefined;
                if (!items || items.length === 0) return null;
                return (
                  <div key={period}>
                    <p className="text-xs font-semibold text-purple-800 capitalize mb-1.5">{period}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {items.map((t) => (
                        <button
                          key={t}
                          onClick={() => setSlot(t)}
                          className={`py-2 rounded-lg text-xs font-semibold border ${slot === t ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-purple-200 text-purple-700'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="w-1/3" onClick={() => setStep('details')}>Back</Button>
            <Button className="w-2/3" disabled={!slot} onClick={() => setStep('payment')}>Continue to Payment</Button>
          </div>
        </Card>
      )}

      {step === 'payment' && (
        <Card className="p-5 space-y-4">
          <h3 className="font-bold text-purple-950 text-sm">Payment Summary</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Consultation Fee</span><span>₹{fee ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Platform Service Fee</span><span>₹{platformFee}</span></div>
            <div className="flex justify-between font-bold border-t border-purple-100 pt-1.5"><span>Total</span><span>₹{total}</span></div>
          </div>
          <div>
            <span className="block text-xs font-semibold text-purple-900 mb-1">Payment Method</span>
            <div className="grid grid-cols-3 gap-2">
              {['upi', 'card', 'netbanking'].map((pm) => (
                <button
                  key={pm}
                  onClick={() => setPaymentMethod(pm)}
                  className={`py-2 rounded-lg text-xs font-semibold border capitalize ${paymentMethod === pm ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-purple-200 text-purple-700'}`}
                >
                  {pm}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="w-1/3" onClick={() => setStep('schedule')}>Back</Button>
            <Button className="w-2/3" disabled={booking} onClick={confirmBooking}>
              {booking ? 'Confirming…' : `Pay ₹${total} & Confirm`}
            </Button>
          </div>
        </Card>
      )}

      {step === 'confirmed' && (
        <Card className="p-8 text-center space-y-3">
          <i className="fa-solid fa-circle-check text-emerald-500 text-4xl" />
          <h3 className="font-bold text-purple-950 text-lg">Appointment Confirmed!</h3>
          <p className="text-sm text-slate-500">
            Your {mode === 'video_call' ? 'video call' : 'in-person'} appointment with {doc.full_name} on {date} at {slot} is booked.
          </p>
          <Badge tone="green">Confirmed</Badge>
          <Button className="mt-4" onClick={() => navigate('/patient/appointments')}>View My Appointments</Button>
        </Card>
      )}
    </div>
  );
}
