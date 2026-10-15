import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Input, Select } from '@/components/ui/Primitives';

export default function PatientAuth() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { show } = useToast();
  const [step, setStep] = useState<'profile' | 'otp'>('profile');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    age: '',
    gender: 'Male',
    mobile_number: '',
    pin_code: '',
  });
  const [otp, setOtp] = useState('');
  const [devHint, setDevHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.age || !/^\d{10}$/.test(form.mobile_number) || !form.pin_code) {
      show('Please fill in all required fields with a valid 10-digit mobile number.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.patientRequestOtp({
        first_name: form.first_name,
        last_name: form.last_name,
        age: Number(form.age),
        gender: form.gender,
        mobile_number: form.mobile_number,
        pin_code: form.pin_code,
      });
      if (res.debug_otp) {
        setDevHint(res.debug_otp);
        setOtp(res.debug_otp);
      }
      setStep('otp');
      show('OTP sent to your mobile number.', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not request OTP. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await authApi.patientVerifyOtp({ mobile_number: form.mobile_number, otp });
      login(
        {
          user_id: res.patient.patient_id,
          user_type: 'patient',
          display_name: `${res.patient.first_name} ${res.patient.last_name}`,
          photo_url: res.patient.profile_photo_url,
        },
        res,
      );
      show('Welcome to MeshApp AI!', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Invalid OTP. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-purple-50/50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-purple-600 mx-auto flex items-center justify-center text-white text-xl shadow-lg mb-2">
            <i className="fa-solid fa-hospital-user" />
          </div>
          <h1 className="text-lg font-bold text-purple-950">Patient Login</h1>
          <p className="text-xs text-purple-700/80">Complete your profile and verify your mobile number</p>
        </div>

        {step === 'profile' && (
          <form onSubmit={requestOtp} className="space-y-3 bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} />
              <Input label="Last Name" value={form.last_name} onChange={(e) => update('last_name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Age" type="number" value={form.age} onChange={(e) => update('age', e.target.value)} />
              <Select label="Gender" value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </Select>
            </div>
            <Input
              label="Mobile Number"
              value={form.mobile_number}
              onChange={(e) => update('mobile_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
            />
            <Input label="PIN Code" value={form.pin_code} onChange={(e) => update('pin_code', e.target.value)} placeholder="Used to find nearby doctors" />
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" className="w-1/3" onClick={() => navigate('/')}>
                Back
              </Button>
              <Button type="submit" className="w-2/3" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send OTP'}
              </Button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-4 bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
            <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-200">
              <label className="block text-xs font-semibold text-purple-900 mb-2">Enter the OTP sent to +91 {form.mobile_number}</label>
              <input
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
                className="w-full text-center tracking-[0.4em] font-mono text-lg bg-white border border-purple-300 rounded-lg py-2 focus:border-purple-600 focus:outline-none text-purple-950"
              />
              {devHint && <p className="text-[11px] text-purple-500 mt-1">Dev autofill: OTP {devHint} pre-filled — still tap Verify.</p>}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="w-1/3" onClick={() => setStep('profile')}>
                Back
              </Button>
              <Button type="submit" className="w-2/3" disabled={submitting || !otp}>
                {submitting ? 'Verifying…' : 'Verify & Continue'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
