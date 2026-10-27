import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PostCard } from '@/components/PostCard';
import { HeroCard } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';
import type { PostCategory } from '@/lib/types';

const filters: Array<{ key: PostCategory | 'All'; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'All', label: 'All', icon: 'apps' },
  { key: 'Islamic', label: 'Islamic', icon: 'star-crescent' },
  { key: 'History', label: 'History', icon: 'bank-outline' },
  { key: 'Poetry', label: 'Poetry', icon: 'feather' },
  { key: 'Reflection', label: 'Reflections', icon: 'heart-outline' },
];

export default function HomeScreen() {
  const colors = useColors();
  const nav = useNav();
  const { posts, settings, profile, likedPostIds, savedPostIds, viewedPostIds, toggleLike, toggleSaved, registerView } = useApp();
  const [filter, setFilter] = useState<PostCategory | 'All'>('All');
  const [search, setSearch] = useState('');

  const visiblePosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = posts.filter((post) => {
      const matchesFilter = filter === 'All' || post.category === filter;
      const matchesSearch = !query || `${post.title} ${post.body} ${post.author} ${post.category}`.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
    const city = profile.city.trim().toLowerCase();
    return city ? [...filtered].sort((a, b) => Number((b.city ?? '').toLowerCase() === city) - Number((a.city ?? '').toLowerCase() === city)) : filtered;
  }, [filter, posts, profile.city, search, settings.language]);

  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Feather name="search" size={23} color={colors.primary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search posts and questions"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
          accessibilityLabel="Search posts"
        />
        <Pressable onPress={() => nav.push({ name: 'postSubmit' })} accessibilityRole="button" accessibilityLabel="Share a community post" hitSlop={8}>
          <Feather name="upload-cloud" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <HeroCard
        eyebrow="Fatwa • daily guidance"
        title="Guidance for your day"
        subtitle="Trusted answers and thoughtful reminders."
        icon="star-crescent"
        actionLabel="Ask a question"
        onAction={nav.openAsk}
        testID="home-ask-guidance"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.filterChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
            >
              <MaterialCommunityIcons name={item.icon} size={18} color={active ? colors.primaryForeground : colors.secondaryForeground} />
              <Text style={[styles.filterText, { color: active ? colors.primaryForeground : colors.secondaryForeground }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <MaterialCommunityIcons name="book-open-outline" size={28} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Latest Posts</Text>
        </View>
        <Pressable onPress={() => setFilter('All')} accessibilityRole="button" hitSlop={8} style={styles.viewAll}>
          <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
          <Feather name="arrow-right" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {visiblePosts.map((post) => (
        <PostCard
          key={`${post.id}-${settings.language}`}
          post={!settings.autoTranslate || settings.language === 'en' || !post.translations?.[settings.language] ? post : { ...post, ...post.translations[settings.language] }}
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

      {!visiblePosts.length ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={24} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No posts found</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Try another topic or clear the search.</Text>
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    marginBottom: 14,
  },
  searchInput: { flex: 1, minHeight: 54, fontSize: 14, fontWeight: '500' },
  filterRow: { gap: 8, paddingBottom: 20 },
  filterChip: { minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterText: { fontSize: 13, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewAllText: { fontSize: 14, fontWeight: '700' },
  empty: { borderWidth: 1, borderRadius: 22, padding: 28, alignItems: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 10 },
  emptyText: { fontSize: 12, marginTop: 5 },
});
