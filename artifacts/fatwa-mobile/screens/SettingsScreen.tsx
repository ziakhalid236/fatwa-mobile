import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { PrimaryButton, SectionTitle, uiStyles } from '@/components/ui';
import { IMAGE_PICKER_OPTIONS } from '@/lib/upload';
import { detectPlace } from '@/lib/geo';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';

export default function SettingsScreen() {
  const colors = useColors();
  const nav = useNav();
  const { settings, setSettings, prayerCity, profile, saveProfile, uploadAvatar, signedIn } = useApp();
  const [name, setName] = useState(profile.name);
  const [country, setCountry] = useState(profile.country);
  const [city, setCity] = useState(profile.city);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const dirty = name.trim() !== profile.name || country.trim() !== profile.country || city.trim() !== profile.city || !signedIn;

  const chooseProfilePhoto = async () => {
    setMessage(null);
    if (!signedIn) { setMessage({ kind: 'error', text: 'Save your name, country and city first, then add a picture.' }); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ ...IMAGE_PICKER_OPTIONS, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets[0]?.uri) return;
    setBusy(true);
    try {
      await uploadAvatar(result.assets[0]);
      setMessage({ kind: 'ok', text: 'Profile picture updated.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not upload your picture.' });
    } finally {
      setBusy(false);
    }
  };

  const useMyLocation = async () => {
    const found = await detectPlace();
    if (found.place?.city) setCity(found.place.city);
    if (found.place?.country) setCountry(found.place.country);
    if (!found.place) setMessage({ kind: 'error', text: 'Could not detect your location. Please type your city and country.' });
  };

  const save = async () => {
    setMessage(null);
    if (name.trim().length < 2 || country.trim().length < 2 || city.trim().length < 2) {
      setMessage({ kind: 'error', text: 'Please enter your name, country and city.' });
      return;
    }
    setBusy(true);
    try {
      await saveProfile({ name, country, city });
      setMessage({ kind: 'ok', text: 'Profile saved.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save your profile.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>PREFERENCES</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Manage alerts, adhan sound, and prayer tools.</Text>
      </View>

      <SectionTitle title="Notifications" />
      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Feather name="bell" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Push notifications</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Receive answers and Fatwa updates</Text>
        </View>
        <Switch
          value={settings.notificationsEnabled}
          onValueChange={(value) => setSettings({ notificationsEnabled: value })}
          trackColor={{ false: colors.border, true: colors.teal }}
          thumbColor="#FFFFFF"
        />
      </View>

      <SectionTitle title="Your account" subtitle="Your name, picture and city appear on your posts. Nearby posts are shown first in your feed." />
      <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.profilePhotoRow}>
          {profile.avatarUri ? <Image source={{ uri: profile.avatarUri }} style={styles.profilePhoto} contentFit="cover" /> : <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder, { backgroundColor: colors.primarySoft }]}><Feather name="user" size={22} color={colors.primary} /></View>}
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Profile picture</Text>
            <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Shown next to your posts.</Text>
          </View>
          <Pressable onPress={() => void chooseProfilePhoto()} disabled={busy} style={[styles.photoButton, { borderColor: colors.border }]} accessibilityRole="button" testID="settings-avatar">
            <Text style={[styles.photoButtonText, { color: colors.primary }]}>{profile.avatarUri ? 'Change' : 'Add'}</Text>
          </Pressable>
        </View>
        <Text style={[styles.inputLabel, { color: colors.foreground }]}>Your name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Your name (required)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} autoCapitalize="words" testID="settings-name" />
        <Text style={[styles.inputLabel, { color: colors.foreground }]}>Country</Text>
        <TextInput value={country} onChangeText={setCountry} placeholder="Your country" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} autoCapitalize="words" testID="settings-country" />
        <Text style={[styles.inputLabel, { color: colors.foreground }]}>City</Text>
        <TextInput value={city} onChangeText={setCity} placeholder="Your city" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} autoCapitalize="words" testID="settings-city" />
        <Pressable onPress={() => void useMyLocation()} style={styles.locateRow} accessibilityRole="button">
          <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
          <Text style={[styles.photoButtonText, { color: colors.primary }]}>Use my current location</Text>
        </Pressable>
        {message ? <Text style={[styles.rowSubtitle, { color: message.kind === 'ok' ? colors.primary : colors.coral, marginBottom: 10 }]} accessibilityRole="alert">{message.text}</Text> : null}
        <PrimaryButton label={busy ? 'Saving…' : signedIn ? 'Save changes' : 'Create account'} icon="check" onPress={() => void save()} disabled={!dirty} loading={busy} testID="settings-save" />
      </View>

      <SectionTitle title="Prayer tools" />
      <Pressable
        onPress={() => nav.push({ name: 'prayerSettings' })}
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="bell-ring-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Prayer alarms</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>GPS prayer times: {prayerCity.name}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
      <Pressable
        onPress={() => nav.push({ name: 'qiblaSettings' })}
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="compass-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Qibla direction</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Live compass using your GPS position</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="volume-high" size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Adhan sound</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Play sound when an alarm is due</Text>
        </View>
        <Switch
          value={settings.adhanSound}
          onValueChange={(value) => setSettings({ adhanSound: value })}
          trackColor={{ false: colors.border, true: colors.teal }}
          thumbColor="#FFFFFF"
        />
      </View>

      <SectionTitle title="About" />
      <Pressable
        onPress={() => nav.push({ name: 'legalIndex' })}
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
        accessibilityRole="button"
        testID="settings-legal"
      >
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Terms, privacy & sources</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Terms of Use, Privacy Policy, AI disclaimer, data deletion</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 10, marginBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  row: { borderRadius: 21, borderWidth: 1, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  rowSubtitle: { fontSize: 12 },
  accountCard: { borderWidth: 1, borderRadius: 21, padding: 16, marginBottom: 16 },
  profilePhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16 },
  profilePhoto: { width: 52, height: 52, borderRadius: 26 },
  profilePhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  locateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  photoButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  photoButtonText: { fontSize: 12, fontWeight: '800' },
  inputLabel: { fontSize: 11.5, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, fontSize: 13, marginBottom: 12 },
});
