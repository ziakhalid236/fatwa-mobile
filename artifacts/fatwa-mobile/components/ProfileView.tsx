import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StarPattern } from '@/components/Art';
import { timeAgo } from '@/components/PostCard';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL, useApp } from '@/lib/store';
import { IMAGE_PICKER_OPTIONS, uploadImage } from '@/lib/upload';

/** Cover photos are always shown as a 2:1 banner; the picker crops to the same ratio (ideal size 1200 x 600). */
const COVER_ASPECT: [number, number] = [2, 1];

type ProfilePost = { id: string; title: string; body: string; imageUrl: string; createdAt: string; likes: number; status?: string; rejectionReason?: string };
type PublicProfile = { user: { id: string; name: string; city: string; country: string; avatarUrl: string; coverUrl?: string; bio: string; joinedAt: string }; posts: ProfilePost[]; likesReceived: number };

/** Facebook-style profile: cover, avatar, bio, stats and the user's own posts. `userId` is the profile owner. */
export function ProfileView({ userId, self, onEdit }: { userId: string; self?: boolean; onEdit?: () => void }) {
  const colors = useColors();
  const nav = useNav();
  const { authHeaders, profile, saveProfile, setBio, uploadAvatar, refreshContent, signedIn } = useApp();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [mine, setMine] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(profile.bio ?? '');
  const [editorOpen, setEditorOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [cityDraft, setCityDraft] = useState(profile.city);
  const [countryDraft, setCountryDraft] = useState(profile.country);
  const [emailDraft, setEmailDraft] = useState(profile.email ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

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

  const pickCover = async () => {
    const ImagePicker = await import('expo-image-picker');
    const result = await ImagePicker.launchImageLibraryAsync({ ...IMAGE_PICKER_OPTIONS, allowsEditing: true, aspect: COVER_ASPECT, quality: 0.7 });
    if (result.canceled || !result.assets[0]?.uri) return;
    try {
      const response = await uploadImage(`${API_BASE_URL}/api/profile/cover`, result.assets[0], 'cover', {}, authHeaders());
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Could not upload your cover photo.');
      void load();
    } catch (e) { Alert.alert('Could not upload', e instanceof Error ? e.message : 'Try again.'); }
  };
  const removeCover = async () => {
    const form = new FormData();
    form.append('remove', '1');
    await fetch(`${API_BASE_URL}/api/profile/cover`, { method: 'POST', body: form, headers: authHeaders() }).catch(() => undefined);
    void load();
  };
  const changeCover = () => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [{ text: data?.user.coverUrl ? 'Choose a new photo' : 'Choose a photo', onPress: () => void pickCover() }];
    if (data?.user.coverUrl) buttons.push({ text: 'Remove cover photo', style: 'destructive', onPress: () => void removeCover() });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Cover photo', 'The photo is cropped to a wide 2:1 banner (best size 1200 x 600), exactly as it appears on your profile.', buttons);
  };

  const openEditor = () => {
    setNameDraft(profile.name);
    setBioDraft(profile.bio ?? '');
    setCityDraft(profile.city);
    setCountryDraft(profile.country);
    setEmailDraft(profile.email ?? '');
    setEditorOpen(true);
  };

  const saveEditor = async () => {
    if (nameDraft.trim().length < 2) {
      Alert.alert('Name required', 'Please enter at least 2 characters for your username.');
      return;
    }
    setSavingProfile(true);
    try {
      await saveProfile({ name: nameDraft, city: cityDraft, country: countryDraft });
      await setBio(bioDraft);
      // Email is intentionally shown in the editor but remains managed by the
      // sign-in provider until a dedicated server-side email-change flow exists.
      setEditorOpen(false);
      void load();
    } catch (e) {
      Alert.alert('Could not save profile', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const u = data?.user;
  const cover = u?.coverUrl;
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
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Cover photo" /> : null}
        </LinearGradient>
        {self && signedIn ? (
          <Pressable onPress={changeCover} style={styles.coverMenuBtn} accessibilityRole="button" accessibilityLabel="Cover photo options" testID="profile-cover">
            <Feather name="more-horizontal" size={21} color="#fff" />
          </Pressable>
        ) : null}
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
            <Pressable onPress={() => { if (signedIn) openEditor(); else onEdit?.(); }} style={[styles.action, { backgroundColor: colors.primarySoft }]} accessibilityRole="button" testID="profile-edit"><Feather name="user" size={15} color={colors.primary} /><Text style={[styles.actionText, { color: colors.primary }]}>Edit profile</Text></Pressable>
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

      <Modal visible={editorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditorOpen(false)}>
        <View style={[styles.editor, { backgroundColor: colors.background }]}>
          <View style={styles.editorHeader}>
            <View>
              <Text style={[styles.editorEyebrow, { color: colors.mutedForeground }]}>YOUR PROFILE</Text>
              <Text style={[styles.editorTitle, { color: colors.foreground }]}>Edit profile</Text>
            </View>
            <Pressable onPress={() => setEditorOpen(false)} style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLabel="Close profile editor"><Feather name="x" size={19} color={colors.foreground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            <View style={styles.editorPhotos}>
              <Pressable onPress={() => void changePhoto()} style={styles.editorPhotoAction} accessibilityRole="button">
                {avatar ? <Image source={{ uri: avatar }} style={styles.editorAvatar} contentFit="cover" /> : <View style={[styles.editorAvatar, { backgroundColor: colors.primarySoft }]}><Text style={[styles.initial, { color: colors.primary }]}>{name[0]?.toUpperCase() ?? '?'}</Text></View>}
                <View style={[styles.photoBadge, { backgroundColor: colors.primary }]}><Feather name="camera" size={13} color="#fff" /></View>
              </Pressable>
              <Pressable onPress={changeCover} style={[styles.editorCover, { backgroundColor: colors.forest }]} accessibilityRole="button">
                {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <StarPattern opacity={0.18} size={34} />}
                <View style={styles.editorCoverOverlay}><Feather name="image" size={14} color="#fff" /><Text style={styles.coverBtnText}>Change cover</Text></View>
              </Pressable>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Username</Text>
            <TextInput value={nameDraft} onChangeText={setNameDraft} placeholder="Your name" placeholderTextColor={colors.mutedForeground} style={[styles.editorInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} autoCapitalize="words" />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Email</Text>
            <TextInput value={emailDraft} onChangeText={setEmailDraft} editable={false} keyboardType="email-address" style={[styles.editorInput, styles.disabledInput, { color: colors.mutedForeground, borderColor: colors.border, backgroundColor: colors.muted }]} />
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Email is managed securely by your sign-in method.</Text>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Bio</Text>
            <TextInput value={bioDraft} onChangeText={setBioDraft} maxLength={200} multiline placeholder="Tell people a little about yourself" placeholderTextColor={colors.mutedForeground} style={[styles.editorInput, styles.bioInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
            <View style={styles.twoFields}>
              <View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>City</Text><TextInput value={cityDraft} onChangeText={setCityDraft} placeholder="City" placeholderTextColor={colors.mutedForeground} style={[styles.editorInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>Country</Text><TextInput value={countryDraft} onChangeText={setCountryDraft} placeholder="Country" placeholderTextColor={colors.mutedForeground} style={[styles.editorInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} /></View>
            </View>
            <Pressable onPress={() => void saveEditor()} disabled={savingProfile} style={[styles.saveProfileBtn, { backgroundColor: colors.primary, opacity: savingProfile ? 0.7 : 1 }]}><Text style={styles.saveProfileText}>{savingProfile ? 'Saving…' : 'Save profile'}</Text></Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  coverWrap: { marginBottom: 52 },
  cover: { aspectRatio: 2, width: '100%', borderRadius: 26, overflow: 'hidden', justifyContent: 'center', alignItems: 'flex-end' },
  coverMenuBtn: { position: 'absolute', right: 12, top: 12, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 21 },
  coverBtnText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
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
  editor: { flex: 1 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  editorEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 4 },
  editorTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editorContent: { padding: 20, paddingBottom: 36, gap: 4 },
  editorPhotos: { gap: 12, marginBottom: 18 },
  editorPhotoAction: { position: 'absolute', zIndex: 2, left: 16, bottom: -22 },
  editorAvatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  photoBadge: { position: 'absolute', right: -1, bottom: 2, width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  editorCover: { height: 138, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  editorCoverOverlay: { alignSelf: 'flex-end', flexDirection: 'row', gap: 6, alignItems: 'center', margin: 12, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.42)' },
  fieldLabel: { fontSize: 12, fontWeight: '800', marginTop: 11, marginBottom: 6 },
  editorInput: { minHeight: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14 },
  disabledInput: { opacity: 0.85 },
  fieldHint: { fontSize: 11, marginTop: 5 },
  twoFields: { flexDirection: 'row', gap: 10 },
  saveProfileBtn: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  saveProfileText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
