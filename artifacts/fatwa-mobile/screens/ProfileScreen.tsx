import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Avatar, InfoBanner, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';
import { prayerCities } from '@/data/content';

function ProfileRow({
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  badge?: number;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.86 : 1 },
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
        <Feather name={icon} size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>{badge}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function ProfileScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const colors = useColors();
  const nav = useNav();
  const {
    profile,
    setProfile,
    questions,
    savedPostIds,
    notifications,
    unreadCount,
    settings,
    setSettings,
    prayerCity,
    setPrayerCity,
    clearLocalData,
  } = useApp();

  const answered = questions.filter((item) => item.status === 'Answered').length;

  const confirmClear = () => {
    Alert.alert(
      'Clear local data?',
      'This removes your profile, saved posts, questions, and notifications from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear data',
          style: 'destructive',
          onPress: () => {
            clearLocalData();
            Alert.alert('Data cleared', 'Your local Fatwa data has been removed.');
          },
        },
      ],
    );
  };

  return (
    <View style={uiStyles.screenPadding}>
      <LinearGradient
        colors={[colors.forest, colors.green]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.bannerAvatar}>
          <Feather name="user" size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerName}>{profile.name.trim() || 'Guest reader'}</Text>
          <Text style={styles.bannerSub}>{profile.city.trim() || 'Your private Fatwa profile'}</Text>
        </View>
        <Pressable onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="Settings">
          <Feather name="settings" size={20} color="#FFFFFF" />
        </Pressable>
      </LinearGradient>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{questions.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Questions</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{answered}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Answered</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{savedPostIds.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Saved</Text>
        </View>
      </View>

      <SectionTitle title="Your details" />
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Full name</Text>
      <TextInput
        value={profile.name}
        onChangeText={(value) => setProfile({ name: value })}
        placeholder="Enter your name"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
        autoCapitalize="words"
      />
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>City / country</Text>
      <TextInput
        value={profile.city}
        onChangeText={(value) => setProfile({ city: value })}
        placeholder="Enter your city"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
        autoCapitalize="words"
      />

      <SectionTitle title="Your space" />
      <ProfileRow
        icon="message-square"
        title="My questions"
        subtitle={questions.length ? `${questions.length} submitted` : 'Track your requests'}
        onPress={() => nav.goTab('questions')}
      />
      <ProfileRow
        icon="bookmark"
        title="Saved posts"
        subtitle={savedPostIds.length ? `${savedPostIds.length} saved` : 'Nothing saved yet'}
        onPress={() => nav.push({ name: 'saved' })}
      />
      <ProfileRow
        icon="bell"
        title="Notifications"
        subtitle={notifications.length ? `${notifications.length} alerts` : 'Alerts and updates'}
        badge={unreadCount}
        onPress={() => nav.push({ name: 'notifications' })}
      />
      <ProfileRow
        icon="compass"
        title="Qibla & adhan"
        subtitle={`Prayer city: ${prayerCity.name}`}
        onPress={() => nav.push({ name: 'prayerSettings' })}
      />

      <SectionTitle title="Preferences" />
      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="bell-ring-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Answer notifications</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
            Alert me when a reply is published
          </Text>
        </View>
        <Switch
          value={settings.notificationsEnabled}
          onValueChange={(value) => setSettings({ notificationsEnabled: value })}
          trackColor={{ false: colors.border, true: colors.teal }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Answer notifications"
        />
      </View>

      <View style={styles.cityWrap}>
        {prayerCities.map((city) => {
          const active = city.name === prayerCity.name;
          return (
            <Pressable
              key={city.name}
              onPress={() => setPrayerCity(city)}
              style={[
                styles.cityChip,
                {
                  backgroundColor: active ? colors.primarySoft : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.cityChipText, { color: active ? colors.primary : colors.foreground }]}>
                {city.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle title="About" />
      <ProfileRow
        icon="info"
        title="About Fatwa"
        subtitle="Islamic guidance, history, and reflection"
        onPress={() =>
          Alert.alert(
            'About Fatwa',
            'Fatwa brings you reviewed guidance, Islamic history, and poetry, and lets you send private questions to scholars.',
          )
        }
      />
      <View style={{ marginBottom: 16 }}>
        <InfoBanner
          icon="lock"
          text="Your profile, saved posts, and questions are stored on this device."
        />
      </View>

      <Pressable
        onPress={confirmClear}
        style={[styles.dangerButton, { borderColor: colors.border }]}
        accessibilityRole="button"
      >
        <Feather name="trash-2" size={17} color={colors.coral} />
        <Text style={[styles.dangerText, { color: colors.coral }]}>Clear local data</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 8 },
  bannerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerName: { fontSize: 16.5, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  bannerSub: { fontSize: 11.5, color: '#DCEFE7' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 6 },
  statBox: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 3 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 14,
    fontSize: 13.5,
    marginBottom: 15,
  },
  row: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  rowIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 13.5, fontWeight: '700', marginBottom: 3 },
  rowSubtitle: { fontSize: 11.5 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  cityWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  cityChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  cityChipText: { fontSize: 12, fontWeight: '700' },
  dangerButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginBottom: 24,
  },
  dangerText: { fontSize: 13.5, fontWeight: '700' },
});
