import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DoctorHomeStackParamList } from '../../navigation/types';
import { Button, Card, Input, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api, ApiError } from '../../lib/apiClient';
import { runComplianceScan } from '../../lib/compliance';
import { ComplianceModal } from '../../components/ComplianceModal';
import { ComplianceViolation } from '../../types/shared';

type Props = NativeStackScreenProps<DoctorHomeStackParamList, 'DoctorAchievements'>;

export default function DoctorAchievementsScreen({ navigation }: Props) {
  const [text, setText] = useState('');
  const [year, setYear] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [violations, setViolations] = useState<ComplianceViolation[] | null>(null);

  async function submit() {
    if (!text) {
      Alert.alert('Missing info', 'Describe the achievement first.');
      return;
    }
    setLoading(true);
    try {
      const scan = await runComplianceScan('doctor_achievement', text);
      if (scan.verdict !== 'passed') {
        setViolations(scan.violations);
        return;
      }
      await api.post('/doctors/me/achievements', {
        achievement_text: text,
        achievement_year: year ? Number(year) : undefined,
        awarding_body: body || undefined,
        compliance_scan_id: scan.scan_id,
      });
      Alert.alert('Added', 'Achievement saved to your profile.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Add achievement</Text>
        <Card>
          <SectionTitle title="Details" subtitle="This will be scanned against NMC content-compliance rules before saving." />
          <Input label="Achievement" value={text} onChangeText={setText} placeholder="e.g. Best paper award at the National Cardiology Conference" multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} />
          <Input label="Year" keyboardType="number-pad" value={year} onChangeText={setYear} placeholder="2024" />
          <Input label="Awarding body" value={body} onChangeText={setBody} placeholder="e.g. Indian Cardiology Society" />
          <Button title="Scan and save" loading={loading} onPress={submit} />
        </Card>
      </ScrollView>
      <ComplianceModal
        visible={!!violations}
        violations={violations ?? []}
        onDismiss={() => setViolations(null)}
        onEditAndRescan={() => setViolations(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingTop: 40 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
});
