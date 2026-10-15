import React from 'react';
import {
  Alert, Pressable, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Card } from '../../components/ui';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RoleSelect'>;

const ROLES: Array<{ key: string; label: string; emoji: string; enabled: boolean }> = [
  { key: 'doctor', label: 'Doctor', emoji: '🩺', enabled: true },
  { key: 'patient', label: 'Patient', emoji: '🧑‍⚕️', enabled: true },
  { key: 'mr', label: 'Medical Rep', emoji: '💼', enabled: false },
  { key: 'paramedical', label: 'Paramedical', emoji: '🧪', enabled: false },
  { key: 'supplier', label: 'Supplier', emoji: '📦', enabled: false },
];

export default function RoleSelectScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.brand}>MeshApp AI</Text>
        <Text style={styles.tagline}>Doctors Professional Partner</Text>
      </View>
      <View style={styles.grid}>
        {ROLES.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => {
              if (!r.enabled) {
                Alert.alert('Coming soon', `${r.label} role is not available in this build yet.`);
                return;
              }
              if (r.key === 'doctor') navigation.navigate('DoctorAuth');
              if (r.key === 'patient') navigation.navigate('PatientAuth');
            }}
            style={({ pressed }) => [pressed && { opacity: 0.8 }]}
          >
            <Card style={[styles.tile, !r.enabled && styles.tileDisabled]}>
              <Text style={styles.tileEmoji}>{r.emoji}</Text>
              <Text style={styles.tileLabel}>{r.label}</Text>
              {!r.enabled && <Text style={styles.soon}>Coming soon</Text>}
            </Card>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDark },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 30 },
  brand: { fontSize: 30, fontWeight: '800', color: colors.white },
  tagline: { fontSize: 13, color: colors.accent, marginTop: 6 },
  grid: {
    flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    paddingHorizontal: 16, gap: 14, alignContent: 'flex-start',
  },
  tile: { width: 150, alignItems: 'center', paddingVertical: 24 },
  tileDisabled: { opacity: 0.5 },
  tileEmoji: { fontSize: 34, marginBottom: 8 },
  tileLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  soon: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
});
