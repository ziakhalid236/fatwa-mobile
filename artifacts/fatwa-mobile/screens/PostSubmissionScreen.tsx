import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL, useApp } from '@/lib/store';
import { IMAGE_PICKER_OPTIONS, uploadImage, uploadVideo } from '@/lib/upload';

const MAX_POST_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_POST_VIDEO_BYTES = 12 * 1024 * 1024;
const MAX_POST_VIDEO_SECONDS = 60;
const ACCEPTED_POST_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={styles.videoPreview} contentFit="cover" nativeControls fullscreenOptions={{ enable: false }} />;
}

export default function PostSubmissionScreen() {
  const colors = useColors();
  const nav = useNav();
  const { profile, settings, signedIn, authHeaders, refreshContent, membership, refreshMembership } = useApp();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [videoAsset, setVideoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [mediaProgress, setMediaProgress] = useState<number | null>(null);
  const imageUri = imageAsset?.uri ?? '';
  const MAX_CHARS = 5000;
  // Keep what the user typed if they leave the screen before sending.
  React.useEffect(() => { void AsyncStorage.getItem('fatwa.postDraft').then((d) => { if (d) setBody((cur) => cur || d); }); }, []);
  React.useEffect(() => { const t = setTimeout(() => { void (body ? AsyncStorage.setItem('fatwa.postDraft', body) : AsyncStorage.removeItem('fatwa.postDraft')); }, 400); return () => clearTimeout(t); }, [body]);

  // Android can restart the app while the gallery is open; pick up the photo that was chosen.
  React.useEffect(() => {
    void ImagePicker.getPendingResultAsync().then((pending) => {
      const first = pending && 'assets' in pending && !pending.canceled ? pending.assets?.[0] : undefined;
      if (first?.uri) setImageAsset((cur) => cur ?? { ...first, mimeType: (first.mimeType ?? 'image/jpeg').toLowerCase() });
    }).catch(() => undefined);
  }, []);

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ ...IMAGE_PICKER_OPTIONS, allowsEditing: false });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (!selected?.uri) {
        setError('Could not prepare photo. Please choose another image and try again.');
        return;
      }
      if (typeof selected.fileSize === 'number' && selected.fileSize > MAX_POST_IMAGE_BYTES) {
        setError('Photo is too large. Please crop the photo or choose a smaller image.');
        return;
      }
      const mimeType = (selected.mimeType ?? 'image/jpeg').toLowerCase();
      if (!ACCEPTED_POST_IMAGE_TYPES.has(mimeType)) {
        setError('Unsupported photo format. Please choose a JPG, PNG, WEBP, or GIF image.');
        return;
      }
      setError('');
      setImageAsset({ ...selected, mimeType });
      setVideoAsset(null);
    } catch {
      setError('Could not open photos. Please try again.');
    }
  };

  const pickVideo = async () => {
    if (!signedIn) {
      setError('Sign in before submitting a video.');
      nav.goTab('profile');
      return;
    }
    if (membership.plan === 'free') {
      setError('Short videos are available with Premium. Choose a plan to continue.');
      nav.push({ name: 'membership' });
      return;
    }
    if (membership.plan === 'premium' && membership.usage.videoLimit !== null && membership.usage.videos >= membership.usage.videoLimit) {
      setError('You have used today’s Premium video allowance. High Premium includes unlimited videos.');
      nav.push({ name: 'membership' });
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, videoMaxDuration: MAX_POST_VIDEO_SECONDS });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (!selected?.uri) throw new Error('Could not open this video. Please choose another file.');
      setMediaProgress(0);
      let ready = selected;
      if (Platform.OS !== 'web') {
        const { Video, getVideoMetaData } = await import('react-native-compressor');
        const source = await getVideoMetaData(selected.uri);
        if (source.duration > MAX_POST_VIDEO_SECONDS || source.duration < 0.5) throw new Error('Choose a video between half a second and 60 seconds long.');
        const compressedUri = await Video.compress(selected.uri, { compressionMethod: 'auto', maxSize: 720, bitrate: 1_400_000 }, (progress) => setMediaProgress(Math.round(progress)));
        const compressed = await getVideoMetaData(compressedUri);
        if (compressed.size > MAX_POST_VIDEO_BYTES) throw new Error('Compressed video is still larger than 12 MB. Choose a shorter video.');
        ready = { ...selected, uri: compressedUri, fileName: `fatwa-video-${Date.now()}.mp4`, mimeType: 'video/mp4', fileSize: compressed.size, duration: compressed.duration * 1000 };
      } else if (typeof selected.fileSize === 'number' && selected.fileSize > MAX_POST_VIDEO_BYTES) {
        throw new Error('Videos must be 12 MB or smaller on the web.');
      } else if (typeof selected.duration === 'number' && selected.duration > MAX_POST_VIDEO_SECONDS * 1000) {
        throw new Error('Choose a video no longer than 60 seconds.');
      }
      setImageAsset(null);
      setVideoAsset({ ...ready, mimeType: 'video/mp4' });
      setError('');
    } catch (reason) {
      setVideoAsset(null);
      setError(reason instanceof Error ? reason.message : 'Could not prepare this video. Please try another.');
    } finally {
      setMediaProgress(null);
    }
  };

  const submit = async () => {
    setError('');
    if (!signedIn) {
      setError('Create your account first (name, country and city) from Settings, then share your post.');
      nav.push({ name: 'settings' });
      return;
    }
    if (!body.trim() && !imageAsset && !videoAsset) {
      setError('Please add a description, photo, or short video.');
      return;
    }
    if (membership.usage.postLimit !== null && membership.usage.posts >= membership.usage.postLimit) {
      setError('You have used today’s free post allowance. See membership options to continue.');
      nav.push({ name: 'membership' });
      return;
    }
    setBusy(true);
    try {
      const fields = { body: body.trim(), language: settings.language, category: '' };
      let response: Response;
      if (imageAsset) {
        response = await uploadImage(`${API_BASE_URL}/api/post-submissions`, imageAsset, 'image', fields, authHeaders());
      } else if (videoAsset) {
        const result = await uploadVideo(`${API_BASE_URL}/api/post-submissions`, videoAsset, fields, authHeaders(), setMediaProgress);
        if (!result.ok) throw new Error(result.body.error ?? 'Unable to upload your video.');
        response = new Response(JSON.stringify(result.body), { status: result.status, headers: { 'content-type': 'application/json' } });
      } else {
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.append(key, value);
        response = await fetch(`${API_BASE_URL}/api/post-submissions`, { method: 'POST', body: form, headers: authHeaders() });
      }
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to send your post');
      refreshContent();
      void refreshMembership();
      void AsyncStorage.removeItem('fatwa.postDraft');
      setSubmitted(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not send post. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>COMMUNITY POST</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Share a reminder</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Your post will be reviewed before it becomes visible to everyone.</Text>
      </View>

      {submitted ? (
        <View style={[styles.feedback, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]} accessibilityRole="alert">
          <Feather name="check-circle" size={18} color={colors.primary} />
          <Text style={[styles.feedbackText, { color: colors.foreground }]}>Sent for review. You will receive a notification when the post is approved and published.</Text>
        </View>
      ) : error ? (
        <View style={[styles.feedback, { backgroundColor: colors.coralSoft, borderColor: colors.coral }]} accessibilityRole="alert">
          <Feather name="alert-circle" size={18} color={colors.coral} />
          <Text style={[styles.feedbackText, { color: colors.foreground }]}>{error}</Text>
        </View>
      ) : null}

      <SectionTitle title="Your profile" subtitle={`${profile.name || 'Guest'} · ${profile.city || 'City'}, ${profile.country || 'Country'}`} />

      <SectionTitle
        title={membership.plan === 'high_premium' ? 'High Premium' : membership.plan === 'premium' ? 'Premium' : 'Free membership'}
        subtitle={`${membership.usage.postLimit == null ? 'Unlimited posts' : `${membership.usage.posts}/${membership.usage.postLimit} posts today`} · ${membership.usage.videoLimit == null ? 'Unlimited videos' : `${membership.usage.videos}/${membership.usage.videoLimit} videos today`}`}
        action="Plans"
        onAction={() => nav.push({ name: 'membership' })}
      />

      <SectionTitle title="Post" subtitle="Your post is reviewed before it is published." />
      <Text style={[styles.label, { color: colors.foreground }]}>Description (optional)</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        editable={!submitted && !busy}
        placeholder="Write your reminder, reflection, or quote..."
        placeholderTextColor={colors.mutedForeground}
        multiline
        textAlignVertical="top"
        maxLength={MAX_CHARS}
        style={[styles.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
      />
      <Text style={[styles.counter, { color: body.length > MAX_CHARS * 0.9 ? colors.coral : colors.mutedForeground }]}>{body.length}/{MAX_CHARS} · draft saved automatically</Text>
      <SectionTitle title="Photo (optional)" subtitle="Choose one photo or one short video. You can share it without a description." />
      <Pressable
        onPress={() => { if (!submitted && !busy) void pickPhoto(); }}
        style={[styles.photoPicker, { backgroundColor: colors.card, borderColor: colors.border, opacity: busy || submitted || mediaProgress !== null ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={imageUri ? 'Change selected photo' : 'Choose a photo'}
        disabled={busy || submitted || mediaProgress !== null}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.photoPreview} contentFit="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Feather name="image" size={22} color={colors.primary} />
            <Text style={[styles.photoLabel, { color: colors.foreground }]}>Choose from album</Text>
            <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>Your image will be stored securely and reviewed before publication.</Text>
          </View>
        )}
      </Pressable>
      {imageUri ? (
        <Pressable onPress={() => { if (!submitted && !busy) setImageAsset(null); }} style={styles.removePhoto} accessibilityRole="button">
          <Feather name="x-circle" size={15} color={colors.coral} />
          <Text style={[styles.removePhotoText, { color: colors.coral }]}>Remove photo</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => { if (!submitted && !busy) void pickVideo(); }}
        style={[styles.videoPicker, { backgroundColor: colors.card, borderColor: colors.border, opacity: busy || submitted || mediaProgress !== null ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={videoAsset ? 'Change selected video' : 'Choose a video'}
        disabled={busy || submitted || mediaProgress !== null}
      >
        {videoAsset ? <VideoPreview uri={videoAsset.uri} /> : <View style={styles.videoPlaceholder}><Feather name="film" size={22} color={colors.primary} /><Text style={[styles.photoLabel, { color: colors.foreground }]}>{mediaProgress === null ? 'Choose a short video' : 'Preparing video…'}</Text><Text style={[styles.photoHint, { color: colors.mutedForeground }]}>MP4 · up to 60 seconds · compressed to fit within 12 MB</Text></View>}
      </Pressable>
      {videoAsset ? <Pressable onPress={() => { if (!submitted && !busy) setVideoAsset(null); }} style={styles.removePhoto} accessibilityRole="button"><Feather name="x-circle" size={15} color={colors.coral} /><Text style={[styles.removePhotoText, { color: colors.coral }]}>Remove video</Text></Pressable> : null}
      {mediaProgress !== null ? <Text style={[styles.counter, { color: colors.mutedForeground }]}>{busy ? `Uploading video · ${mediaProgress}%` : `Compressing video · ${mediaProgress}%`}</Text> : null}
      <PrimaryButton
        label={submitted ? 'Back to feed' : busy ? (videoAsset ? 'Uploading…' : 'Sending…') : mediaProgress !== null ? 'Preparing video…' : 'Send for approval'}
        icon={submitted ? 'check' : 'send'}
        onPress={() => { if (submitted) nav.back(); else void submit(); }}
        disabled={mediaProgress !== null && !busy}
        loading={busy}
      />
      <View style={styles.note}>
        <MaterialCommunityIcons name="shield-check-outline" size={17} color={colors.primary} />
        <Text style={[styles.noteText, { color: colors.mutedForeground }]}>An admin reviews every community post before publication.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 10, marginBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 15, padding: 13, marginBottom: 18 },
  feedbackText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  textarea: { minHeight: 160, borderWidth: 1, borderRadius: 18, padding: 15, fontSize: 14, lineHeight: 22, marginBottom: 6 },
  counter: { fontSize: 10.5, textAlign: 'right', marginBottom: 14 },
  note: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  noteText: { fontSize: 11, textAlign: 'center' },
  photoPicker: { minHeight: 150, borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, overflow: 'hidden', marginBottom: 8 },
  photoPlaceholder: { minHeight: 150, alignItems: 'center', justifyContent: 'center', padding: 18 },
  photoPreview: { width: '100%', height: 210 },
  videoPicker: { minHeight: 150, borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, overflow: 'hidden', marginBottom: 8 },
  videoPlaceholder: { minHeight: 150, alignItems: 'center', justifyContent: 'center', padding: 18 },
  videoPreview: { width: '100%', height: 250, backgroundColor: '#071A14' },
  photoLabel: { fontSize: 13, fontWeight: '800', marginTop: 10 },
  photoHint: { fontSize: 10.5, textAlign: 'center', marginTop: 5 },
  removePhoto: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-end', paddingVertical: 9, marginBottom: 8 },
  removePhotoText: { fontSize: 11.5, fontWeight: '700' },
});
