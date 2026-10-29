import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL, getDeviceId, useApp } from '@/lib/store';

const MAX_POST_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_POST_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export default function PostSubmissionScreen() {
  const colors = useColors();
  const nav = useNav();
  const { profile, settings } = useApp();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const imageUri = imageAsset?.uri ?? '';

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (!selected?.uri) {
        Alert.alert('Could not prepare photo', 'Please choose another image and try again.');
        return;
      }
      if (typeof selected.fileSize === 'number' && selected.fileSize > MAX_POST_IMAGE_BYTES) {
        Alert.alert('Photo is too large', 'Please crop the photo or choose a smaller image.');
        return;
      }
      const mimeType = (selected.mimeType ?? 'image/jpeg').toLowerCase();
      if (!ACCEPTED_POST_IMAGE_TYPES.has(mimeType)) {
        Alert.alert('Unsupported photo format', 'Please choose a JPG, PNG, WEBP, or GIF image.');
        return;
      }
      setImageAsset({ ...selected, mimeType });
    } catch {
      Alert.alert('Could not open photos', 'Please try again.');
    }
  };

  const submit = async () => {
    if (profile.name.trim().length < 2 || profile.country.trim().length < 2 || profile.city.trim().length < 2) {
      Alert.alert('Profile required', 'Settings میں اپنا نام، ملک اور شہر save کریں۔ Profile photo optional ہے۔');
      nav.push({ name: 'settings' });
      return;
    }
    if (!body.trim() && !imageAsset) {
      Alert.alert('Add content', 'Please add a description or choose an image.');
      return;
    }
    setBusy(true);
    try {
      const deviceId = await getDeviceId();
      // Ensure the server knows this device/profile before submitting. The
      // profile is otherwise synced fire-and-forget while typing, so a failed
      // sync would surface here as a confusing 401.
      const profileResponse = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          name: profile.name.trim(),
          country: profile.country.trim(),
          city: profile.city.trim(),
        }),
      });
      if (!profileResponse.ok) {
        const failure = (await profileResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(failure.error ?? 'Could not save your profile. Check your connection and try again.');
      }
      const form = new FormData();
      form.append('deviceId', deviceId);
      form.append('name', profile.name.trim());
      form.append('country', profile.country.trim());
      form.append('city', profile.city.trim());
      const bodyText = body.trim();
      form.append('body', bodyText);
      form.append('language', settings.language);
      if (imageAsset) {
        const mimeType = imageAsset.mimeType ?? 'image/jpeg';
        const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
        form.append('image', {
          uri: imageAsset.uri,
          name: imageAsset.fileName ?? `community-${Date.now()}.${extension}`,
          type: mimeType,
        } as unknown as Blob);
      }
      const response = await fetch(`${API_BASE_URL}/api/post-submissions`, {
        method: 'POST',
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to send your post');
      Alert.alert('Sent for review', 'Your post is pending admin approval. You will receive a notification when it is approved and published.', [
        { text: 'Done', onPress: () => nav.back() },
      ]);
    } catch (error) {
      Alert.alert('Could not send post', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={uiStyles.screenPadding} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>COMMUNITY POST</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Share a reminder</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Your post will be reviewed before it becomes visible to everyone.</Text>
      </View>

      <SectionTitle title="Your profile" subtitle={`${profile.name || 'Guest'} · ${profile.city || 'City'}, ${profile.country || 'Country'}`} />

      <SectionTitle title="Post" subtitle={`It will be submitted in ${settings.language === 'ur' ? 'Urdu' : settings.language === 'ar' ? 'Arabic' : 'English'}.`} />
      <Text style={[styles.label, { color: colors.foreground }]}>Description (optional)</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Write your reminder, reflection, or quote..."
        placeholderTextColor={colors.mutedForeground}
        multiline
        textAlignVertical="top"
        style={[styles.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
      />
      <SectionTitle title="Photo (optional)" subtitle="The full image will be uploaded without forcing a crop. You can share it without a description." />
      <Pressable
        onPress={() => void pickPhoto()}
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
        <Pressable onPress={() => setImageAsset(null)} style={styles.removePhoto} accessibilityRole="button">
          <Feather name="x-circle" size={15} color={colors.coral} />
          <Text style={[styles.removePhotoText, { color: colors.coral }]}>Remove photo</Text>
        </Pressable>
      ) : null}
      <PrimaryButton label={busy ? 'Sending…' : 'Send for approval'} icon="send" onPress={() => void submit()} loading={busy} />
      <View style={styles.note}>
        <MaterialCommunityIcons name="shield-check-outline" size={17} color={colors.primary} />
        <Text style={[styles.noteText, { color: colors.mutedForeground }]}>An admin reviews every community post before publication.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 10, marginBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  textarea: { minHeight: 160, borderWidth: 1, borderRadius: 18, padding: 15, fontSize: 14, lineHeight: 22, marginBottom: 17 },
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
