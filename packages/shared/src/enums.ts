/**
 * Enum unions mirrored 1:1 from meshapp-create-db.sql.
 * Keep this file in sync with the Postgres ENUM types — it is the
 * single contract shared by the API, web, and mobile clients.
 */

export const USER_TYPES = [
  'doctor', 'patient', 'mr', 'paramedical', 'medico_legal', 'supplier', 'admin',
] as const;
export type UserType = typeof USER_TYPES[number];

export const SUBSCRIPTION_TIERS = ['free', 'premium'] as const;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];

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

export const PAYMENT_GATEWAY_STATUSES = [
  'initiated', 'processing', 'success', 'failed', 'refunded', 'partially_refunded',
] as const;
export type PaymentGatewayStatus = typeof PAYMENT_GATEWAY_STATUSES[number];

export const VISIBILITY_SCOPES = ['public', 'network_only', 'community_only', 'private'] as const;
export type VisibilityScope = typeof VISIBILITY_SCOPES[number];

export const POST_TYPES = ['clinical_case', 'research', 'opinion', 'update', 'general'] as const;
export type PostType = typeof POST_TYPES[number];

export const CONNECTION_CATEGORIES = [
  'ug_batch', 'pg_batch', 'super_spec', 'teachers', 'juniors_seniors', 'coworkers', 'team', 'general',
] as const;
export type ConnectionCategory = typeof CONNECTION_CATEGORIES[number];

export const CONNECTION_STATUSES = ['pending', 'accepted', 'rejected', 'blocked'] as const;
export type ConnectionStatus = typeof CONNECTION_STATUSES[number];

export const EQUIPMENT_CONDITIONS = ['new', 'like_new', 'good', 'fair'] as const;
export type EquipmentCondition = typeof EQUIPMENT_CONDITIONS[number];

export const LISTING_STATUSES = ['active', 'sold', 'cancelled', 'under_review'] as const;
export type ListingStatus = typeof LISTING_STATUSES[number];

export const MEDICO_LEGAL_CATEGORIES = [
  'malpractice_allegation', 'consent_review', 'notice_reply', 'hospital_compliance', 'general',
] as const;
export type MedicoLegalCategory = typeof MEDICO_LEGAL_CATEGORIES[number];

export const MEDICO_LEGAL_STATUSES = ['submitted', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
export type MedicoLegalStatus = typeof MEDICO_LEGAL_STATUSES[number];

export const CONSULTATION_TYPES = ['phone', 'video', 'written'] as const;
export type ConsultationType = typeof CONSULTATION_TYPES[number];

export const NOTIFICATION_TYPES = ['network', 'post', 'appointment', 'market', 'legal', 'system'] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = typeof TICKET_STATUSES[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = typeof TICKET_PRIORITIES[number];

export const COMPLIANCE_ENTITY_TYPES = [
  'doctor_achievement', 'doctor_publication', 'post', 'equipment_listing',
] as const;
export type ComplianceEntityType = typeof COMPLIANCE_ENTITY_TYPES[number];

export const COMPLIANCE_SEVERITIES = ['block', 'warn'] as const;
export type ComplianceSeverity = typeof COMPLIANCE_SEVERITIES[number];

export const COMPLIANCE_VERDICTS = ['passed', 'blocked'] as const;
export type ComplianceVerdict = typeof COMPLIANCE_VERDICTS[number];

export const ADMIN_ROLES = ['super_admin', 'verification_admin', 'content_admin', 'support_admin'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];
