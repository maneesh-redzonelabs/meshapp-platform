import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Button, Card, Input, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DoctorAuth'>;

type Mode = 'register' | 'login';
type RegisterStep = 'details' | 'verifyMobile' | 'verifyEmail';
type LoginStep = 'mobile' | 'otp';

// Dev convenience: if the API includes a debug_otp-shaped field anywhere in
// the request-otp response (not formally documented, but called out in the
// task brief as a possibility), auto-fill the matching OTP input. The user
// must still tap Verify.
function extractDebugOtp(data: unknown, key: string): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const rec = data as Record<string, unknown>;
  const candidates = [key, 'debug_otp', `${key}_debug_otp`, `debug_${key}`];
  for (const c of candidates) {
    if (typeof rec[c] === 'string') return rec[c] as string;
  }
  return undefined;
}

export default function DoctorAuthScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('register');

  // Registration state
  const [regStep, setRegStep] = useState<RegisterStep>('details');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);

  // Login state
  const [loginStep, setLoginStep] = useState<LoginStep>('mobile');
  const [loginMobile, setLoginMobile] = useState('');
  const [loginOtp, setLoginOtp] = useState('');

  const [loading, setLoading] = useState(false);

  async function requestRegistrationOtp() {
    if (!mobile || !email) {
      Alert.alert('Missing info', 'Enter both mobile number and email to continue.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<Record<string, unknown>>(
        '/auth/doctor/register/request-otp',
        { mobile_number: mobile, email },
        { auth: false },
      );
      const debugMobileOtp = extractDebugOtp(data, 'mobile_otp');
      if (debugMobileOtp) setMobileOtp(debugMobileOtp);
      setRegStep('verifyMobile');
    } catch (err) {
      Alert.alert('Could not send OTP', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyMobileOtp() {
    setLoading(true);
    try {
      const data = await api.post<Record<string, unknown>>(
        '/auth/doctor/register/verify-mobile-otp',
        { mobile_number: mobile, otp: mobileOtp },
        { auth: false },
      );
      const debugEmailOtp = extractDebugOtp(data, 'email_otp');
      if (debugEmailOtp) setEmailOtp(debugEmailOtp);
      setMobileVerified(true);
      setRegStep('verifyEmail');
    } catch (err) {
      Alert.alert('Invalid OTP', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmailOtp() {
    setLoading(true);
    try {
      await api.post<Record<string, unknown>>(
        '/auth/doctor/register/verify-email-otp',
        { email, otp: emailOtp },
        { auth: false },
      );
      Alert.alert('Verified', 'Mobile and email verified. Let’s finish setting up your profile.');
      navigation.navigate('DoctorOnboarding', undefined);
    } catch (err) {
      Alert.alert('Invalid OTP', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function requestLoginOtp() {
    if (!loginMobile) {
      Alert.alert('Missing info', 'Enter your registered mobile number.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<Record<string, unknown>>(
        '/auth/login/request-otp',
        { mobile_number: loginMobile },
        { auth: false },
      );
      const debugOtp = extractDebugOtp(data, 'otp');
      if (debugOtp) setLoginOtp(debugOtp);
      setLoginStep('otp');
    } catch (err) {
      Alert.alert('Could not send OTP', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyLoginOtp() {
    setLoading(true);
    try {
      const data = await api.post<{ access_token: string; refresh_token: string }>(
        '/auth/login/verify-otp',
        { mobile_number: loginMobile, otp: loginOtp, device_type: Platform.OS },
        { auth: false },
      );
      await signIn('doctor', data.access_token, data.refresh_token);
    } catch (err) {
      Alert.alert('Invalid OTP', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Doctor Sign In</Text>

          <View style={styles.tabs}>
            <Button
              title="New registration"
              variant={mode === 'register' ? 'primary' : 'ghost'}
              onPress={() => setMode('register')}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title="Log in"
              variant={mode === 'login' ? 'primary' : 'ghost'}
              onPress={() => setMode('login')}
              style={{ flex: 1 }}
            />
          </View>

          {mode === 'register' && (
            <Card>
              {regStep === 'details' && (
                <>
                  <SectionTitle title="Verify your identity" subtitle="We'll send separate OTPs to your mobile and email." />
                  <Input label="Mobile number" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} placeholder="+91 9XXXXXXXXX" />
                  <Input label="Email address" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} placeholder="you@hospital.com" />
                  <Button title="Send OTPs" loading={loading} onPress={requestRegistrationOtp} />
                </>
              )}
              {regStep === 'verifyMobile' && (
                <>
                  <SectionTitle title="Verify mobile OTP" subtitle={`Code sent to ${mobile}`} />
                  <Input label="Mobile OTP" keyboardType="number-pad" value={mobileOtp} onChangeText={setMobileOtp} placeholder="6-digit code" />
                  <Button title="Verify" loading={loading} onPress={verifyMobileOtp} />
                </>
              )}
              {regStep === 'verifyEmail' && (
                <>
                  <SectionTitle title="Verify email OTP" subtitle={`Code sent to ${email}${mobileVerified ? ' • mobile verified' : ''}`} />
                  <Input label="Email OTP" keyboardType="number-pad" value={emailOtp} onChangeText={setEmailOtp} placeholder="6-digit code" />
                  <Button title="Verify and continue" loading={loading} onPress={verifyEmailOtp} />
                </>
              )}
            </Card>
          )}

          {mode === 'login' && (
            <Card>
              {loginStep === 'mobile' && (
                <>
                  <SectionTitle title="Log in with mobile OTP" />
                  <Input label="Mobile number" keyboardType="phone-pad" value={loginMobile} onChangeText={setLoginMobile} placeholder="+91 9XXXXXXXXX" />
                  <Button title="Send OTP" loading={loading} onPress={requestLoginOtp} />
                </>
              )}
              {loginStep === 'otp' && (
                <>
                  <SectionTitle title="Enter OTP" subtitle={`Code sent to ${loginMobile}`} />
                  <Input label="OTP" keyboardType="number-pad" value={loginOtp} onChangeText={setLoginOtp} placeholder="6-digit code" />
                  <Button title="Verify and log in" loading={loading} onPress={verifyLoginOtp} />
                </>
              )}
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingTop: 50 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 18 },
  tabs: { flexDirection: 'row', marginBottom: 18 },
});
