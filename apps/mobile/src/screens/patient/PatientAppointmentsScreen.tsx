import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PatientAppointmentsStackParamList } from '../../navigation/types';
import { Button, Card, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api } from '../../lib/apiClient';
import { Appointment } from '../../types/shared';

type Props = NativeStackScreenProps<PatientAppointmentsStackParamList, 'PatientAppointmentsMain'>;

type Tab = 'upcoming' | 'completed';

const UPCOMING_STATUSES = ['requested', 'confirmed', 'rescheduled'];

export default function PatientAppointmentsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await api.get<Appointment[]>('/appointments');
      setAppointments(data);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filtered = appointments.filter((a) => (tab === 'upcoming'
    ? UPCOMING_STATUSES.includes(a.status)
    : ['completed', 'no_show', 'cancelled'].includes(a.status)));

  function openReschedule(appt: Appointment) {
    navigation.navigate('BookingDate', {
      draft: {
        doctorId: appt.doctor_id,
        doctorName: appt.doctor_name ?? 'Doctor',
        doctorPhoto: appt.doctor_photo,
        locationId: appt.location_id ?? undefined,
        familyMemberId: appt.family_member_id ?? undefined,
        appointmentType: appt.appointment_type,
        isReschedule: true,
        rescheduleAppointmentId: appt.appointment_id,
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>My Appointments</Text>
      <View style={styles.tabs}>
        <Button title="Upcoming" variant={tab === 'upcoming' ? 'primary' : 'ghost'} onPress={() => setTab('upcoming')} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Completed" variant={tab === 'completed' ? 'primary' : 'ghost'} onPress={() => setTab('completed')} style={{ flex: 1 }} />
      </View>
      {loadError && <Text style={styles.subtle}>Could not reach the API — pull to refresh once the backend is running.</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(a) => a.appointment_id}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loadError ? <Text style={styles.subtle}>No {tab} appointments.</Text> : null}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 12 }}>
            <SectionTitle title={item.doctor_name ?? 'Doctor'} subtitle={`${item.appointment_date} • ${item.start_time}`} />
            <Text style={styles.subtle}>{item.appointment_type === 'video_call' ? 'Video call' : 'In-person'} • Status: {item.status}</Text>
            <View style={styles.actionsRow}>
              {tab === 'upcoming' && (
                <>
                  {item.appointment_type === 'video_call' && (
                    <Button title="Video call" variant="secondary" onPress={() => navigation.navigate('VideoCall', { appointmentId: item.appointment_id })} style={styles.actionBtn} />
                  )}
                  <Button title="Reschedule" variant="secondary" onPress={() => openReschedule(item)} style={styles.actionBtn} />
                </>
              )}
              {tab === 'completed' && (
                <Button title="See prescription" variant="secondary" onPress={() => navigation.navigate('Prescription', { appointmentId: item.appointment_id })} style={styles.actionBtn} />
              )}
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingTop: 50 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16, paddingHorizontal: 16 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 10 },
  subtle: { color: colors.textMuted, fontSize: 13, paddingHorizontal: 16, marginBottom: 10 },
  actionsRow: { flexDirection: 'row', marginTop: 10 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 10 },
});
