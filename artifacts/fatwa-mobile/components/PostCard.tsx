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

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
      ]}
      testID={`post-card-${post.id}`}
    >
      <View style={styles.body}>
        <View style={styles.authorHeader}>
          <Avatar size={38} icon="user" />
          <View style={styles.authorMeta}>
            <Text style={[styles.author, { color: colors.foreground }]} numberOfLines={1}>
              {post.author}
            </Text>
            <View style={styles.metaLine}>
              <Text style={[styles.date, { color: colors.mutedForeground }]}>{post.date}</Text>
              <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>•</Text>
              <Feather name="globe" size={11} color={colors.mutedForeground} />
            </View>
          </View>
          <Pill
            label={post.category}
            icon={categoryIcon[post.category]}
            tone={categoryTone[post.category]}
          />
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
  body: { padding: 17 },
  authorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  authorMeta: { flex: 1 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  metaDot: { fontSize: 12 },
  date: { fontSize: 10.5, fontWeight: '500' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3, marginBottom: 9 },
  excerpt: { fontSize: 13, lineHeight: 20, marginBottom: 15 },
  author: { fontSize: 13, fontWeight: '700' },
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
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 5 },
  actionText: { fontSize: 11.5, fontWeight: '700' },
});
