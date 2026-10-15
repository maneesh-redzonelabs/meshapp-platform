import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi, authApi, uploadsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Input, Select } from '@/components/ui/Primitives';
import { LocationPickerMap } from '@/components/LocationPickerMap';
import { ApiError } from '@/lib/apiClient';

const DEFAULT_CENTER = { lat: 19.076, lng: 72.8777 }; // Mumbai fallback

export function DoctorOnboardingForm({ registrationToken, mobile, email }: { registrationToken: string; mobile: string; email: string }) {
  const { login } = useAuth();
  const { show } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    speciality_id: '',
    subspeciality_id: '',
    grad_degree: '',
    grad_college: '',
    grad_year: '',
    pg_degree: '',
    pg_college: '',
    pg_year: '',
    clinic_name: '',
    address_line1: '',
    city: '',
    state: '',
    pin_code: '',
  });
  const [coords, setCoords] = useState(DEFAULT_CENTER);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: specialities } = useQuery({ queryKey: ['specialities'], queryFn: searchApi.specialities });
  const { data: subspecialities } = useQuery({
    queryKey: ['subspecialities', form.speciality_id],
    queryFn: () => searchApi.subspecialities(Number(form.speciality_id)),
    enabled: !!form.speciality_id,
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          /* fall back to default; user can click the map */
        },
      );
    }
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.full_name.trim()) next.full_name = 'Full name is required';
    if (!form.speciality_id) next.speciality_id = 'Select a speciality';
    if (!form.subspeciality_id) next.subspeciality_id = 'Select a subspeciality';
    if (!form.grad_degree.trim() || !form.grad_college.trim() || !form.grad_year)
      next.grad_degree = 'Graduation details are mandatory';
    if (!form.clinic_name.trim()) next.clinic_name = 'Clinic/hospital name is required';
    if (!selfieFile) next.selfie = 'A selfie photo is mandatory';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const uploadId = await uploadsApi.uploadFile(selfieFile!, 'doctor_selfie', registrationToken);

      const education = [
        { education_level: 'graduation', degree_name: form.grad_degree, college_name_other: form.grad_college, passing_year: Number(form.grad_year) },
      ];
      if (form.pg_degree) {
        education.push({
          education_level: 'post_graduation',
          degree_name: form.pg_degree,
          college_name_other: form.pg_college,
          passing_year: Number(form.pg_year),
        });
      }

      const result = await authApi.doctorCompleteProfile(
        {
          full_name: form.full_name,
          speciality_id: Number(form.speciality_id),
          subspeciality_id: Number(form.subspeciality_id),
          education,
          clinic_location: {
            clinic_hospital_name: form.clinic_name,
            address_line1: form.address_line1,
            city: form.city,
            state: form.state,
            pin_code: form.pin_code,
            latitude: coords.lat,
            longitude: coords.lng,
          },
          selfie_upload_id: uploadId,
          mobile_number: mobile,
          email,
        },
        registrationToken,
      );

      login(
        {
          user_id: result.doctor.doctor_id,
          user_type: 'doctor',
          display_name: result.doctor.full_name,
          photo_url: result.doctor.profile_selfie_url,
        },
        result,
      );
      show('Welcome to MeshApp AI! Your doctor profile is set up.', 'success');
    } catch (err) {
      if (err instanceof ApiError) {
        show(err.message, 'error');
      } else {
        show('Something went wrong completing your profile. Please try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl mx-auto">
      <div className="text-center mb-2">
        <h2 className="text-lg font-bold text-purple-950">Complete Your Doctor Profile</h2>
        <p className="text-xs text-slate-500">This mandatory setup verifies you as a practicing medical professional.</p>
      </div>

      <div className="bg-white rounded-2xl border border-purple-100 p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-purple-800">Identity</h3>
        <div>
          <label className="block text-xs font-semibold text-purple-900 mb-1">Selfie Photo <span className="text-rose-600">*</span></label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-purple-100 file:text-purple-800 file:text-xs file:font-semibold"
          />
          {errors.selfie && <span className="text-xs text-rose-600">{errors.selfie}</span>}
        </div>
        <Input label="Full Name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} error={errors.full_name} placeholder="Dr. Jane Doe" />
      </div>

      <div className="bg-white rounded-2xl border border-purple-100 p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-purple-800">Speciality</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Speciality" value={form.speciality_id} onChange={(e) => { update('speciality_id', e.target.value); update('subspeciality_id', ''); }} error={errors.speciality_id}>
            <option value="">Select speciality</option>
            {specialities?.map((s) => (
              <option key={s.speciality_id} value={s.speciality_id}>{s.speciality_name}</option>
            ))}
          </Select>
          <Select label="Subspeciality" value={form.subspeciality_id} onChange={(e) => update('subspeciality_id', e.target.value)} disabled={!form.speciality_id} error={errors.subspeciality_id}>
            <option value="">Select subspeciality</option>
            {subspecialities?.map((s) => (
              <option key={s.subspeciality_id} value={s.subspeciality_id}>{s.subspeciality_name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-purple-100 p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-purple-800">Education</h3>
        <p className="text-[11px] text-slate-500">Graduation is mandatory; post-graduation is optional.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Graduation Degree" value={form.grad_degree} onChange={(e) => update('grad_degree', e.target.value)} placeholder="MBBS" error={errors.grad_degree} />
          <Input label="College" value={form.grad_college} onChange={(e) => update('grad_college', e.target.value)} placeholder="Grant Medical College" />
          <Input label="Passing Year" type="number" value={form.grad_year} onChange={(e) => update('grad_year', e.target.value)} placeholder="2012" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="PG Degree (optional)" value={form.pg_degree} onChange={(e) => update('pg_degree', e.target.value)} placeholder="MD" />
          <Input label="PG College" value={form.pg_college} onChange={(e) => update('pg_college', e.target.value)} placeholder="AIIMS Delhi" />
          <Input label="PG Year" type="number" value={form.pg_year} onChange={(e) => update('pg_year', e.target.value)} placeholder="2016" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-purple-100 p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-purple-800">Clinic Location</h3>
        <Input label="Clinic / Hospital Name" value={form.clinic_name} onChange={(e) => update('clinic_name', e.target.value)} error={errors.clinic_name} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Address" value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} />
          <Input label="City" value={form.city} onChange={(e) => update('city', e.target.value)} />
          <Input label="PIN Code" value={form.pin_code} onChange={(e) => update('pin_code', e.target.value)} />
        </div>
        <p className="text-[11px] text-slate-500">Tap on the map to drop a pin at your clinic&apos;s exact location.</p>
        <LocationPickerMap lat={coords.lat} lng={coords.lng} onChange={(lat, lng) => setCoords({ lat, lng })} />
        <p className="text-[11px] text-purple-700">Selected: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Setting up your profile…' : 'Complete Setup & Enter Dashboard'}
      </Button>
    </form>
  );
}
