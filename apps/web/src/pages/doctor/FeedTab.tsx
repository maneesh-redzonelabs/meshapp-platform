import React, { useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Select, Textarea } from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Modal';
import { useComplianceScan, ComplianceScanningOverlay, ComplianceBlockedDialog } from '@/components/ComplianceGate';

export default function FeedTab() {
  const [showCompose, setShowCompose] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }: { pageParam?: string }) => postsApi.feed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
  });

  const posts = data?.pages.flat() ?? [];

  return (
    <div className="space-y-4 max-w-2xl mx-auto lg:max-w-none">
      <Card className="p-4">
        <button
          onClick={() => setShowCompose(true)}
          className="w-full text-left bg-purple-50 hover:bg-purple-100 rounded-xl px-4 py-3 text-sm text-purple-600"
        >
          Share a clinical case, research, or update with your network…
        </button>
      </Card>

      {isLoading && <LoadingState label="Loading feed…" />}
      {isError && <ErrorState message="Could not load the feed." onRetry={() => refetch()} />}
      {!isLoading && !isError && posts.length === 0 && (
        <EmptyState icon="fa-newspaper" title="No posts yet" subtitle="Be the first to share something with your network." />
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.post_id} post={post} onChanged={() => qc.invalidateQueries({ queryKey: ['feed'] })} />
        ))}
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onPosted={() => {
            setShowCompose(false);
            qc.invalidateQueries({ queryKey: ['feed'] });
          }}
        />
      )}
    </div>
  );
}

function PostCard({ post, onChanged }: { post: any; onChanged: () => void }) {
  const { show } = useToast();
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState('');

  async function toggleLike() {
    try {
      if (post.liked_by_me) await postsApi.unlike(post.post_id);
      else await postsApi.like(post.post_id);
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update like.', 'error');
    }
  }

  async function submitComment() {
    if (!comment.trim()) return;
    try {
      await postsApi.addComment(post.post_id, comment);
      setComment('');
      show('Comment added.', 'success');
      onChanged();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not add comment.', 'error');
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 overflow-hidden">
          {post.author_photo ? <img src={post.author_photo} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user-doctor" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-purple-950">{post.author_name || 'Doctor'}</p>
          <p className="text-[11px] text-slate-400">{new Date(post.created_at).toLocaleString()}</p>
        </div>
        <Badge tone="slate">{post.visibility_scope.replace('_', ' ')}</Badge>
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-line mb-3">{post.content}</p>
      <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-purple-50 pt-2">
        <button onClick={toggleLike} className={`flex items-center gap-1 ${post.liked_by_me ? 'text-purple-700 font-semibold' : ''}`}>
          <i className={`fa-solid fa-heart ${post.liked_by_me ? 'text-rose-500' : ''}`} /> {post.likes_count}
        </button>
        <button onClick={() => setCommentOpen((v) => !v)} className="flex items-center gap-1">
          <i className="fa-regular fa-comment" /> {post.comments_count}
        </button>
      </div>
      {commentOpen && (
        <div className="mt-3 flex gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment…"
            className="flex-1 bg-purple-50/70 border border-purple-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
          />
          <Button className="px-3 py-0 text-xs" onClick={submitComment}>Post</Button>
        </div>
      )}
    </Card>
  );
}

function ComposeModal({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { show } = useToast();
  const { scan, scanning, blockedResult, dismiss } = useComplianceScan('post');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [postType, setPostType] = useState('general');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!content.trim()) return show('Write something before posting.', 'error');
    setSaving(true);
    try {
      const scanId = await scan(content);
      if (!scanId) return;
      await postsApi.create({ content, visibility_scope: visibility, post_type: postType, compliance_scan_id: scanId });
      show('Post published.', 'success');
      onPosted();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not publish your post.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        title="Create Post"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving || scanning}>{saving || scanning ? 'Checking…' : 'Scan & Publish'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Share a clinical case, research update, or opinion…" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="public">Public</option>
              <option value="network_only">Network Only</option>
              <option value="community_only">Community Only</option>
              <option value="private">Private</option>
            </Select>
            <Select label="Post Type" value={postType} onChange={(e) => setPostType(e.target.value)}>
              <option value="general">General</option>
              <option value="clinical_case">Clinical Case</option>
              <option value="research">Research</option>
              <option value="opinion">Opinion</option>
              <option value="update">Update</option>
            </Select>
          </div>
          <p className="text-[11px] text-slate-500">
            <i className="fa-solid fa-shield-halved text-purple-500 mr-1" /> All posts are scanned for NMC advertising/ethics compliance before publishing, regardless of visibility.
          </p>
        </div>
      </Modal>
      {scanning && <ComplianceScanningOverlay />}
      {blockedResult && <ComplianceBlockedDialog result={blockedResult} onClose={dismiss} />}
    </>
  );
}
