import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { InfoBanner } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { computePrayerTimes, formatClockTime } from '@/lib/prayer';
import { useApp } from '@/lib/store';
import type { PrayerName } from '@/lib/types';

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const prayerEnd = (name: PrayerName, times: ReturnType<typeof computePrayerTimes>, tomorrow: ReturnType<typeof computePrayerTimes>) => {
  if (name === 'Fajr') return times.Sunrise;
  if (name === 'Dhuhr') return times.Asr;
  if (name === 'Asr') return times.Maghrib;
  if (name === 'Maghrib') return times.Isha;
  return tomorrow.Fajr;
};

export default function PrayerDetailScreen({ prayer }: { prayer: PrayerName }) {
  const colors = useColors();
  const { prayerCity } = useApp();
  const now = new Date();
  const details = useMemo(() => {
    const times = computePrayerTimes(now, prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
    const index = PRAYERS.indexOf(prayer);
    const nextPrayer = index === PRAYERS.length - 1 ? 'Fajr' : PRAYERS[index + 1];
    const nextDay = index === PRAYERS.length - 1 ? new Date(now.getTime() + 86400000) : now;
    const nextTimes = computePrayerTimes(nextDay, prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
    const nextTomorrow = computePrayerTimes(new Date(nextDay.getTime() + 86400000), prayerCity.latitude, prayerCity.longitude, prayerCity.timezone);
    return {
      start: times[prayer],
      end: prayerEnd(prayer, times, nextTimes),
      nextPrayer,
      nextStart: nextTimes[nextPrayer],
      nextEnd: prayerEnd(nextPrayer, nextTimes, nextTomorrow),
    };
  }, [now, prayer, prayerCity]);
  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { backgroundColor: colors.forest }]}>
        <View style={[styles.icon, { backgroundColor: 'rgba(255,255,255,0.16)' }]}><MaterialCommunityIcons name="mosque" size={25} color="#fff" /></View>
        <Text style={styles.eyebrow}>ADHAN NOTIFICATION</Text>
        <Text style={styles.title}>{prayer} time has started</Text>
        <Text style={styles.city}>{prayerCity.name}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}><Feather name="play-circle" size={20} color={colors.primary} /><View><Text style={[styles.label, { color: colors.mutedForeground }]}>CURRENT PRAYER STARTED</Text><Text style={[styles.time, { color: colors.foreground }]}>{formatClockTime(details.start)}</Text></View></View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}><Feather name="stop-circle" size={20} color={colors.gold} /><View><Text style={[styles.label, { color: colors.mutedForeground }]}>CURRENT PRAYER ENDS</Text><Text style={[styles.time, { color: colors.foreground }]}>{formatClockTime(details.end)}</Text></View></View>
      </View>
      <View style={[styles.nextCard, { backgroundColor: colors.primarySoft }]}>
        <Feather name="clock" size={19} color={colors.primary} />
        <View style={{ flex: 1 }}><Text style={[styles.label, { color: colors.primary }]}>NEXT PRAYER</Text><Text style={[styles.nextName, { color: colors.foreground }]}>{details.nextPrayer}</Text><Text style={[styles.nextCopy, { color: colors.mutedForeground }]}>Starts {formatClockTime(details.nextStart)} · Ends {formatClockTime(details.nextEnd)}</Text></View>
      </View>
      <InfoBanner icon="bell" text="Your adhan alarm is enabled on this device. Prayer times follow your selected location." />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16 },
  hero: { borderRadius: 24, padding: 20, marginBottom: 14 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  eyebrow: { color: '#CBE7DB', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: '#fff', fontSize: 25, fontWeight: '800', marginTop: 7 },
  city: { color: '#CBE7DB', fontSize: 12, fontWeight: '700', marginTop: 7 },
  card: { borderWidth: 1, borderRadius: 20, padding: 17, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  label: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 },
  time: { fontSize: 22, fontWeight: '800', marginTop: 3 },
  divider: { height: 1, marginVertical: 15 },
  nextCard: { borderRadius: 19, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  nextName: { fontSize: 17, fontWeight: '800', marginTop: 3 },
  nextCopy: { fontSize: 11.5, fontWeight: '600', marginTop: 4 },
});
