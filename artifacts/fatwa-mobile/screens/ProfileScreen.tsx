import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthPanel } from '@/components/AuthPanel';
import { ProfileView } from '@/components/ProfileView';
import { uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';

type MenuItem = { icon: keyof typeof Feather.glyphMap; label: string; badge?: number; danger?: boolean; onPress: () => void };

export default function ProfileScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const colors = useColors();
  const nav = useNav();
  const { profile, questions, savedPostIds, unreadCount, clearLocalData, signedIn, membership } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  const confirmClear = () => {
    Alert.alert('Clear local data?', 'This removes your profile, saved posts, questions, and notifications from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear data', style: 'destructive', onPress: () => { clearLocalData(); Alert.alert('Data cleared', 'Your local Fatwa data has been removed.'); } },
    ]);
  };

  const go = (action: () => void) => () => { setMenuOpen(false); action(); };
  const items: MenuItem[] = [
    { icon: 'award', label: membership.plan === 'free' ? 'Explore memberships' : 'Manage membership', onPress: go(() => nav.push({ name: 'membership' })) },
    { icon: 'bookmark', label: savedPostIds.length ? `Saved posts (${savedPostIds.length})` : 'Saved posts', onPress: go(() => nav.push({ name: 'saved' })) },
    { icon: 'settings', label: 'Settings', onPress: go(onOpenSettings) },
    { icon: 'message-square', label: questions.length ? `My questions (${questions.length})` : 'My questions', onPress: go(() => nav.goTab('questions')) },
    { icon: 'bell', label: 'Notifications', badge: unreadCount, onPress: go(() => nav.push({ name: 'notifications' })) },
    { icon: 'clock', label: 'Prayer alarms', onPress: go(() => nav.push({ name: 'prayerSettings' })) },
    { icon: 'compass', label: 'Qibla direction', onPress: go(() => nav.push({ name: 'qiblaSettings' })) },
    { icon: 'shield', label: 'About & legal', onPress: go(() => nav.push({ name: 'legalIndex' })) },
    { icon: 'trash-2', label: 'Clear local data', danger: true, onPress: go(confirmClear) },
  ];

  const toolbar = (
    <View style={styles.toolbar}>
      <Pressable onPress={() => nav.push({ name: 'notifications' })} style={[styles.toolBtn, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Notifications" testID="profile-notifications">
        <Feather name="bell" size={18} color={colors.foreground} />
        {unreadCount > 0 ? <View style={[styles.dot, { backgroundColor: colors.coral }]} /> : null}
      </Pressable>
      <Pressable onPress={() => setMenuOpen(true)} style={[styles.toolBtn, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="More options" testID="profile-menu">
        <Feather name="more-vertical" size={19} color={colors.foreground} />
        {unreadCount > 0 ? <View style={[styles.dot, { backgroundColor: colors.coral }]} /> : null}
      </Pressable>
    </View>
  );

  return (
    <View style={uiStyles.screenPadding}>
      {toolbar}
      {signedIn ? (
        profile.id ? <ProfileView userId={profile.id} self onEdit={onOpenSettings} /> : <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
      ) : (
        <View style={[styles.guest, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.guestIcon, { backgroundColor: colors.primarySoft }]}><Feather name="user" size={30} color={colors.primary} /></View>
          <Text style={[styles.guestTitle, { color: colors.foreground }]}>Sign in to Fatwa</Text>
          <Text style={[styles.guestCopy, { color: colors.mutedForeground }]}>Share posts, build your own page and get notified when your questions are answered.</Text>
          <AuthPanel onDone={() => undefined} />
        </View>
      )}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {items.map((item, index) => (
              <Pressable key={item.label} onPress={item.onPress} style={[styles.menuRow, index < items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]} accessibilityRole="button">
                <Feather name={item.icon} size={18} color={item.danger ? colors.coral : colors.primary} />
                <Text style={[styles.menuLabel, { color: item.danger ? colors.coral : colors.foreground }]}>{item.label}</Text>
                {item.badge ? <View style={[styles.badge, { backgroundColor: colors.primary }]}><Text style={styles.badgeText}>{item.badge}</Text></View> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4, marginBottom: 10 },
  toolBtn: { minWidth: 42, height: 42, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  toolCount: { fontSize: 12, fontWeight: '800' },
  dot: { position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'flex-end', paddingTop: 96, paddingRight: 16 },
  menu: { minWidth: 230, borderRadius: 18, borderWidth: 1, paddingVertical: 4, elevation: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  guest: { borderWidth: 1, borderRadius: 26, padding: 22, marginTop: 10, gap: 12, alignItems: 'stretch' },
  guestIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  guestTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  guestCopy: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
