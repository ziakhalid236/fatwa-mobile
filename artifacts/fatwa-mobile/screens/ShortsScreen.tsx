import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoStage } from '@/components/VideoStage';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL, useApp } from '@/lib/store';
import type { Post } from '@/lib/types';

export default function ShortsScreen() {
  const colors = useColors();
  // The feed is edge-to-edge, so the top bar pads itself around the status bar.
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const { authHeaders, likedPostIds, toggleLike } = useApp();
  const [videos, setVideos] = useState<Post[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [muted, setMuted] = useState(true);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    void fetch(`${API_BASE_URL}/api/videos?limit=60`, { headers: authHeaders() })
      .then(async (response) => {
        const value = await response.json().catch(() => ({})) as { videos?: Array<Record<string, unknown>>; error?: string };
        if (!response.ok) throw new Error(value.error || 'Could not load community videos.');
        const mapped = (value.videos || []).map((item): Post => ({
          id: String(item.id), title: String(item.title || ''), body: String(item.body || ''), category: 'General',
          author: String(item.author || 'Community contributor'), authorImageUrl: typeof item.authorImageUrl === 'string' ? item.authorImageUrl : undefined,
          authorId: typeof item.authorId === 'string' ? item.authorId : undefined, city: typeof item.city === 'string' ? item.city : undefined,
          country: typeof item.country === 'string' ? item.country : undefined, videoUrl: typeof item.videoUrl === 'string' ? item.videoUrl : undefined,
          mediaType: 'video', videoDurationMs: Number(item.videoDurationMs || 0), createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
          date: String(item.createdAt || ''), views: Number(item.views || 0), likes: Number(item.likes || 0), accent: 'forest', icon: 'video',
        })).filter((post) => Boolean(post.videoUrl));
        if (live) setVideos(mapped);
      })
      .catch((reason) => { if (live) setError(reason instanceof Error ? reason.message : 'Could not load community videos.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [authHeaders, retry]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const next = viewableItems.find((item) => item.isViewable)?.index;
    if (typeof next === 'number') setActiveIndex(next);
  });
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const renderItem = useCallback(({ item, index }: { item: Post; index: number }) => (
    <VideoStage
      post={item}
      height={height}
      active={index === activeIndex}
      liked={likedPostIds.includes(item.id)}
      muted={muted}
      onToggleMute={() => setMuted((value) => !value)}
      onToggleLike={() => toggleLike(item.id)}
      onOpen={() => nav.push({ name: 'post', postId: item.id })}
    />
  ), [activeIndex, height, likedPostIds, muted, nav, toggleLike]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (next > 0 && Math.abs(next - height) > 1) setHeight(next);
  };

  const state = loading ? (
    <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground }}>Loading community videos…</Text></View>
  ) : error ? (
    <View style={styles.center}><Feather name="wifi-off" size={24} color={colors.coral} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{error}</Text><Pressable onPress={() => setRetry((value) => value + 1)}><Text style={{ color: colors.primary, fontWeight: '800' }}>Try again</Text></Pressable></View>
  ) : !videos.length ? (
    <View style={styles.center}><Feather name="film" size={28} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No community videos yet</Text><Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Approved short reminders will appear here.</Text></View>
  ) : null;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {state ?? (height > 0 ? (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          pagingEnabled
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          getItemLayout={(_data, index) => ({ length: height, offset: height * index, index })}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
        />
      ) : null)}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => (nav.route.name === 'tabs' ? nav.goTab('home') : nav.back())}
          style={styles.topButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.titlePill} pointerEvents="none">
          <Feather name="play-circle" size={13} color="#FFFFFF" />
          <Text style={styles.titleText}>Shorts</Text>
        </View>
        <Pressable onPress={() => setMuted((value) => !value)} style={styles.topButton} accessibilityRole="button" accessibilityLabel={muted ? 'Unmute videos' : 'Mute videos'}>
          <Feather name={muted ? 'volume-x' : 'volume-2'} size={19} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04120D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.34)', alignItems: 'center', justifyContent: 'center' },
  titlePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.34)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  titleText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
