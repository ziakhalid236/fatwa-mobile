import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import type { TabKey } from '@/lib/types';

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;
const ITEMS: Array<{ key: TabKey; label: string; on: Icon; off: Icon }> = [
  { key: 'home', label: 'Home', on: 'home-variant', off: 'home-variant-outline' },
  { key: 'library', label: 'Books', on: 'book-open-page-variant', off: 'book-open-page-variant-outline' },
  { key: 'questions', label: 'Fatwa AI', on: 'creation', off: 'creation-outline' },
  { key: 'shorts', label: 'Shorts', on: 'play-circle', off: 'play-circle-outline' },
  { key: 'profile', label: 'Profile', on: 'account-circle', off: 'account-circle-outline' },
];
const PADDING = 6;

export function TabBar({ tab, badge, onSelect }: { tab: TabKey; badge: number; onSelect: (tab: TabKey) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const pops = useRef(ITEMS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const index = Math.max(0, ITEMS.findIndex((item) => item.key === tab));
  const itemWidth = width ? (width - PADDING * 2) / ITEMS.length : 0;

  useEffect(() => {
    Animated.spring(slide, { toValue: index * itemWidth, useNativeDriver: true, friction: 8, tension: 140 }).start();
    // The pill stretches while it travels, then settles: a liquid feel without being flashy.
    Animated.sequence([
      Animated.timing(stretch, { toValue: 1.16, duration: 110, useNativeDriver: true }),
      Animated.spring(stretch, { toValue: 1, useNativeDriver: true, friction: 6, tension: 160 }),
    ]).start();
    pops.forEach((value, i) => {
      Animated.spring(value, { toValue: i === index ? 1 : 0, useNativeDriver: true, friction: 5, tension: 170 }).start();
    });
  }, [index, itemWidth, slide, stretch, pops]);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={[styles.bar, { borderColor: colors.goldSoft, shadowColor: colors.shadow }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <BlurView intensity={Platform.OS === 'android' ? 0 : 70} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card, opacity: Platform.OS === 'ios' ? 0.6 : 0.96 }]} />
        <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']} style={styles.sheen} />
        {itemWidth > 0 ? (
          <Animated.View style={[styles.indicatorWrap, { width: itemWidth, shadowColor: colors.primary, transform: [{ translateX: slide }, { scaleX: stretch }] }]}>
            <LinearGradient colors={['#13866A', colors.primary, '#07402F']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.indicator}>
              <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} style={styles.indicatorSheen} />
            </LinearGradient>
          </Animated.View>
        ) : null}
        {ITEMS.map((item, i) => {
          const selected = item.key === tab;
          const pop = pops[i];
          const count = 0;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                if (Platform.OS !== 'web') void Haptics.selectionAsync();
                onSelect(item.key);
              }}
              style={styles.item}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={item.label}
              testID={`tab-${item.key}`}
            >
              <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }, { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }) }] }}>
                <MaterialCommunityIcons name={selected ? item.on : item.off} size={24} color={selected ? colors.primaryForeground : colors.mutedForeground} />
                {count > 0 ? (
                  <View style={[styles.badge, { backgroundColor: colors.coral, borderColor: selected ? colors.primary : colors.card }]}>
                    <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                  </View>
                ) : null}
              </Animated.View>
              <Text style={[styles.label, { color: selected ? colors.primaryForeground : colors.mutedForeground, fontWeight: selected ? '800' : '600' }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 4 },
  bar: {
    flexDirection: 'row',
    padding: PADDING,
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  sheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '55%' },
  indicatorWrap: { position: 'absolute', left: PADDING, top: PADDING, bottom: PADDING, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  indicator: { flex: 1, borderRadius: 24, overflow: 'hidden' },
  indicatorSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '50%' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 56, borderRadius: 24 },
  label: { fontSize: 10.5, letterSpacing: 0.1 },
  badge: { position: 'absolute', top: -5, right: -9, minWidth: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
});
