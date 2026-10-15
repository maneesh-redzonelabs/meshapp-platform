import React, { useEffect, useState } from 'react';
import { Alert, FlatList, SafeAreaView, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PatientHomeStackParamList } from '../../../navigation/types';
import { Button, Card, SectionTitle } from '../../../components/ui';
import { colors } from '../../../theme/colors';
import { api } from '../../../lib/apiClient';
import { FamilyMember } from '../../../types/shared';

type Props = NativeStackScreenProps<PatientHomeStackParamList, 'BookingFamily'>;

export default function BookingFamilyScreen({ route, navigation }: Props) {
  const { draft } = route.params;
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<FamilyMember[]>('/patients/me/family-members');
        setMembers(data);
      } catch {
        setLoadError(true);
      }
    })();
  }, []);

  function choose(member: FamilyMember) {
    navigation.navigate('BookingMode', {
      draft: { ...draft, familyMemberId: member.family_member_id, familyMemberName: member.full_name },
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Who is this appointment for?</Text>
      <Card style={{ marginBottom: 14 }}>
        <SectionTitle title={draft.doctorName} subtitle={[draft.specialityName, draft.subspecialityName].filter(Boolean).join(' • ')} />
      </Card>
      {loadError && <Text style={styles.subtle}>Could not load family members — try again once the backend is running.</Text>}
      <FlatList
        data={members}
        keyExtractor={(m) => m.family_member_id}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListEmptyComponent={!loadError ? <Text style={styles.subtle}>No family members found.</Text> : null}
        renderItem={({ item }) => (
          <Button
            title={`${item.full_name} (${item.relationship === 'self' ? 'Self' : item.relationship})`}
            variant="secondary"
            onPress={() => choose(item)}
            style={{ marginBottom: 10 }}
          />
        )}
      />
      <Button
        title="Add a new family member"
        variant="ghost"
        onPress={() => Alert.alert('Add from Profile tab', 'Go to Profile > Family Members to add someone new, then come back here.')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 50 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  subtle: { color: colors.textMuted, fontSize: 13, marginBottom: 10 },
});
