import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Image, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DoctorHomeStackParamList } from '../../navigation/types';
import { Button, Card, Input, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api, ApiError } from '../../lib/apiClient';
import { DoctorAchievement, DoctorProfile, DoctorPublication } from '../../types/shared';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<DoctorHomeStackParamList, 'DoctorHomeMain'>;

export default function DoctorHomeScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [achievements, setAchievements] = useState<DoctorAchievement[]>([]);
  const [publications, setPublications] = useState<DoctorPublication[]>([]);
  const [bio, setBio] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const me = await api.get<DoctorProfile>('/doctors/me');
      setProfile(me);
      setBio(me.bio ?? '');
      const [ach, pubs] = await Promise.all([
        api.get<DoctorAchievement[]>(`/doctors/${me.doctor_id}/achievements`).catch(() => []),
        api.get<DoctorPublication[]>(`/doctors/${me.doctor_id}/publications`).catch(() => []),
      ]);
      setAchievements(ach);
      setPublications(pubs);
    } catch (err) {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function saveBio() {
    try {
      await api.patch('/doctors/me', { bio });
      Alert.alert('Saved', 'Your about section was updated.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.profileHeader}>
          {profile?.profile_selfie_url ? (
            <Image source={{ uri: profile.profile_selfie_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={{ fontSize: 28 }}>🩺</Text></View>
          )}
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={styles.name}>{profile?.full_name ?? 'Your profile'}</Text>
            <Text style={styles.specialityText}>
              {profile?.speciality_name ?? '—'}{profile?.subspeciality_name ? ` • ${profile.subspeciality_name}` : ''}
            </Text>
            <Text style={styles.verifyBadge}>
              {profile?.verification_status === 'verified' ? '✅ Verified' : `Status: ${profile?.verification_status ?? 'unknown'}`}
            </Text>
          </View>
        </View>

        {loadError && (
          <Card style={{ marginBottom: 14 }}>
            <Text style={styles.subtle}>Could not reach the API — showing empty state. Pull to refresh once the backend is running.</Text>
          </Card>
        )}

        <Card style={{ marginBottom: 14 }}>
          <SectionTitle title="About" />
          <Input value={bio} onChangeText={setBio} placeholder="Tell patients about your practice…" multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: 'top' }} />
          <Button title="Save about" onPress={saveBio} variant="secondary" />
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <View style={styles.rowBetween}>
            <SectionTitle title={`Achievements (${achievements.length})`} />
            <Button title="+ Add" onPress={() => navigation.navigate('DoctorAchievements')} style={styles.smallBtn} />
          </View>
          {achievements.length === 0 && <Text style={styles.subtle}>No achievements added yet.</Text>}
          {achievements.map((a) => (
            <View key={a.achievement_id} style={styles.listItem}>
              <Text style={styles.listItemTitle}>{a.achievement_text}</Text>
              <Text style={styles.subtle}>{[a.awarding_body, a.achievement_year].filter(Boolean).join(' • ')}</Text>
            </View>
          ))}
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <View style={styles.rowBetween}>
            <SectionTitle title={`Publications (${publications.length})`} />
            <Button title="+ Add" onPress={() => navigation.navigate('DoctorPublications')} style={styles.smallBtn} />
          </View>
          {publications.length === 0 && <Text style={styles.subtle}>No publications added yet.</Text>}
          {publications.map((p) => (
            <View key={p.publication_id} style={styles.listItem}>
              <Text style={styles.listItemTitle}>{p.title}</Text>
              <Text style={styles.subtle}>{[p.journal_name, p.publication_year].filter(Boolean).join(' • ')}</Text>
            </View>
          ))}
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <SectionTitle title="Affiliations" />
          <Text style={styles.subtle}>Coming soon — affiliations management isn't wired up in this build yet.</Text>
        </Card>

        <Button title="Log out" variant="danger" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingTop: 50, paddingBottom: 60 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { backgroundColor: colors.surfaceTint100, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 19, fontWeight: '800', color: colors.text },
  specialityText: { color: colors.textMuted, marginTop: 2 },
  verifyBadge: { color: colors.primary, marginTop: 4, fontWeight: '600', fontSize: 12.5 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  subtle: { color: colors.textMuted, fontSize: 13 },
  listItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
  listItemTitle: { fontWeight: '600', color: colors.text, marginBottom: 2 },
});
