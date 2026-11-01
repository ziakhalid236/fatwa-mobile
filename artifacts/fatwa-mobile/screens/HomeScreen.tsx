import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StarPattern } from '@/components/Art';
import { PostCard } from '@/components/PostCard';
import { computePrayerTimes, formatClockTime, formatCountdown, localClockParts, minutesUntil } from '@/lib/prayer';
import { formatGregorianDate, formatIslamicDate } from '@/lib/islamic-date';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';

const ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
const prayerEnd = (name: typeof ORDER[number], times: ReturnType<typeof computePrayerTimes>, tomorrow: ReturnType<typeof computePrayerTimes>) => {
  if (name === 'Fajr') return times.Sunrise;
  if (name === 'Dhuhr') return times.Asr;
  if (name === 'Asr') return times.Maghrib;
  if (name === 'Maghrib') return times.Isha;
  return tomorrow.Fajr;
};
function Hero() {
  const colors = useColors();
  const nav = useNav();
  const { prayerCity, settings } = useApp();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const prayerSummary = useMemo(() => {
    const times = computePrayerTimes(now, prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
    const tomorrow = computePrayerTimes(new Date(now.getTime() + 86400000), prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
    const yesterday = computePrayerTimes(new Date(now.getTime() - 86400000), prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
    const currentMinutes = localClockParts(now, prayerCity.timezone).totalMinutes;
    const toMinutes = (time: string) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
    const currentIndex = ORDER.findIndex((name) => {
      const start = toMinutes(times[name]);
      const end = toMinutes(prayerEnd(name, times, tomorrow));
      if (name === 'Isha') return currentMinutes >= start || currentMinutes < toMinutes(times.Fajr);
      return start <= currentMinutes && currentMinutes < end;
    });
    if (currentIndex >= 0) {
      const currentName = ORDER[currentIndex];
      const nextName = currentName === 'Isha' ? 'Fajr' : ORDER[currentIndex + 1];
      const beforeFajr = currentName === 'Isha' && currentMinutes < toMinutes(times.Fajr);
      const nextStart = currentName === 'Isha' ? (beforeFajr ? times.Fajr : tomorrow.Fajr) : times[nextName];
      const nextTimes = beforeFajr ? times : tomorrow;
      const nextTomorrow = beforeFajr ? tomorrow : computePrayerTimes(new Date(now.getTime() + 2 * 86400000), prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
      const nextEnd = currentName === 'Isha' ? prayerEnd('Fajr', nextTimes, nextTomorrow) : prayerEnd(nextName, times, tomorrow);
      const currentStart = beforeFajr ? yesterday.Isha : times[currentName];
      return {
        current: { name: currentName, start: currentStart, end: beforeFajr ? times.Fajr : prayerEnd(currentName, times, tomorrow), left: 0 },
        next: { name: nextName, start: nextStart, end: nextEnd, left: currentName === 'Isha' ? minutesUntil(nextStart, now, prayerCity.timezone) + 1440 : minutesUntil(nextStart, now, prayerCity.timezone) },
      };
    }
    const nextIndex = ORDER.findIndex((name) => minutesUntil(times[name], now, prayerCity.timezone) > 0);
    if (nextIndex >= 0) {
      const nextName = ORDER[nextIndex];
      const previousName = nextIndex === 0 ? 'Isha' : ORDER[nextIndex - 1];
      const previousEnd = nextIndex === 0 ? times.Fajr : prayerEnd(previousName, times, tomorrow);
      return {
        current: { name: previousName, start: previousName === 'Isha' ? yesterday.Isha : times[previousName], end: previousEnd, left: 0 },
        next: { name: nextName, start: times[nextName], end: prayerEnd(nextName, times, tomorrow), left: minutesUntil(times[nextName], now, prayerCity.timezone) },
      };
    }
    return {
      current: { name: 'Isha' as const, start: times.Isha, end: tomorrow.Fajr, left: 0 },
      next: { name: 'Fajr' as const, start: tomorrow.Fajr, end: prayerEnd('Fajr', tomorrow, computePrayerTimes(new Date(now.getTime() + 2 * 86400000), prayerCity.latitude, prayerCity.longitude, prayerCity.timezone)), left: minutesUntil(tomorrow.Fajr, now, prayerCity.timezone) + 1440 },
    };
  }, [now, prayerCity]);
  const hour = localClockParts(now, prayerCity.timezone).hour;
  const greet = hour < 5 ? 'Peaceful night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <LinearGradient colors={[colors.forest, colors.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <StarPattern opacity={0.1} size={52} />
      <Feather name="moon" size={96} color="rgba(255,255,255,0.08)" style={styles.heroArt} />
      <Text style={styles.heroSalam}>السلام علیکم</Text>
      <Text style={styles.heroGreet}>{greet}</Text>
      <View style={styles.dateBlock}>
        <Feather name="calendar" size={18} color="#fff" />
        <View style={styles.dateCopy}>
          <Text style={styles.heroDate}>{formatGregorianDate(now, prayerCity.timezone)}</Text>
          <Text style={styles.heroDate}>{formatIslamicDate(now, settings.language, prayerCity.timezone)}</Text>
        </View>
      </View>
      <Pressable onPress={() => nav.push({ name: 'prayerSettings' })} style={styles.prayerPill} accessibilityRole="button">
        <View style={styles.prayerSection}>
          <View style={styles.prayerHeading}><Feather name="clock" size={19} color="#fff" /><Text style={styles.prayerLabel}>ENDING SOON</Text></View>
          <Text style={styles.prayerName}>{prayerSummary.current.name}</Text>
          <Text style={styles.prayerText}>ends at {formatClockTime(prayerSummary.current.end)}</Text>
        </View>
        <View style={styles.prayerDivider} />
        <View style={styles.prayerSection}>
          <View style={styles.prayerHeading}><Feather name="moon" size={19} color="#F8E59B" /><Text style={styles.prayerLabel}>NEXT PRAYER</Text></View>
          <Text style={styles.prayerName}>{prayerSummary.next.name} {formatClockTime(prayerSummary.next.start)}</Text>
          <Text style={styles.prayerMeta}>Ends {formatClockTime(prayerSummary.next.end)} · {formatCountdown(prayerSummary.next.left)}</Text>
        </View>
      </Pressable>
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

function FeedSkeleton() {
  const colors = useColors();
  return (
    <View accessibilityLabel="Loading home feed">
      <View style={[styles.skeletonHero, { backgroundColor: colors.muted }]} />
      <View style={styles.skeletonActions}>{[0, 1, 2, 3].map((item) => <View key={item} style={[styles.skeletonAction, { backgroundColor: colors.muted }]} />)}</View>
      {[0, 1].map((item) => (
        <View key={item} style={[styles.skeletonPost, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.skeletonAvatar, { backgroundColor: colors.muted }]} />
          <View style={styles.skeletonLines}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.muted, width: '44%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.muted, width: '88%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.muted, width: '72%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function HomeScreen({ focusSearchSignal = 0 }: { focusSearchSignal?: number }) {
  const colors = useColors();
  const nav = useNav();
  const { posts, profile, hydrated, likedPostIds, savedPostIds, viewedPostIds, toggleLike, toggleSaved, registerView, refreshContent } = useApp();
  const [search, setSearch] = useState('');
  const [connection, setConnection] = useState<'checking' | 'online' | 'offline'>('checking');
  const searchInputRef = useRef<TextInput>(null);
  useEffect(() => { if (focusSearchSignal > 0) searchInputRef.current?.focus(); }, [focusSearchSignal]);

  const checkConnection = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch('https://fatwa-api.ziakhalid236.workers.dev/api/health', { signal: controller.signal, cache: 'no-store' });
      setConnection(response.ok ? 'online' : 'offline');
    } catch {
      setConnection('offline');
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void checkConnection();
    const timer = setInterval(() => void checkConnection(), 20_000);
    return () => clearInterval(timer);
  }, [checkConnection]);

  const visiblePosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = posts.filter((post) => {
      return !query || `${post.title} ${post.body} ${post.author} ${post.city ?? ''} ${post.category ?? ''}`.toLowerCase().includes(query);
    });
    // The server already orders posts: same city, then same country, then the rest.
    return filtered;
  }, [posts, search]);
  const myCity = profile.city.trim().toLowerCase();
  const showSkeleton = !hydrated || (posts.length === 0 && connection === 'checking');
  const retryOffline = () => {
    setConnection('checking');
    refreshContent();
    void checkConnection();
  };

  return (
    <View style={styles.container}>
      {showSkeleton ? <FeedSkeleton /> : <Hero />}
      {!showSkeleton ? <QuickActions /> : null}
      {!showSkeleton && connection === 'offline' && posts.length ? (
        <View style={[styles.offlineStrip, { backgroundColor: colors.accent, borderColor: colors.goldSoft }]}>
          <Feather name="wifi-off" size={14} color={colors.accentForeground} />
          <Text style={[styles.offlineStripText, { color: colors.accentForeground }]}>Offline · Showing saved posts</Text>
        </View>
      ) : null}
      {!showSkeleton ? <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Feather name="search" size={21} color={colors.primary} />
        <TextInput
          ref={searchInputRef}
          value={search}
          onChangeText={setSearch}
          placeholder="Search posts, people, cities"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
          accessibilityLabel="Search posts"
        />
        {search ? <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search"><Feather name="x-circle" size={18} color={colors.mutedForeground} /></Pressable> : null}
      </View> : null}

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

      {!showSkeleton && !visiblePosts.length && connection === 'offline' ? (
        <View style={[styles.offlineEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="wifi-off" size={28} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>You are offline</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No saved posts are available yet. Connect to the internet and try again.</Text>
          <Pressable onPress={retryOffline} style={[styles.retryButton, { backgroundColor: colors.primary }]} accessibilityRole="button">
            <Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {!showSkeleton && !visiblePosts.length && connection !== 'offline' ? (
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
  heroSalam: { color: '#fff', fontSize: 23, fontWeight: '800' },
  heroGreet: { color: '#CBE7DB', fontSize: 12, marginTop: 2, marginBottom: 9 },
  dateBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  dateCopy: { gap: 1 },
  heroDate: { color: '#E3F1E7', fontSize: 11, fontWeight: '700' },
  prayerPill: { flexDirection: 'row', alignItems: 'stretch', gap: 12, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 11, alignSelf: 'stretch' },
  prayerSection: { flex: 1, gap: 2 },
  prayerHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  prayerLabel: { color: '#CBE7DB', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5 },
  prayerName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  prayerDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.32)' },
  prayerText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  prayerMeta: { color: '#F8E59B', fontSize: 10, fontWeight: '800' },
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
  offlineStrip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  offlineStripText: { fontSize: 11.5, fontWeight: '800' },
  offlineEmpty: { borderWidth: 1, borderRadius: 22, padding: 28, alignItems: 'center', marginBottom: 18 },
  retryButton: { borderRadius: 14, paddingHorizontal: 17, paddingVertical: 10, marginTop: 14 },
  skeletonHero: { height: 184, borderRadius: 26, marginBottom: 12, opacity: 0.6 },
  skeletonActions: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  skeletonAction: { flex: 1, height: 92, borderRadius: 17, opacity: 0.6 },
  skeletonPost: { borderWidth: 1, borderRadius: 26, padding: 17, marginBottom: 16, flexDirection: 'row', gap: 10, opacity: 0.8 },
  skeletonAvatar: { width: 38, height: 38, borderRadius: 19 },
  skeletonLines: { flex: 1, gap: 10, paddingTop: 4 },
  skeletonLine: { height: 12, borderRadius: 99 },
});
