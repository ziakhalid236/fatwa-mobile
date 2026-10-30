import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PostCard } from '@/components/PostCard';
import { computePrayerTimes, formatCountdown, minutesUntil } from '@/lib/prayer';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';

const ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

function Hero() {
  const colors = useColors();
  const nav = useNav();
  const { profile, prayerCity } = useApp();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const next = useMemo(() => {
    const times = computePrayerTimes(now, prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
    for (const name of ORDER) { const m = minutesUntil(times[name], now); if (m > 0) return { name, time: times[name], left: m }; }
    const tomorrow = computePrayerTimes(new Date(now.getTime() + 86400000), prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
    return { name: 'Fajr' as const, time: tomorrow.Fajr, left: minutesUntil(tomorrow.Fajr, now) + 1440 };
  }, [now, prayerCity]);
  const hour = now.getHours();
  const greet = hour < 5 ? 'Peaceful night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = profile.name.trim().split(/\s+/)[0];
  return (
    <LinearGradient colors={[colors.forest, colors.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <Feather name="moon" size={120} color="rgba(255,255,255,0.07)" style={styles.heroArt} />
      <Text style={styles.heroSalam}>السلام علیکم{first ? ` ${first}` : ''}</Text>
      <Text style={styles.heroGreet}>{greet}</Text>
      <Pressable onPress={() => nav.push({ name: 'prayerSettings' })} style={styles.prayerPill} accessibilityRole="button">
        <Feather name="clock" size={15} color="#fff" />
        <Text style={styles.prayerText}>{next.name} at {next.time}</Text>
        <Text style={styles.prayerLeft}>in {formatCountdown(next.left)}</Text>
      </Pressable>
    </LinearGradient>
  );
}

function QuickActions() {
  const colors = useColors();
  const nav = useNav();
  const items: Array<{ icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }> = [
    { icon: 'message-circle', label: 'Ask', onPress: nav.openAsk },
    { icon: 'book-open', label: 'Library', onPress: () => nav.goTab('library') },
    { icon: 'compass', label: 'Qibla', onPress: () => nav.push({ name: 'qiblaSettings' }) },
    { icon: 'bookmark', label: 'Saved', onPress: () => nav.push({ name: 'saved' }) },
  ];
  return (
    <View style={styles.actions}>
      {items.map((it) => (
        <Pressable key={it.label} onPress={it.onPress} style={({ pressed }) => [styles.action, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]} accessibilityRole="button">
          <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}><Feather name={it.icon} size={19} color={colors.primary} /></View>
          <Text style={[styles.actionLabel, { color: colors.foreground }]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const nav = useNav();
  const { posts, profile, likedPostIds, savedPostIds, viewedPostIds, toggleLike, toggleSaved, registerView } = useApp();
  const [search, setSearch] = useState('');

  const visiblePosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = posts.filter((post) => {
      return !query || `${post.title} ${post.body} ${post.author}`.toLowerCase().includes(query);
    });
    // The server already orders posts: same city, then same country, then the rest.
    return filtered;
  }, [posts, search]);
  const myCity = profile.city.trim().toLowerCase();

  return (
    <View style={styles.container}>
      <Hero />
      <QuickActions />
      <Pressable onPress={() => nav.push({ name: 'postSubmit' })} style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
        <View style={[styles.composerAvatar, { backgroundColor: colors.primarySoft }]}><Feather name="edit-3" size={16} color={colors.primary} /></View>
        <Text style={[styles.composerText, { color: colors.mutedForeground }]}>Share a reminder with the community…</Text>
        <Feather name="image" size={18} color={colors.primary} />
      </Pressable>
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Feather name="search" size={21} color={colors.primary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search posts and questions"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
          accessibilityLabel="Search posts"
        />
      </View>

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
          nearby={Boolean(myCity) && (post.city ?? '').trim().toLowerCase() === myCity}
          onShare={() => undefined}
          onAuthor={post.authorId ? () => nav.push({ name: 'user', userId: post.authorId as string }) : undefined}
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
  hero: { borderRadius: 28, padding: 20, marginBottom: 14, overflow: 'hidden' },
  heroArt: { position: 'absolute', right: 10, top: 6 },
  heroSalam: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroGreet: { color: '#CBE7DB', fontSize: 13, marginTop: 3, marginBottom: 16 },
  prayerPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, alignSelf: 'flex-start' },
  prayerText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  prayerLeft: { color: '#E6D3A3', fontSize: 12.5, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  action: { flex: 1, borderWidth: 1, borderRadius: 20, paddingVertical: 12, alignItems: 'center', gap: 7 },
  actionIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11.5, fontWeight: '800' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 12 },
  composerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  composerText: { flex: 1, fontSize: 13.5 },
  searchBar: {
    minHeight: 52,
    borderRadius: 18,
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
  empty: { borderWidth: 1, borderRadius: 22, padding: 28, alignItems: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 10 },
  emptyText: { fontSize: 12, marginTop: 5 },
});
