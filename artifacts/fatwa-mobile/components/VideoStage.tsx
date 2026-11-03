import { Feather } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCount } from '@/components/PostCard';
import type { Post } from '@/lib/types';

export type VideoStageProps = {
  post: Post;
  active: boolean;
  liked: boolean;
  muted: boolean;
  height: number;
  onToggleLike: () => void;
  onToggleMute: () => void;
  onOpen: () => void;
};

/**
 * One full-screen page of the shorts feed: looping video, double-tap to like,
 * tap to pause, progress bar and a right-hand action rail.
 */
export function VideoStage({ post, active, liked, muted, height, onToggleLike, onToggleMute, onOpen }: VideoStageProps) {
  const player = useVideoPlayer(post.videoUrl || '', (instance) => {
    instance.loop = true;
    instance.muted = muted;
  });
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastTap = useRef(0);

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    player.timeUpdateEventInterval = 0.25;
  }, [player]);

  useEffect(() => {
    if (active && !paused) {
      player.play();
    } else {
      player.pause();
      if (!active) setPaused(false);
    }
  }, [active, paused, player]);

  const onProgress = (event: { currentTime: number }) => {
    const duration = player.duration || 0;
    setProgress(duration > 0 ? Math.min(1, event.currentTime / duration) : 0);
  };
  // Subscribe manually so we can drive the progress bar without re-rendering on every frame.
  useEffect(() => {
    const subscription = player.addListener('timeUpdate', onProgress);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 260) {
      lastTap.current = 0;
      if (!liked) onToggleLike();
      return;
    }
    lastTap.current = now;
    setTimeout(() => {
      if (lastTap.current === now) setPaused((value) => !value);
    }, 260);
  };

  const caption = post.body.trim() || post.title;
  const loading = active && status === 'loading';
  const failed = status === 'error';

  return (
    <View style={[styles.page, { height }]}>
      {post.videoUrl ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
        />
      ) : null}
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.75)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />

      <Pressable style={StyleSheet.absoluteFill} onPress={handlePress} accessibilityRole="button" accessibilityLabel={`Video by ${post.author}`} />

      {failed ? (
        <View pointerEvents="none" style={styles.centerState}>
          <Feather name="alert-triangle" size={26} color="#FFFFFF" />
          <Text style={styles.stateText}>This video could not be played</Text>
        </View>
      ) : null}
      {loading ? (
        <View pointerEvents="none" style={styles.centerState}>
          <Feather name="loader" size={26} color="#FFFFFF" />
        </View>
      ) : null}
      {paused && active && !failed ? (
        <View pointerEvents="none" style={styles.centerState}>
          <View style={styles.playBadge}><Feather name="play" size={30} color="#FFFFFF" /></View>
        </View>
      ) : null}

      <View style={styles.copyBlock} pointerEvents="box-none">
        <Pressable style={styles.authorRow} onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open post">
          <View style={styles.authorDot}><Feather name="user" size={13} color="#FFFFFF" /></View>
          <Text style={styles.author} numberOfLines={1}>{post.author}{post.city ? ` · ${post.city}` : ''}</Text>
        </Pressable>
        {caption ? <Text style={styles.caption} numberOfLines={3}>{caption}</Text> : null}
        <View style={styles.metaRow}>
          <Feather name="eye" size={12} color="#DCE7E1" />
          <Text style={styles.meta}>{formatCount(post.views)} views</Text>
          <Text style={styles.metaDot}>·</Text>
          <Pressable onPress={onOpen} hitSlop={8} accessibilityRole="button" accessibilityLabel="Read the full post">
            <Text style={styles.readMore}>Read full post</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.rail}>
        <Pressable onPress={onToggleLike} style={styles.railButton} accessibilityRole="button" accessibilityLabel={liked ? 'Unlike video' : 'Like video'}>
          <View style={[styles.railIcon, liked && styles.railIconActive]}>
            <Feather name="heart" size={25} color={liked ? '#FF7E77' : '#FFFFFF'} />
          </View>
          <Text style={styles.railLabel}>{formatCount(post.likes + (liked ? 1 : 0))}</Text>
        </Pressable>
        <Pressable onPress={onOpen} style={styles.railButton} accessibilityRole="button" accessibilityLabel="Read the full post">
          <View style={styles.railIcon}><Feather name="message-circle" size={24} color="#FFFFFF" /></View>
          <Text style={styles.railLabel}>Post</Text>
        </Pressable>
        <Pressable onPress={onToggleMute} style={styles.railButton} accessibilityRole="button" accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}>
          <View style={styles.railIcon}><Feather name={muted ? 'volume-x' : 'volume-2'} size={23} color="#FFFFFF" /></View>
          <Text style={styles.railLabel}>{muted ? 'Muted' : 'Sound'}</Text>
        </Pressable>
      </View>

      <View pointerEvents="none" style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', backgroundColor: '#04120D', overflow: 'hidden', justifyContent: 'flex-end' },
  centerState: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 10 },
  playBadge: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  stateText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  copyBlock: { position: 'absolute', left: 18, right: 92, bottom: 18, gap: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  author: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', flexShrink: 1, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 8 },
  caption: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { color: '#DCE7E1', fontSize: 11, fontWeight: '600' },
  metaDot: { color: '#DCE7E1', fontSize: 11 },
  readMore: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800', textDecorationLine: 'underline' },
  rail: { position: 'absolute', right: 12, bottom: 24, gap: 22, alignItems: 'center' },
  railButton: { alignItems: 'center', gap: 5, minWidth: 48 },
  railIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center' },
  railIconActive: { backgroundColor: 'rgba(255,126,119,0.22)' },
  railLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.24)' },
  progressFill: { height: 3, backgroundColor: '#FFFFFF' },
});
