import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { QiblaCompass } from '@/components/QiblaCompass';
import { InfoBanner, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { getCurrentPrayerLocation } from '@/lib/location';
import { haversineDistanceKm, qiblaDirection } from '@/lib/prayer';
import { useApp } from '@/lib/store';

export default function QiblaScreen() {
  const colors = useColors();
  const { prayerCity, setPrayerCity, setProfile } = useApp();
  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const headingSub = useRef<Location.LocationSubscription | null>(null);

  const loadLocation = useCallback(async () => {
    try {
      const current = await getCurrentPrayerLocation();
      setPrayerCity(current.city);
      setProfile({ city: current.city.name });
      setPermission('granted');
    } catch {
      setPermission('denied');
    }
  }, [setPrayerCity, setProfile]);

  useEffect(() => {
    void loadLocation();
    void Location.watchHeadingAsync((value) => {
      setHeading(value.trueHeading >= 0 ? value.trueHeading : value.magHeading);
    }).then((subscription) => {
      headingSub.current = subscription;
    }).catch(() => undefined);
    return () => headingSub.current?.remove();
  }, [loadLocation]);

  const qibla = useMemo(() => qiblaDirection(prayerCity.latitude, prayerCity.longitude), [prayerCity]);
  const distance = useMemo(() => haversineDistanceKm(prayerCity.latitude, prayerCity.longitude, 21.4225, 39.8262), [prayerCity]);
  const effectiveHeading = heading ?? 0;
  const aligned = heading !== null && Math.abs(((qibla - effectiveHeading + 540) % 360) - 180) < 8;

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>QIBLA DIRECTION</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Find the Qibla</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Use your phone compass while holding the device flat and level.</Text>
      </View>
      <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.locationTitle, { color: colors.foreground }]}>{prayerCity.name}</Text>
          <Text style={[styles.locationCopy, { color: colors.mutedForeground }]}>GPS coordinates are used for the direction.</Text>
        </View>
        <Pressable onPress={() => void loadLocation()} accessibilityRole="button" accessibilityLabel="Refresh Qibla location">
          <Feather name="refresh-cw" size={17} color={colors.primary} />
        </Pressable>
      </View>
      <SectionTitle title="Compass" subtitle="The gold arrow points toward the Kaaba" />
      <View style={[styles.compassCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <QiblaCompass heading={effectiveHeading} qibla={qibla} aligned={aligned} kaabaDistanceKm={distance} />
        {permission === 'denied' ? (
          <InfoBanner icon="alert-triangle" tone="gold" text="Location permission is off. Enable it to use your current GPS position." />
        ) : (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {heading === null ? 'Calibrating the compass…' : aligned ? 'You are facing the Qibla.' : 'Rotate the phone until the gold arrow points up.'}
          </Text>
        )}
      </View>
      <Pressable onPress={() => Alert.alert('Compass calibration', 'Move the phone in a gentle figure-eight, then hold it flat again.')} style={[styles.help, { borderColor: colors.border }]}>
        <Feather name="help-circle" size={16} color={colors.primary} />
        <Text style={[styles.helpText, { color: colors.foreground }]}>Compass not stable?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 10, marginBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  locationCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 15 },
  locationTitle: { fontSize: 14, fontWeight: '800' },
  locationCopy: { fontSize: 11, marginTop: 3 },
  compassCard: { borderWidth: 1, borderRadius: 24, padding: 16, alignItems: 'center' },
  hint: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 14 },
  help: { borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 15 },
  helpText: { fontSize: 12, fontWeight: '700' },
});
