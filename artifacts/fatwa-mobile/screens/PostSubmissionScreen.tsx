import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL, useApp } from '@/lib/store';
import { IMAGE_PICKER_OPTIONS, uploadImage } from '@/lib/upload';

const MAX_POST_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_POST_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export default function PostSubmissionScreen() {
  const colors = useColors();
  const nav = useNav();
  const { profile, settings, signedIn, authHeaders, refreshContent } = useApp();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
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
    } catch {
      setError('Could not open photos. Please try again.');
    }
  };

  const submit = async () => {
    setError('');
    if (!signedIn) {
      setError('Create your account first (name, country and city) from Settings, then share your post.');
      nav.push({ name: 'settings' });
      return;
    }
    if (!body.trim() && !imageAsset) {
      setError('Please add a description or choose an image.');
      return;
    }
    setBusy(true);
    try {
      const fields = { body: body.trim(), language: settings.language, category: '' };
      let response: Response;
      if (imageAsset) {
        response = await uploadImage(`${API_BASE_URL}/api/post-submissions`, imageAsset, 'image', fields, authHeaders());
      } else {
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.append(key, value);
        response = await fetch(`${API_BASE_URL}/api/post-submissions`, { method: 'POST', body: form, headers: authHeaders() });
      }
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to send your post');
      refreshContent();
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
      <SectionTitle title="Photo (optional)" subtitle="The full image will be uploaded without forcing a crop. You can share it without a description." />
      <Pressable
        onPress={() => { if (!submitted && !busy) void pickPhoto(); }}
        style={[styles.photoPicker, { backgroundColor: colors.card, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={imageUri ? 'Change selected photo' : 'Choose a photo'}
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
      <PrimaryButton
        label={submitted ? 'Back to feed' : busy ? 'Sending…' : 'Send for approval'}
        icon={submitted ? 'check' : 'send'}
        onPress={() => { if (submitted) nav.back(); else void submit(); }}
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
  photoLabel: { fontSize: 13, fontWeight: '800', marginTop: 10 },
  photoHint: { fontSize: 10.5, textAlign: 'center', marginTop: 5 },
  removePhoto: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-end', paddingVertical: 9, marginBottom: 8 },
  removePhotoText: { fontSize: 11.5, fontWeight: '700' },
});
