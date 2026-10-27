import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar, Pill } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { cleanPostBody, containsArabic } from '@/lib/post-text';
import type { Post } from '@/lib/types';

export const POST_CARD_BODY_LINES = 5;

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
  const excerpt = cleanPostBody(post.title, post.body);
  const isRtl = containsArabic(`${post.title}\n${excerpt}`);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderTopColor: colors.gold,
          shadowColor: colors.shadow,
        },
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
              <Feather name={post.city ? 'map-pin' : 'globe'} size={11} color={colors.mutedForeground} />
              {post.city ? <Text style={[styles.date, { color: colors.mutedForeground }]} numberOfLines={1}>{post.city}</Text> : null}
            </View>
          </View>
          <Pill
            label={post.category}
            icon={categoryIcon[post.category]}
            tone={categoryTone[post.category]}
          />
        </View>

        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={post.title}>
          <Text
            style={[styles.title, isRtl && styles.rtlTitle, { color: colors.foreground }]}
            numberOfLines={isRtl ? 3 : 2}
          >
            {post.title}
          </Text>
          <Text
            style={[styles.excerpt, isRtl && styles.rtlExcerpt, { color: colors.mutedForeground }]}
            numberOfLines={isRtl ? 6 : POST_CARD_BODY_LINES}
          >
            {excerpt}
          </Text>
        </Pressable>

        {post.imageUrl ? (
          <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open post photo">
            <Image source={{ uri: post.imageUrl }} style={styles.postImage} contentFit="cover" />
          </Pressable>
        ) : null}

        <View style={[styles.footer, { borderTopColor: colors.border }]}> 
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              onToggleLike();
            }}
            style={({ pressed }) => [
              styles.action,
              {
                 backgroundColor: liked ? colors.coralSoft : colors.cardMuted,
                opacity: pressed ? 0.72 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unlike post' : 'Like post'}
            accessibilityState={{ selected: liked }}
            testID={`like-${post.id}`}
          >
            <MaterialCommunityIcons
              name={liked ? 'heart' : 'heart-outline'}
              size={17}
              color={liked ? colors.coral : colors.mutedForeground}
            />
            <Text style={[styles.actionText, { color: liked ? colors.coral : colors.mutedForeground }]}>
              {formatCount(post.likes + (liked ? 1 : 0))}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              onToggleSave();
            }}
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor: saved ? colors.primarySoft : colors.cardMuted,
                opacity: pressed ? 0.72 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
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
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: colors.cardMuted, opacity: pressed ? 0.72 : 1 },
            ]}
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
                message: `${post.title}\n\n${excerpt}\n\nShared from Fatwa App.`,
              }).catch(() => undefined);
            }}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: colors.cardMuted, opacity: pressed ? 0.72 : 1 },
            ]}
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
    borderRadius: 24,
    borderWidth: 1,
    borderTopWidth: 3,
    marginBottom: 14,
    overflow: 'hidden',
    shadowOpacity: 0.065,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  body: { padding: 17 },
  authorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  authorMeta: { flex: 1 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  metaDot: { fontSize: 12 },
  date: { fontSize: 10.5, fontWeight: '500' },
  title: { fontSize: 20, lineHeight: 29, fontWeight: '800', letterSpacing: -0.2, marginBottom: 9 },
  rtlTitle: { fontSize: 20, lineHeight: 34, letterSpacing: 0, textAlign: 'right', writingDirection: 'rtl', includeFontPadding: true },
  excerpt: { fontSize: 14, lineHeight: 23, marginBottom: 15 },
  postImage: { width: '100%', height: 220, borderRadius: 18, marginTop: 2 },
  rtlExcerpt: { fontSize: 16, lineHeight: 30, textAlign: 'right', writingDirection: 'rtl', includeFontPadding: true },
  author: { fontSize: 13, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 9,
    paddingTop: 10,
    marginHorizontal: -17,
    paddingHorizontal: 17,
    gap: 6,
  },
  action: { flex: 1, minWidth: 0, minHeight: 40, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
  actionText: { fontSize: 11, fontWeight: '800' },
});
