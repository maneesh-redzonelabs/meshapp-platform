import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Button, Card, SectionTitle } from '../../../components/ui';
import { colors } from '../../../theme/colors';
import { BookingDraft } from '../../../navigation/types';

// Reused from both the patient-home booking flow and the appointments
// reschedule flow, which have structurally identical 'BookingDate' routes
// but live in two separate navigators — typed loosely on purpose.
type Props = {
  route: { params: { draft: BookingDraft } };
  navigation: { navigate: (screen: string, params: { draft: BookingDraft }) => void };
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingDateScreen({ route, navigation }: Props) {
  const { draft } = route.params;
  const [selectedDate, setSelectedDate] = useState(draft.appointmentDate ?? '');

  function onDayPress(day: DateData) {
    setSelectedDate(day.dateString);
  }

  function proceed() {
    navigation.navigate('BookingTime', { draft: { ...draft, appointmentDate: selectedDate } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Choose a date</Text>
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle title={draft.doctorName} subtitle={draft.appointmentType === 'video_call' ? 'Video call' : 'In-person visit'} />
      </Card>
      <Calendar
        minDate={todayStr()}
        onDayPress={onDayPress}
        markedDates={selectedDate ? { [selectedDate]: { selected: true, selectedColor: colors.primary } } : {}}
        theme={{
          selectedDayBackgroundColor: colors.primary,
          todayTextColor: colors.primary,
          arrowColor: colors.primary,
        }}
      />
      <Button
        title={selectedDate ? `Continue with ${selectedDate}` : 'Pick a date to continue'}
        disabled={!selectedDate}
        onPress={proceed}
        style={{ marginTop: 20 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 50 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
});
