import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { AuthPanel } from '@/components/AuthPanel';
import { ProfileView } from '@/components/ProfileView';
import { InfoBanner, PrimaryButton, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';

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
    questions,
    savedPostIds,
    notifications,
    unreadCount,
    settings,
    setSettings,
    prayerCity,
    clearLocalData,
  } = useApp();


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

  const { signedIn } = useApp();
  const head = signedIn ? (
    <View style={{ marginTop: 10 }}>
      {profile.id ? <ProfileView userId={profile.id} self onEdit={onOpenSettings} /> : <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />}
    </View>
  ) : (
    <View style={[styles.guest, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.guestIcon, { backgroundColor: colors.primarySoft }]}><Feather name="user" size={30} color={colors.primary} /></View>
      <Text style={[styles.guestTitle, { color: colors.foreground }]}>Create your profile</Text>
      <Text style={[styles.guestCopy, { color: colors.mutedForeground }]}>Share posts, build your own page and get notified when your questions are answered.</Text>
      <AuthPanel onDone={() => undefined} />
      <PrimaryButton label="Set up with name and city" icon="user-plus" onPress={onOpenSettings} />
    </View>
  );

  return (
    <View style={uiStyles.screenPadding}>
      {head}

      <View style={{ height: 14 }} />
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
        icon="bell"
        title="Prayer alarms"
        subtitle={`GPS prayer times · ${prayerCity.name}`}
        onPress={() => nav.push({ name: 'prayerSettings' })}
      />
      <ProfileRow
        icon="compass"
        title="Qibla direction"
        subtitle="Open the live compass"
        onPress={() => nav.push({ name: 'qiblaSettings' })}
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
  guest: { borderWidth: 1, borderRadius: 26, padding: 22, marginTop: 10, gap: 12, alignItems: 'stretch' },
  guestIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  guestTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  guestCopy: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  banner: { borderRadius: 26, padding: 19, flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 10 },
  bannerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bannerAvatarImage: { width: '100%', height: '100%' },
  bannerName: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  bannerSub: { fontSize: 12, color: '#DCEFE7' },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 14, marginBottom: 8 },
  statBox: { flex: 1, borderRadius: 18, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 3 },
  row: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  rowIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  rowSubtitle: { fontSize: 12 },
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
