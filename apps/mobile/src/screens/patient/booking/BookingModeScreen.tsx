import React from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PatientHomeStackParamList } from '../../../navigation/types';
import { Button, Card, SectionTitle } from '../../../components/ui';
import { colors } from '../../../theme/colors';

type Props = NativeStackScreenProps<PatientHomeStackParamList, 'BookingMode'>;

export default function BookingModeScreen({ route, navigation }: Props) {
  const { draft } = route.params;

  function choose(mode: 'in_person' | 'video_call') {
    navigation.navigate('BookingDate', { draft: { ...draft, appointmentType: mode } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Appointment mode</Text>
      <Card style={{ marginBottom: 20 }}>
        <SectionTitle title={draft.doctorName} subtitle={`For ${draft.familyMemberName ?? 'Self'}`} />
      </Card>
      <Button title="🏥 In-person visit" onPress={() => choose('in_person')} style={{ marginBottom: 14 }} />
      <Button title="📹 Video call" variant="secondary" onPress={() => choose('video_call')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 50 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
});
