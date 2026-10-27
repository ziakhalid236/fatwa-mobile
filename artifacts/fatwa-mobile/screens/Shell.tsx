import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LogoMark } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { NavProvider, type Nav, type Route } from '@/lib/nav';
import { AppProvider, useApp } from '@/lib/store';
import { syncAdhanAlarms } from '@/lib/adhan';
import type { TabKey } from '@/lib/types';
import AlarmScreen from '@/screens/AlarmScreen';
import FatwaDetailScreen from '@/screens/FatwaDetailScreen';
import FatwaScreen from '@/screens/FatwaScreen';
import HomeScreen from '@/screens/HomeScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import PostDetailScreen from '@/screens/PostDetailScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import QuestionsScreen from '@/screens/QuestionsScreen';
import SavedScreen from '@/screens/SavedScreen';
import SettingsScreen from '@/screens/SettingsScreen';

const tabs: Array<{ key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'fatwa', label: 'Fatwa', icon: 'book-open' },
  { key: 'questions', label: 'Ask', icon: 'message-circle' },
  { key: 'alarm', label: 'Notifications', icon: 'bell' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

const titles: Record<string, string> = {
  post: 'Post',
  fatwa: 'Fatwa',
  notifications: 'Notifications',
  saved: 'Saved posts',
  settings: 'Settings',
  prayerSettings: 'Prayer settings',
};

function Shell() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alarms, settings, unreadCount, pushNotification } = useApp();

  const [tab, setTab] = useState<TabKey>('home');
  const [stack, setStack] = useState<Route[]>([]);
  const [askSignal, setAskSignal] = useState(0);

  const route = stack.length ? stack[stack.length - 1] : { name: 'tabs' as const };

  const goTab = useCallback((next: TabKey) => {
    void Haptics.selectionAsync();
    setStack([]);
    setTab(next);
  }, []);

  const push = useCallback((next: Route) => {
    setStack((current) => [...current, next]);
  }, []);

  const back = useCallback(() => {
    setStack((current) => current.slice(0, -1));
  }, []);

  const openAsk = useCallback(() => {
    setStack([]);
    setTab('questions');
    setAskSignal((value) => value + 1);
  }, []);

  const nav = useMemo<Nav>(
    () => ({ tab, route, goTab, push, back, openAsk }),
    [tab, route, goTab, push, back, openAsk],
  );

  const onSettings = useCallback(() => push({ name: 'settings' }), [push]);

  const header = () => {
    const title = titles[route.name] ?? (route.name === 'tabs' && tab === 'alarm' ? 'Notifications' : undefined);
    const canGoBack = stack.length > 0 || tab !== 'home';
    return (
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 67 : 6 }]}>
        {title ? (
          <Pressable
            onPress={() => (stack.length ? back() : goTab('home'))}
            style={styles.headerSide}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="header-back"
          >
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={styles.brandLockup}>
            <LogoMark size={32} />
            <Text style={[styles.brandName, { color: colors.forest }]}>Fatwa</Text>
          </View>
        )}
        {title ? <Text style={[styles.topBarTitle, { color: colors.foreground }]}>{title}</Text> : null}
        <Pressable
          style={styles.headerSide}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => push({ name: 'notifications' })}
        >
          <Feather name="bell" size={20} color={colors.foreground} />
          {unreadCount > 0 ? (
            <View style={[styles.notificationDot, { backgroundColor: colors.coral }]} />
          ) : null}
        </Pressable>
      </View>
    );
  };

  let content: React.ReactNode;
  if (route.name === 'post') content = <PostDetailScreen postId={route.postId} />;
  else if (route.name === 'fatwa') content = <FatwaDetailScreen fatwaId={route.fatwaId} />;
  else if (route.name === 'notifications') content = <NotificationsScreen />;
  else if (route.name === 'saved') content = <SavedScreen />;
  else if (route.name === 'settings') content = <SettingsScreen />;
  else if (route.name === 'prayerSettings') content = <AlarmScreen />;
  else if (tab === 'home') content = <HomeScreen />;
  else if (tab === 'fatwa') content = <FatwaScreen />;
  else if (tab === 'questions') content = <QuestionsScreen askSignal={askSignal} />;
  else if (tab === 'alarm') content = <NotificationsScreen />;
  else content = <ProfileScreen onOpenSettings={onSettings} />;

  const showTabBar = route.name === 'tabs';

  return (
    <NavProvider value={nav}>
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={[styles.app, { backgroundColor: colors.background }]}>
          <KeyboardAwareScrollViewCompat
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            enabled
          >
            {header()}
            {content}
          </KeyboardAwareScrollViewCompat>
          {showTabBar ? (
            <View
              style={[
                styles.tabBar,
                {
                  backgroundColor: colors.card,
                  borderTopColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 30 : 8),
                },
              ]}
            >
              {tabs.map((item) => {
                const selected = tab === item.key;
                const badge = item.key === 'alarm' ? unreadCount : 0;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => goTab(item.key)}
                    style={styles.tabItem}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={item.label}
                    testID={`tab-${item.key}`}
                  >
                    <View>
                      <Feather
                        name={item.icon}
                        size={20}
                        color={selected ? colors.primary : colors.mutedForeground}
                      />
                      {badge > 0 ? (
                        <View style={[styles.tabBadge, { backgroundColor: colors.coral }]}>
                          <Text style={styles.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.tabLabel,
                        { color: selected ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {selected ? (
                      <LinearGradient
                        colors={[colors.primary, colors.teal]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.activeDot}
                      />
                    ) : (
                      <View style={styles.activeDot} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </NavProvider>
  );
}

export default function AppShell() {
  const { alarms, settings, pushNotification } = useApp();
  const synced = React.useRef(false);

  React.useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    if (alarms.length) {
      void syncAdhanAlarms(alarms, { soundEnabled: settings.adhanSound }).then((result) => {
        if (result.scheduled > 0) {
          pushNotification({
            kind: 'system',
            title: 'Adhan alarms ready',
            body: `${result.scheduled} adhan alarm${result.scheduled === 1 ? '' : 's'} scheduled.`,
          });
        }
      });
    }
  }, [alarms, settings.adhanSound, pushNotification]);

  return <Shell />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  app: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 12 },
  topBar: {
    minHeight: 56,
    paddingHorizontal: 18,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandName: { fontSize: 21, fontWeight: '700', letterSpacing: -0.7 },
  topBarTitle: { position: 'absolute', left: 70, right: 66, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  headerSide: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', top: 9, right: 9 },
  tabBar: {
    minHeight: 62,
    paddingTop: 9,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabLabel: { fontSize: 9.5, fontWeight: '700' },
  activeDot: { height: 3, width: 16, borderRadius: 2 },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
});
