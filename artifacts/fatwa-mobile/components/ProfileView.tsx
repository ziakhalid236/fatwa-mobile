import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StarPattern } from '@/components/Art';
import { timeAgo } from '@/components/PostCard';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL, useApp } from '@/lib/store';

type ProfilePost = { id: string; title: string; body: string; imageUrl: string; createdAt: string; likes: number; status?: string; rejectionReason?: string };
type PublicProfile = { user: { id: string; name: string; city: string; country: string; avatarUrl: string; bio: string; joinedAt: string }; posts: ProfilePost[]; likesReceived: number };

/** Facebook-style profile: cover, avatar, bio, stats and the user's own posts. `userId` is the profile owner. */
export function ProfileView({ userId, self, onEdit }: { userId: string; self?: boolean; onEdit?: () => void }) {
  const colors = useColors();
  const nav = useNav();
  const { authHeaders, profile, setBio, uploadAvatar, refreshContent, signedIn } = useApp();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [mine, setMine] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(profile.bio ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pub, own] = await Promise.all([
        fetch(`${API_BASE_URL}/api/users/${userId}/profile`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('x')))),
        self ? fetch(`${API_BASE_URL}/api/my/posts`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : { posts: [] })) : Promise.resolve({ posts: [] }),
      ]);
      setData(pub);
      setMine((own.posts as ProfilePost[]).filter((p) => p.status === 'pending' || p.status === 'rejected'));
      setFailed(false);
    } catch { setFailed(true); } finally { setLoading(false); }
  }, [userId, self, authHeaders]);
  useEffect(() => { void load(); }, [load]);

  const remove = (p: ProfilePost) => {
    Alert.alert('Delete post?', 'This removes the post for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await fetch(`${API_BASE_URL}/api/my/posts/${p.id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => undefined); refreshContent(); void load(); } },
    ]);
  };

  const changePhoto = async () => {
    const ImagePicker = await import('expo-image-picker');
    const { IMAGE_PICKER_OPTIONS } = await import('@/lib/upload');
    const result = await ImagePicker.launchImageLibraryAsync({ ...IMAGE_PICKER_OPTIONS, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets[0]?.uri) return;
    try { await uploadAvatar(result.assets[0]); void load(); } catch (e) { Alert.alert('Could not upload', e instanceof Error ? e.message : 'Try again.'); }
  };

  const u = data?.user;
  const avatar = self ? profile.avatarUri || u?.avatarUrl : u?.avatarUrl;
  const name = (self ? profile.name : u?.name) || u?.name || 'Reader';
  const bio = self ? profile.bio ?? u?.bio : u?.bio;
  const place = [u?.city || (self ? profile.city : ''), u?.country || (self ? profile.country : '')].filter(Boolean).join(', ');
  const joined = u?.joinedAt ? new Date(u.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';

  return (
    <View>
      <View style={styles.coverWrap}>
        <LinearGradient colors={[colors.forest, colors.green, colors.teal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
          <StarPattern opacity={0.12} size={44} />
          <Feather name="moon" size={90} color="rgba(255,255,255,0.08)" style={styles.coverArt} />
        </LinearGradient>
        <View style={[styles.avatarRing, { borderColor: colors.background, backgroundColor: colors.primarySoft }]}>
          {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" /> : <Text style={[styles.initial, { color: colors.primary }]}>{name[0]?.toUpperCase() ?? '?'}</Text>}
          {self && signedIn ? (
            <Pressable onPress={() => void changePhoto()} style={[styles.cam, { backgroundColor: colors.primary }]} accessibilityLabel="Change profile picture"><Feather name="camera" size={14} color="#fff" /></Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.identity}>
        <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
        {editingBio ? (
          <View style={{ gap: 8 }}>
            <TextInput value={bioDraft} onChangeText={setBioDraft} maxLength={200} multiline placeholder="Write a short bio…" placeholderTextColor={colors.mutedForeground} style={[styles.bioInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
            <View style={styles.row}>
              <Pressable onPress={async () => { try { await setBio(bioDraft); setEditingBio(false); } catch (e) { Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.'); } }} style={[styles.smallBtn, { backgroundColor: colors.primary }]}><Text style={styles.smallBtnText}>Save bio</Text></Pressable>
              <Pressable onPress={() => setEditingBio(false)} style={[styles.smallBtn, { backgroundColor: colors.muted }]}><Text style={[styles.smallBtnText, { color: colors.foreground }]}>Cancel</Text></Pressable>
            </View>
          </View>
        ) : bio ? <Text style={[styles.bio, { color: colors.foreground }]}>{bio}</Text> : self && signedIn ? (
          <Pressable onPress={() => { setBioDraft(''); setEditingBio(true); }}><Text style={[styles.bio, { color: colors.primary }]}>+ Add a short bio</Text></Pressable>
        ) : null}
        <View style={styles.metaRow}>
          {place ? <View style={styles.meta}><Feather name="map-pin" size={13} color={colors.mutedForeground} /><Text style={[styles.metaText, { color: colors.mutedForeground }]}>{place}</Text></View> : null}
          {joined ? <View style={styles.meta}><Feather name="calendar" size={13} color={colors.mutedForeground} /><Text style={[styles.metaText, { color: colors.mutedForeground }]}>Joined {joined}</Text></View> : null}
        </View>
        {self ? (
          <View style={styles.row}>
            <Pressable onPress={() => nav.push({ name: 'postSubmit' })} style={[styles.action, { backgroundColor: colors.primary }]} accessibilityRole="button"><Feather name="edit-3" size={15} color="#fff" /><Text style={styles.actionText}>Upload post</Text></Pressable>
            <Pressable onPress={() => { if (signedIn && !editingBio) { setBioDraft(profile.bio ?? ''); setEditingBio(true); } else onEdit?.(); }} style={[styles.action, { backgroundColor: colors.primarySoft }]} accessibilityRole="button"><Feather name="user" size={15} color={colors.primary} /><Text style={[styles.actionText, { color: colors.primary }]}>Edit bio</Text></Pressable>
          </View>
        ) : null}
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>{self ? 'Your posts' : 'Posts'}{data ? ` · ${data.posts.length}` : ''}</Text>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} /> : failed ? (
        <Pressable onPress={() => void load()} style={[styles.empty, { borderColor: colors.border }]}><Text style={{ color: colors.mutedForeground }}>Could not load. Tap to retry.</Text></Pressable>
      ) : (
        <>
          {self && mine.map((p) => (
            <View key={p.id} style={[styles.post, { backgroundColor: colors.card, borderColor: p.status === 'rejected' ? colors.coral : colors.border }]}>
              <View style={styles.postHead}>
                <View style={[styles.status, { backgroundColor: p.status === 'rejected' ? colors.coralSoft : colors.goldSoft }]}><Text style={[styles.statusText, { color: p.status === 'rejected' ? colors.coral : colors.gold }]}>{p.status === 'rejected' ? 'Not approved' : 'Waiting for review'}</Text></View>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(p.createdAt)}</Text>
                <Pressable onPress={() => remove(p)} hitSlop={8}><Feather name="trash-2" size={16} color={colors.mutedForeground} /></Pressable>
              </View>
              {p.body ? <Text style={[styles.postBody, { color: colors.foreground }]} numberOfLines={4}>{p.body}</Text> : null}
              {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={styles.postImage} contentFit="cover" /> : null}
              {p.status === 'rejected' && p.rejectionReason ? <Text style={[styles.reason, { color: colors.coral }]}>{p.rejectionReason}</Text> : null}
            </View>
          ))}
          {data?.posts.length ? data.posts.map((p) => (
            <Pressable key={p.id} onPress={() => nav.push({ name: 'post', postId: p.id })} style={[styles.post, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.postHead}>
                <Text style={[styles.time, { color: colors.mutedForeground, flex: 1 }]}>{timeAgo(p.createdAt)}</Text>
                {self ? <Pressable onPress={() => remove(p)} hitSlop={8}><Feather name="trash-2" size={16} color={colors.mutedForeground} /></Pressable> : null}
              </View>
              {p.body ? <Text style={[styles.postBody, { color: colors.foreground }]} numberOfLines={5}>{p.body}</Text> : null}
              {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={styles.postImage} contentFit="cover" /> : null}
              <View style={styles.likes}><Feather name="heart" size={14} color={colors.coral} /><Text style={[styles.metaText, { color: colors.mutedForeground }]}>{p.likes}</Text></View>
            </Pressable>
          )) : !mine.length ? (
            <View style={[styles.empty, { borderColor: colors.border }]}>
              <Feather name="file-text" size={26} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 8, textAlign: 'center' }}>{self ? 'You have not shared anything yet.' : 'No posts yet.'}</Text>
              {self ? <Pressable onPress={() => nav.push({ name: 'postSubmit' })} style={[styles.smallBtn, { backgroundColor: colors.primary, marginTop: 12 }]}><Text style={styles.smallBtnText}>Share your first post</Text></Pressable> : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  coverWrap: { marginBottom: 52 },
  cover: { height: 130, borderRadius: 26, overflow: 'hidden', justifyContent: 'center', alignItems: 'flex-end' },
  coverArt: { marginRight: 24 },
  avatarRing: { position: 'absolute', left: 20, bottom: -48, width: 100, height: 100, borderRadius: 50, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: '100%', height: '100%', borderRadius: 50 },
  initial: { fontSize: 38, fontWeight: '800' },
  cam: { position: 'absolute', right: -2, bottom: 2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  identity: { paddingHorizontal: 4, gap: 7, marginBottom: 14 },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  bio: { fontSize: 14, lineHeight: 21 },
  bioInput: { minHeight: 70, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14, textAlignVertical: 'top' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 6 },
  action: { flex: 1, height: 44, borderRadius: 14, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  iconBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  smallBtn: { paddingHorizontal: 16, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  stats: { flexDirection: 'row', borderWidth: 1, borderRadius: 20, paddingVertical: 14, marginBottom: 18 },
  stat: { flex: 1, alignItems: 'center' }, sep: { width: 1, marginVertical: 4 },
  statValue: { fontSize: 20, fontWeight: '800' }, statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  section: { fontSize: 17, fontWeight: '800', marginBottom: 10, letterSpacing: -0.3 },
  post: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 12, gap: 8 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postBody: { fontSize: 14, lineHeight: 21 },
  postImage: { width: '100%', height: 190, borderRadius: 14 },
  time: { fontSize: 11.5 },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }, statusText: { fontSize: 11, fontWeight: '800' },
  reason: { fontSize: 12, fontWeight: '600' },
  likes: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 20, padding: 28, alignItems: 'center' },
});
