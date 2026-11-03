import { Feather } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Inline muted video preview used in the home feed. It plays only while the
 * card is on screen, and falls back to a tappable "watch" card if the file
 * cannot be decoded.
 */
export function InlineVideo({ uri, active, durationMs, onOpen }: { uri: string; active: boolean; durationMs?: number; onOpen: () => void }) {
  const player = useVideoPlayer(uri, (instance) => { instance.loop = true; instance.muted = true; });
  const [muted, setMuted] = useState(true);
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  if (status === 'error') {
    return (
      <Pressable onPress={onOpen} style={[styles.wrap, styles.fallback]} accessibilityRole="button" accessibilityLabel="Open video post">
        <View style={styles.playBadge}><Feather name="play" size={20} color="#FFFFFF" /></View>
        <Text style={styles.fallbackText}>Community video · Tap to watch</Text>
      </Pressable>
    );
  }

  const seconds = durationMs ? Math.ceil(durationMs / 1000) : 0;
  return (
    <View style={styles.wrap}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open video post" />
      <View style={styles.badge} pointerEvents="none">
        <Feather name="play-circle" size={12} color="#FFFFFF" />
        <Text style={styles.badgeText}>{seconds ? `${seconds}s video` : 'Video'}</Text>
      </View>
      <Pressable onPress={() => setMuted((value) => !value)} style={styles.mute} accessibilityRole="button" accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}>
        <Feather name={muted ? 'volume-x' : 'volume-2'} size={15} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

/**
 * Lightweight placeholder shown while a feed video card is off screen. Keeping
 * it separate from `InlineVideo` means off-screen cards never allocate a native
 * player, which matters because the home feed renders every card at once.
 */
export function VideoPoster({ durationMs, onOpen }: { durationMs?: number; onOpen: () => void }) {
  const seconds = durationMs ? Math.ceil(durationMs / 1000) : 0;
  return (
    <Pressable onPress={onOpen} style={[styles.wrap, styles.fallback]} accessibilityRole="button" accessibilityLabel="Open video post">
      <View style={styles.playBadge}><Feather name="play" size={20} color="#FFFFFF" /></View>
      <Text style={styles.fallbackText}>{seconds ? `${seconds}s community video · Tap to watch` : 'Community video · Tap to watch'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 4 / 5, maxHeight: 460, borderRadius: 20, overflow: 'hidden', backgroundColor: '#071A14', marginTop: 2, marginBottom: 4 },
  fallback: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  playBadge: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  badge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
  mute: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
});
