import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { Button, Card, Chip, Input, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api, ApiError } from '../../lib/apiClient';
import { FamilyMember, Relationship } from '../../types/shared';

const RELATIONSHIPS: Relationship[] = ['spouse', 'son', 'daughter', 'mother', 'father', 'sibling', 'other'];

export default function FamilyMembersScreen() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('spouse');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await api.get<FamilyMember[]>('/patients/me/family-members');
      setMembers(data);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addMember() {
    if (!name) {
      Alert.alert('Missing info', 'Enter a name for this family member.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/patients/me/family-members', {
        full_name: name,
        age: age ? Number(age) : undefined,
        relationship,
      });
      setName('');
      setAge('');
      setShowForm(false);
      await load();
    } catch (err) {
      Alert.alert('Could not add', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={members}
        keyExtractor={(m) => m.family_member_id}
        contentContainerStyle={{ padding: 16, paddingTop: 40, paddingBottom: 60 }}
        ListHeaderComponent={(
          <>
            <Text style={styles.title}>Family members</Text>
            {loadError && <Text style={styles.subtle}>Could not reach the API — try again once the backend is running.</Text>}
            {!showForm ? (
              <Button title="+ Add family member" onPress={() => setShowForm(true)} style={{ marginBottom: 16 }} />
            ) : (
              <Card style={{ marginBottom: 16 }}>
                <SectionTitle title="Add family member" />
                <Input label="Full name" value={name} onChangeText={setName} />
                <Input label="Age" keyboardType="number-pad" value={age} onChangeText={setAge} />
                <Text style={styles.label}>Relationship</Text>
                <View style={styles.chipsWrap}>
                  {RELATIONSHIPS.map((r) => (
                    <Chip key={r} label={r} selected={relationship === r} onPress={() => setRelationship(r)} />
                  ))}
                </View>
                <Button title="Save" loading={saving} onPress={addMember} />
                <View style={{ height: 8 }} />
                <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
              </Card>
            )}
          </>
        )}
        ListEmptyComponent={!loadError ? <Text style={styles.subtle}>No family members yet.</Text> : null}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <Text style={styles.memberName}>{item.full_name}</Text>
            <Text style={styles.subtle}>{item.relationship === 'self' ? 'Self' : item.relationship}{item.age ? ` • ${item.age} yrs` : ''}</Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  subtle: { color: colors.textMuted, fontSize: 13, marginBottom: 10 },
  label: { color: colors.text, fontWeight: '600', marginBottom: 6, marginTop: 4, fontSize: 13 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  memberName: { fontWeight: '700', color: colors.text, fontSize: 15 },
});
