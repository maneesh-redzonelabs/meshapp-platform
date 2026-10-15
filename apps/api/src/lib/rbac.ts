import type { UserType, SubscriptionTier } from '@meshapp/shared';

/**
 * Role model. Mirrors the `roles` table seeded in meshapp-create-db.sql
 * (role_name values) but is evaluated in-process for speed; the DB table
 * remains the source of truth for the admin console's role list.
 *
 * A user's effective role set is derived from users.user_type plus, for
 * doctors, doctors.subscription_tier, and for admins, platform_admins.admin_role.
 */
export type RoleName =
  | 'doctor_free'
  | 'doctor_premium'
  | 'patient'
  | 'mr'
  | 'paramedical'
  | 'medico_legal'
  | 'supplier'
  | 'admin_support'
  | 'admin_verification'
  | 'admin_content'
  | 'super_admin';

export function rolesForUser(userType: UserType, opts: { subscriptionTier?: SubscriptionTier; adminRole?: string | null }): RoleName[] {
  switch (userType) {
    case 'doctor':
      return opts.subscriptionTier === 'premium' ? ['doctor_premium'] : ['doctor_free'];
    case 'patient':
      return ['patient'];
    case 'mr':
      return ['mr'];
    case 'paramedical':
      return ['paramedical'];
    case 'medico_legal':
      return ['medico_legal'];
    case 'supplier':
      return ['supplier'];
    case 'admin': {
      switch (opts.adminRole) {
        case 'super_admin':
          return ['super_admin'];
        case 'verification_admin':
          return ['admin_verification'];
        case 'content_admin':
          return ['admin_content'];
        case 'support_admin':
          return ['admin_support'];
        default:
          return ['admin_support'];
      }
    }
    default:
      return [];
  }
}

/**
 * Permission map: "resource:action" -> roles allowed. Checked by
 * requirePermission(). super_admin implicitly has every permission.
 */
const PERMISSIONS: Record<string, RoleName[]> = {
  'doctor_profile:update_own': ['doctor_free', 'doctor_premium'],
  'doctor_verification:submit': ['doctor_free', 'doctor_premium'],
  'doctor_verification:review': ['admin_verification'],
  'appointment:create': ['patient'],
  'appointment:manage_own_doctor': ['doctor_free', 'doctor_premium'],
  'appointment:manage_own_patient': ['patient'],
  'prescription:create': ['doctor_premium'],
  'prescription:read': ['doctor_free', 'doctor_premium', 'patient'],
  'post:create': ['doctor_free', 'doctor_premium', 'patient'],
  'compliance_rules:manage': ['admin_content', 'super_admin'],
  'content:moderate': ['admin_content', 'super_admin'],
  'user:lock': ['admin_support', 'super_admin'],
  'audit_log:read': ['admin_support', 'admin_verification', 'admin_content', 'super_admin'],
  'support_ticket:manage': ['admin_support', 'super_admin'],
};

export function roleHasPermission(roles: RoleName[], permission: string): boolean {
  if (roles.includes('super_admin')) return true;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return roles.some((r) => allowed.includes(r));
}
