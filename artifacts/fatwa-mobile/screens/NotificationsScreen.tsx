import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StarPattern } from '@/components/Art';
import { EmptyState, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';
import { containsArabic } from '@/lib/post-text';
import type { AppNotification } from '@/lib/types';

const kindMeta: Record<
  AppNotification['kind'],
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; tone: 'primary' | 'gold' | 'muted' }
> = {
  answer: { icon: 'check-decagram-outline', tone: 'primary' },
  fatwa: { icon: 'scale-balance', tone: 'primary' },
  post: { icon: 'book-open-variant', tone: 'gold' },
  system: { icon: 'information-outline', tone: 'muted' },
};

function dayBucket(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const d = new Date(iso); const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const nav = useNav();
  const { notifications, markNotificationRead, markAllNotificationsRead, clearNotifications } = useApp();
  const unread = notifications.filter((n) => !n.read).length;

  const toneColor = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    gold: { bg: colors.goldSoft, fg: colors.gold },
    muted: { bg: colors.muted, fg: colors.mutedForeground },
  } as const;

  const groups = (['Today', 'Yesterday', 'Earlier'] as const)
    .map((label) => ({ label, items: notifications.filter((n) => dayBucket(n.createdAt) === label) }))
    .filter((g) => g.items.length);

  return (
    <View style={uiStyles.screenPadding}>
      <LinearGradient colors={[colors.forest, colors.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <StarPattern opacity={0.12} size={46} />
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}><Feather name="bell" size={22} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Notifications</Text>
            <Text style={styles.heroCopy}>{unread ? `${unread} new ${unread === 1 ? 'update' : 'updates'} for you` : notifications.length ? 'You are all caught up' : 'Answers and updates appear here'}</Text>
          </View>
          {unread ? <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{unread > 99 ? '99+' : unread}</Text></View> : null}
        </View>
        {notifications.length ? (
          <View style={styles.heroActions}>
            <Pressable onPress={markAllNotificationsRead} style={styles.heroBtn} accessibilityRole="button">
              <Feather name="check-circle" size={14} color="#FFFFFF" />
              <Text style={styles.heroBtnText}>Mark all read</Text>
            </Pressable>
            <Pressable onPress={clearNotifications} style={styles.heroBtn} accessibilityRole="button">
              <Feather name="trash-2" size={14} color="#FFFFFF" />
              <Text style={styles.heroBtnText}>Clear</Text>
            </Pressable>
          </View>
        ) : null}
      </LinearGradient>

      {notifications.length ? (
        groups.map((group) => (
          <View key={group.label}>
            <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{group.label.toUpperCase()}</Text>
            {group.items.map((item) => {
              const baseMeta = kindMeta[item.kind];
              const meta = item.tone === 'broadcast' ? { icon: 'bullhorn-outline' as const, tone: 'gold' as const }
                : item.tone === 'pending' ? { icon: 'clock-outline' as const, tone: 'muted' as const }
                : item.tone === 'approved' ? { icon: 'check-circle-outline' as const, tone: 'primary' as const }
                : item.tone === 'rejected' ? { icon: 'close-circle-outline' as const, tone: 'muted' as const }
                : baseMeta;
              const tone = toneColor[meta.tone];
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    markNotificationRead(item.id);
                    if (item.kind === 'answer' && item.refId) nav.push({ name: 'questionDetail', questionId: item.refId });
                    else if (item.kind === 'answer') nav.goTab('questions');
                    else if (item.kind === 'fatwa' && item.refId) nav.push({ name: 'fatwa', fatwaId: item.refId });
                    else if (item.kind === 'post' && item.refId) nav.push({ name: 'post', postId: item.refId });
                  }}
                  style={[styles.noteCard, { backgroundColor: item.read ? colors.card : colors.primarySoft, borderColor: item.read ? colors.border : 'transparent' }]}
                  accessibilityRole="button"
                >
                  <View style={[styles.accent, { backgroundColor: item.read ? 'transparent' : colors.primary }]} />
                  <View style={[styles.noteIcon, { backgroundColor: item.read ? tone.bg : colors.card }]}>
                    <MaterialCommunityIcons name={meta.icon} size={20} color={tone.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.noteTop}>
                      <Text style={[styles.noteTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                      <Text style={[styles.noteTime, { color: colors.mutedForeground }]}>{relativeTime(item.createdAt)}</Text>
                    </View>
                    <Text style={[styles.noteBody, containsArabic(item.body) && { textAlign: 'right', writingDirection: 'rtl' }, { color: colors.mutedForeground }]} numberOfLines={3}>{item.body}</Text>
                    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.notePreview} contentFit="cover" accessibilityLabel="Post preview" /> : null}
                    {item.refId && item.kind !== 'system' ? (
                      <View style={styles.linkRow}>
                        <Text style={[styles.noteLink, { color: colors.primary }]}>{item.kind === 'post' ? 'View post' : item.kind === 'answer' ? 'Read answer' : 'Open'}</Text>
                        <Feather name="arrow-right" size={13} color={colors.primary} />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))
      ) : (
        <EmptyState
          icon="bell"
          title="No notifications yet"
          copy="When a scholar answers your question or new guidance is published, you will see it here."
          action="Ask a question"
          onAction={nav.openAsk}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: 20, marginTop: 8, marginBottom: 6, overflow: 'hidden', gap: 16 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(230,211,163,0.5)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroCopy: { color: '#DCEFE7', fontSize: 12.5, marginTop: 3 },
  heroBadge: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: '#E6D3A3', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  heroBadgeText: { color: '#3b2f08', fontSize: 13, fontWeight: '900' },
  heroActions: { flexDirection: 'row', gap: 9 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9 },
  heroBtnText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
  groupLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, marginTop: 18, marginBottom: 10, marginLeft: 4 },
  noteCard: { borderRadius: 22, borderWidth: 1, padding: 15, paddingLeft: 17, flexDirection: 'row', gap: 12, marginBottom: 11, overflow: 'hidden', elevation: 1, shadowColor: '#0D594B', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  noteIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  noteTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  noteBody: { fontSize: 12.5, lineHeight: 19, marginTop: 5 },
  notePreview: { width: '100%', height: 140, borderRadius: 16, marginTop: 10, backgroundColor: '#E5F2EC' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  noteLink: { fontSize: 12, fontWeight: '800' },
  noteTime: { fontSize: 10.5, fontWeight: '600' },
});
