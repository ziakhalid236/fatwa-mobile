import * as Location from 'expo-location';
import type { PrayerCity } from '@/lib/types';

export type CurrentLocation = {
  city: PrayerCity;
  country: string;
};

export async function getCurrentPrayerLocation(): Promise<CurrentLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission is required to calculate local prayer times.');

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const [place] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  const name = place?.city || place?.district || place?.subregion || place?.region || 'Current location';
  const country = String(place?.country ?? '');

  return {
    city: {
      name,
      latitude,
      longitude,
      timezone: -new Date().getTimezoneOffset() / 60,
    },
    country,
  };
}
