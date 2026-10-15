import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, SectionTitle } from '../../../components/ui';
import { colors } from '../../../theme/colors';
import { api } from '../../../lib/apiClient';
import { BookingDraft } from '../../../navigation/types';

type Props = {
  route: { params: { draft: BookingDraft } };
  navigation: { navigate: (screen: string, params: { draft: BookingDraft }) => void };
};

type Slot = { time: string; available: boolean };
type Grouped = { morning: Slot[]; afternoon: Slot[]; evening: Slot[] };

function hourOf(time: string): number {
  const match = /^(\d{1,2}):/.exec(time);
  return match ? Number(match[1]) : 12;
}

// The API spec documents GET /doctors/:id/available-times's query params and
// computation logic, but not the exact JSON shape of the slot list. We
// accept either a flat array of {start_time|time, is_available|available}
// or an already-grouped {morning,afternoon,evening} object, and normalize.
function normalize(data: unknown): Grouped {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const rec = data as Record<string, unknown>;
    if (rec.morning || rec.afternoon || rec.evening) {
      const map = (arr: unknown) => (Array.isArray(arr) ? arr.map((s: any) => ({
        time: s.start_time ?? s.time, available: s.is_available ?? s.available ?? true,
      })) : []);
      return { morning: map(rec.morning), afternoon: map(rec.afternoon), evening: map(rec.evening) };
    }
  }
  const flat = Array.isArray(data) ? data : [];
  const slots: Slot[] = flat.map((s: any) => ({
    time: s.start_time ?? s.time ?? '',
    available: s.is_available ?? s.available ?? true,
  }));
  return {
    morning: slots.filter((s) => hourOf(s.time) >= 9 && hourOf(s.time) < 12),
    afternoon: slots.filter((s) => hourOf(s.time) >= 12 && hourOf(s.time) < 17),
    evening: slots.filter((s) => hourOf(s.time) >= 17),
  };
}

// Fallback synthetic half-hour slots (matches the prototype's demo
// generator) for when the API isn't reachable yet, so the flow stays usable.
function fallbackSlots(): Grouped {
  const gen = (startHour: number, endHour: number) => {
    const out: Slot[] = [];
    for (let h = startHour; h < endHour; h += 1) {
      out.push({ time: `${String(h).padStart(2, '0')}:00`, available: true });
      out.push({ time: `${String(h).padStart(2, '0')}:30`, available: true });
    }
    return out;
  };
  return { morning: gen(9, 12), afternoon: gen(14, 16), evening: gen(18, 21) };
}

export default function BookingTimeScreen({ route, navigation }: Props) {
  const { draft } = route.params;
  const [grouped, setGrouped] = useState<Grouped>({ morning: [], afternoon: [], evening: [] });
  const [selected, setSelected] = useState<string | undefined>(draft.startTime);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/doctors/${draft.doctorId}/available-times`, { date: draft.appointmentDate });
        setGrouped(normalize(data));
      } catch {
        setGrouped(fallbackSlots());
        setUsingFallback(true);
      }
    })();
  }, [draft.doctorId, draft.appointmentDate]);

  function proceed() {
    if (!selected) return;
    navigation.navigate('BookingPayment', { draft: { ...draft, startTime: selected } });
  }

  function renderGroup(label: string, slots: Slot[]) {
    if (slots.length === 0) return null;
    return (
      <View style={{ marginBottom: 16 }}>
        <SectionTitle title={label} />
        <View style={styles.chipsWrap}>
          {slots.map((s) => (
            <Chip key={s.time} label={s.time} selected={selected === s.time} onPress={() => s.available && setSelected(s.time)} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 50, paddingBottom: 100 }}>
        <Text style={styles.title}>Choose a time slot</Text>
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title={draft.doctorName} subtitle={`${draft.appointmentDate} • ${draft.appointmentType === 'video_call' ? 'Video call' : 'In-person'}`} />
        </Card>
        {usingFallback && <Text style={styles.subtle}>Could not reach the API — showing placeholder time slots.</Text>}
        {renderGroup('Morning (9:00 AM – 12:00 PM)', grouped.morning)}
        {renderGroup('Afternoon (2:00 PM – 4:00 PM)', grouped.afternoon)}
        {renderGroup('Evening (6:00 PM – 9:00 PM)', grouped.evening)}
      </ScrollView>
      <View style={styles.footer}>
        <Button title={selected ? `Continue with ${selected}` : 'Pick a time to continue'} disabled={!selected} onPress={proceed} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  subtle: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
});
