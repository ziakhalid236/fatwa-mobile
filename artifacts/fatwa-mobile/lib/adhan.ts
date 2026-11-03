import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { cityTimeOn } from '@/lib/prayer';
import type { AdhanAlarm } from '@/lib/types';

export const ADHAN_CHANNEL_ID = 'adhan-alarms';
export const NOTIFICATION_CHANNEL_ID = 'fatwa-updates';
/**
 * Must match the `channel_id` the API sets on remote push messages
 * (`workers/fatwa-api/src/push.ts`). Android drops a push that names a channel
 * the app never created, so this channel is declared even though the client
 * never schedules into it directly.
 */
export const BROADCAST_CHANNEL_ID = 'broadcast';

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
  await Notifications.setNotificationChannelAsync(BROADCAST_CHANNEL_ID, {
    name: 'Announcements',
    importance: Notifications.AndroidImportance.DEFAULT,
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

/**
 * Creates the notification channels early so a remote push that arrives before
 * the first alarm sync still has a channel to land on. On Android a push routed
 * to a channel that does not exist is dropped, so this runs on every launch.
 */
export async function initializeNotificationChannels(soundEnabled = true) {
  if (Platform.OS === 'web') return;
  try {
    await ensureChannels(soundEnabled);
  } catch {
    // Channel setup is best-effort; alarms and pushes still fall back to the default.
  }
}

/** How many days of one-shot alarms to keep queued per enabled alarm. */
const HORIZON_DAYS = 5;

/**
 * Schedules the next occurrences of one adhan alarm as one-shot notifications.
 *
 * We deliberately avoid repeating triggers: Android's scheduler only supports
 * `daily`/`weekly`/`monthly`/`yearly` and its `daily` type fires on the device
 * clock, which drifts away from the city's prayer time whenever the device
 * timezone differs. Instead we queue a rolling horizon of one-shot date
 * triggers, and re-sync on every launch and foreground so the horizon stays
 * topped up even if the app is not opened for a few days.
 */
async function scheduleAdhan(
  alarm: AdhanAlarm,
  now: Date,
  options: { soundEnabled: boolean; timezoneOffsetHours?: number },
): Promise<number> {
  const [hour, minute] = alarm.time.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return 0;
  const zone = options.timezoneOffsetHours ?? -now.getTimezoneOffset() / 60;
  let count = 0;
  // Walk whole days from today; skip today's slot once it has passed so the
  // next day's iteration supplies that occurrence instead of duplicating it.
  for (let day = 0; day <= HORIZON_DAYS; day += 1) {
    const reference = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
    const when = cityTimeOn(reference, alarm.time, zone);
    if (when.getTime() <= now.getTime()) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${alarm.prayer} adhan`,
        body: `It is time for ${alarm.prayer} prayer.`,
        sound: options.soundEnabled ? ADHAN_SOUND : false,
        data: { kind: 'adhan', prayer: alarm.prayer },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: ADHAN_CHANNEL_ID },
    });
    count += 1;
    if (count >= HORIZON_DAYS) break;
  }
  return count;
}

/** Cancels every scheduled adhan alarm and re-schedules the enabled ones. */
export async function syncAdhanAlarms(
  alarms: AdhanAlarm[],
  options: { soundEnabled: boolean; timezoneOffsetHours?: number },
): Promise<{ scheduled: number; permitted: boolean }> {
  if (Platform.OS === 'web') return { scheduled: 0, permitted: false };

  const permitted = await ensureNotificationPermissions();
  // Check permission before cancelling anything. If Android permissions are
  // denied/revoked, keep the existing local schedules instead of silently
  // deleting the user's alarms.
  if (!permitted) return { scheduled: 0, permitted: false };

  await ensureChannels(options.soundEnabled);
  // Only clear adhan alarms; other scheduled notifications (if any) must survive.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((item) => (item.content.data as { kind?: string } | null)?.kind === 'adhan')
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );

  const now = new Date();
  let scheduled = 0;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    try {
      if (await scheduleAdhan(alarm, now, options)) scheduled += 1;
    } catch {
      // Skip an alarm that the OS refuses instead of aborting the remaining ones.
    }
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
    // Android routes an immediate notification to the app's default channel
    // unless we name one, and the default is the loud adhan-alarm channel.
    trigger: Platform.OS === 'android' ? { channelId: NOTIFICATION_CHANNEL_ID } : null,
  });
}
