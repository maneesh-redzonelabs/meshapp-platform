/**
 * Holds patient self-registration form fields between request-otp and
 * verify-otp (the patient flow is single-step from the client's point of
 * view — no server-persisted user exists until the OTP is verified).
 * In-memory + TTL is acceptable for this single-process dev build; a
 * production/multi-instance deployment should move this to Redis.
 */
interface PendingPatientRegistration {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  pin_code: string;
  expiresAt: number;
}

const patientStore = new Map<string, PendingPatientRegistration>();
const TTL_MS = 20 * 60 * 1000;

export function putPendingPatient(mobileNumber: string, data: Omit<PendingPatientRegistration, 'expiresAt'>): void {
  patientStore.set(mobileNumber, { ...data, expiresAt: Date.now() + TTL_MS });
}

export function getPendingPatient(mobileNumber: string): PendingPatientRegistration | undefined {
  const row = patientStore.get(mobileNumber);
  if (!row) return undefined;
  if (row.expiresAt < Date.now()) {
    patientStore.delete(mobileNumber);
    return undefined;
  }
  return row;
}

export function clearPendingPatient(mobileNumber: string): void {
  patientStore.delete(mobileNumber);
}
