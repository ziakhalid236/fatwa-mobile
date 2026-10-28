import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';

export default function SettingsScreen() {
  const colors = useColors();
  const nav = useNav();
  const { settings, setSettings, prayerCity, profile, setProfile } = useApp();
  const languages = [
    { key: 'en' as const, label: 'English' },
    { key: 'ur' as const, label: 'اردو' },
    { key: 'ar' as const, label: 'العربية' },
  ];

  const chooseProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled && result.assets[0]?.uri) setProfile({ avatarUri: result.assets[0].uri });
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

      <SectionTitle title="Content language" subtitle="Choose English, اردو, or العربية. Location detection can set the country language automatically." />
      <View style={styles.languageRow}>
        {languages.map((language) => {
          const active = settings.language === language.key;
          return (
            <Pressable
              key={language.key}
              onPress={() => setSettings({ language: language.key, autoLanguage: false })}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.languageChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
            >
              <Text style={[styles.languageText, { color: active ? colors.primaryForeground : colors.foreground }]}>{language.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle title="Account" subtitle="Stay in guest mode or add your name for personalised question replies." />
      <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.profilePhotoRow}>
          {profile.avatarUri ? <Image source={{ uri: profile.avatarUri }} style={styles.profilePhoto} contentFit="cover" /> : <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder, { backgroundColor: colors.primarySoft }]}><Feather name="user" size={22} color={colors.primary} /></View>}
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Profile photo</Text>
            <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Stored privately on this device.</Text>
          </View>
          <Pressable onPress={() => void chooseProfilePhoto()} style={[styles.photoButton, { borderColor: colors.border }]} accessibilityRole="button">
            <Text style={[styles.photoButtonText, { color: colors.primary }]}>{profile.avatarUri ? 'Change' : 'Add'}</Text>
          </Pressable>
        </View>
        <Text style={[styles.inputLabel, { color: colors.foreground }]}>Your name</Text>
        <TextInput value={profile.name} onChangeText={(value) => setProfile({ name: value })} placeholder="Guest name (optional)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} autoCapitalize="words" />
        <Text style={[styles.inputLabel, { color: colors.foreground }]}>City / country</Text>
        <TextInput value={profile.city} onChangeText={(value) => setProfile({ city: value })} placeholder="Your location (optional)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} autoCapitalize="words" />
      </View>

      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="crosshairs-gps" size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Use location language</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Pakistan → اردو · Arab countries → العربية</Text>
        </View>
        <Switch
          value={settings.autoLanguage}
          onValueChange={(value) => setSettings({ autoLanguage: value })}
          trackColor={{ false: colors.border, true: colors.teal }}
          thumbColor="#FFFFFF"
        />
      </View>

      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="translate" size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Translate posts automatically</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Use Urdu or Arabic translations in the feed</Text>
        </View>
        <Switch
          value={settings.autoTranslate}
          onValueChange={(value) => setSettings({ autoTranslate: value })}
          trackColor={{ false: colors.border, true: colors.teal }}
          thumbColor="#FFFFFF"
        />
      </View>

      <SectionTitle title="Prayer tools" />
      <Pressable
        onPress={() => nav.push({ name: 'prayerSettings' })}
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="compass-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Qibla & Adhan alarms</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Prayer city: {prayerCity.name} · Hanafi timings</Text>
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
  languageRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  languageChip: { borderWidth: 1, borderRadius: 17, paddingHorizontal: 15, paddingVertical: 10 },
  languageText: { fontSize: 12.5, fontWeight: '700' },
  accountCard: { borderWidth: 1, borderRadius: 21, padding: 16, marginBottom: 16 },
  profilePhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16 },
  profilePhoto: { width: 52, height: 52, borderRadius: 26 },
  profilePhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  photoButtonText: { fontSize: 12, fontWeight: '800' },
  inputLabel: { fontSize: 11.5, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, fontSize: 13, marginBottom: 12 },
});
