import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL, getDeviceId, useApp } from '@/lib/store';
import type { PostCategory } from '@/lib/types';

const categories: PostCategory[] = ['Islamic', 'History', 'Poetry', 'Reflection', 'Seerah'];

export default function PostSubmissionScreen() {
  const colors = useColors();
  const nav = useNav();
  const { profile, settings, setProfile } = useApp();
  const [name, setName] = useState(profile.name);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState(profile.city);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<PostCategory>('Islamic');
  const [busy, setBusy] = useState(false);
  const [imageUri, setImageUri] = useState('');

  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow access to your photos to attach an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
    } catch {
      Alert.alert('Could not open photos', 'Please try again.');
    }
  };

  const submit = async () => {
    if (name.trim().length < 2 || country.trim().length < 2 || city.trim().length < 2 || (!title.trim() && !body.trim()) || (!imageUri && body.trim().length < 20)) {
      Alert.alert('More details needed', 'Please enter your name, country, city, and a title or post text. Text-only posts need at least 20 characters.');
      return;
    }
    if (imageUri) {
      Alert.alert('Photo publishing is not ready yet', 'You can preview your photo here, but the server does not yet save post images. Remove the photo to send a text-only post.');
      return;
    }
    setBusy(true);
    try {
      const deviceId = await getDeviceId();
      const response = await fetch(`${API_BASE_URL}/api/post-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, name: name.trim(), country: country.trim(), city: city.trim(), title: title.trim(), body: body.trim(), category, language: settings.language }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to send your post');
      setProfile({ name: name.trim(), city: city.trim() });
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

      <SectionTitle title="Your details" />
      <TextInputField label="Name" value={name} onChangeText={setName} placeholder="Your name" colors={colors} />
      <View style={styles.twoCol}>
        <TextInputField label="Country" value={country} onChangeText={setCountry} placeholder="Country" colors={colors} />
        <TextInputField label="City" value={city} onChangeText={setCity} placeholder="City" colors={colors} />
      </View>

      <SectionTitle title="Post" subtitle={`It will be submitted in ${settings.language === 'ur' ? 'Urdu' : settings.language === 'ar' ? 'Arabic' : 'English'}.`} />
      <TextInputField label="Title (optional)" value={title} onChangeText={setTitle} placeholder="A short title" colors={colors} />
      <Text style={[styles.label, { color: colors.foreground }]}>Category</Text>
      <View style={styles.chips}>
        {categories.map((item) => {
          const active = category === item;
          return (
            <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}>
              <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>Post text</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Write your reminder, reflection, or quote..."
        placeholderTextColor={colors.mutedForeground}
        multiline
        textAlignVertical="top"
        style={[styles.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
      />
      <SectionTitle title="Photo" subtitle="Choose one photo from your album." />
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
            <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>Photo publishing will be enabled after server support is added.</Text>
          </View>
        )}
      </Pressable>
      {imageUri ? (
        <Pressable onPress={() => setImageUri('')} style={styles.removePhoto} accessibilityRole="button">
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

function TextInputField({ label, value, onChangeText, placeholder, colors }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 10, marginBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  field: { flex: 1, marginBottom: 12 },
  twoCol: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, fontSize: 13 },
  textarea: { minHeight: 160, borderWidth: 1, borderRadius: 18, padding: 15, fontSize: 14, lineHeight: 22, marginBottom: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontSize: 11.5, fontWeight: '700' },
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
