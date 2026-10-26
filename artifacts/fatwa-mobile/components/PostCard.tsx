import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar, Pill } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import type { Post } from '@/lib/types';

export const POST_CARD_BODY_LINES = 3;

const categoryTone: Record<Post['category'], 'primary' | 'gold' | 'muted'> = {
  Islamic: 'primary',
  Seerah: 'primary',
  History: 'gold',
  Poetry: 'muted',
  Reflection: 'gold',
};

const categoryIcon: Record<Post['category'], keyof typeof MaterialCommunityIcons.glyphMap> = {
  Islamic: 'star-crescent',
  Seerah: 'account-group-outline',
  History: 'bank-outline',
  Poetry: 'feather',
  Reflection: 'heart-outline',
};

export function formatCount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
}

export function PostCard({
  post,
  liked,
  saved,
  views,
  onToggleLike,
  onToggleSave,
  onOpen,
  onShare,
}: {
  post: Post;
  liked: boolean;
  saved: boolean;
  views: number;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onOpen: () => void;
  onShare: () => void;
}) {
  const colors = useColors();
  const accent = (colors as unknown as Record<string, string>)[post.accent] ?? colors.primary;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
      ]}
      testID={`post-card-${post.id}`}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Pill
            label={post.category}
            icon={categoryIcon[post.category]}
            tone={categoryTone[post.category]}
          />
          <Text style={[styles.date, { color: colors.mutedForeground }]}>{post.date}</Text>
        </View>

        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={post.title}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {post.title}
          </Text>
          <Text
            style={[styles.excerpt, { color: colors.mutedForeground }]}
            numberOfLines={POST_CARD_BODY_LINES}
          >
            {post.body}
          </Text>
        </Pressable>

        <View style={[styles.authorRow, { borderTopColor: colors.border }]}>
          <Avatar size={26} icon="user" />
          <Text style={[styles.author, { color: colors.foreground }]} numberOfLines={1}>
            {post.author}
          </Text>
        </View>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              onToggleLike();
            }}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unlike post' : 'Like post'}
            testID={`like-${post.id}`}
          >
            <Feather name="heart" size={16} color={liked ? colors.coral : colors.mutedForeground} />
            <Text style={[styles.actionText, { color: liked ? colors.coral : colors.mutedForeground }]}>
              {formatCount(post.likes + (liked ? 1 : 0))}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              onToggleSave();
            }}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save post'}
            testID={`save-${post.id}`}
          >
            <Feather
              name="bookmark"
              size={16}
              color={saved ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[styles.actionText, { color: saved ? colors.primary : colors.mutedForeground }]}
            >
              {saved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onOpen}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={`${formatCount(views)} views`}
            testID={`views-${post.id}`}
          >
            <Feather name="eye" size={16} color={colors.mutedForeground} />
            <Text style={[styles.actionText, { color: colors.mutedForeground }]}>
              {formatCount(views)}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              void Share.share({
                title: post.title,
                message: `${post.title}\n\n${post.body}\n\nShared from Fatwa.`,
              }).catch(() => undefined);
            }}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel="Share post"
            testID={`share-${post.id}`}
          >
            <Feather name="share-2" size={16} color={colors.mutedForeground} />
            <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Share</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onOpen}
          style={({ pressed }) => [
            styles.moreButton,
            { backgroundColor: colors.primarySoft, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Read full post: ${post.title}`}
          testID={`more-${post.id}`}
        >
          <Text style={[styles.moreText, { color: colors.primary }]}>More</Text>
          <Feather name="arrow-right" size={15} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  accentBar: { height: 4, width: '100%' },
  body: { padding: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  date: { fontSize: 10.5, fontWeight: '500' },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: 7 },
  excerpt: { fontSize: 12.5, lineHeight: 19, marginBottom: 12 },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 11,
    borderTopWidth: 1,
  },
  author: { fontSize: 11.5, fontWeight: '600', flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 11,
    paddingTop: 10,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3 },
  actionText: { fontSize: 11.5, fontWeight: '600' },
  moreButton: {
    marginTop: 12,
    minHeight: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  moreText: { fontSize: 13, fontWeight: '700' },
});
