import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui';
import { InlineVideo, VideoPoster } from '@/components/InlineVideo';
import { useColors } from '@/hooks/useColors';
import { sharePost } from '@/lib/share';
import { cleanPostBody, containsArabic } from '@/lib/post-text';
import type { Post } from '@/lib/types';

export const POST_CARD_BODY_LINES = 5;

export function formatCount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
}

export function timeAgo(value?: string): string {
  if (!value) return '';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
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
  onAuthor,
  onVisible,
  visibilityTick = 0,
  nearby = false,
}: {
  post: Post;
  liked: boolean;
  saved: boolean;
  views: number;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onOpen: () => void;
  onShare: () => void;
  onAuthor?: () => void;
  onVisible?: () => void;
  visibilityTick?: number;
  nearby?: boolean;
}) {
  const colors = useColors();
  const cardRef = useRef<View>(null);
  const reportedVisible = useRef(false);
  const [onScreen, setOnScreen] = useState(false);
  // Only video cards need scroll-position measurement; plain text and photo
  // cards skip the work entirely.
  const tracksVisibility = Boolean(post.videoUrl);
  const checkVisibility = useCallback(() => {
    if (!tracksVisibility) return;
    requestAnimationFrame(() => {
      cardRef.current?.measureInWindow((_x, y, _width, height) => {
        const screenHeight = Dimensions.get('window').height;
        const visible = y + height > 72 && y < screenHeight - 84;
        setOnScreen(visible);
        if (visible && onVisible && !reportedVisible.current) {
          reportedVisible.current = true;
          onVisible();
        }
      });
    });
  }, [onVisible, tracksVisibility]);
  useEffect(() => { checkVisibility(); }, [checkVisibility, visibilityTick]);
  const excerpt = cleanPostBody(post.title, post.body);
  const imageOnly = Boolean(post.imageUrl && !post.body.trim());
  const isRtl = containsArabic(`${post.title}\n${excerpt}`);
  // Community posts get an automatic title from the first words of the text; do not print it twice.
  const titleIsPrefix = Boolean(post.title.trim()) && post.body.trim().startsWith(post.title.trim());
  const showTitle = Boolean(post.title.trim()) && !titleIsPrefix;
  const bodyText = titleIsPrefix ? post.body.trim() : excerpt;
  const meta = [post.city, timeAgo(post.createdAt)].filter(Boolean).join(' · ');

  return (
    <View
      ref={cardRef}
      onLayout={checkVisibility}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
      testID={`post-card-${post.id}`}
    >
      <View style={styles.body}>
        <Pressable style={styles.authorHeader} onPress={onAuthor} disabled={!onAuthor} accessibilityRole={onAuthor ? 'button' : undefined}>
          {post.authorImageUrl ? <Image source={{ uri: post.authorImageUrl }} cachePolicy="disk" style={styles.authorAvatar} contentFit="cover" /> : <Avatar size={38} icon="user" />}
          <View style={styles.authorMeta}>
            <Text style={[styles.author, { color: colors.foreground }]} numberOfLines={1}>
              {post.author}
            </Text>
            {meta ? <View style={styles.metaLine}><Feather name="map-pin" size={11} color={colors.mutedForeground} /><Text style={[styles.date, { color: colors.mutedForeground }]} numberOfLines={1}>{meta}</Text></View> : null}
          </View>
          {nearby ? <View style={[styles.nearby, { backgroundColor: colors.primarySoft }]}><Text style={[styles.nearbyText, { color: colors.primary }]}>Near you</Text></View> : null}
        </Pressable>

        {!imageOnly ? <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={post.title}>
          {showTitle ? (
            <Text
              style={[styles.title, isRtl && styles.rtlTitle, { color: colors.foreground }]}
              numberOfLines={isRtl ? 3 : 2}
            >
              {post.title}
            </Text>
          ) : null}
          {bodyText ? <Text style={[styles.excerpt, !showTitle && styles.excerptMain, isRtl && styles.rtlExcerpt, { color: showTitle ? colors.mutedForeground : colors.foreground }]} numberOfLines={isRtl ? 6 : POST_CARD_BODY_LINES}>{bodyText}</Text> : null}
        </Pressable> : null}

        {post.imageUrl ? (
          <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open post photo">
            <Image source={{ uri: post.imageUrl }} cachePolicy="disk" style={[styles.postImage, { backgroundColor: colors.cardMuted }]} contentFit="contain" />
          </Pressable>
        ) : null}

        {post.videoUrl ? (
          onScreen
            ? <InlineVideo uri={post.videoUrl} active durationMs={post.videoDurationMs} onOpen={onOpen} />
            : <VideoPoster durationMs={post.videoDurationMs} onOpen={onOpen} />
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
              void sharePost(post);
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
    borderRadius: 26,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
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
  excerptMain: { fontSize: 15.5, lineHeight: 25 },
  nearby: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  nearbyText: { fontSize: 10.5, fontWeight: '800' },
  postImage: { width: '100%', height: 240, borderRadius: 20, marginTop: 2, marginBottom: 4 },
  rtlExcerpt: { fontSize: 16, lineHeight: 30, textAlign: 'right', writingDirection: 'rtl', includeFontPadding: true },
  author: { fontSize: 13, fontWeight: '700' },
  authorAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E5F2EC' },
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
  action: { flex: 1, minWidth: 0, minHeight: 40, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
  actionText: { fontSize: 11, fontWeight: '800' },
});
