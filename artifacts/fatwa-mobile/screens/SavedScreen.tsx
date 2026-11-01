import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PostCard } from '@/components/PostCard';
import { EmptyState, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { sharePost } from '@/lib/share';
import { useApp } from '@/lib/store';

export default function SavedScreen() {
  const colors = useColors();
  const nav = useNav();
  const {
    posts,
    savedPostIds,
    likedPostIds,
    viewedPostIds,
    toggleLike,
    toggleSaved,
    registerView,
  } = useApp();

  const saved = useMemo(
    () => posts.filter((post) => savedPostIds.includes(post.id)),
    [posts, savedPostIds],
  );

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>BOOKMARKS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Saved posts</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Keep guidance and reflections close for later reading.
        </Text>
      </View>

      {saved.length ? (
        saved.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            liked={likedPostIds.includes(post.id)}
            saved
            views={post.views + (viewedPostIds.includes(post.id) ? 1 : 0)}
            onToggleLike={() => toggleLike(post.id)}
            onToggleSave={() => toggleSaved(post.id)}
            onOpen={() => {
              registerView(post.id);
              nav.push({ name: 'post', postId: post.id });
            }}
            onShare={() => { void sharePost(post); }}
            onAuthor={post.authorId ? () => nav.push({ name: 'user', userId: post.authorId as string }) : undefined}
          />
        ))
      ) : (
        <EmptyState
          icon="bookmark"
          title="Nothing saved yet"
          copy="Tap the bookmark on a post to keep it here."
          action="Browse posts"
          onAction={() => nav.goTab('home')}
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
});
