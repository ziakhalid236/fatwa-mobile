import * as Location from 'expo-location';

export type Place = { city: string; country: string };

async function reverseWeb(latitude: number, longitude: number): Promise<Place | null> {
  try {
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
    if (!response.ok) return null;
    const data = (await response.json()) as { city?: string; locality?: string; principalSubdivision?: string; countryName?: string };
    const city = data.city || data.locality || data.principalSubdivision || '';
    return city || data.countryName ? { city, country: data.countryName ?? '' } : null;
  } catch {
    return null;
  }
}

/** Asks for location permission (if needed) and returns the user's city and country. */
export async function detectPlace(): Promise<{ place: Place | null; granted: boolean }> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { place: null, granted: false };
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = position.coords;
    const [found] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
    const city = found?.city || found?.district || found?.subregion || found?.region || '';
    const country = found?.country || '';
    if (city && country) return { place: { city, country }, granted: true };
    const fallback = await reverseWeb(latitude, longitude);
    return { place: fallback ?? (city || country ? { city, country } : null), granted: true };
  } catch {
    return { place: null, granted: true };
  }
}
