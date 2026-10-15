import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { ApiError } from '@/lib/apiClient';
import { useToast } from '@/context/ToastContext';
import { Button, Input } from '@/components/ui/Primitives';
import { DoctorOnboardingForm } from './DoctorOnboardingForm';

type Step = 'credentials' | 'otp' | 'onboarding';

export default function DoctorAuth() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [step, setStep] = useState<Step>('credentials');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [requesting, setRequesting] = useState(false);

  const [mobileOtp, setMobileOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingMobile, setVerifyingMobile] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [devHintMobile, setDevHintMobile] = useState<string | null>(null);
  const [devHintEmail, setDevHintEmail] = useState<string | null>(null);
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{10}$/.test(mobile)) return show('Enter a valid 10-digit mobile number.', 'error');
    if (!/^\S+@\S+\.\S+$/.test(email)) return show('Enter a valid email address.', 'error');
    setRequesting(true);
    try {
      const res = await authApi.doctorRequestOtp({ mobile_number: mobile, email });
      const dMobile = res.debug_otp_mobile || res.debug_otp || null;
      const dEmail = res.debug_otp_email || res.debug_otp || null;
      setDevHintMobile(dMobile);
      setDevHintEmail(dEmail);
      if (dMobile) setMobileOtp(dMobile);
      if (dEmail) setEmailOtp(dEmail);
      setStep('otp');
      show('Verification OTPs sent to your mobile and email.', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not request OTP. Please try again.', 'error');
    } finally {
      setRequesting(false);
    }
  }

  async function verifyMobile() {
    setVerifyingMobile(true);
    try {
      const res = await authApi.doctorVerifyMobileOtp({ mobile_number: mobile, otp: mobileOtp });
      setMobileVerified(!!res.verified);
      if (res.registration_token) setRegistrationToken(res.registration_token);
      if (!res.verified) show('Incorrect mobile OTP. Please try again.', 'error');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Mobile OTP verification failed.', 'error');
    } finally {
      setVerifyingMobile(false);
    }
  }

  async function verifyEmail() {
    setVerifyingEmail(true);
    try {
      const res = await authApi.doctorVerifyEmailOtp({ email, otp: emailOtp });
      setEmailVerified(!!res.verified);
      if (res.registration_token) setRegistrationToken(res.registration_token);
      if (!res.verified) show('Incorrect email OTP. Please try again.', 'error');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Email OTP verification failed.', 'error');
    } finally {
      setVerifyingEmail(false);
    }
  }

  const bothVerified = mobileVerified && emailVerified;

  if (step === 'onboarding' && registrationToken) {
    return (
      <div className="min-h-screen bg-purple-50/50 py-8 px-4">
        <DoctorOnboardingForm registrationToken={registrationToken} mobile={mobile} email={email} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-purple-50/50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-purple-600 mx-auto flex items-center justify-center text-white text-xl shadow-lg shadow-purple-500/30 mb-2">
            <i className="fa-solid fa-user-doctor" />
          </div>
          <h1 className="text-lg font-bold text-purple-950">Doctor Verification</h1>
          <p className="text-xs text-purple-700/80">One Platform for Every Medical Professional</p>
        </div>

        {step === 'credentials' && (
          <form onSubmit={requestOtp} className="space-y-4 bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
            <Input
              label="Mobile Number *"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
            />
            <Input label="Email ID *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@hospital.org" />
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex gap-2.5">
              <i className="fa-solid fa-shield-halved text-purple-600 mt-0.5" />
              <span>Dual verification filters fake signups and keeps the medical network strictly verified.</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="w-1/3" onClick={() => navigate('/')}>
                Back
              </Button>
              <Button type="submit" className="w-2/3" disabled={requesting}>
                {requesting ? 'Sending…' : 'Request Verification OTPs'}
              </Button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <div className="space-y-4 bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
            <OtpBlock
              icon="fa-mobile-screen"
              label="Mobile OTP"
              verified={mobileVerified}
              value={mobileOtp}
              onChange={setMobileOtp}
              onVerify={verifyMobile}
              verifying={verifyingMobile}
              devHint={devHintMobile}
            />
            <OtpBlock
              icon="fa-envelope"
              label="Email OTP"
              verified={emailVerified}
              value={emailOtp}
              onChange={setEmailOtp}
              onVerify={verifyEmail}
              verifying={verifyingEmail}
              devHint={devHintEmail}
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="w-1/3" onClick={() => setStep('credentials')}>
                Back
              </Button>
              <Button
                type="button"
                className="w-2/3"
                disabled={!bothVerified || !registrationToken}
                onClick={() => setStep('onboarding')}
              >
                {bothVerified ? 'Continue to Onboarding Setup' : 'Both OTPs Required'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OtpBlock({
  icon,
  label,
  verified,
  value,
  onChange,
  onVerify,
  verifying,
  devHint,
}: {
  icon: string;
  label: string;
  verified: boolean;
  value: string;
  onChange: (v: string) => void;
  onVerify: () => void;
  verifying: boolean;
  devHint: string | null;
}) {
  return (
    <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-purple-900">
          <i className={`fa-solid ${icon} text-purple-600 mr-1`} /> {label}
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border ${
            verified ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
          }`}
        >
          {verified ? 'Verified' : 'Pending'}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          placeholder="1234"
          disabled={verified}
          className="w-full text-center tracking-[0.4em] font-mono text-lg bg-white border border-purple-300 rounded-lg py-2 focus:border-purple-600 focus:outline-none text-purple-950"
        />
        <Button type="button" onClick={onVerify} disabled={verified || verifying || !value} className="px-4 py-0 text-xs">
          {verifying ? '…' : 'Verify'}
        </Button>
      </div>
      {devHint && <p className="text-[11px] text-purple-500 mt-1">Dev autofill: OTP {devHint} pre-filled from API debug response — still tap Verify.</p>}
    </div>
  );
}
