import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Button, Card, Chip, Input, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Gender } from '../../types/shared';

type Props = NativeStackScreenProps<RootStackParamList, 'PatientAuth'>;

type Mode = 'register' | 'login';

function extractDebugOtp(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const rec = data as Record<string, unknown>;
  for (const k of ['debug_otp', 'otp_debug']) {
    if (typeof rec[k] === 'string') return rec[k] as string;
  }
  return undefined;
}

export default function PatientAuthScreen(_props: Props) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('register');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('prefer_not_to_say');
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);

  const [loginMobile, setLoginMobile] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginOtpRequested, setLoginOtpRequested] = useState(false);

  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    if (!firstName || !lastName || !mobile || !pin) {
      Alert.alert('Missing info', 'Please fill in your name, mobile number, and PIN code.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<Record<string, unknown>>(
        '/auth/patient/register/request-otp',
        { first_name: firstName, last_name: lastName, age: age ? Number(age) : undefined, gender, mobile_number: mobile, pin_code: pin },
        { auth: false },
      );
      const debugOtp = extractDebugOtp(data);
      if (debugOtp) setOtp(debugOtp);
      setOtpRequested(true);
    } catch (err) {
      Alert.alert('Could not send OTP', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    try {
      const data = await api.post<{ access_token: string; refresh_token: string }>(
        '/auth/patient/register/verify-otp',
        { mobile_number: mobile, otp },
        { auth: false },
      );
      await signIn('patient', data.access_token, data.refresh_token);
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
      const debugOtp = extractDebugOtp(data);
      if (debugOtp) setLoginOtp(debugOtp);
      setLoginOtpRequested(true);
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
      await signIn('patient', data.access_token, data.refresh_token);
    } catch (err) {
      Alert.alert('Invalid OTP', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const genders: Gender[] = ['male', 'female', 'other', 'prefer_not_to_say'];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Patient Sign In</Text>

          <View style={styles.tabs}>
            <Button title="New patient" variant={mode === 'register' ? 'primary' : 'ghost'} onPress={() => setMode('register')} style={{ flex: 1, marginRight: 8 }} />
            <Button title="Log in" variant={mode === 'login' ? 'primary' : 'ghost'} onPress={() => setMode('login')} style={{ flex: 1 }} />
          </View>

          {mode === 'register' && (
            <Card>
              {!otpRequested ? (
                <>
                  <SectionTitle title="Your details" />
                  <Input label="First name" value={firstName} onChangeText={setFirstName} />
                  <Input label="Last name" value={lastName} onChangeText={setLastName} />
                  <Input label="Age" keyboardType="number-pad" value={age} onChangeText={setAge} />
                  <Text style={styles.label}>Gender</Text>
                  <View style={styles.chipsWrap}>
                    {genders.map((g) => (
                      <Chip key={g} label={g.replace(/_/g, ' ')} selected={gender === g} onPress={() => setGender(g)} />
                    ))}
                  </View>
                  <Input label="Mobile number" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} placeholder="+91 9XXXXXXXXX" />
                  <Input label="PIN code" keyboardType="number-pad" value={pin} onChangeText={setPin} placeholder="e.g. 400001" />
                  <Button title="Send OTP" loading={loading} onPress={requestOtp} />
                </>
              ) : (
                <>
                  <SectionTitle title="Verify OTP" subtitle={`Code sent to ${mobile}`} />
                  <Input label="OTP" keyboardType="number-pad" value={otp} onChangeText={setOtp} placeholder="6-digit code" />
                  <Button title="Verify and continue" loading={loading} onPress={verifyOtp} />
                </>
              )}
            </Card>
          )}

          {mode === 'login' && (
            <Card>
              {!loginOtpRequested ? (
                <>
                  <SectionTitle title="Log in with mobile OTP" />
                  <Input label="Mobile number" keyboardType="phone-pad" value={loginMobile} onChangeText={setLoginMobile} />
                  <Button title="Send OTP" loading={loading} onPress={requestLoginOtp} />
                </>
              ) : (
                <>
                  <SectionTitle title="Enter OTP" subtitle={`Code sent to ${loginMobile}`} />
                  <Input label="OTP" keyboardType="number-pad" value={loginOtp} onChangeText={setLoginOtp} />
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
  label: { color: colors.text, fontWeight: '600', marginBottom: 6, fontSize: 13 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
});
