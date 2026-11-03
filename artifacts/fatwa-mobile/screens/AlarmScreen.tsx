import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { InfoBanner, PrimaryButton, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { getCurrentPrayerLocation } from '@/lib/location';
import { ADHAN_CHANNEL_ID, countScheduledAdhan, ensureNotificationPermissions, initializeNotificationChannels, sendTestAdhan, syncAdhanAlarms } from '@/lib/adhan';
import { computePrayerTimes, formatClockTime, formatCountdown, minutesUntil } from '@/lib/prayer';
import { useApp } from '@/lib/store';
import type { AdhanAlarm, PrayerName } from '@/lib/types';

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export default function AlarmScreen() {
  const colors = useColors();
  const { alarms, updateAlarm, prayerCity, setPrayerCity, setProfile, settings, setSettings, pushNotification } = useApp();
  const [now, setNow] = useState(new Date());
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [playing, setPlaying] = useState(false);
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [queued, setQueued] = useState<number | null>(null);
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [channelMuted, setChannelMuted] = useState(false);
  const player = useAudioPlayer(require('../assets/audio/adhan_drive.mp3'));

  const refreshDiagnostics = useCallback(async () => {
    const [count, permission, channel] = await Promise.all([
      countScheduledAdhan(),
      Notifications.getPermissionsAsync().catch(() => null),
      Notifications.getNotificationChannelAsync(ADHAN_CHANNEL_ID).catch(() => null),
    ]);
    setQueued(count);
    if (permission) setPermitted(permission.granted);
    setChannelMuted(Boolean(channel) && !channel?.sound);
  }, []);

  const refreshLocation = useCallback(async () => {
    setLocationStatus('loading');
    try {
      const current = await getCurrentPrayerLocation();
      setPrayerCity(current.city);
      setProfile({ city: current.city.name });
      setLocationStatus('ready');
    } catch {
      setLocationStatus('denied');
    }
  }, [setPrayerCity, setProfile]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => undefined);
    void refreshLocation();
    void initializeNotificationChannels(settings.adhanSound);
    void refreshDiagnostics();
    return () => clearInterval(timer);
  }, [refreshLocation, refreshDiagnostics, settings.adhanSound]);

  const times = useMemo(() => computePrayerTimes(now, prayerCity.latitude, prayerCity.longitude, prayerCity.timezone), [now, prayerCity]);
  const nextPrayer = useMemo(() => {
    let best: { name: PrayerName; time: string; minutes: number } | null = null;
    for (const name of PRAYERS) {
      const minutes = minutesUntil(times[name], now, prayerCity.timezone);
      if (minutes >= 0 && (!best || minutes < best.minutes)) best = { name, time: times[name], minutes };
    }
    return best ?? { name: 'Fajr', time: times.Fajr, minutes: minutesUntil(times.Fajr, now, prayerCity.timezone) + 24 * 60 };
  }, [now, prayerCity.timezone, times]);

  const syncAlarms = useCallback(async (list: AdhanAlarm[]) => {
    const result = await syncAdhanAlarms(list, { soundEnabled: settings.adhanSound, timezoneOffsetHours: prayerCity.timezone });
    setScheduled(result.scheduled);
    setPermitted(result.permitted);
    void refreshDiagnostics();
    return result;
  }, [prayerCity.timezone, refreshDiagnostics, settings.adhanSound]);

  useEffect(() => {
    if (alarms.some((alarm) => alarm.enabled)) void syncAlarms(alarms);
    else void refreshDiagnostics();
  }, [alarms, prayerCity, refreshDiagnostics, syncAlarms]);

  const mergeAlarm = (prayer: PrayerName, patch: Partial<AdhanAlarm>): AdhanAlarm[] => {
    const existing = alarms.find((item) => item.prayer === prayer);
    if (!existing) return [...alarms, { prayer, time: patch.time ?? times[prayer], enabled: false, auto: true, ...patch }];
    return alarms.map((item) => item.prayer === prayer ? { ...item, ...patch } : item);
  };

  const toggleAlarm = async (prayer: PrayerName, enabled: boolean) => {
    const next = mergeAlarm(prayer, { enabled });
    updateAlarm(prayer, { enabled });
    const result = await syncAlarms(next);
    if (enabled && result.permitted) {
      pushNotification({ kind: 'system', title: `${prayer} alarm enabled`, body: `Your ${prayer} alarm is enabled. You will be notified when prayer time begins.` });
    }
    if (enabled && !result.permitted) Alert.alert('Notifications are off', 'Allow notifications so the adhan alarm can sound.');
  };

  const changeTime = (prayer: PrayerName, delta: number) => {
    const current = alarms.find((item) => item.prayer === prayer)?.time ?? times[prayer];
    const [hour, minute] = current.split(':').map(Number);
    const total = (hour * 60 + minute + delta + 1440) % 1440;
    const time = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    // A hand-adjusted time stops following the computed prayer time.
    updateAlarm(prayer, { time, auto: false });
    void syncAlarms(mergeAlarm(prayer, { time, auto: false }));
  };

  const enableAll = async () => {
    if (!(await ensureNotificationPermissions())) {
      Alert.alert('Notifications are off', 'Allow notifications to receive adhan alarms.');
      return;
    }
    const next = PRAYERS.map((prayer) => {
      const existing = alarms.find((item) => item.prayer === prayer);
      return { prayer, time: existing?.time ?? times[prayer], enabled: true, auto: existing?.auto ?? true };
    });
    next.forEach((item) => updateAlarm(item.prayer, item));
    const result = await syncAlarms(next);
    pushNotification({ kind: 'system', title: 'Adhan alarms enabled', body: `${result.scheduled} adhan alarms scheduled for ${prayerCity.name}.` });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const togglePreview = () => {
    if (playing) { player.pause(); setPlaying(false); } else { player.seekTo(0); player.play(); setPlaying(true); }
  };

  const testAdhan = async () => {
    if (!(await ensureNotificationPermissions())) {
      Alert.alert('Notifications are off', 'Allow notifications to test the adhan alarm.');
      return;
    }
    const ok = await sendTestAdhan(8);
    if (ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Test adhan sent', 'Lock your phone or leave the app. In about 8 seconds you should hear the adhan. If nothing arrives, open Android Settings → Apps → Fatwa App → Notifications and check that the "Adhan alarms" channel is not silenced.');
    } else {
      Alert.alert('Could not schedule the test', 'Notifications are disabled for this app.');
    }
  };

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>PRAYER ALARMS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Adhan times</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Prayer times and alarms follow your current GPS location.</Text>
      </View>
      <View style={[styles.nextCard, { backgroundColor: colors.forest }]}>
        <View style={{ flex: 1 }}><Text style={styles.nextLabel}>NEXT PRAYER</Text><Text style={styles.nextName}>{nextPrayer.name}</Text><Text style={styles.nextTime}>{formatClockTime(nextPrayer.time)}</Text></View>
        <View style={styles.nextRight}><MaterialCommunityIcons name="timer-sand" size={20} color="#CFE7DE" /><Text style={styles.nextCountdown}>{formatCountdown(nextPrayer.minutes)}</Text><Text style={styles.nextCity}>{prayerCity.name}</Text></View>
      </View>
      <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="map-pin" size={17} color={colors.primary} />
        <View style={{ flex: 1 }}><Text style={[styles.locationTitle, { color: colors.foreground }]}>{locationStatus === 'ready' ? `Using GPS: ${prayerCity.name}` : 'Use current location'}</Text><Text style={[styles.locationCopy, { color: colors.mutedForeground }]}>{locationStatus === 'denied' ? 'Permission is off; city fallback is being used.' : 'Location is used for latitude, longitude and local timezone.'}</Text></View>
        <Pressable onPress={() => void refreshLocation()} accessibilityRole="button" accessibilityLabel="Refresh prayer location"><Feather name="refresh-cw" size={17} color={colors.primary} /></Pressable>
      </View>
      {locationStatus === 'denied' ? <InfoBanner icon="alert-triangle" tone="gold" text="Enable location permission for accurate local prayer times. You can still choose a city below." /> : null}
      <SectionTitle title="Prayer alarms" subtitle="Adjust by five minutes if your local authority differs." />
      {PRAYERS.map((prayer) => {
        const alarm = alarms.find((item) => item.prayer === prayer);
        const enabled = alarm?.enabled ?? false;
        const time = alarm?.time ?? times[prayer];
        return <View key={prayer} style={[styles.alarmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.alarmTop}><View style={[styles.alarmIcon, { backgroundColor: enabled ? colors.primarySoft : colors.muted }]}><MaterialCommunityIcons name="bell-ring-outline" size={19} color={enabled ? colors.primary : colors.mutedForeground} /></View><View style={{ flex: 1 }}><Text style={[styles.alarmName, { color: colors.foreground }]}>{prayer}</Text><Text style={[styles.alarmCalc, { color: colors.mutedForeground }]}>Calculated {formatClockTime(times[prayer])}</Text></View><Switch value={enabled} onValueChange={(value) => void toggleAlarm(prayer, value)} trackColor={{ false: colors.border, true: colors.teal }} thumbColor="#FFFFFF" accessibilityLabel={`${prayer} adhan alarm`} /></View>
          <View style={[styles.timeRow, { borderTopColor: colors.border }]}><Pressable onPress={() => changeTime(prayer, -5)} style={[styles.stepButton, { borderColor: colors.border }]}><Feather name="minus" size={16} color={colors.foreground} /></Pressable><View style={styles.timeDisplay}><Text style={[styles.timeValue, { color: enabled ? colors.primary : colors.foreground }]}>{formatClockTime(time)}</Text><Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>Alarm time</Text></View><Pressable onPress={() => changeTime(prayer, 5)} style={[styles.stepButton, { borderColor: colors.border }]}><Feather name="plus" size={16} color={colors.foreground} /></Pressable></View>
        </View>;
      })}
      <PrimaryButton label="Enable all adhan alarms" icon="bell" onPress={() => void enableAll()} />
      <View style={[styles.soundRow, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.alarmIcon, { backgroundColor: colors.primarySoft }]}><Feather name="volume-2" size={18} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.alarmName, { color: colors.foreground }]}>Adhan sound</Text><Text style={[styles.alarmCalc, { color: colors.mutedForeground }]}>Play the adhan when an alarm fires</Text></View><Switch value={settings.adhanSound} onValueChange={(value) => setSettings({ adhanSound: value })} trackColor={{ false: colors.border, true: colors.teal }} thumbColor="#FFFFFF" /></View>
      <Pressable onPress={togglePreview} style={[styles.preview, { borderColor: colors.border }]}><Feather name={playing ? 'pause' : 'play'} size={16} color={colors.primary} /><Text style={[styles.previewText, { color: colors.foreground }]}>{playing ? 'Pause adhan preview' : 'Preview the adhan'}</Text></Pressable>
      <Pressable onPress={() => void testAdhan()} style={[styles.preview, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Send a test adhan notification"><Feather name="bell" size={16} color={colors.primary} /><Text style={[styles.previewText, { color: colors.foreground }]}>Send a test adhan now</Text></Pressable>
      {scheduled !== null ? <Text style={[styles.status, { color: colors.mutedForeground }]}>{scheduled} alarm{scheduled === 1 ? '' : 's'} scheduled on this device.</Text> : null}
      {queued !== null && permitted === false ? <InfoBanner icon="alert-triangle" tone="gold" text="Notifications are turned off for this app. Open Android Settings → Apps → Fatwa App → Notifications and allow them, otherwise no adhan alarm can sound." /> : null}
      {channelMuted && permitted ? <InfoBanner icon="alert-triangle" tone="gold" text="The Android 'Adhan alarms' channel is currently silenced. Open Android Settings → Apps → Fatwa App → Notifications → Adhan alarms and turn the sound back on." /> : null}
      {queued === 0 && permitted ? <InfoBanner icon="alert-triangle" tone="gold" text="No adhan alarm is queued yet. Turn on at least one prayer above, then send a test adhan to confirm sound and vibration." /> : null}
      <InfoBanner icon="info" text="Prayer times use the Karachi calculation method with Hanafi Asr. Confirm local timings with your mosque." />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 10, marginBottom: 20 }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 }, title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6 }, subtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 }, nextCard: { borderRadius: 22, padding: 19, flexDirection: 'row', marginBottom: 15 }, nextLabel: { color: '#CFE7DE', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 }, nextName: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 6 }, nextTime: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginTop: 2 }, nextRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 5 }, nextCountdown: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, nextCity: { color: '#CFE7DE', fontSize: 11 }, locationCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 }, locationTitle: { fontSize: 13, fontWeight: '800' }, locationCopy: { fontSize: 11, marginTop: 3, lineHeight: 16 }, alarmCard: { borderWidth: 1, borderRadius: 19, padding: 14, marginBottom: 10 }, alarmTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, alarmIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, alarmName: { fontSize: 13, fontWeight: '800' }, alarmCalc: { fontSize: 11, marginTop: 3 }, timeRow: { borderTopWidth: 1, marginTop: 13, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, stepButton: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, timeDisplay: { alignItems: 'center' }, timeValue: { fontSize: 21, fontWeight: '800' }, timeLabel: { fontSize: 10, marginTop: 2 }, soundRow: { borderWidth: 1, borderRadius: 19, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 5 }, preview: { borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }, previewText: { fontSize: 12, fontWeight: '700' }, status: { textAlign: 'center', fontSize: 11, marginVertical: 12 },
});
