import type {
  Appointment,
  AuthTokens,
  ComplianceScanResult,
  DoctorClinicLocation,
  DoctorEducation,
  DoctorProfile,
  EquipmentListing,
  FamilyMember,
  MedicoLegalRequest,
  NetworkConnection,
  NotificationItem,
  PatientProfile,
  Post,
  Prescription,
} from '@meshapp/shared';
import { apiClient } from './apiClient';

/* -------------------------------------------------------------------- */
/* Auth                                                                   */
/* -------------------------------------------------------------------- */

export const authApi = {
  doctorRequestOtp: (body: { mobile_number: string; email: string }) =>
    apiClient.post<{ debug_otp_mobile?: string; debug_otp_email?: string; debug_otp?: string }>(
      '/auth/doctor/register/request-otp',
      body,
      { skipAuth: true },
    ),
  doctorVerifyMobileOtp: (body: { mobile_number: string; otp: string }) =>
    apiClient.post<{ verified: boolean; registration_token?: string }>('/auth/doctor/register/verify-mobile-otp', body, {
      skipAuth: true,
    }),
  doctorVerifyEmailOtp: (body: { email: string; otp: string }) =>
    apiClient.post<{ verified: boolean; registration_token?: string }>('/auth/doctor/register/verify-email-otp', body, {
      skipAuth: true,
    }),
  doctorCompleteProfile: (body: Record<string, unknown>, registrationToken: string) =>
    apiClient.post<AuthTokens & { doctor: DoctorProfile }>('/auth/doctor/register/complete-profile', body, {
      skipAuth: true,
      headers: { Authorization: `Bearer ${registrationToken}` },
    }),
  patientRequestOtp: (body: {
    first_name: string;
    last_name: string;
    age: number;
    gender: string;
    mobile_number: string;
    pin_code: string;
  }) => apiClient.post<{ debug_otp?: string }>('/auth/patient/register/request-otp', body, { skipAuth: true }),
  patientVerifyOtp: (body: { mobile_number: string; otp: string }) =>
    apiClient.post<AuthTokens & { patient: PatientProfile }>('/auth/patient/register/verify-otp', body, {
      skipAuth: true,
    }),
  loginRequestOtp: (body: { mobile_number: string }) =>
    apiClient.post<{ debug_otp?: string }>('/auth/login/request-otp', body, { skipAuth: true }),
  loginVerifyOtp: (body: { mobile_number: string; otp: string; device_type: string }) =>
    apiClient.post<AuthTokens & { user: { user_id: string; user_type: string } }>('/auth/login/verify-otp', body, {
      skipAuth: true,
    }),
  logout: () => apiClient.post('/auth/logout'),
};

/* -------------------------------------------------------------------- */
/* Uploads & compliance                                                   */
/* -------------------------------------------------------------------- */

export const uploadsApi = {
  presign: (body: { document_type: string; mime_type: string }, token?: string) =>
    apiClient.post<{ upload_id: string; upload_url: string }>('/uploads/presign', body, {
      skipAuth: !!token,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  async uploadFile(file: File, documentType: string, token?: string): Promise<string> {
    const presign = await this.presign({ document_type: documentType, mime_type: file.type }, token);
    await fetch(presign.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return presign.upload_id;
  },
};

export const complianceApi = {
  scan: (body: { content_type: string; text: string; has_image?: boolean }) =>
    apiClient.post<ComplianceScanResult>('/compliance/scan', body),
};

/* -------------------------------------------------------------------- */
/* Search / masters                                                      */
/* -------------------------------------------------------------------- */

export interface Speciality {
  speciality_id: number;
  speciality_name: string;
}
export interface Subspeciality {
  subspeciality_id: number;
  subspeciality_name: string;
}
export interface DoctorSearchResult extends DoctorProfile {
  distance_km?: number;
  clinic_name?: string;
}

export const searchApi = {
  specialities: () => apiClient.get<Speciality[]>('/search/specialities', { skipAuth: true }),
  subspecialities: (specialityId: number) =>
    apiClient.get<Subspeciality[]>(`/search/specialities/${specialityId}/subspecialities`, { skipAuth: true }),
  doctors: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, String(v)));
    return apiClient.get<DoctorSearchResult[]>(`/search/doctors?${qs.toString()}`);
  },
};

/* -------------------------------------------------------------------- */
/* Doctors                                                                */
/* -------------------------------------------------------------------- */

export interface Achievement {
  achievement_id: string;
  achievement_text: string;
  achievement_year?: number;
  awarding_body?: string;
}
export interface Publication {
  publication_id: string;
  title: string;
  journal_name?: string;
  publication_year?: number;
  pubmed_id?: string;
  doi?: string;
  publication_url?: string;
}
export interface Affiliation {
  affiliation_id: string;
  job_title: string;
  hospital_name: string;
  from_year: number;
  to_year?: number | null;
  is_current?: boolean;
}

export const doctorsApi = {
  me: () => apiClient.get<DoctorProfile>('/doctors/me'),
  getById: (doctorId: string) => apiClient.get<DoctorProfile>(`/doctors/${doctorId}`),
  updateMe: (body: Partial<DoctorProfile>) => apiClient.patch<DoctorProfile>('/doctors/me', body),
  education: (doctorId: string) => apiClient.get<DoctorEducation[]>(`/doctors/${doctorId}/education`),
  affiliations: (doctorId: string) => apiClient.get<Affiliation[]>(`/doctors/${doctorId}/affiliations`),
  addAffiliation: (body: Omit<Affiliation, 'affiliation_id'>) =>
    apiClient.post<Affiliation>('/doctors/me/affiliations', body),
  deleteAffiliation: (id: string) => apiClient.delete(`/doctors/me/affiliations/${id}`),
  achievements: (doctorId: string) => apiClient.get<Achievement[]>(`/doctors/${doctorId}/achievements`),
  addAchievement: (body: { achievement_text: string; achievement_year?: number; awarding_body?: string; compliance_scan_id: string }) =>
    apiClient.post<Achievement>('/doctors/me/achievements', body),
  deleteAchievement: (id: string) => apiClient.delete(`/doctors/me/achievements/${id}`),
  publications: (doctorId: string, q?: string) =>
    apiClient.get<Publication[]>(`/doctors/${doctorId}/publications${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  addPublication: (body: {
    title: string;
    journal_name?: string;
    publication_year?: number;
    pubmed_id?: string;
    doi?: string;
    publication_url?: string;
    compliance_scan_id: string;
  }) => apiClient.post<Publication>('/doctors/me/publications', body),
  deletePublication: (id: string) => apiClient.delete(`/doctors/me/publications/${id}`),
  locations: (doctorId: string) => apiClient.get<DoctorClinicLocation[]>(`/doctors/${doctorId}/locations`),
  addLocation: (body: Omit<DoctorClinicLocation, 'location_id' | 'doctor_id' | 'is_active'>) =>
    apiClient.post<DoctorClinicLocation>('/doctors/me/locations', body),
  availableTimes: (doctorId: string, date: string) =>
    apiClient.get<{ morning: string[]; afternoon: string[]; evening: string[] }>(
      `/doctors/${doctorId}/available-times?date=${date}`,
    ),
  addTeamMember: (body: { email_or_mobile: string; role_label?: string }) =>
    apiClient.post('/doctors/me/team-members', body),
  verificationDocsPresign: (body: { document_type: string; mime_type: string }) =>
    uploadsApi.presign(body),
  submitVerificationDocument: (body: { document_type: string; upload_id: string }) =>
    apiClient.post('/doctors/me/verification-documents', body),
};

/* -------------------------------------------------------------------- */
/* Patients                                                               */
/* -------------------------------------------------------------------- */

export const patientsApi = {
  me: () => apiClient.get<PatientProfile>('/patients/me'),
  updateMe: (body: Partial<PatientProfile>) => apiClient.patch<PatientProfile>('/patients/me', body),
  addresses: () => apiClient.get<any[]>('/patients/me/addresses'),
  addAddress: (body: { locality: string; city: string; state: string; pin_code: string; latitude: number; longitude: number; is_primary?: boolean }) =>
    apiClient.post('/patients/me/addresses', body),
  familyMembers: () => apiClient.get<FamilyMember[]>('/patients/me/family-members'),
  addFamilyMember: (body: Omit<FamilyMember, 'family_member_id' | 'patient_id' | 'is_active'>) =>
    apiClient.post<FamilyMember>('/patients/me/family-members', body),
  updateFamilyMember: (id: string, body: Partial<FamilyMember>) =>
    apiClient.put<FamilyMember>(`/patients/me/family-members/${id}`, body),
};

/* -------------------------------------------------------------------- */
/* Appointments                                                           */
/* -------------------------------------------------------------------- */

export const appointmentsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.get<Appointment[]>(`/appointments${qs}`);
  },
  get: (id: string) => apiClient.get<Appointment>(`/appointments/${id}`),
  book: (body: {
    doctor_id: string;
    location_id: string;
    family_member_id: string;
    appointment_date: string;
    start_time: string;
    appointment_type: string;
  }) => apiClient.post<Appointment & { payment_id?: string }>('/appointments', body, { idempotencyKey: crypto.randomUUID() }),
  cancel: (id: string, cancellation_reason: string) =>
    apiClient.patch(`/appointments/${id}/cancel`, { cancellation_reason }),
  reschedule: (id: string, body: { appointment_date: string; start_time: string }) =>
    apiClient.post(`/appointments/${id}/reschedule`, body),
  prescription: (id: string) => apiClient.get<Prescription>(`/appointments/${id}/prescription`),
  createVideoSession: (id: string) => apiClient.post<{ session_id: string; session_token: string }>(`/appointments/${id}/video-session`),
};

export const paymentsApi = {
  confirm: (paymentId: string, body: { gateway_payment_id: string; gateway_signature: string }) =>
    apiClient.post(`/payments/${paymentId}/confirm`, body),
};

/* -------------------------------------------------------------------- */
/* Posts / Feed                                                           */
/* -------------------------------------------------------------------- */

export const postsApi = {
  feed: (cursor?: string) => apiClient.get<Post[]>(`/feed${cursor ? `?cursor=${cursor}` : ''}`),
  create: (body: { content: string; visibility_scope: string; community_id?: string; post_type: string; media?: string[]; compliance_scan_id: string }) =>
    apiClient.post<Post>('/posts', body),
  like: (postId: string) => apiClient.post(`/posts/${postId}/likes`),
  unlike: (postId: string) => apiClient.delete(`/posts/${postId}/likes`),
  comments: (postId: string) => apiClient.get<any[]>(`/posts/${postId}/comments`),
  addComment: (postId: string, content: string) => apiClient.post(`/posts/${postId}/comments`, { content }),
};

/* -------------------------------------------------------------------- */
/* Network                                                                */
/* -------------------------------------------------------------------- */

export const networkApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.get<NetworkConnection[]>(`/network${qs}`);
  },
  request: (body: { recipient_id: string; connection_category: string }) =>
    apiClient.post('/network/requests', body),
  accept: (connectionId: string) => apiClient.patch(`/network/requests/${connectionId}/accept`),
  reject: (connectionId: string) => apiClient.patch(`/network/requests/${connectionId}/reject`),
};

/* -------------------------------------------------------------------- */
/* Community                                                              */
/* -------------------------------------------------------------------- */

export interface Community {
  community_id: string;
  community_name: string;
  description?: string;
  speciality_id?: number;
  is_public: boolean;
  member_count: number;
  is_member?: boolean;
}

export const communityApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.get<Community[]>(`/communities${qs}`);
  },
  create: (body: { community_name: string; description: string; speciality_id?: number; is_public: boolean }) =>
    apiClient.post<Community>('/communities', body),
  join: (id: string) => apiClient.post(`/communities/${id}/join`),
  leave: (id: string) => apiClient.delete(`/communities/${id}/leave`),
};

/* -------------------------------------------------------------------- */
/* Marketplace                                                           */
/* -------------------------------------------------------------------- */

export const marketApi = {
  categories: () => apiClient.get<{ category_id: number; name: string; parent_id?: number | null }[]>('/market/categories', { skipAuth: true }),
  list: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.get<EquipmentListing[]>(`/market/listings${qs}`);
  },
  get: (id: string) => apiClient.get<EquipmentListing>(`/market/listings/${id}`),
  create: (body: {
    title: string;
    description: string;
    category_id?: number;
    condition: string;
    asking_price: number;
    is_negotiable: boolean;
    media?: string[];
    compliance_scan_id: string;
  }) => apiClient.post<EquipmentListing>('/market/listings', body),
  inquire: (listingId: string, message: string) => apiClient.post(`/market/listings/${listingId}/inquiries`, { message }),
};

/* -------------------------------------------------------------------- */
/* Medico-Legal                                                          */
/* -------------------------------------------------------------------- */

export const medicoLegalApi = {
  list: () => apiClient.get<MedicoLegalRequest[]>('/medico-legal/requests'),
  create: (body: { category: string; subject: string; description: string }) =>
    apiClient.post<MedicoLegalRequest>('/medico-legal/requests', body),
};

/* -------------------------------------------------------------------- */
/* Support / Help Desk                                                   */
/* -------------------------------------------------------------------- */

export const supportApi = {
  botQuery: (message: string) => apiClient.post<{ reply: string; escalated?: boolean }>('/support/bot/query', { message }),
  tickets: () => apiClient.get<any[]>('/support/tickets'),
  createTicket: (body: { subject: string; description: string; priority: string }) =>
    apiClient.post('/support/tickets', body),
};

/* -------------------------------------------------------------------- */
/* Notifications                                                         */
/* -------------------------------------------------------------------- */

export const notificationsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.get<NotificationItem[]>(`/notifications${qs}`);
  },
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
};
