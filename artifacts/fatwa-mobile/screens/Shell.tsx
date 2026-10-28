import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, RefreshControl, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LogoMark } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { NavProvider, type Nav, type Route } from '@/lib/nav';
import { AppProvider, useApp } from '@/lib/store';
import { syncAdhanAlarms } from '@/lib/adhan';
import { formatIslamicDate } from '@/lib/islamic-date';
import type { TabKey } from '@/lib/types';
import AlarmScreen from '@/screens/AlarmScreen';
import FatwaDetailScreen from '@/screens/FatwaDetailScreen';
import FatwaScreen from '@/screens/FatwaScreen';
import HomeScreen from '@/screens/HomeScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import PostDetailScreen from '@/screens/PostDetailScreen';
import PostSubmissionScreen from '@/screens/PostSubmissionScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import QiblaScreen from '@/screens/QiblaScreen';
import QuestionsScreen from '@/screens/QuestionsScreen';
import QuestionDetailScreen from '@/screens/QuestionDetailScreen';
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
  postSubmit: 'Share a reminder',
  fatwa: 'Fatwa',
  notifications: 'Notifications',
  saved: 'Saved posts',
  settings: 'Settings',
  prayerSettings: 'Prayer settings',
  qiblaSettings: 'Qibla direction',
  questionDetail: 'Answer details',
};

function Shell() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alarms, settings, unreadCount, pushNotification, refreshContent, notifications, hydrated, markNotificationRead } = useApp();

  const [tab, setTab] = useState<TabKey>('home');
  const [stack, setStack] = useState<Route[]>([]);
  const [askSignal, setAskSignal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const handledNotificationResponses = React.useRef(new Set<string>());

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
    if (kind === 'adhan') return;
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
            <LogoMark size={36} />
            <View>
              <Text style={[styles.brandName, { color: colors.forest }]}>Fatwa</Text>
              <Text style={[styles.hijriDate, { color: colors.mutedForeground }]}>{formatIslamicDate(new Date(), settings.language)}</Text>
            </View>
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
  else if (route.name === 'postSubmit') content = <PostSubmissionScreen />;
  else if (route.name === 'fatwa') content = <FatwaDetailScreen fatwaId={route.fatwaId} />;
  else if (route.name === 'notifications') content = <NotificationsScreen />;
  else if (route.name === 'saved') content = <SavedScreen />;
  else if (route.name === 'settings') content = <SettingsScreen />;
  else if (route.name === 'prayerSettings') content = <AlarmScreen />;
  else if (route.name === 'qiblaSettings') content = <QiblaScreen />;
  else if (route.name === 'questionDetail') content = <QuestionDetailScreen questionId={route.questionId} />;
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          >
            {header()}
            {content}
          </KeyboardAwareScrollViewCompat>
          {showTabBar ? (
            <LinearGradient
              colors={[colors.card, colors.cardMuted]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.tabBar,
                {
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
                    style={[styles.tabItem, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={item.label}
                    testID={`tab-${item.key}`}
                  >
                    <View style={[styles.tabIcon, selected && { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                      <Feather
                        name={item.icon}
                        size={20}
                        color={selected ? colors.primaryForeground : colors.mutedForeground}
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
                        { color: selected ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {item.key === 'alarm' ? 'Alerts' : item.label}
                    </Text>
                    {selected ? (
                      <LinearGradient
                        colors={selected ? [colors.gold, colors.goldSoft] : [colors.border, colors.border]}
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
            </LinearGradient>
          ) : null}
        </View>
      </SafeAreaView>
    </NavProvider>
  );
}

export default function AppShell() {
  const { alarms, settings, pushNotification, hydrated } = useApp();

  React.useEffect(() => {
    if (!hydrated || !alarms.length) return;
    void syncAdhanAlarms(alarms, { soundEnabled: settings.adhanSound }).then((result) => {
      if (result.scheduled > 0) {
        pushNotification({
          kind: 'system',
          title: 'Adhan alarms ready',
          body: `${result.scheduled} adhan alarm${result.scheduled === 1 ? '' : 's'} scheduled.`,
        });
      }
    });
  }, [alarms, hydrated, settings.adhanSound, pushNotification]);

  return <Shell />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  app: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 12 },
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
  headerSide: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
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
});
