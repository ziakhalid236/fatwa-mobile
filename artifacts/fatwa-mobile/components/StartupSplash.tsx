import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LogoMark } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export function StartupSplash({ visible }: { visible: boolean }) {
  const colors = useColors();
  const motion = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, { toValue: 1, duration: 1150, useNativeDriver: true }),
        Animated.timing(motion, { toValue: 0, duration: 1150, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motion]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 260,
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  const rotateY = motion.interpolate({ inputRange: [0, 1], outputRange: ['-13deg', '13deg'] });
  const lift = motion.interpolate({ inputRange: [0, 1], outputRange: [4, -7] });
  const scale = motion.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFillObject, styles.overlay, { opacity }]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#013A2D" animated />
      <LinearGradient
        colors={[colors.forest, '#00533F', '#013A2D']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.background}
      >
        <View style={styles.glow} />
        <View style={styles.content}>
          <View style={styles.logoStage}>
            <View style={styles.halo} />
            <Animated.View
              style={[
                styles.logo,
                {
                  transform: [{ perspective: 900 }, { rotateY }, { translateY: lift }, { scale }],
                },
              ]}
            >
              <LogoMark size={104} />
            </Animated.View>
          </View>
          <Text style={styles.name}>Fatwa App</Text>
          <Text style={styles.tagline}>Islamic guidance for life</Text>
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#B8F2D7" />
            <Text style={styles.loadingText}>Preparing your reading space</Text>
          </View>
        </View>
        <Text style={styles.footer}>FAITH · KNOWLEDGE · DAILY LIFE</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 100, elevation: 100 },
  background: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glow: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(60, 205, 147, 0.1)',
    top: '15%',
    alignSelf: 'center',
  },
  content: { alignItems: 'center', paddingHorizontal: 30, marginTop: -10 },
  logoStage: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  halo: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 1,
    borderColor: 'rgba(184, 242, 215, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  logo: {
    borderRadius: 30,
    shadowColor: '#8FFFD0',
    shadowOpacity: 0.34,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  name: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -0.7 },
  tagline: { color: '#D0EDE1', fontSize: 14, fontWeight: '500', letterSpacing: 0.25, marginTop: 8 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 35 },
  loadingText: { color: '#D0EDE1', fontSize: 12, fontWeight: '500' },
  footer: {
    position: 'absolute',
    bottom: 38,
    color: 'rgba(220, 245, 234, 0.58)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.1,
  },
});
