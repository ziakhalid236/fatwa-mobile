import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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

  const submit = async () => {
    if (name.trim().length < 2 || country.trim().length < 2 || city.trim().length < 2 || body.trim().length < 20) {
      Alert.alert('More details needed', 'Please enter your name, country, city, and at least 20 characters for the post.');
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
});
