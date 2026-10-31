import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StarPattern } from '@/components/Art';
import { PostCard } from '@/components/PostCard';
import { computePrayerTimes, formatClockTime, formatCountdown, minutesUntil } from '@/lib/prayer';
import { formatGregorianDate, formatIslamicDate } from '@/lib/islamic-date';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';

const ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

function Hero() {
  const colors = useColors();
  const nav = useNav();
  const { profile, prayerCity, settings } = useApp();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const prayerSummary = useMemo(() => {
    const times = computePrayerTimes(now, prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
    const todayIndex = ORDER.findIndex((name) => minutesUntil(times[name], now) > 0);
    if (todayIndex >= 0) {
      const nextName = ORDER[todayIndex];
      const previousName = todayIndex === 0 ? 'Isha' : ORDER[todayIndex - 1];
      const previousTime = todayIndex === 0
        ? computePrayerTimes(new Date(now.getTime() - 86400000), prayerCity.latitude, prayerCity.longitude, prayerCity.timezone).Isha
        : times[previousName];
      return {
        next: { name: nextName, start: times[nextName], end: todayIndex === ORDER.length - 1 ? computePrayerTimes(new Date(now.getTime() + 86400000), prayerCity.latitude, prayerCity.longitude, prayerCity.timezone).Fajr : times[ORDER[todayIndex + 1]], left: minutesUntil(times[nextName], now) },
        previous: { name: previousName, end: times[nextName], ended: minutesUntil(previousTime, now) <= 0 },
      };
    }
    const tomorrow = computePrayerTimes(new Date(now.getTime() + 86400000), prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
    return {
      next: { name: 'Fajr' as const, start: tomorrow.Fajr, end: tomorrow.Dhuhr, left: minutesUntil(tomorrow.Fajr, now) + 1440 },
      previous: { name: 'Isha' as const, end: tomorrow.Fajr, ended: true },
    };
  }, [now, prayerCity]);
  const hour = now.getHours();
  const greet = hour < 5 ? 'Peaceful night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = profile.name.trim().split(/\s+/)[0];
  return (
    <LinearGradient colors={[colors.forest, colors.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <StarPattern opacity={0.1} size={52} />
      <Feather name="moon" size={96} color="rgba(255,255,255,0.08)" style={styles.heroArt} />
      <Text style={styles.heroSalam}>السلام علیکم{first ? ` ${first}` : ''}</Text>
      <Text style={styles.heroGreet}>{greet}</Text>
      <View style={styles.dateRow}>
        <Text style={styles.heroDate}>{formatIslamicDate(now, settings.language)}</Text>
        <Text style={styles.heroDate}>{formatGregorianDate(now)}</Text>
      </View>
      <Pressable onPress={() => nav.push({ name: 'prayerSettings' })} style={styles.prayerPill} accessibilityRole="button">
        <Feather name="clock" size={15} color="#fff" />
        <View style={styles.prayerCopy}>
          <Text style={styles.prayerText}>{prayerSummary.next.name} starts {formatClockTime(prayerSummary.next.start)}</Text>
          <Text style={styles.prayerMeta}>Ends {formatClockTime(prayerSummary.next.end)} · {formatCountdown(prayerSummary.next.left)}</Text>
        </View>
      </Pressable>
      <Text style={styles.previousPrayer}>Previous: {prayerSummary.previous.name} ended at {formatClockTime(prayerSummary.previous.end)}</Text>
    </LinearGradient>
  );
}

const CARD_COLORS: Record<string, [string, string]> = {
  Fatwa: ['#0B6B53', '#013A2D'],
  Library: ['#8A5A12', '#4A2E08'],
  Qibla: ['#1D4F7A', '#0F2A47'],
  Saved: ['#6B2F5B', '#3A1633'],
};

function QuickActions() {
  const nav = useNav();
  const items: Array<{ icon: keyof typeof Feather.glyphMap; label: string; sub: string; onPress: () => void }> = [
    { icon: 'message-circle', label: 'Fatwa', sub: 'Ask AI', onPress: nav.openAsk },
    { icon: 'book-open', label: 'Library', sub: 'Quran & books', onPress: () => nav.goTab('library') },
    { icon: 'compass', label: 'Qibla', sub: 'Direction', onPress: () => nav.push({ name: 'qiblaSettings' }) },
    { icon: 'bookmark', label: 'Saved', sub: 'Your posts', onPress: () => nav.push({ name: 'saved' }) },
  ];
  return (
    <View style={styles.actions}>
      {items.map((it) => (
        <Pressable key={it.label} onPress={it.onPress} style={({ pressed }) => [styles.actionWrap, { opacity: pressed ? 0.88 : 1 }]} accessibilityRole="button" accessibilityLabel={`${it.label} ${it.sub}`}>
          <LinearGradient colors={CARD_COLORS[it.label]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.action}>
            <StarPattern opacity={0.16} size={30} />
            <Feather name={it.icon} size={34} color="rgba(255,255,255,0.14)" style={styles.actionBig} />
            <View style={styles.actionIcon}><Feather name={it.icon} size={15} color="#fff" /></View>
            <View>
              <Text style={styles.actionLabel}>{it.label}</Text>
              <Text style={styles.actionSub}>{it.sub}</Text>
            </View>
          </LinearGradient>
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
      return !query || `${post.title} ${post.body} ${post.author} ${post.city ?? ''} ${post.category ?? ''}`.toLowerCase().includes(query);
    });
    // The server already orders posts: same city, then same country, then the rest.
    return filtered;
  }, [posts, search]);
  const myCity = profile.city.trim().toLowerCase();

  return (
    <View style={styles.container}>
      <Hero />
      <QuickActions />
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Feather name="search" size={21} color={colors.primary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search posts, people, cities"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
          accessibilityLabel="Search posts"
        />
        {search ? <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search"><Feather name="x-circle" size={18} color={colors.mutedForeground} /></Pressable> : null}
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
  hero: { borderRadius: 26, padding: 18, marginBottom: 12, overflow: 'hidden' },
  heroArt: { position: 'absolute', right: 10, top: 6 },
  heroSalam: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroGreet: { color: '#CBE7DB', fontSize: 13, marginTop: 3, marginBottom: 12 },
  dateRow: { gap: 2, marginBottom: 12 },
  heroDate: { color: '#D5E7DB', fontSize: 11, fontWeight: '700' },
  prayerPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, alignSelf: 'flex-start' },
  prayerCopy: { gap: 2 },
  prayerText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  prayerMeta: { color: '#E6D3A3', fontSize: 10.5, fontWeight: '700' },
  previousPrayer: { color: '#CBE7DB', fontSize: 10.5, fontWeight: '700', marginTop: 9 },
  actions: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  actionWrap: { flex: 1, minWidth: 0 },
  action: { height: 92, borderRadius: 17, padding: 8, justifyContent: 'space-between', overflow: 'hidden' },
  actionBig: { position: 'absolute', right: 8, bottom: 6 },
  actionIcon: { width: 27, height: 27, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: -0.2 },
  actionSub: { color: 'rgba(255,255,255,0.78)', fontSize: 8.5, fontWeight: '600', marginTop: 1 },
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
