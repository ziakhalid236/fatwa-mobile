import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Registers this device for remote (FCM) push so admin broadcasts arrive while the app is closed.
 * Silently does nothing on web, when permission is missing, or when the build has no Firebase config.
 */
export async function registerDevicePush(apiBase: string, sessionToken: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !apiBase || !sessionToken) return false;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return false;
    await Notifications.setNotificationChannelAsync('broadcast', {
      name: 'Community posts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#0B6B53',
    });
    const device = await Notifications.getDevicePushTokenAsync();
    const token = typeof device.data === 'string' ? device.data : '';
    if (!token) return false;
    const response = await fetch(`${apiBase}/api/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
