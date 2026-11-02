import { Feather } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL, useApp } from '@/lib/store';
import { sharePost } from '@/lib/share';
import type { Post } from '@/lib/types';

function ShortVideo({ post, active, height, onLike, liked, onOpen }: { post: Post; active: boolean; height: number; onLike: () => void; liked: boolean; onOpen: () => void }) {
  const colors = useColors();
  const player = useVideoPlayer(post.videoUrl || '', (instance) => { instance.loop = true; });
  useEffect(() => { if (active) void player.play(); else player.pause(); }, [active, player]);
  const caption = post.body.trim() || post.title;
  return (
    <View style={[styles.page, { height, backgroundColor: '#061B15' }]}>
      {post.videoUrl ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} /> : null}
      <View pointerEvents="none" style={styles.scrim} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open video post by ${post.author}`} />
      <View style={styles.copyBlock} pointerEvents="box-none">
        <Text style={styles.author} numberOfLines={1}>{post.author}{post.city ? ` · ${post.city}` : ''}</Text>
        {caption ? <Text style={styles.caption} numberOfLines={4}>{caption}</Text> : null}
        <Text style={styles.hint}>Tap to read the full post</Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onLike} style={styles.action} accessibilityRole="button" accessibilityLabel={liked ? 'Unlike video' : 'Like video'}>
          <Feather name="heart" size={24} color={liked ? '#FF7E77' : '#FFFFFF'} />
          <Text style={styles.actionLabel}>{post.likes + (liked ? 1 : 0)}</Text>
        </Pressable>
        <Pressable onPress={() => { void sharePost(post); }} style={styles.action} accessibilityRole="button" accessibilityLabel="Share video">
          <Feather name="share-2" size={23} color="#FFFFFF" />
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>
      </View>
      {!active ? <View pointerEvents="none" style={styles.paused}><Feather name="play" size={22} color="#FFFFFF" /></View> : null}
    </View>
  );
}

export default function ShortsScreen() {
  const colors = useColors();
  const { height: windowHeight } = useWindowDimensions();
  const nav = useNav();
  const { authHeaders, likedPostIds, toggleLike } = useApp();
  const [videos, setVideos] = useState<Post[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const pageHeight = Math.max(320, windowHeight - 140);

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
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 75 });
  const renderItem = useCallback(({ item, index }: { item: Post; index: number }) => (
    <ShortVideo post={item} height={pageHeight} active={index === activeIndex} liked={likedPostIds.includes(item.id)} onLike={() => toggleLike(item.id)} onOpen={() => nav.push({ name: 'post', postId: item.id })} />
  ), [activeIndex, likedPostIds, nav, pageHeight, toggleLike]);

  if (loading) return <View style={[styles.center, { height: pageHeight }]}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground }}>Loading community videos…</Text></View>;
  if (error) return <View style={[styles.center, { height: pageHeight }]}><Feather name="wifi-off" size={24} color={colors.coral} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{error}</Text><Pressable onPress={() => setRetry((value) => value + 1)}><Text style={{ color: colors.primary, fontWeight: '800' }}>Try again</Text></Pressable></View>;
  if (!videos.length) return <View style={[styles.center, { height: pageHeight }]}><Feather name="film" size={28} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No community videos yet</Text><Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Approved short reminders will appear here.</Text></View>;

  return <FlatList
    data={videos}
    keyExtractor={(item) => item.id}
    renderItem={renderItem}
    pagingEnabled
    snapToInterval={pageHeight}
    decelerationRate="fast"
    showsVerticalScrollIndicator={false}
    onViewableItemsChanged={onViewableItemsChanged.current}
    viewabilityConfig={viewabilityConfig.current}
    initialNumToRender={1}
    maxToRenderPerBatch={2}
    windowSize={3}
    removeClippedSubviews
  />;
}

const styles = StyleSheet.create({
  page: { width: '100%', overflow: 'hidden', justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
  copyBlock: { position: 'absolute', left: 20, right: 86, bottom: 25, gap: 8 },
  author: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 8 },
  caption: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 8 },
  hint: { color: '#E1E1E1', fontSize: 10.5 },
  actions: { position: 'absolute', right: 16, bottom: 31, gap: 20, alignItems: 'center' },
  action: { alignItems: 'center', gap: 5, minWidth: 44 },
  actionLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  paused: { position: 'absolute', alignSelf: 'center', top: '48%', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
