/**
 * Duplicated from packages/shared/src/{enums,types,errorCodes}.ts.
 *
 * Why duplicated instead of imported: see README.md -> "Metro / workspace
 * resolution choice". In short — apps/mobile is a standalone Expo app (not
 * an npm workspace member of the monorepo root), so Metro's module resolver
 * cannot see outside apps/mobile without extra `watchFolders` +
 * `resolver.disableHierarchicalLookup` configuration that is brittle across
 * Expo SDK upgrades. Rather than fight that, we copy the small set of
 * enums/types we actually consume. Keep this file in sync by hand whenever
 * packages/shared/src/enums.ts or types.ts change.
 */

export const USER_TYPES = [
  'doctor', 'patient', 'mr', 'paramedical', 'medico_legal', 'supplier', 'admin',
] as const;
export type UserType = typeof USER_TYPES[number];

export const VERIFICATION_STATUSES = ['unverified', 'pending', 'verified', 'rejected'] as const;
export type VerificationStatus = typeof VERIFICATION_STATUSES[number];

export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export type Gender = typeof GENDERS[number];

export const RELATIONSHIPS = [
  'self', 'spouse', 'son', 'daughter', 'mother', 'father', 'sibling', 'other',
] as const;
export type Relationship = typeof RELATIONSHIPS[number];

export const APPOINTMENT_TYPES = ['in_person', 'video_call'] as const;
export type AppointmentType = typeof APPOINTMENT_TYPES[number];

export const APPOINTMENT_STATUSES = [
  'requested', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled',
] as const;
export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'partial'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const VISIBILITY_SCOPES = ['public', 'network_only', 'community_only', 'private'] as const;
export type VisibilityScope = typeof VISIBILITY_SCOPES[number];

export const POST_TYPES = ['clinical_case', 'research', 'opinion', 'update', 'general'] as const;
export type PostType = typeof POST_TYPES[number];

export const COMPLIANCE_ENTITY_TYPES = [
  'doctor_achievement', 'doctor_publication', 'post', 'equipment_listing',
] as const;
export type ComplianceEntityType = typeof COMPLIANCE_ENTITY_TYPES[number];

export const COMPLIANCE_VERDICTS = ['passed', 'blocked'] as const;
export type ComplianceVerdict = typeof COMPLIANCE_VERDICTS[number];

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface DoctorProfile {
  doctor_id: string;
  full_name: string;
  profile_selfie_url?: string | null;
  speciality_id: number;
  subspeciality_id: number;
  speciality_name?: string;
  subspeciality_name?: string;
  subscription_tier: 'free' | 'premium';
  bio?: string | null;
  years_of_experience?: number | null;
  is_searchable: boolean;
  verification_status: VerificationStatus;
  rating_avg?: number | null;
  rating_count: number;
  profile_completeness_pct: number;
  backdrop_image_url?: string | null;
}

export interface DoctorEducation {
  education_id: string;
  doctor_id: string;
  education_level: 'graduation' | 'post_graduation' | 'super_speciality' | 'fellowship' | 'other';
  degree_name: string;
  college_id?: number | null;
  college_name_other?: string | null;
  passing_year: number;
}

export interface DoctorClinicLocation {
  location_id: string;
  doctor_id: string;
  clinic_hospital_name: string;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  latitude: number;
  longitude: number;
  consultation_fee_inperson?: number | null;
  consultation_fee_video?: number | null;
  is_primary: boolean;
  is_active: boolean;
}

export interface DoctorAchievement {
  achievement_id: string;
  achievement_text: string;
  achievement_year?: number | null;
  awarding_body?: string | null;
}

export interface DoctorPublication {
  publication_id: string;
  title: string;
  journal_name?: string | null;
  publication_year?: number | null;
  pubmed_id?: string | null;
  doi?: string | null;
  publication_url?: string | null;
}

export interface PatientProfile {
  patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: Gender | null;
  blood_group?: string | null;
  profile_photo_url?: string | null;
}

export interface FamilyMember {
  family_member_id: string;
  patient_id: string;
  full_name: string;
  date_of_birth?: string | null;
  age?: number | null;
  gender?: Gender | null;
  relationship: Relationship;
  relationship_other?: string | null;
  is_active: boolean;
}

export interface Appointment {
  appointment_id: string;
  patient_id: string;
  family_member_id?: string | null;
  doctor_id: string;
  location_id?: string | null;
  appointment_date: string;
  start_time: string;
  end_time?: string | null;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  consultation_fee: number;
  platform_service_fee: number;
  total_amount: number;
  payment_status: PaymentStatus;
  payment_id?: string | null;
  doctor_name?: string;
  doctor_photo?: string | null;
  patient_name?: string;
}

export interface Prescription {
  prescription_id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  diagnosis?: string | null;
  medications?: Array<{ name: string; dosage: string; frequency: string; duration: string; route?: string }>;
  advice?: string | null;
  follow_up_date?: string | null;
}

export interface Post {
  post_id: string;
  author_id: string;
  author_name?: string;
  author_photo?: string | null;
  content: string;
  visibility_scope: VisibilityScope;
  community_id?: string | null;
  post_type: PostType;
  likes_count: number;
  comments_count: number;
  liked_by_me?: boolean;
  created_at: string;
}

export interface ComplianceViolation {
  category: string;
  excerpt: string;
  severity: 'block' | 'warn';
  guidance: string;
}

export interface ComplianceScanResult {
  scan_id: string;
  verdict: ComplianceVerdict;
  violations: ComplianceViolation[];
}

/** Mirrors packages/shared/src/errorCodes.ts */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  NOT_VERIFIED: 'NOT_VERIFIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  COMPLIANCE_BLOCKED: 'COMPLIANCE_BLOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    fields?: Record<string, string>;
    violations?: ComplianceViolation[];
    scan_id?: string;
    request_id?: string;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  meta?: { request_id?: string; next_cursor?: string | null };
}

export type ApiResponse<T> = ApiSuccessBody<T> | ApiErrorBody;
