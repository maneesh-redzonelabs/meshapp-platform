import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/lib/api';
import { Badge, Card, EmptyState, ErrorState, Input, LoadingState } from '@/components/ui/Primitives';

export default function PatientHomeTab() {
  const navigate = useNavigate();
  const [pinCode, setPinCode] = useState('');
  const [specialityId, setSpecialityId] = useState('');

  const { data: specialities } = useQuery({ queryKey: ['specialities'], queryFn: searchApi.specialities });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['search-doctors', pinCode, specialityId],
    queryFn: () =>
      searchApi.doctors({
        pin_code: pinCode || undefined,
        speciality_id: specialityId || undefined,
        sort: 'distance',
      }),
  });

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-bold text-purple-950 mb-3">Find a Doctor Near You</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value)}
            placeholder="Enter PIN code"
            className="sm:max-w-[200px]"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-1">
          <button
            onClick={() => setSpecialityId('')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              specialityId === '' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-200'
            }`}
          >
            All
          </button>
          {specialities?.map((s) => (
            <button
              key={s.speciality_id}
              onClick={() => setSpecialityId(String(s.speciality_id))}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                specialityId === String(s.speciality_id) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-200'
              }`}
            >
              {s.speciality_name}
            </button>
          ))}
        </div>
      </Card>

      {isLoading && <LoadingState label="Finding doctors near you…" />}
      {isError && <ErrorState message="Could not search for doctors." onRetry={() => refetch()} />}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState icon="fa-user-doctor" title="No doctors found" subtitle="Try a different PIN code or speciality." />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.map((doc) => (
          <Card key={doc.doctor_id} className="p-4 cursor-pointer hover:shadow-md transition" onClick={() => navigate(`/patient/book/${doc.doctor_id}`)}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-purple-100 overflow-hidden flex items-center justify-center text-purple-700">
                {doc.profile_selfie_url ? <img src={doc.profile_selfie_url} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user-doctor" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-purple-950 truncate">{doc.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{doc.speciality_name}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span><i className="fa-solid fa-star text-amber-400 mr-1" />{doc.rating_avg?.toFixed(1) ?? 'New'}</span>
              {doc.distance_km !== undefined && <Badge tone="slate">{doc.distance_km.toFixed(1)} km away</Badge>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
