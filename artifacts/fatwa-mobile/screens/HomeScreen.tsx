import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PostCard } from '@/components/PostCard';
import { HeroCard, InfoBanner, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';
import type { PostCategory } from '@/lib/types';

const filters: Array<PostCategory | 'All'> = ['All', 'Islamic', 'History', 'Poetry', 'Reflection', 'Seerah'];

export default function HomeScreen() {
  const colors = useColors();
  const nav = useNav();
  const {
    profile,
    posts,
    likedPostIds,
    savedPostIds,
    viewedPostIds,
    toggleLike,
    toggleSaved,
    registerView,
  } = useApp();
  const [filter, setFilter] = useState<PostCategory | 'All'>('All');

  const visiblePosts = useMemo(
    () => (filter === 'All' ? posts : posts.filter((post) => post.category === filter)),
    [filter, posts],
  );

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>ASSALAMU ALAIKUM</Text>
          <Text style={[styles.greeting, { color: colors.foreground }]}>
            {profile.name.trim() ? `Welcome, ${profile.name.trim().split(' ')[0]}` : 'Knowledge & reflection'}
          </Text>
        </View>
        <Pressable
          onPress={() => nav.push({ name: 'notifications' })}
          style={[styles.bellButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Feather name="bell" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      <HeroCard
        eyebrow="Ask a scholar"
        title="A question on your mind?"
        subtitle="Send a private question and follow the answer here."
        icon="hands-pray"
        actionLabel="Ask a question"
        onAction={nav.openAsk}
        testID="ask-a-question"
      />

      <View style={styles.bannerWrap}>
        <InfoBanner
          icon="book-open"
          text="Posts cover Islamic guidance, Islamic history, and poetry. Open a post to read it in full."
        />
      </View>

      <SectionTitle title="Latest posts" subtitle={`${visiblePosts.length} posts`} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
      >
        {filters.map((item) => {
          const active = filter === item;
          return (
            <Pressable
              key={item}
              onPress={() => setFilter(item)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {visiblePosts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          liked={likedPostIds.includes(post.id)}
          saved={savedPostIds.includes(post.id)}
          views={post.views + (viewedPostIds.includes(post.id) ? 1 : 0)}
          onToggleLike={() => toggleLike(post.id)}
          onToggleSave={() => toggleSaved(post.id)}
          onOpen={() => {
            registerView(post.id);
            nav.push({ name: 'post', postId: post.id });
          }}
          onShare={() => undefined}
        />
      ))}

      <View style={styles.footerNote}>
        <MaterialCommunityIcons name="mosque" size={16} color={colors.mutedForeground} />
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          Guidance is reviewed before it is published.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 5 },
  greeting: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerWrap: { marginTop: 14, marginBottom: 6 },
  chipsScroll: { marginHorizontal: -18, marginBottom: 16 },
  chips: { gap: 8, paddingHorizontal: 18 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 18,
  },
  footerText: { fontSize: 11.5, fontWeight: '500' },
});
