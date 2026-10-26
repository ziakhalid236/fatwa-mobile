import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { QiblaCompass } from '@/components/QiblaCompass';
import { InfoBanner, PrimaryButton, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { ensureNotificationPermissions, syncAdhanAlarms } from '@/lib/adhan';
import {
  computePrayerTimes,
  formatCountdown,
  haversineDistanceKm,
  minutesUntil,
  qiblaDirection,
} from '@/lib/prayer';
import { useApp } from '@/lib/store';
import { prayerCities } from '@/data/content';
import type { AdhanAlarm, PrayerName } from '@/lib/types';

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export default function AlarmScreen() {
  const colors = useColors();
  const { alarms, updateAlarm, prayerCity, setPrayerCity, settings, setSettings, pushNotification } =
    useApp();

  const [now, setNow] = useState(new Date());
  const [heading, setHeading] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [playing, setPlaying] = useState(false);
  const [scheduled, setScheduled] = useState<number | null>(null);

  const player = useAudioPlayer(require('../assets/audio/adhan.mp3'));
  const headingSub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(
      () => undefined,
    );
  }, []);

  const times = useMemo(
    () =>
      computePrayerTimes(
        now,
        prayerCity.latitude,
        prayerCity.longitude,
        prayerCity.timezone,
      ),
    [now, prayerCity],
  );

  const qibla = useMemo(
    () => qiblaDirection(prayerCity.latitude, prayerCity.longitude),
    [prayerCity],
  );

  const distance = useMemo(
    () => haversineDistanceKm(prayerCity.latitude, prayerCity.longitude, 21.4225, 39.8262),
    [prayerCity],
  );

  const nextPrayer = useMemo(() => {
    let best: { name: PrayerName; time: string; minutes: number } | null = null;
    for (const name of PRAYERS) {
      const remaining = minutesUntil(times[name], now);
      if (remaining >= 0 && (!best || remaining < best.minutes)) {
        best = { name, time: times[name], minutes: remaining };
      }
    }
    if (!best) {
      best = { name: 'Fajr', time: times.Fajr, minutes: minutesUntil(times.Fajr, now) + 24 * 60 };
    }
    return best;
  }, [now, times]);

  const stopHeading = useCallback(() => {
    headingSub.current?.remove();
    headingSub.current = null;
  }, []);

  const startHeading = useCallback(async () => {
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setPermission('denied');
        return;
      }
      setPermission('granted');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      stopHeading();
      headingSub.current = await Location.watchHeadingAsync((value) => {
        const next = value.trueHeading >= 0 ? value.trueHeading : value.magHeading;
        setHeading(next);
      });
    } catch {
      setPermission('denied');
    }
  }, [stopHeading]);

  useEffect(() => {
    void startHeading();
    return () => stopHeading();
  }, [startHeading, stopHeading]);

  const activeLatitude = coords?.latitude ?? prayerCity.latitude;
  const activeLongitude = coords?.longitude ?? prayerCity.longitude;
  const activeQibla = useMemo(
    () => qiblaDirection(activeLatitude, activeLongitude),
    [activeLatitude, activeLongitude],
  );
  const activeDistance = useMemo(
    () => haversineDistanceKm(activeLatitude, activeLongitude, 21.4225, 39.8262),
    [activeLatitude, activeLongitude],
  );

  const effectiveHeading = heading ?? 0;
  const aligned =
    heading !== null && Math.abs(((activeQibla - effectiveHeading + 540) % 360) - 180) < 8;

  const syncAlarms = useCallback(
    async (list: AdhanAlarm[]) => {
      const result = await syncAdhanAlarms(list, { soundEnabled: settings.adhanSound });
      setScheduled(result.scheduled);
      return result;
    },
    [settings.adhanSound],
  );

  const mergeAlarm = useCallback(
    (list: AdhanAlarm[], prayer: PrayerName, patch: Partial<AdhanAlarm>): AdhanAlarm[] => {
      const existing = list.find((item) => item.prayer === prayer);
      if (!existing) return [...list, { prayer, time: patch.time ?? times[prayer], enabled: false, ...patch }];
      return list.map((item) => (item.prayer === prayer ? { ...item, ...patch } : item));
    },
    [times],
  );

  const onToggleAlarm = async (prayer: PrayerName, value: boolean) => {
    updateAlarm(prayer, { enabled: value });
    void Haptics.selectionAsync();
    const result = await syncAlarms(mergeAlarm(alarms, prayer, { enabled: value }));
    if (value && !result.permitted) {
      Alert.alert(
        'Notifications are off',
        'Allow notifications so the adhan alarm can sound at prayer time.',
      );
    }
  };

  const setAlarmTime = (prayer: PrayerName, deltaMinutes: number) => {
    const current = alarms.find((item) => item.prayer === prayer);
    const base = current?.time ?? times[prayer];
    const [h, m] = base.split(':').map(Number);
    const total = (h * 60 + m + deltaMinutes + 24 * 60) % (24 * 60);
    const next = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    updateAlarm(prayer, { time: next });
    void syncAlarms(mergeAlarm(alarms, prayer, { time: next }));
  };

  const enableAllAdhans = async () => {
    const permitted = await ensureNotificationPermissions();
    if (!permitted) {
      Alert.alert('Notifications are off', 'Allow notifications to receive adhan alarms.');
      return;
    }
    const next = PRAYERS.map((prayer) => {
      const existing = alarms.find((item) => item.prayer === prayer);
      return { prayer, time: existing?.time ?? times[prayer], enabled: true };
    });
    for (const alarm of next) {
      updateAlarm(alarm.prayer, { enabled: true, time: alarm.time });
    }
    const result = await syncAlarms(next);
    pushNotification({
      kind: 'system',
      title: 'Adhan alarms enabled',
      body: `${result.scheduled} adhan alarms will sound at the selected times.`,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const togglePreview = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
      return;
    }
    player.seekTo(0);
    player.play();
    setPlaying(true);
  };

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>QIBLA &amp; ADHAN</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Alarm</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Find the Qibla direction with the compass and set an adhan alarm for each prayer.
        </Text>
      </View>

      <View style={[styles.nextCard, { backgroundColor: colors.forest }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nextLabel}>NEXT PRAYER</Text>
          <Text style={styles.nextName}>{nextPrayer.name}</Text>
          <Text style={styles.nextTime}>{nextPrayer.time}</Text>
        </View>
        <View style={styles.nextRight}>
          <MaterialCommunityIcons name="timer-sand" size={20} color="#CFE7DE" />
          <Text style={styles.nextCountdown}>{formatCountdown(nextPrayer.minutes)}</Text>
          <Text style={styles.nextCity}>{prayerCity.name}</Text>
        </View>
      </View>

      <SectionTitle title="Qibla compass" subtitle="Hold the phone flat and level" />
      <View style={[styles.compassCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <QiblaCompass
          heading={effectiveHeading}
          qibla={activeQibla}
          aligned={aligned}
          kaabaDistanceKm={activeDistance}
        />
        <View style={styles.compassStatus}>
          {permission === 'denied' ? (
            <InfoBanner
              icon="alert-triangle"
              tone="gold"
              text="Location permission is off. Showing the Qibla for the selected city instead."
            />
          ) : (
            <Text style={[styles.compassHint, { color: colors.mutedForeground }]}>
              {heading === null
                ? 'Calibrating the compass…'
                : aligned
                  ? 'You are facing the Qibla.'
                  : 'Rotate the phone until the gold arrow points up.'}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => void startHeading()}
          style={[styles.refreshButton, { borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <Feather name="refresh-cw" size={15} color={colors.foreground} />
          <Text style={[styles.refreshText, { color: colors.foreground }]}>Recalibrate</Text>
        </Pressable>
      </View>

      <SectionTitle title="Adhan alarms" subtitle="Times follow the selected city; adjust as needed" />

      <View style={[styles.cityRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="map-pin" size={16} color={colors.primary} />
        <Text style={[styles.cityLabel, { color: colors.foreground }]}>Prayer city</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityChips}>
          {prayerCities.map((city) => {
            const active = city.name === prayerCity.name;
            return (
              <Pressable
                key={city.name}
                onPress={() => setPrayerCity(city)}
                style={[
                  styles.cityChip,
                  {
                    backgroundColor: active ? colors.primary : colors.background,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.cityChipText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                  {city.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {PRAYERS.map((prayer) => {
        const alarm = alarms.find((item) => item.prayer === prayer);
        const enabled = alarm?.enabled ?? false;
        const time = alarm?.time ?? times[prayer];
        return (
          <View
            key={prayer}
            style={[styles.alarmCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.alarmTop}>
              <View style={[styles.alarmIcon, { backgroundColor: enabled ? colors.primarySoft : colors.muted }]}>
                <MaterialCommunityIcons
                  name="bell-ring-outline"
                  size={19}
                  color={enabled ? colors.primary : colors.mutedForeground}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alarmName, { color: colors.foreground }]}>{prayer}</Text>
                <Text style={[styles.alarmCalc, { color: colors.mutedForeground }]}>
                  Calculated {times[prayer]}
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={(value) => void onToggleAlarm(prayer, value)}
                trackColor={{ false: colors.border, true: colors.teal }}
                thumbColor="#FFFFFF"
                accessibilityLabel={`${prayer} adhan alarm`}
              />
            </View>

            <View style={[styles.timeRow, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={() => setAlarmTime(prayer, -5)}
                style={[styles.stepButton, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${prayer} alarm time`}
              >
                <Feather name="minus" size={16} color={colors.foreground} />
              </Pressable>
              <View style={styles.timeDisplay}>
                <Text style={[styles.timeValue, { color: enabled ? colors.primary : colors.foreground }]}>
                  {time}
                </Text>
                <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>Alarm time</Text>
              </View>
              <Pressable
                onPress={() => setAlarmTime(prayer, 5)}
                style={[styles.stepButton, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={`Increase ${prayer} alarm time`}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
        );
      })}

      <View style={{ height: 6 }} />
      <PrimaryButton label="Enable all adhan alarms" icon="bell" onPress={() => void enableAllAdhans()} />
      <View style={{ height: 12 }} />

      <View style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.alarmIcon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="volume-high" size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.alarmName, { color: colors.foreground }]}>Adhan sound</Text>
          <Text style={[styles.alarmCalc, { color: colors.mutedForeground }]}>
            Play the adhan when the alarm sounds
          </Text>
        </View>
        <Switch
          value={settings.adhanSound}
          onValueChange={(value) => {
            setSettings({ adhanSound: value });
            void syncAlarms(alarms);
          }}
          trackColor={{ false: colors.border, true: colors.teal }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Adhan sound"
        />
      </View>

      <Pressable
        onPress={togglePreview}
        style={[styles.previewButton, { borderColor: colors.border, backgroundColor: colors.card }]}
        accessibilityRole="button"
      >
        <Feather name={playing ? 'pause' : 'play'} size={16} color={colors.primary} />
        <Text style={[styles.previewText, { color: colors.primary }]}>
          {playing ? 'Pause adhan preview' : 'Preview the adhan'}
        </Text>
      </Pressable>

      {scheduled !== null ? (
        <Text style={[styles.scheduledNote, { color: colors.mutedForeground }]}>
          {scheduled > 0
            ? `${scheduled} adhan alarm${scheduled === 1 ? '' : 's'} scheduled on this device.`
            : 'No alarms are scheduled yet.'}
        </Text>
      ) : null}

      <View style={{ height: 14 }} />
      <InfoBanner
        icon="info"
        text={`Prayer times use the Karachi calculation method and follow the selected city (${prayerCity.name}). You can adjust each alarm time yourself.`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 8, marginBottom: 16 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 6 },
  title: { fontSize: 23, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, lineHeight: 19, marginTop: 6 },
  nextCard: { borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  nextLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: '#B6E7D6' },
  nextName: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: 6 },
  nextTime: { fontSize: 15, fontWeight: '600', color: '#CFE7DE', marginTop: 3 },
  nextRight: { alignItems: 'flex-end', gap: 5 },
  nextCountdown: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  nextCity: { fontSize: 11, color: '#B6E7D6', fontWeight: '600' },
  compassCard: { borderRadius: 24, borderWidth: 1, padding: 18, alignItems: 'center', marginBottom: 20 },
  compassStatus: { marginTop: 16, width: '100%' },
  compassHint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  refreshButton: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshText: { fontSize: 12.5, fontWeight: '700' },
  cityRow: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 13,
  },
  cityLabel: { fontSize: 12.5, fontWeight: '700' },
  cityChips: { gap: 7 },
  cityChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6 },
  cityChipText: { fontSize: 11, fontWeight: '700' },
  alarmCard: { borderRadius: 20, borderWidth: 1, padding: 15, marginBottom: 12 },
  alarmTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alarmIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  alarmName: { fontSize: 14.5, fontWeight: '700', marginBottom: 3 },
  alarmCalc: { fontSize: 11.5 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 13,
    paddingTop: 12,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDisplay: { alignItems: 'center' },
  timeValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  timeLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  settingRow: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 13,
  },
  previewButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginBottom: 12,
  },
  previewText: { fontSize: 13.5, fontWeight: '700' },
  scheduledNote: { fontSize: 11.5, textAlign: 'center', marginBottom: 4 },
});
