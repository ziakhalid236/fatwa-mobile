import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { AdhanAlarm } from '@/lib/types';

export const ADHAN_CHANNEL_ID = 'adhan-alarms';
export const NOTIFICATION_CHANNEL_ID = 'fatwa-updates';

/** Sound file registered through the expo-notifications config plugin. */
const ADHAN_SOUND = 'adhan_drive.mp3';
const UPDATE_SOUND = 'adhan_notification.wav';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannels(soundEnabled: boolean) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ADHAN_CHANNEL_ID, {
    name: 'Adhan alarms',
    importance: Notifications.AndroidImportance.MAX,
    sound: soundEnabled ? ADHAN_SOUND : null,
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  });
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'Fatwa updates',
    importance: Notifications.AndroidImportance.HIGH,
    sound: UPDATE_SOUND,
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Cancels every scheduled adhan alarm and re-schedules the enabled ones. */
export async function syncAdhanAlarms(
  alarms: AdhanAlarm[],
  options: { soundEnabled: boolean },
): Promise<{ scheduled: number; permitted: boolean }> {
  if (Platform.OS === 'web') return { scheduled: 0, permitted: false };

  await Notifications.cancelAllScheduledNotificationsAsync();
  await ensureChannels(options.soundEnabled);

  const permitted = await ensureNotificationPermissions();
  if (!permitted) return { scheduled: 0, permitted: false };

  let scheduled = 0;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const [hour, minute] = alarm.time.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${alarm.prayer} adhan`,
        body: `It is time for ${alarm.prayer} prayer.`,
        sound: options.soundEnabled ? ADHAN_SOUND : false,
        data: { kind: 'adhan', prayer: alarm.prayer },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: ADHAN_CHANNEL_ID,
      },
    });
    scheduled += 1;
  }
  return { scheduled, permitted: true };
}

/** Posts an immediate local notification for app events such as a published answer. */
export async function notifyNow(title: string, body: string, data?: Record<string, unknown>) {
  if (Platform.OS === 'web') return;
  const permitted = await ensureNotificationPermissions();
  if (!permitted) return;
  await ensureChannels(true);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: UPDATE_SOUND, data },
    trigger: null,
  });
}
