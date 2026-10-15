import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Image, RefreshControl, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { Button, Card, Chip, Input, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';
import { api, ApiError } from '../../lib/apiClient';
import { runComplianceScan } from '../../lib/compliance';
import { ComplianceModal } from '../../components/ComplianceModal';
import { ComplianceViolation, Post, VisibilityScope } from '../../types/shared';

const SCOPES: { key: VisibilityScope; label: string }[] = [
  { key: 'public', label: 'Public' },
  { key: 'network_only', label: 'Network only' },
  { key: 'community_only', label: 'Community only' },
  { key: 'private', label: 'Private' },
];

export default function DoctorPostsScreen() {
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<VisibilityScope>('public');
  const [posting, setPosting] = useState(false);
  const [violations, setViolations] = useState<ComplianceViolation[] | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await api.get<Post[]>('/feed');
      setPosts(data);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  async function onRefresh() {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }

  async function createPost() {
    if (!content.trim()) {
      Alert.alert('Empty post', 'Write something before posting.');
      return;
    }
    setPosting(true);
    try {
      const scan = await runComplianceScan('post', content);
      if (scan.verdict !== 'passed') {
        setViolations(scan.violations);
        return;
      }
      await api.post('/posts', {
        content,
        visibility_scope: scope,
        post_type: 'general',
        compliance_scan_id: scan.scan_id,
      });
      setContent('');
      await loadFeed();
    } catch (err) {
      Alert.alert('Could not post', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(post: Post) {
    try {
      if (post.liked_by_me) {
        await api.delete(`/posts/${post.post_id}/likes`);
      } else {
        await api.post(`/posts/${post.post_id}/likes`);
      }
      setPosts((prev) => prev.map((p) => (p.post_id === post.post_id
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) }
        : p)));
    } catch (err) {
      Alert.alert('Could not update like', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.post_id}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={(
          <>
            <Text style={styles.title}>Posts & Feed</Text>
            <Card style={{ marginBottom: 16 }}>
              <SectionTitle title="Create a post" subtitle="Every post is scanned for NMC content compliance before publishing." />
              <Input value={content} onChangeText={setContent} placeholder="Share a clinical case, update, or opinion…" multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: 'top' }} />
              <View style={styles.chipsWrap}>
                {SCOPES.map((s) => (
                  <Chip key={s.key} label={s.label} selected={scope === s.key} onPress={() => setScope(s.key)} />
                ))}
              </View>
              <Button title="Scan and post" loading={posting} onPress={createPost} />
            </Card>
            {loadError && (
              <Card style={{ marginBottom: 14 }}>
                <Text style={styles.subtle}>Could not reach the API — feed is empty until the backend is running.</Text>
              </Card>
            )}
            <SectionTitle title="Feed" />
          </>
        )}
        ListEmptyComponent={!loadError ? <Text style={styles.subtle}>No posts yet. Be the first to share something.</Text> : null}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 12 }}>
            <View style={styles.postHeader}>
              {item.author_photo ? (
                <Image source={{ uri: item.author_photo }} style={styles.avatarSmall} />
              ) : (
                <View style={[styles.avatarSmall, styles.avatarPlaceholder]} />
              )}
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.authorName}>{item.author_name ?? 'Doctor'}</Text>
                <Text style={styles.subtle}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
            </View>
            <Text style={styles.postContent}>{item.content}</Text>
            <View style={styles.postActions}>
              <Text style={styles.actionLink} onPress={() => toggleLike(item)}>
                {item.liked_by_me ? '❤️' : '🤍'} {item.likes_count}
              </Text>
              <Text style={[styles.actionLink, { marginLeft: 20 }]}>💬 {item.comments_count}</Text>
            </View>
          </Card>
        )}
      />
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
  scroll: { padding: 16, paddingTop: 50, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 },
  subtle: { color: colors.textMuted, fontSize: 13 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatarSmall: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { backgroundColor: colors.surfaceTint100 },
  authorName: { fontWeight: '700', color: colors.text },
  postContent: { color: colors.text, lineHeight: 20, marginBottom: 10 },
  postActions: { flexDirection: 'row' },
  actionLink: { color: colors.textMuted, fontWeight: '600' },
});
