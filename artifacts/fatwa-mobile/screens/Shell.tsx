import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, RefreshControl, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LogoMark } from '@/components/ui';
import { ReportModal } from '@/components/ReportModal';
import { TabBar } from '@/components/TabBar';
import { useColors } from '@/hooks/useColors';
import { NavProvider, type Nav, type Route } from '@/lib/nav';
import { AppProvider, useApp } from '@/lib/store';
import { postIdFromUrl } from '@/lib/share';
import { syncAdhanAlarms } from '@/lib/adhan';
import { NetworkStatusProvider, useNetworkStatus } from '@/lib/network';
import type { TabKey } from '@/lib/types';
import AlarmScreen from '@/screens/AlarmScreen';
import FatwaDetailScreen from '@/screens/FatwaDetailScreen';
import FatwaScreen from '@/screens/FatwaScreen';
import LibraryScreen, { QuranListScreen, ReaderScreen, SurahScreen } from '@/screens/LibraryScreen';
import LegalScreen, { LegalIndex } from '@/screens/LegalScreen';
import HomeScreen from '@/screens/HomeScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import PostDetailScreen from '@/screens/PostDetailScreen';
import PostSubmissionScreen from '@/screens/PostSubmissionScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import PrayerDetailScreen from '@/screens/PrayerDetailScreen';
import QiblaScreen from '@/screens/QiblaScreen';
import QuestionsScreen from '@/screens/QuestionsScreen';
import QuestionDetailScreen from '@/screens/QuestionDetailScreen';
import SavedScreen from '@/screens/SavedScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import UserProfileScreen from '@/screens/UserProfileScreen';
import MembershipScreen from '@/screens/MembershipScreen';
import ShortsScreen from '@/screens/ShortsScreen';

const titles: Record<string, string> = {
  post: 'Post',
  postSubmit: 'Share a reminder',
  shorts: 'Community Shorts',
  membership: 'Membership',
  user: 'Profile',
  fatwa: 'Fatwa',
  fatwaList: 'Published rulings',
  quranList: 'Quran',
  legalIndex: 'About & legal',
  notifications: 'Notifications',
  saved: 'Saved posts',
  settings: 'Settings',
  prayerSettings: 'Prayer settings',
  qiblaSettings: 'Qibla direction',
  questionDetail: 'Answer details',
  prayerDetail: 'Prayer time',
};

function NetworkBanner() {
  const colors = useColors();
  const { state } = useNetworkStatus();

  if (state !== 'offline' && state !== 'slow') return null;
  return (
    <View style={[styles.networkBanner, { backgroundColor: state === 'offline' ? colors.coral : colors.gold }]} pointerEvents="none">
      <Feather name={state === 'offline' ? 'wifi-off' : 'wifi'} size={14} color="#fff" />
      <Text style={styles.networkText}>{state === 'offline' ? 'No internet connection · Showing saved content' : 'Slow internet connection'}</Text>
    </View>
  );
}

function Shell() {
  const colors = useColors();
  const { alarms, unreadCount, refreshContent, notifications, hydrated, markNotificationRead } = useApp();

  const [tab, setTab] = useState<TabKey>('home');
  const [stack, setStack] = useState<Route[]>([]);
  const [askSignal, setAskSignal] = useState(0);
  const [homeSearchOpen, setHomeSearchOpen] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [feedVisibilityTick, setFeedVisibilityTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const handledNotificationResponses = React.useRef(new Set<string>());

  const route = stack.length ? stack[stack.length - 1] : { name: 'tabs' as const };

  const goTab = useCallback((next: TabKey) => {
    void Haptics.selectionAsync();
    setHomeSearchOpen(false);
    setHomeSearchQuery('');
    setStack([]);
    setTab(next);
  }, []);

  const push = useCallback((next: Route) => {
    setStack((current) => [...current, next]);
  }, []);

  const back = useCallback(() => {
    setStack((current) => current.slice(0, -1));
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshContent();
    setTimeout(() => setRefreshing(false), 900);
  }, [refreshContent]);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 0) {
        back();
        return true;
      }
      if (tab !== 'home') {
        goTab('home');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [back, goTab, stack.length, tab]);

  const openAsk = useCallback(() => {
    setStack([]);
    setTab('questions');
    setAskSignal((value) => value + 1);
  }, []);

  const nav = useMemo<Nav>(
    () => ({ tab, route, goTab, push, back, openAsk }),
    [tab, route, goTab, push, back, openAsk],
  );

  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    const identifier = response.notification.request.identifier;
    if (handledNotificationResponses.current.has(identifier)) return;
    const content = response.notification.request.content;
    const data = content.data as Record<string, unknown>;
    const item = notifications.find((note) => note.title === content.title && note.body === content.body);
    const kind = typeof data.kind === 'string' ? data.kind : item?.kind;
    const refId = typeof data.refId === 'string' ? data.refId
      : typeof data.postId === 'string' ? data.postId
        : typeof data.questionId === 'string' ? data.questionId
          : typeof data.fatwaId === 'string' ? data.fatwaId : item?.refId;
    if (!kind && !item) return;
    handledNotificationResponses.current.add(identifier);
    if (kind === 'adhan') {
      const prayer = data.prayer;
      if (prayer === 'Fajr' || prayer === 'Dhuhr' || prayer === 'Asr' || prayer === 'Maghrib' || prayer === 'Isha') {
        setStack([{ name: 'prayerDetail', prayer }]);
      }
      return;
    }
    if (item) markNotificationRead(item.id);
    if (kind === 'post' && refId) {
      refreshContent();
      setStack([{ name: 'notifications' }, { name: 'post', postId: refId }]);
    } else if (kind === 'answer' && refId) {
      setStack([{ name: 'notifications' }, { name: 'questionDetail', questionId: refId }]);
    } else if (kind === 'fatwa' && refId) {
      setStack([{ name: 'notifications' }, { name: 'fatwa', fatwaId: refId }]);
    } else {
      setStack([{ name: 'notifications' }]);
    }
  }, [notifications, markNotificationRead, refreshContent]);

  React.useEffect(() => {
    if (!hydrated || Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });
    return () => subscription.remove();
  }, [hydrated, handleNotificationResponse]);

  const openLink = useCallback((url: string | null) => {
    const postId = postIdFromUrl(url);
    if (!postId) return;
    refreshContent();
    setTab('home');
    setStack([{ name: 'post', postId }]);
  }, [refreshContent]);

  React.useEffect(() => {
    if (!hydrated || Platform.OS === 'web') return;
    void Linking.getInitialURL().then(openLink).catch(() => undefined);
    const subscription = Linking.addEventListener('url', (event) => openLink(event.url));
    return () => subscription.remove();
  }, [hydrated, openLink]);

  const onSettings = useCallback(() => push({ name: 'settings' }), [push]);

  const REPORTABLE = new Set(['post', 'fatwa', 'questionDetail', 'reader', 'surah', 'quranList', 'user', 'fatwaList', 'postSubmit']);
  const reportable = route.name === 'tabs' ? tab !== 'alarm' : REPORTABLE.has(route.name);
  const pageName = route.name === 'tabs' ? tab : route.name;
  const hideTopHeader = (route.name === 'tabs' && tab === 'profile') || route.name === 'settings';

  const header = () => {
    const title = route.name === 'surah' || route.name === 'reader' ? route.title : titles[route.name] ?? (route.name === 'tabs' && tab === 'alarm' ? 'Notifications' : undefined);
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
            <LogoMark size={36} />
            <View>
              <Text style={[styles.brandName, { color: colors.forest }]}>Fatwa</Text>
            </View>
          </View>
        )}
        {title ? <Text style={[styles.topBarTitle, { color: colors.foreground }]}>{title}</Text> : null}
        <View style={styles.headerRight}>
        {route.name === 'tabs' && tab === 'home' && homeSearchOpen ? (
          <View style={[styles.headerSearchInput, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
            <Feather name="search" size={18} color={colors.primary} />
            <TextInput
              autoFocus
              value={homeSearchQuery}
              onChangeText={setHomeSearchQuery}
              placeholder="Search posts..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.headerSearchText, { color: colors.foreground }]}
              returnKeyType="search"
              accessibilityLabel="Search posts"
              testID="home-header-search-input"
            />
            <Pressable onPress={() => { setHomeSearchQuery(''); setHomeSearchOpen(false); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close search">
              <Feather name="x" size={19} color={colors.primary} />
            </Pressable>
          </View>
        ) : route.name === 'tabs' && tab === 'home' ? (
          <Pressable
            style={[styles.headerSearch, { backgroundColor: colors.primarySoft, borderColor: colors.primary, shadowColor: colors.shadow }]}
            accessibilityRole="button"
            accessibilityLabel="Search posts"
            onPress={() => setHomeSearchOpen(true)}
            testID="home-header-search"
          >
            <Feather name="search" size={23} color={colors.primary} />
          </Pressable>
        ) : reportable ? (
          <Pressable style={styles.headerSide} accessibilityRole="button" accessibilityLabel="Report a problem" onPress={() => setReportOpen(true)} testID="report-problem">
            <Feather name="flag" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
        {route.name === 'tabs' && tab === 'home' ? (
          <Pressable style={styles.headerSide} accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => push({ name: 'notifications' })} testID="home-notifications">
            <Feather name="bell" size={20} color={colors.foreground} />
            {unreadCount > 0 ? <View style={[styles.notificationDot, { backgroundColor: colors.coral }]} /> : null}
          </Pressable>
        ) : null}
        {route.name === 'tabs' && tab !== 'home' ? (
          <Pressable
            style={styles.headerSide}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => push({ name: 'notifications' })}
          >
            <Feather name="bell" size={20} color={colors.foreground} />
            {unreadCount > 0 ? <View style={[styles.notificationDot, { backgroundColor: colors.coral }]} /> : null}
          </Pressable>
        ) : null}
        </View>
      </View>
    );
  };

  let content: React.ReactNode;
  if (route.name === 'post') content = <PostDetailScreen postId={route.postId} />;
  else if (route.name === 'postSubmit') content = <PostSubmissionScreen />;
  else if (route.name === 'shorts') content = <ShortsScreen />;
  else if (route.name === 'membership') content = <MembershipScreen />;
  else if (route.name === 'user') content = <UserProfileScreen userId={route.userId} />;
  else if (route.name === 'fatwa') content = <FatwaDetailScreen fatwaId={route.fatwaId} />;
  else if (route.name === 'fatwaList') content = <FatwaScreen />;
  else if (route.name === 'legalIndex') content = <LegalIndex />;
  else if (route.name === 'legal') content = <LegalScreen pageKey={route.pageKey} />;
  else if (route.name === 'quranList') content = <QuranListScreen />;
  else if (route.name === 'surah') content = <SurahScreen number={route.number} />;
  else if (route.name === 'reader') content = <ReaderScreen workId={route.workId} />;
  else if (route.name === 'notifications') content = <NotificationsScreen />;
  else if (route.name === 'saved') content = <SavedScreen />;
  else if (route.name === 'settings') content = <SettingsScreen />;
  else if (route.name === 'prayerSettings') content = <AlarmScreen />;
  else if (route.name === 'prayerDetail') content = <PrayerDetailScreen prayer={route.prayer} />;
  else if (route.name === 'qiblaSettings') content = <QiblaScreen />;
  else if (route.name === 'questionDetail') content = <QuestionDetailScreen questionId={route.questionId} />;
  else if (tab === 'home') content = <HomeScreen searchQuery={homeSearchQuery} visibilityTick={feedVisibilityTick} />;
  else if (tab === 'library') content = <LibraryScreen />;
  else if (tab === 'questions') content = <QuestionsScreen askSignal={askSignal} />;
  else if (tab === 'alarm') content = <NotificationsScreen />;
  else content = <ProfileScreen onOpenSettings={onSettings} />;

  const showTabBar = route.name === 'tabs';
  const isAskTab = route.name === 'tabs' && tab === 'questions';

  return (
    <NavProvider value={nav}>
      <NetworkStatusProvider>
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={[styles.app, { backgroundColor: colors.background }]}>
          <NetworkBanner />
          {isAskTab ? (
            <View style={styles.chatContent}>
              {header()}
              <View style={styles.chatContent}>{content}</View>
            </View>
          ) : route.name === 'shorts' ? (
            <View style={styles.immersive}>
              {header()}
              <View style={styles.immersiveContent}>{content}</View>
            </View>
          ) : (
              <KeyboardAwareScrollViewCompat
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                scrollEventThrottle={250}
                onScroll={route.name === 'tabs' && tab === 'home' ? () => setFeedVisibilityTick((current) => current + 1) : undefined}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
            >
              {!hideTopHeader ? header() : null}
              {content}
            </KeyboardAwareScrollViewCompat>
          )}
          {showTabBar ? <TabBar tab={tab} badge={unreadCount} onSelect={goTab} /> : null}
        </View>
        <ReportModal visible={reportOpen} page={pageName} onClose={() => setReportOpen(false)} />
      </SafeAreaView>
      </NetworkStatusProvider>
    </NavProvider>
  );
}

export default function AppShell() {
  const { alarms, settings, prayerCity, hydrated } = useApp();

  React.useEffect(() => {
    if (!hydrated || !alarms.length) return;
    void syncAdhanAlarms(alarms, { soundEnabled: settings.adhanSound, timezoneOffsetHours: prayerCity.timezone });
  }, [alarms, hydrated, prayerCity.timezone, settings.adhanSound]);

  return <Shell />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  app: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 12 },
  chatScrollContent: { flex: 1 },
  chatContent: { flex: 1, minHeight: 0 },
  immersive: { flex: 1, minHeight: 0 },
  immersiveContent: { flex: 1, minHeight: 0 },
  topBar: {
    minHeight: 60,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { fontSize: 23, fontWeight: '800', letterSpacing: -0.6 },
  hijriDate: { fontSize: 10.5, fontWeight: '500', marginTop: 2 },
  topBarTitle: { position: 'absolute', left: 70, right: 66, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerSide: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerSearch: { width: 52, height: 46, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  headerSearchInput: { width: 202, height: 46, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSearchText: { flex: 1, minWidth: 0, height: 44, fontSize: 13.5, fontWeight: '600' },
  notificationDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', top: 9, right: 9 },
  tabBar: {
    minHeight: 80,
    paddingTop: 8,
    paddingHorizontal: 10,
    borderTopWidth: 0,
    borderRadius: 25,
    marginHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#0D594B',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
  },
  tabItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 58, borderWidth: 1, borderColor: 'transparent', borderRadius: 18, marginHorizontal: 2, paddingHorizontal: 2, paddingVertical: 4 },
  tabIcon: { width: 38, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.05 },
  activeDot: { height: 3, width: 12, borderRadius: 2 },
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
  networkBanner: { position: 'absolute', top: 8, left: 18, right: 18, zIndex: 20, minHeight: 34, borderRadius: 17, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, elevation: 8, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  networkText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
});
