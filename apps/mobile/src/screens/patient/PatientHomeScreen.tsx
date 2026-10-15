import React, { useEffect, useState } from 'react';
import {
  FlatList, Image, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PatientHomeStackParamList } from '../../navigation/types';
import { Button, Card, Chip, Input, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api } from '../../lib/apiClient';

type Props = NativeStackScreenProps<PatientHomeStackParamList, 'PatientHomeMain'>;

type Speciality = { speciality_id: number; name: string };

// The API spec doesn't enumerate the exact response field names for
// GET /search/doctors list items (only the query params + backing view are
// documented). We defensively accept either snake_case API fields or the
// prototype's camelCase demo fields and normalize them below.
type RawDoctorResult = Record<string, unknown>;

type DoctorResult = {
  doctorId: string;
  name: string;
  speciality?: string;
  subspeciality?: string;
  photo?: string | null;
  feeInPerson?: number;
  locationId?: string;
};

function normalizeDoctor(raw: RawDoctorResult): DoctorResult {
  return {
    doctorId: String(raw.doctor_id ?? raw.doctorId ?? raw.id ?? ''),
    name: String(raw.full_name ?? raw.name ?? 'Doctor'),
    speciality: (raw.speciality_name ?? raw.speciality) as string | undefined,
    subspeciality: (raw.subspeciality_name ?? raw.subspeciality) as string | undefined,
    photo: (raw.profile_selfie_url ?? raw.photo) as string | null | undefined,
    feeInPerson: (raw.consultation_fee_inperson ?? raw.consultationFee) as number | undefined,
    locationId: (raw.location_id ?? raw.locationId) as string | undefined,
  };
}

export default function PatientHomeScreen({ navigation }: Props) {
  const [pin, setPin] = useState('');
  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [subspecialities, setSubspecialities] = useState<Speciality[]>([]);
  const [specialityId, setSpecialityId] = useState<number | null>(null);
  const [subspecialityId, setSubspecialityId] = useState<number | null>(null);
  const [doctors, setDoctors] = useState<DoctorResult[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Speciality[]>('/search/specialities');
        setSpecialities(data);
      } catch {
        // leave empty, non-fatal
      }
    })();
  }, []);

  useEffect(() => {
    if (!specialityId) { setSubspecialities([]); return; }
    (async () => {
      try {
        const data = await api.get<Speciality[]>(`/search/specialities/${specialityId}/subspecialities`);
        setSubspecialities(data);
      } catch {
        setSubspecialities([]);
      }
    })();
  }, [specialityId]);

  async function findDoctors() {
    setLoadError(false);
    try {
      const data = await api.get<RawDoctorResult[]>('/search/doctors', {
        pin_code: pin || undefined,
        speciality_id: specialityId ?? undefined,
        subspeciality_id: subspecialityId ?? undefined,
      });
      setDoctors(data.map(normalizeDoctor));
    } catch {
      setLoadError(true);
      setDoctors([]);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={doctors}
        keyExtractor={(d) => d.doctorId}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={(
          <>
            <Text style={styles.title}>Find a doctor</Text>
            <Card style={{ marginBottom: 14 }}>
              <SectionTitle title="Location" />
              <Input label="PIN code" keyboardType="number-pad" value={pin} onChangeText={setPin} placeholder="e.g. 400001" />
              <Button title="Update location & find nearby doctors" onPress={findDoctors} />
            </Card>
            <Card style={{ marginBottom: 14 }}>
              <SectionTitle title="Speciality" />
              <View style={styles.chipsWrap}>
                {specialities.map((s) => (
                  <Chip key={s.speciality_id} label={s.name} selected={specialityId === s.speciality_id} onPress={() => { setSpecialityId(s.speciality_id); setSubspecialityId(null); }} />
                ))}
                {specialities.length === 0 && <Text style={styles.subtle}>Speciality list unavailable — start the API to load it.</Text>}
              </View>
              {specialityId != null && subspecialities.length > 0 && (
                <>
                  <Text style={styles.label}>Subspeciality</Text>
                  <View style={styles.chipsWrap}>
                    {subspecialities.map((s) => (
                      <Chip key={s.speciality_id} label={s.name} selected={subspecialityId === s.speciality_id} onPress={() => setSubspecialityId(s.speciality_id)} />
                    ))}
                  </View>
                </>
              )}
              <Button title="Apply filters" variant="secondary" onPress={findDoctors} />
            </Card>
            <SectionTitle title={`Available doctors (${doctors.length})`} />
            {loadError && <Text style={styles.subtle}>Could not reach the API — try again once the backend is running.</Text>}
          </>
        )}
        ListEmptyComponent={!loadError ? <Text style={styles.subtle}>No results yet — set your location and search.</Text> : null}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 12 }}>
            <View style={styles.doctorRow}>
              {item.photo ? (
                <Image source={{ uri: item.photo }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}><Text>🩺</Text></View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.doctorName}>{item.name}</Text>
                <Text style={styles.subtle}>{[item.speciality, item.subspeciality].filter(Boolean).join(' • ')}</Text>
                {item.feeInPerson != null && <Text style={styles.fee}>Consultation fee: ₹{item.feeInPerson}</Text>}
              </View>
            </View>
            <Button
              title="Book appointment"
              onPress={() => navigation.navigate('BookingFamily', {
                draft: {
                  doctorId: item.doctorId,
                  doctorName: item.name,
                  specialityName: item.speciality,
                  subspecialityName: item.subspeciality,
                  doctorPhoto: item.photo,
                  locationId: item.locationId,
                  consultationFeeInPerson: item.feeInPerson,
                },
              })}
            />
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingTop: 50, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { color: colors.text, fontWeight: '600', marginTop: 10, marginBottom: 6, fontSize: 13 },
  subtle: { color: colors.textMuted, fontSize: 13 },
  doctorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { backgroundColor: colors.surfaceTint100, alignItems: 'center', justifyContent: 'center' },
  doctorName: { fontWeight: '700', color: colors.text, fontSize: 15 },
  fee: { color: colors.primary, fontWeight: '600', marginTop: 4, fontSize: 13 },
});
