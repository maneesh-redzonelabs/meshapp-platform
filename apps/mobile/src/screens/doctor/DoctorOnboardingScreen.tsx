import React, { useEffect, useState } from 'react';
import {
  Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Button, Card, Chip, Input, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DoctorOnboarding'>;

type Speciality = { speciality_id: number; name: string };

export default function DoctorOnboardingScreen(_props: Props) {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');

  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [subspecialities, setSubspecialities] = useState<Speciality[]>([]);
  const [specialityId, setSpecialityId] = useState<number | null>(null);
  const [subspecialityId, setSubspecialityId] = useState<number | null>(null);
  const [specialitiesError, setSpecialitiesError] = useState(false);

  const [gradCollege, setGradCollege] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [pgCollege, setPgCollege] = useState('');
  const [pgYear, setPgYear] = useState('');

  const [clinicName, setClinicName] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Speciality[]>('/search/specialities', undefined, false);
        setSpecialities(data);
      } catch {
        setSpecialitiesError(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!specialityId) {
      setSubspecialities([]);
      return;
    }
    (async () => {
      try {
        const data = await api.get<Speciality[]>(
          `/search/specialities/${specialityId}/subspecialities`,
          undefined,
          false,
        );
        setSubspecialities(data);
      } catch {
        setSubspecialities([]);
      }
    })();
  }, [specialityId]);

  async function pickSelfie(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'MeshApp needs this permission to set your profile selfie.');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelfieUri(result.assets[0].uri);
    }
  }

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Location access is required to pin your clinic.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
    } catch {
      Alert.alert('Could not get location', 'Please try again, or enter coordinates manually.');
    } finally {
      setLocating(false);
    }
  }

  async function uploadSelfieAndGetUploadId(): Promise<string | undefined> {
    if (!selfieUri) return undefined;
    try {
      const presign = await api.post<{ upload_id: string; upload_url: string }>(
        '/uploads/presign',
        { purpose: 'doctor_selfie', mime_type: 'image/jpeg' },
        { auth: false },
      );
      const fileResponse = await fetch(selfieUri);
      const blob = await fileResponse.blob();
      await fetch(presign.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      return presign.upload_id;
    } catch (err) {
      console.warn('Selfie upload failed, continuing without it', err);
      return undefined;
    }
  }

  async function submit() {
    if (!fullName || !specialityId || !subspecialityId || !gradCollege || !gradYear || !clinicName || lat == null || lng == null) {
      Alert.alert('Missing info', 'Please fill in name, speciality, graduation details, and clinic location.');
      return;
    }
    setLoading(true);
    try {
      const selfieUploadId = await uploadSelfieAndGetUploadId();
      const education = [
        { education_level: 'graduation', degree_name: 'MBBS', college_name_other: gradCollege, passing_year: Number(gradYear) },
        ...(pgCollege && pgYear
          ? [{ education_level: 'post_graduation', degree_name: 'MD/MS', college_name_other: pgCollege, passing_year: Number(pgYear) }]
          : []),
      ];
      const data = await api.post<{ access_token: string; refresh_token: string }>(
        '/auth/doctor/register/complete-profile',
        {
          full_name: fullName,
          speciality_id: specialityId,
          subspeciality_id: subspecialityId,
          education,
          clinic_location: { name: clinicName, lat, lng },
          selfie_upload_id: selfieUploadId,
        },
        { auth: false },
      );
      await signIn('doctor', data.access_token, data.refresh_token);
    } catch (err) {
      Alert.alert('Could not complete profile', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Set up your doctor profile</Text>

        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title="Profile selfie" subtitle="Required for verification" />
          <View style={styles.selfieRow}>
            {selfieUri ? (
              <Image source={{ uri: selfieUri }} style={styles.selfiePreview} />
            ) : (
              <View style={[styles.selfiePreview, styles.selfiePlaceholder]}>
                <Text style={{ fontSize: 28 }}>🙂</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Button title="Take photo" onPress={() => pickSelfie(true)} style={{ marginBottom: 8 }} />
              <Button title="Choose from library" variant="secondary" onPress={() => pickSelfie(false)} />
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title="Basic details" />
          <Input label="Full name" value={fullName} onChangeText={setFullName} placeholder="Dr. Jane Doe" />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title="Speciality" subtitle={specialitiesError ? 'Could not load list from API — the API may not be running yet.' : undefined} />
          <View style={styles.chipsWrap}>
            {specialities.map((s) => (
              <Chip key={s.speciality_id} label={s.name} selected={specialityId === s.speciality_id} onPress={() => { setSpecialityId(s.speciality_id); setSubspecialityId(null); }} />
            ))}
          </View>
          {specialityId != null && (
            <>
              <Text style={[styles.label]}>Subspeciality</Text>
              <View style={styles.chipsWrap}>
                {subspecialities.map((s) => (
                  <Chip key={s.speciality_id} label={s.name} selected={subspecialityId === s.speciality_id} onPress={() => setSubspecialityId(s.speciality_id)} />
                ))}
                {subspecialities.length === 0 && <Text style={styles.label}>No subspecialities found for this speciality.</Text>}
              </View>
            </>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title="Education" />
          <Input label="Graduation college (MBBS)" value={gradCollege} onChangeText={setGradCollege} placeholder="e.g. AIIMS Delhi" />
          <Input label="Graduation passing year" keyboardType="number-pad" value={gradYear} onChangeText={setGradYear} placeholder="2012" />
          <Input label="PG college (optional)" value={pgCollege} onChangeText={setPgCollege} placeholder="e.g. KEM Hospital" />
          <Input label="PG passing year (optional)" keyboardType="number-pad" value={pgYear} onChangeText={setPgYear} placeholder="2016" />
        </Card>

        <Card style={{ marginBottom: 24 }}>
          <SectionTitle title="Clinic location" />
          <Input label="Clinic / hospital name" value={clinicName} onChangeText={setClinicName} placeholder="e.g. City Care Clinic" />
          <Button title={locating ? 'Locating…' : 'Use my current location'} variant="secondary" onPress={useCurrentLocation} loading={locating} />
          {lat != null && lng != null && (
            <Text style={styles.coords}>Pinned: {lat.toFixed(5)}, {lng.toFixed(5)}</Text>
          )}
        </Card>

        <Button title="Finish setup" loading={loading} onPress={submit} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingTop: 50, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 18 },
  selfieRow: { flexDirection: 'row', alignItems: 'center' },
  selfiePreview: { width: 84, height: 84, borderRadius: 42 },
  selfiePlaceholder: { backgroundColor: colors.surfaceTint100, alignItems: 'center', justifyContent: 'center' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  label: { color: colors.text, fontWeight: '600', marginTop: 10, marginBottom: 6, fontSize: 13 },
  coords: { marginTop: 10, color: colors.textMuted, fontSize: 13 },
});
