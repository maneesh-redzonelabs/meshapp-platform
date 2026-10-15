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

type Props = NativeStackScreenProps<DoctorHomeStackParamList, 'DoctorPublications'>;

export default function DoctorPublicationsScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [journal, setJournal] = useState('');
  const [year, setYear] = useState('');
  const [doi, setDoi] = useState('');
  const [loading, setLoading] = useState(false);
  const [violations, setViolations] = useState<ComplianceViolation[] | null>(null);

  async function submit() {
    if (!title) {
      Alert.alert('Missing info', 'Enter the publication title first.');
      return;
    }
    setLoading(true);
    try {
      const scan = await runComplianceScan('doctor_publication', `${title}. ${journal}`);
      if (scan.verdict !== 'passed') {
        setViolations(scan.violations);
        return;
      }
      await api.post('/doctors/me/publications', {
        title,
        journal_name: journal || undefined,
        publication_year: year ? Number(year) : undefined,
        doi: doi || undefined,
        compliance_scan_id: scan.scan_id,
      });
      Alert.alert('Added', 'Publication saved to your profile.');
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
        <Text style={styles.title}>Add publication</Text>
        <Card>
          <SectionTitle title="Details" subtitle="This will be scanned against NMC content-compliance rules before saving." />
          <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Outcomes of early PCI in STEMI patients" />
          <Input label="Journal name" value={journal} onChangeText={setJournal} placeholder="e.g. Indian Heart Journal" />
          <Input label="Year" keyboardType="number-pad" value={year} onChangeText={setYear} placeholder="2023" />
          <Input label="DOI (optional)" value={doi} onChangeText={setDoi} placeholder="10.xxxx/xxxxx" autoCapitalize="none" />
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
