import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar, Pill, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';
import { formatCount } from '@/components/PostCard';

export default function PostDetailScreen({ postId }: { postId: string }) {
  const colors = useColors();
  const nav = useNav();
  const {
    posts,
    likedPostIds,
    savedPostIds,
    viewedPostIds,
    toggleLike,
    toggleSaved,
    registerView,
  } = useApp();

  const post = useMemo(() => posts.find((item) => item.id === postId), [posts, postId]);

  if (!post) {
    return (
      <View style={uiStyles.screenPadding}>
        <Text style={[styles.missing, { color: colors.mutedForeground }]}>
          This post is no longer available.
        </Text>
      </View>
    );
  }

  const liked = likedPostIds.includes(post.id);
  const saved = savedPostIds.includes(post.id);
  const accent = (colors as unknown as Record<string, string>)[post.accent] ?? colors.primary;

  const related = posts.filter((item) => item.id !== post.id && item.category === post.category).slice(0, 3);

  return (
    <View>
      <View style={[styles.hero, { backgroundColor: colors.forest }]}>
        <View style={[styles.heroAccent, { backgroundColor: accent }]} />
        <Pill label={post.category} tone="primary" />
        <Text style={styles.heroTitle}>{post.title}</Text>
        <View style={styles.heroMeta}>
          <Avatar size={30} />
          <View>
            <Text style={styles.heroAuthor}>{post.author}</Text>
            <Text style={styles.heroDate}>{post.date}</Text>
          </View>
        </View>
      </View>

      <View style={uiStyles.screenPadding}>
        <View style={[styles.bodyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.bodyText, { color: colors.foreground }]}>{post.body}</Text>
          {post.source ? (
            <View style={[styles.source, { borderTopColor: colors.border }]}>
              <Feather name="book-open" size={14} color={colors.primary} />
              <Text style={[styles.sourceText, { color: colors.mutedForeground }]}>{post.source}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {formatCount(post.likes + (liked ? 1 : 0))}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Likes</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {formatCount(post.views + (viewedPostIds.includes(post.id) ? 1 : 0))}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Views</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {formatCount(Math.round(post.likes / 12))}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Saves</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              toggleLike(post.id);
            }}
            style={[
              styles.actionButton,
              {
                backgroundColor: liked ? colors.coral : colors.card,
                borderColor: liked ? colors.coral : colors.border,
              },
            ]}
            accessibilityRole="button"
          >
            <Feather name="heart" size={17} color={liked ? '#FFFFFF' : colors.foreground} />
            <Text style={[styles.actionText, { color: liked ? '#FFFFFF' : colors.foreground }]}>
              {liked ? 'Liked' : 'Like'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              toggleSaved(post.id);
            }}
            style={[
              styles.actionButton,
              {
                backgroundColor: saved ? colors.primary : colors.card,
                borderColor: saved ? colors.primary : colors.border,
              },
            ]}
            accessibilityRole="button"
          >
            <Feather name="bookmark" size={17} color={saved ? colors.primaryForeground : colors.foreground} />
            <Text
              style={[styles.actionText, { color: saved ? colors.primaryForeground : colors.foreground }]}
            >
              {saved ? 'Saved' : 'Save'}
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
            style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Feather name="share-2" size={17} color={colors.foreground} />
            <Text style={[styles.actionText, { color: colors.foreground }]}>Share</Text>
          </Pressable>
        </View>

        <PrimaryButton
          label="Ask a related question"
          icon="edit-3"
          onPress={nav.openAsk}
        />

        {related.length ? (
          <>
            <Text style={[styles.relatedTitle, { color: colors.foreground }]}>More in {post.category}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRow}>
              {related.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    registerView(item.id);
                    nav.push({ name: 'post', postId: item.id });
                  }}
                  style={[styles.relatedCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="book-open-outline" size={18} color={colors.primary} />
                  <Text style={[styles.relatedCardTitle, { color: colors.foreground }]} numberOfLines={3}>
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { fontSize: 14, textAlign: 'center', marginTop: 40 },
  hero: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  heroTitle: { fontSize: 25, lineHeight: 33, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginTop: 15 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  heroAuthor: { fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' },
  heroDate: { fontSize: 11.5, color: '#D5E7DB', marginTop: 3 },
  bodyCard: { borderRadius: 24, borderWidth: 1, padding: 19, marginTop: -16 },
  bodyText: { fontSize: 15.5, lineHeight: 27, letterSpacing: 0.05 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, marginTop: 16, paddingTop: 13 },
  sourceText: { fontSize: 11.5, fontWeight: '600', flex: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statBox: { flex: 1, borderRadius: 18, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: 9, marginTop: 16, marginBottom: 18 },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionText: { fontSize: 12, fontWeight: '700' },
  relatedTitle: { fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 13 },
  relatedRow: { gap: 11, paddingBottom: 6 },
  relatedCard: { width: 168, borderRadius: 20, borderWidth: 1, padding: 15, gap: 11 },
  relatedCardTitle: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
});
