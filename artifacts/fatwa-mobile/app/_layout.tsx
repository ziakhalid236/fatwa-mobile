import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider } from '@/lib/store';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [showLaunchArt, setShowLaunchArt] = useState(true);
  const [launchArtStatus, setLaunchArtStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if ((fontsLoaded || fontError) && launchArtStatus !== 'loading') {
      SplashScreen.hideAsync();
      const launchTimer = setTimeout(() => setShowLaunchArt(false), 2500);
      return () => clearTimeout(launchTimer);
    }
  }, [fontsLoaded, fontError, launchArtStatus]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={styles.root}>
            <AppProvider>
              <View style={styles.root}>
                <Stack screenOptions={{ headerShown: false }} />
                {showLaunchArt ? (
                  <View style={styles.launchOverlay}>
                    <StatusBar hidden />
                    <Image
                      source={require('../assets/images/splash.png')}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                      accessible={false}
                      onLoad={() => setLaunchArtStatus('loaded')}
                      onError={() => setLaunchArtStatus('failed')}
                    />
                    {launchArtStatus === 'failed' ? (
                      <View style={styles.launchFallback}>
                        <Image source={require('../assets/images/icon.png')} style={styles.fallbackLogo} />
                        <Text style={styles.fallbackName}>Fatwa</Text>
                        <Text style={styles.fallbackTagline}>Islamic Guidance for Life</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  launchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    backgroundColor: '#00533F',
  },
  launchFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLogo: { width: 88, height: 88, borderRadius: 24, marginBottom: 14 },
  fallbackName: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', letterSpacing: -0.8 },
  fallbackTagline: { color: '#DDE9DF', fontSize: 14, marginTop: 6 },
});
