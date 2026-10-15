import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, SectionTitle } from '../../../components/ui';
import { colors } from '../../../theme/colors';
import { api, ApiError } from '../../../lib/apiClient';
import { BookingDraft } from '../../../navigation/types';

type Props = {
  route: { params: { draft: BookingDraft } };
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    popToTop: () => void;
  };
};

const PLATFORM_FEE = 49;

const PAYMENT_METHODS = ['Credit/Debit Card', 'UPI / Paytm / PhonePe', 'Net Banking'];

export default function BookingPaymentScreen({ route, navigation }: Props) {
  const { draft } = route.params;
  const [method, setMethod] = useState(PAYMENT_METHODS[1]);
  const [loading, setLoading] = useState(false);

  const consultationFee = draft.appointmentType === 'video_call'
    ? (draft.consultationFeeVideo ?? draft.consultationFeeInPerson ?? 0)
    : (draft.consultationFeeInPerson ?? 0);
  const total = consultationFee + PLATFORM_FEE;

  async function payNow() {
    setLoading(true);
    try {
      if (draft.isReschedule && draft.rescheduleAppointmentId) {
        await api.post(`/appointments/${draft.rescheduleAppointmentId}/reschedule`, {
          appointment_date: draft.appointmentDate,
          start_time: draft.startTime,
        });
        Alert.alert('Rescheduled', 'Your appointment has been rescheduled.');
        navigation.popToTop();
        return;
      }

      const idempotencyKey = `booking-${draft.doctorId}-${draft.appointmentDate}-${draft.startTime}-${Date.now()}`;
      const appointment = await api.post<{ appointment_id: string; payment_id?: string }>(
        '/appointments',
        {
          doctor_id: draft.doctorId,
          location_id: draft.locationId,
          family_member_id: draft.familyMemberId,
          appointment_date: draft.appointmentDate,
          start_time: draft.startTime,
          appointment_type: draft.appointmentType,
        },
        { idempotencyKey },
      );

      if (appointment.payment_id) {
        // Mock "Pay Now" — in the real gateway flow the SDK would collect
        // gateway_payment_id/signature; here we simulate a successful charge.
        await api.post(`/payments/${appointment.payment_id}/confirm`, {
          gateway_payment_id: `MOCK-${Date.now()}`,
          gateway_signature: 'mock-signature',
        });
      }

      navigation.navigate('BookingSuccess', { appointmentId: appointment.appointment_id });
    } catch (err) {
      Alert.alert('Booking failed', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 50, paddingBottom: 40 }}>
        <Text style={styles.title}>{draft.isReschedule ? 'Confirm reschedule' : 'Payment summary'}</Text>
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title="Appointment summary" />
          <Row label="Patient" value={draft.familyMemberName ?? 'Self'} />
          <Row label="Doctor" value={draft.doctorName} />
          <Row label="Date" value={draft.appointmentDate ?? ''} />
          <Row label="Time" value={draft.startTime ?? ''} />
          <Row label="Mode" value={draft.appointmentType === 'video_call' ? 'Video call' : 'In-person'} />
          {!draft.isReschedule && (
            <>
              <Row label="Consultation fee" value={`₹${consultationFee}`} />
              <Row label="Booking service fee" value={`₹${PLATFORM_FEE}`} />
              <Row label="Total" value={`₹${total}`} bold />
            </>
          )}
        </Card>
        {!draft.isReschedule && (
          <Card style={{ marginBottom: 16 }}>
            <SectionTitle title="Payment method" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {PAYMENT_METHODS.map((m) => (
                <Chip key={m} label={m} selected={method === m} onPress={() => setMethod(m)} />
              ))}
            </View>
          </Card>
        )}
        <Button
          title={loading ? 'Processing…' : draft.isReschedule ? 'Confirm reschedule' : `Pay Now ₹${total}`}
          loading={loading}
          onPress={payNow}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontWeight: '800', color: colors.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { color: colors.textMuted },
  rowValue: { color: colors.text, fontWeight: '600' },
});
