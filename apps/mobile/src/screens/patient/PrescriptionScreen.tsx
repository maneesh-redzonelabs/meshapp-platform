import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PatientAppointmentsStackParamList } from '../../navigation/types';
import { Card, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api } from '../../lib/apiClient';
import { Prescription } from '../../types/shared';

type Props = NativeStackScreenProps<PatientAppointmentsStackParamList, 'Prescription'>;

export default function PrescriptionScreen({ route }: Props) {
  const { appointmentId } = route.params;
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Prescription>(`/appointments/${appointmentId}/prescription`);
        setPrescription(data);
      } catch {
        setLoadError(true);
      }
    })();
  }, [appointmentId]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 50 }}>
        <Text style={styles.title}>Prescription</Text>
        {loadError && (
          <Card>
            <Text style={styles.subtle}>No prescription available yet, or the API isn't reachable.</Text>
          </Card>
        )}
        {prescription && (
          <>
            <Card style={{ marginBottom: 14 }}>
              <SectionTitle title="Diagnosis" />
              <Text style={styles.text}>{prescription.diagnosis ?? '—'}</Text>
            </Card>
            <Card style={{ marginBottom: 14 }}>
              <SectionTitle title="Medications" />
              {(prescription.medications ?? []).length === 0 && <Text style={styles.subtle}>None listed.</Text>}
              {(prescription.medications ?? []).map((m, idx) => (
                <View key={idx} style={styles.medRow}>
                  <Text style={styles.medName}>{m.name}</Text>
                  <Text style={styles.subtle}>{m.dosage} • {m.frequency} • {m.duration}</Text>
                </View>
              ))}
            </Card>
            <Card>
              <SectionTitle title="Advice & follow-up" />
              <Text style={styles.text}>{prescription.advice ?? '—'}</Text>
              {prescription.follow_up_date && <Text style={styles.subtle}>Follow-up: {prescription.follow_up_date}</Text>}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  subtle: { color: colors.textMuted, fontSize: 13 },
  text: { color: colors.text, lineHeight: 20 },
  medRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 },
  medName: { fontWeight: '700', color: colors.text },
});
