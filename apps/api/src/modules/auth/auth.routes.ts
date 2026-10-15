import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authLimiter, otpRequestLimiter } from '../../middleware/rateLimit';
import { authenticate } from '../../middleware/authenticate';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';
import { hashSecret, verifySecret } from '../../lib/crypto';
import { issueOtp, verifyOtp, debugOtpPayload } from './otp.service';
import { createSession, rotateRefreshToken, revokeSession, revokeAllSessions } from './session.service';
import { signRegistrationToken, verifyRegistrationToken } from '../../lib/jwt';
import { putPendingPatient, getPendingPatient, clearPendingPatient } from './pendingRegistration.store';
import { insertClinicLocation } from '../../lib/geo';
import { consumeUpload } from '../uploads/uploads.store';
import {
  doctorRequestOtpSchema,
  doctorVerifyMobileOtpSchema,
  doctorVerifyEmailOtpSchema,
  doctorCompleteProfileSchema,
  patientRequestOtpSchema,
  patientVerifyOtpSchema,
  loginRequestOtpSchema,
  loginVerifyOtpSchema,
  loginPasswordSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schemas';

const router = Router();
router.use(authLimiter);

function deviceFromReq(req: any) {
  return {
    deviceType: req.body.device_type,
    deviceFingerprint: req.body.device_fingerprint,
    ipAddress: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
  };
}

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 30;

/* ============================== DOCTOR DUAL-OTP REGISTRATION ============================== */

router.post(
  '/doctor/register/request-otp',
  otpRequestLimiter,
  validateBody(doctorRequestOtpSchema),
  asyncHandler(async (req, res) => {
    const { mobile_number, email } = req.body;

    const existingByPhone = await prisma.users.findUnique({ where: { phone_number: mobile_number } });
    const existingByEmail = await prisma.users.findUnique({ where: { email } });
    if ((existingByPhone && existingByPhone.phone_verified_at) || (existingByEmail && existingByEmail.email_verified_at)) {
      throw ApiError.conflict('An account already exists with this mobile number or email. Try logging in instead.');
    }
    if (existingByPhone && existingByEmail && existingByPhone.user_id !== existingByEmail.user_id) {
      throw ApiError.conflict('Mobile number and email belong to different pending registrations');
    }

    let user = existingByPhone ?? existingByEmail;
    if (!user) {
      user = await prisma.users.create({
        data: { phone_number: mobile_number, email, user_type: 'doctor' },
      });
    } else if (!existingByEmail) {
      user = await prisma.users.update({ where: { user_id: user.user_id }, data: { email } });
    }

    const [mobileOtp, emailOtp] = await Promise.all([
      issueOtp({ userId: user.user_id, otpType: 'mobile_registration', recipient: mobile_number, ipAddress: req.ip }),
      issueOtp({ userId: user.user_id, otpType: 'email_registration', recipient: email, ipAddress: req.ip }),
    ]);

    const mobileDebug = debugOtpPayload(mobileOtp);
    const emailDebug = debugOtpPayload(emailOtp);
    created(res, {
      message: 'OTPs dispatched to mobile and email. Both must be verified before continuing.',
      ...('debug_otp' in mobileDebug ? { debug_otp_mobile: mobileDebug.debug_otp } : {}),
      ...('debug_otp' in emailDebug ? { debug_otp_email: emailDebug.debug_otp } : {}),
    });
  }),
);

router.post(
  '/doctor/register/verify-mobile-otp',
  validateBody(doctorVerifyMobileOtpSchema),
  asyncHandler(async (req, res) => {
    const { mobile_number, otp } = req.body;
    const { user_id } = await verifyOtp({ otpType: 'mobile_registration', recipient: mobile_number, code: otp });
    if (!user_id) throw ApiError.badRequest('OTP not linked to a pending registration');
    const user = await prisma.users.update({ where: { user_id }, data: { phone_verified_at: new Date() } });
    ok(res, { mobile_verified: true, both_verified: Boolean(user.phone_verified_at && user.email_verified_at) });
  }),
);

router.post(
  '/doctor/register/verify-email-otp',
  validateBody(doctorVerifyEmailOtpSchema),
  asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    const { user_id } = await verifyOtp({ otpType: 'email_registration', recipient: email, code: otp });
    if (!user_id) throw ApiError.badRequest('OTP not linked to a pending registration');
    const user = await prisma.users.update({ where: { user_id }, data: { email_verified_at: new Date() } });

    const bothVerified = Boolean(user.phone_verified_at && user.email_verified_at);
    const payload: Record<string, unknown> = { email_verified: true, both_verified: bothVerified };
    if (bothVerified) {
      const existingDoctor = await prisma.doctors.findUnique({ where: { doctor_id: user_id } });
      if (existingDoctor) throw ApiError.conflict('Doctor profile already completed for this account');
      payload.registration_token = signRegistrationToken(user_id);
    }
    ok(res, payload);
  }),
);

router.post(
  '/doctor/register/complete-profile',
  validateBody(doctorCompleteProfileSchema),
  asyncHandler(async (req, res) => {
    const body = req.body;
    let claims;
    try {
      claims = verifyRegistrationToken(body.registration_token);
    } catch {
      throw ApiError.unauthenticated('Invalid or expired registration token — verify both OTPs again');
    }

    const user = await prisma.users.findUnique({ where: { user_id: claims.sub } });
    if (!user || user.user_type !== 'doctor') throw ApiError.unauthenticated('Invalid registration session');
    if (!user.phone_verified_at || !user.email_verified_at) throw ApiError.forbidden('Both OTPs must be verified first');

    const existingDoctor = await prisma.doctors.findUnique({ where: { doctor_id: user.user_id } });
    if (existingDoctor) throw ApiError.conflict('Doctor profile already completed for this account');

    let selfieUrl: string | null = null;
    if (body.selfie_upload_id) {
      selfieUrl = consumeUpload(body.selfie_upload_id, user.user_id);
    }

    const completenessInputs = [body.bio, body.years_of_experience, selfieUrl, body.education?.length, body.clinic_location];
    const completenessPct = Math.round((completenessInputs.filter(Boolean).length / completenessInputs.length) * 100);

    const doctor = await prisma.$transaction(async (tx) => {
      const d = await tx.doctors.create({
        data: {
          doctor_id: user.user_id,
          full_name: body.full_name,
          profile_selfie_url: selfieUrl,
          speciality_id: body.speciality_id,
          subspeciality_id: body.subspeciality_id,
          bio: body.bio,
          years_of_experience: body.years_of_experience,
          subscription_tier: 'free',
          verification_status: 'unverified',
          profile_completeness_pct: completenessPct,
        },
      });

      for (const edu of body.education) {
        await tx.doctor_education.create({
          data: {
            doctor_id: d.doctor_id,
            education_level: edu.education_level,
            degree_name: edu.degree_name,
            college_id: edu.college_id,
            college_name_other: edu.college_name_other,
            passing_year: edu.passing_year,
          },
        });
      }

      const loc = await insertClinicLocation(
        {
          doctorId: d.doctor_id,
          clinicHospitalName: body.clinic_location.clinic_hospital_name,
          addressLine1: body.clinic_location.address_line1,
          addressLine2: body.clinic_location.address_line2,
          city: body.clinic_location.city,
          state: body.clinic_location.state,
          pinCode: body.clinic_location.pin_code,
          latitude: body.clinic_location.latitude,
          longitude: body.clinic_location.longitude,
          consultationFeeInPerson: body.clinic_location.consultation_fee_inperson,
          consultationFeeVideo: body.clinic_location.consultation_fee_video,
          isPrimary: true,
        },
        tx,
      );

      return { doctor: d, locationId: loc.location_id };
    });

    const session = await createSession(user.user_id, 'doctor', {
      ipAddress: req.ip ?? '0.0.0.0',
      userAgent: req.header('user-agent') ?? undefined,
    });

    created(res, {
      user_id: user.user_id,
      doctor_id: doctor.doctor.doctor_id,
      verification_status: 'unverified',
      subscription_tier: 'free',
      profile_completeness_pct: completenessPct,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    });
  }),
);

/* ============================== PATIENT SINGLE-OTP REGISTRATION ============================== */

router.post(
  '/patient/register/request-otp',
  otpRequestLimiter,
  validateBody(patientRequestOtpSchema),
  asyncHandler(async (req, res) => {
    const { mobile_number, first_name, last_name, date_of_birth, age, gender, pin_code } = req.body;

    const existing = await prisma.users.findUnique({ where: { phone_number: mobile_number } });
    if (existing && existing.phone_verified_at) {
      throw ApiError.conflict('An account already exists with this mobile number. Try logging in instead.');
    }

    putPendingPatient(mobile_number, { first_name, last_name, date_of_birth, age, gender, pin_code });
    const issued = await issueOtp({ userId: existing?.user_id ?? null, otpType: 'mobile_registration', recipient: mobile_number, ipAddress: req.ip });

    created(res, { message: 'OTP dispatched to mobile number', ...debugOtpPayload(issued) });
  }),
);

router.post(
  '/patient/register/verify-otp',
  validateBody(patientVerifyOtpSchema),
  asyncHandler(async (req, res) => {
    const { mobile_number, otp } = req.body;
    const pending = getPendingPatient(mobile_number);
    if (!pending) throw ApiError.badRequest('Registration session expired — request a new OTP');

    await verifyOtp({ otpType: 'mobile_registration', recipient: mobile_number, code: otp });

    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.users.findUnique({ where: { phone_number: mobile_number } });
      if (user) {
        user = await tx.users.update({ where: { user_id: user.user_id }, data: { phone_verified_at: new Date() } });
      } else {
        user = await tx.users.create({
          data: { phone_number: mobile_number, user_type: 'patient', phone_verified_at: new Date() },
        });
      }

      const patient = await tx.patients.create({
        data: {
          patient_id: user.user_id,
          first_name: pending.first_name,
          last_name: pending.last_name,
          date_of_birth: pending.date_of_birth ? new Date(pending.date_of_birth) : null,
          gender: pending.gender,
        },
      });

      await tx.patient_addresses.create({
        data: { patient_id: patient.patient_id, pin_code: pending.pin_code, is_primary: true },
      });

      await tx.patient_family_members.create({
        data: {
          patient_id: patient.patient_id,
          full_name: `${pending.first_name} ${pending.last_name}`,
          date_of_birth: pending.date_of_birth ? new Date(pending.date_of_birth) : null,
          age: pending.age,
          gender: pending.gender,
          relationship: 'self',
        },
      });

      return { user, patient };
    });

    clearPendingPatient(mobile_number);

    const session = await createSession(result.user.user_id, 'patient', {
      ipAddress: req.ip ?? '0.0.0.0',
      userAgent: req.header('user-agent') ?? undefined,
    });

    created(res, {
      user_id: result.user.user_id,
      patient_id: result.patient.patient_id,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    });
  }),
);

/* ============================== LOGIN ============================== */

router.post(
  '/login/request-otp',
  otpRequestLimiter,
  validateBody(loginRequestOtpSchema),
  asyncHandler(async (req, res) => {
    const { mobile_number } = req.body;
    const user = await prisma.users.findUnique({ where: { phone_number: mobile_number } });
    if (!user || !user.is_active || user.deleted_at) {
      // Do not reveal account existence; respond identically either way.
      created(res, { message: 'If this number is registered, an OTP has been sent.' });
      return;
    }
    const issued = await issueOtp({ userId: user.user_id, otpType: 'mobile_login', recipient: mobile_number, ipAddress: req.ip });
    created(res, { message: 'If this number is registered, an OTP has been sent.', ...debugOtpPayload(issued) });
  }),
);

router.post(
  '/login/verify-otp',
  validateBody(loginVerifyOtpSchema),
  asyncHandler(async (req, res) => {
    const { mobile_number, otp } = req.body;
    const user = await prisma.users.findUnique({ where: { phone_number: mobile_number } });
    if (!user) throw ApiError.otpInvalid();

    await verifyOtp({ otpType: 'mobile_login', recipient: mobile_number, code: otp });

    if (user.is_locked && user.locked_until && user.locked_until > new Date()) {
      throw ApiError.accountLocked(`Account locked until ${user.locked_until.toISOString()}`);
    }

    const session = await createSession(user.user_id, user.user_type, deviceFromReq(req));
    await prisma.users.update({
      where: { user_id: user.user_id },
      data: { last_login_at: new Date(), last_login_ip: req.ip, failed_login_attempts: 0, is_locked: false, locked_until: null },
    });

    ok(res, { user_id: user.user_id, user_type: user.user_type, ...session });
  }),
);

router.post(
  '/login/password',
  validateBody(loginPasswordSchema),
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;
    const user = await prisma.users.findFirst({ where: { OR: [{ phone_number: identifier }, { email: identifier }] } });

    if (!user || !user.password_hash) {
      throw ApiError.unauthenticated('Invalid credentials');
    }
    if (user.is_locked && user.locked_until && user.locked_until > new Date()) {
      throw ApiError.accountLocked(`Account locked until ${user.locked_until.toISOString()}`);
    }

    const valid = await verifySecret(user.password_hash, password);
    if (!valid) {
      const attempts = user.failed_login_attempts + 1;
      const shouldLock = attempts >= LOCKOUT_THRESHOLD;
      await prisma.users.update({
        where: { user_id: user.user_id },
        data: {
          failed_login_attempts: attempts,
          last_failed_login_at: new Date(),
          is_locked: shouldLock,
          locked_until: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : user.locked_until,
        },
      });
      await prisma.failed_login_attempts.create({
        data: { identifier_hash: identifier, ip_address: req.ip ?? '0.0.0.0', attempt_type: 'password', failure_reason: 'bad_password' },
      }).catch(() => undefined);
      throw ApiError.unauthenticated('Invalid credentials');
    }

    const session = await createSession(user.user_id, user.user_type, deviceFromReq(req));
    await prisma.users.update({
      where: { user_id: user.user_id },
      data: { last_login_at: new Date(), last_login_ip: req.ip, failed_login_attempts: 0 },
    });

    ok(res, { user_id: user.user_id, user_type: user.user_type, ...session });
  }),
);

router.post(
  '/token/refresh',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const tokens = await rotateRefreshToken(req.body.refresh_token, deviceFromReq(req));
    ok(res, tokens);
  }),
);

router.post(
  '/logout',
  authenticate(),
  asyncHandler(async (req, res) => {
    await revokeSession(req.authUser!.sessionId, 'logout');
    ok(res, { logged_out: true });
  }),
);

router.post(
  '/logout-all',
  authenticate(),
  asyncHandler(async (req, res) => {
    await revokeAllSessions(req.authUser!.userId, 'logout');
    ok(res, { logged_out_all: true });
  }),
);

router.get(
  '/sessions',
  authenticate(),
  asyncHandler(async (req, res) => {
    const sessions = await prisma.user_sessions.findMany({
      where: { user_id: req.authUser!.userId, is_active: true },
      orderBy: { created_at: 'desc' },
      select: { session_id: true, device_type: true, ip_address: true, last_active_at: true, created_at: true, expires_at: true },
    });
    ok(res, sessions.map((s) => ({ ...s, is_current: s.session_id === req.authUser!.sessionId })));
  }),
);

router.delete(
  '/sessions/:session_id',
  authenticate(),
  asyncHandler(async (req, res) => {
    const session = await prisma.user_sessions.findUnique({ where: { session_id: req.params.session_id } });
    if (!session || session.user_id !== req.authUser!.userId) throw ApiError.notFound();
    await revokeSession(session.session_id, 'logout');
    ok(res, { revoked: true });
  }),
);

/* ============================== PASSWORD RESET / CHANGE ============================== */

router.post(
  '/password/forgot',
  otpRequestLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { identifier } = req.body;
    const user = await prisma.users.findFirst({ where: { OR: [{ phone_number: identifier }, { email: identifier }] } });
    if (!user) {
      created(res, { message: 'If this account exists, a reset code has been sent.' });
      return;
    }
    const issued = await issueOtp({ userId: user.user_id, otpType: 'password_reset', recipient: identifier, ipAddress: req.ip });
    created(res, { message: 'If this account exists, a reset code has been sent.', ...debugOtpPayload(issued) });
  }),
);

router.post(
  '/password/reset',
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { identifier, otp, new_password } = req.body;
    const user = await prisma.users.findFirst({ where: { OR: [{ phone_number: identifier }, { email: identifier }] } });
    if (!user) throw ApiError.otpInvalid();

    await verifyOtp({ otpType: 'password_reset', recipient: identifier, code: otp });

    const password_hash = await hashSecret(new_password);
    await prisma.users.update({ where: { user_id: user.user_id }, data: { password_hash, is_locked: false, locked_until: null, failed_login_attempts: 0 } });
    await revokeAllSessions(user.user_id, 'password_change');

    ok(res, { password_reset: true });
  }),
);

router.patch(
  '/password/change',
  authenticate(),
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.users.findUnique({ where: { user_id: req.authUser!.userId } });
    if (!user?.password_hash || !(await verifySecret(user.password_hash, req.body.current_password))) {
      throw ApiError.unauthenticated('Current password is incorrect');
    }
    const password_hash = await hashSecret(req.body.new_password);
    await prisma.users.update({ where: { user_id: user.user_id }, data: { password_hash } });
    await revokeAllSessions(user.user_id, 'password_change');
    ok(res, { password_changed: true });
  }),
);

export default router;
