import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';
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

  const toneColor = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    gold: { bg: colors.goldSoft, fg: colors.gold },
    muted: { bg: colors.muted, fg: colors.mutedForeground },
  } as const;

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Answers to your questions, new guidance, and alarm updates appear here.
        </Text>
      </View>

      {notifications.length ? (
        <>
          <View style={styles.toolbar}>
            <Pressable
              onPress={markAllNotificationsRead}
              style={[styles.toolButton, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Feather name="check-circle" size={14} color={colors.foreground} />
              <Text style={[styles.toolText, { color: colors.foreground }]}>Mark all read</Text>
            </Pressable>
            <Pressable
              onPress={clearNotifications}
              style={[styles.toolButton, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Feather name="trash-2" size={14} color={colors.coral} />
              <Text style={[styles.toolText, { color: colors.coral }]}>Clear</Text>
            </Pressable>
          </View>

          {notifications.map((item) => {
            const meta = kindMeta[item.kind];
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
                style={[
                  styles.noteCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: item.read ? colors.border : colors.primary,
                  },
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.noteIcon, { backgroundColor: tone.bg }]}>
                  <MaterialCommunityIcons name={meta.icon} size={19} color={tone.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.noteTop}>
                    <Text style={[styles.noteTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {!item.read ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
                  </View>
                  <Text style={[styles.noteBody, { color: colors.mutedForeground }]}>{item.body}</Text>
                  <Text style={[styles.noteTime, { color: colors.mutedForeground }]}>
                    {relativeTime(item.createdAt)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </>
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
  head: { marginTop: 10, marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  toolbar: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  toolButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  toolText: { fontSize: 11.5, fontWeight: '700' },
  noteCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 15,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  noteIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  noteTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  noteBody: { fontSize: 12.5, lineHeight: 19, marginTop: 5 },
  noteTime: { fontSize: 10.5, marginTop: 8, fontWeight: '600' },
});
