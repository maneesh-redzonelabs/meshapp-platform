import React from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { PatientHomeStackParamList } from '../../../navigation/types';
import { Button } from '../../../components/ui';
import { colors } from '../../../theme/colors';

type Props = NativeStackScreenProps<PatientHomeStackParamList, 'BookingSuccess'>;

export default function BookingSuccessScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.emoji}>✅</Text>
      <Text style={styles.title}>Appointment booked</Text>
      <Text style={styles.subtitle}>You'll find it under My Appointments → Upcoming.</Text>
      <Button
        title="Back to search"
        onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'PatientHomeMain' }] }))}
        style={{ marginTop: 24, width: 220 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
  subtitle: { color: colors.textMuted, textAlign: 'center' },
});
