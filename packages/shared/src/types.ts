import type {
  UserType, SubscriptionTier, VerificationStatus, Gender, Relationship,
  AppointmentType, AppointmentStatus, PaymentStatus, VisibilityScope, PostType,
  ConnectionCategory, ConnectionStatus, EquipmentCondition, ListingStatus,
  MedicoLegalCategory, MedicoLegalStatus, NotificationType, ComplianceEntityType,
  ComplianceVerdict,
} from './enums';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface UserSummary {
  user_id: string;
  user_type: UserType;
  is_active: boolean;
}

export interface DoctorProfile {
  doctor_id: string;
  full_name: string;
  profile_selfie_url?: string | null;
  speciality_id: number;
  subspeciality_id: number;
  speciality_name?: string;
  subspeciality_name?: string;
  subscription_tier: SubscriptionTier;
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

export interface NetworkConnection {
  connection_id: string;
  requester_id: string;
  recipient_id: string;
  connection_category: ConnectionCategory;
  status: ConnectionStatus;
  peer_name?: string;
  peer_photo?: string | null;
}

export interface EquipmentListing {
  listing_id: string;
  seller_id: string;
  title: string;
  description?: string | null;
  category_id?: number | null;
  condition: EquipmentCondition;
  asking_price: number;
  currency: string;
  listing_status: ListingStatus;
  is_negotiable: boolean;
  views_count: number;
}

export interface MedicoLegalRequest {
  request_id: string;
  requester_id: string;
  category: MedicoLegalCategory;
  subject: string;
  description: string;
  status: MedicoLegalStatus;
  assigned_expert_id?: string | null;
}

export interface NotificationItem {
  notification_id: string;
  recipient_id: string;
  notification_type: NotificationType;
  title?: string | null;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  is_read: boolean;
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

export interface ComplianceScanRequest {
  content_type: ComplianceEntityType;
  text: string;
  has_image?: boolean;
}
