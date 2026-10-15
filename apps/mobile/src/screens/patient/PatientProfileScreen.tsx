import React, { useEffect, useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PatientProfileStackParamList } from '../../navigation/types';
import { Button, Card, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { FamilyMember, PatientProfile } from '../../types/shared';

type Props = NativeStackScreenProps<PatientProfileStackParamList, 'PatientProfileMain'>;

export default function PatientProfileScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [familyCount, setFamilyCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get<PatientProfile>('/patients/me');
        setProfile(me);
      } catch {
        // non-fatal
      }
      try {
        const members = await api.get<FamilyMember[]>('/patients/me/family-members');
        setFamilyCount(members.length);
      } catch {
        // non-fatal
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 50, paddingBottom: 60 }}>
        <View style={styles.header}>
          {profile?.profile_photo_url ? (
            <Image source={{ uri: profile.profile_photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={{ fontSize: 26 }}>🧑</Text></View>
          )}
          <View style={{ marginLeft: 14 }}>
            <Text style={styles.name}>{profile ? `${profile.first_name} ${profile.last_name}` : 'Your profile'}</Text>
            <Text style={styles.subtle}>{profile?.gender ?? ''}</Text>
          </View>
        </View>

        <Card style={{ marginBottom: 14 }}>
          <View style={styles.rowBetween}>
            <SectionTitle title={`Family members (${familyCount})`} />
            <Button title="Manage" onPress={() => navigation.navigate('FamilyMembers')} style={styles.smallBtn} />
          </View>
          <Text style={styles.subtle}>Add family members so you can book appointments on their behalf.</Text>
        </Card>

        <Button title="Log out" variant="danger" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { backgroundColor: colors.surfaceTint100, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  subtle: { color: colors.textMuted, fontSize: 13 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 14 },
});
