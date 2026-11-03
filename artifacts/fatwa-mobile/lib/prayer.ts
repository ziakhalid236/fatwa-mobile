import { prayerMethod } from '@/data/content';
import type { PrayerName } from '@/lib/types';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

const fix = (a: number, b: number) => a - b * Math.floor(a / b);
const fixAngle = (a: number) => fix(a, 360);
const fixHour = (a: number) => fix(a, 24);

function julianDate(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

function sunPosition(jd: number) {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * Math.sin(g * D2R) + 0.02 * Math.sin(2 * g * D2R));
  const e = 23.439 - 0.00000036 * d;
  const ra = fixHour(
    (Math.atan2(Math.cos(e * D2R) * Math.sin(l * D2R), Math.cos(l * D2R)) * R2D) / 15,
  );
  return {
    declination: Math.asin(Math.sin(e * D2R) * Math.sin(l * D2R)) * R2D,
    equation: q / 15 - ra,
  };
}

export type PrayerTimes = Record<PrayerName | 'Sunrise' | 'Sunset', string>;

/**
 * Computes prayer times for a date and place using standard astronomical
 * formulas. Times are returned as `HH:MM` in the location's local time.
 */
export function computePrayerTimes(
  date: Date,
  latitude: number,
  longitude: number,
  timezoneOffsetHours: number,
): PrayerTimes {
  const cityDate = new Date(date.getTime() + timezoneOffsetHours * 60 * 60 * 1000);
  const jd = julianDate(cityDate.getUTCFullYear(), cityDate.getUTCMonth() + 1, cityDate.getUTCDate());
  const { fajrAngle, ishaAngle, asrFactor } = prayerMethod;

  const midDay = (t: number) => 12 - sunPosition(jd + t).equation;

  const sunAngleTime = (angle: number, time: number, ccw: boolean) => {
    const decl = sunPosition(jd + time).declination;
    const noon = midDay(time);
    const t =
      (1 / 15) *
      Math.acos(
        (-Math.sin(angle * D2R) - Math.sin(decl * D2R) * Math.sin(latitude * D2R)) /
          (Math.cos(decl * D2R) * Math.cos(latitude * D2R)),
      ) *
      R2D;
    return noon + (ccw ? -t : t);
  };

  const asrTime = (factor: number, time: number) => {
    const decl = sunPosition(jd + time).declination;
    const angle = -Math.atan(1 / (factor + Math.tan(Math.abs(latitude - decl) * D2R))) * R2D;
    return sunAngleTime(angle, time, false);
  };

  let times = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
  const portion = (t: number) => t / 24;

  for (let pass = 0; pass < 2; pass += 1) {
    times = {
      fajr: sunAngleTime(fajrAngle, portion(times.fajr), true),
      sunrise: sunAngleTime(0.833, portion(times.sunrise), true),
      dhuhr: midDay(portion(times.dhuhr)),
      asr: asrTime(asrFactor, portion(times.asr)),
      sunset: sunAngleTime(0.833, portion(times.sunset), false),
      maghrib: sunAngleTime(0.833, portion(times.maghrib), false),
      isha: sunAngleTime(ishaAngle, portion(times.isha), false),
    };
  }

  const adjust = (t: number) => t + timezoneOffsetHours - longitude / 15;
  const format = (t: number) => {
    const rounded = fixHour(t + 0.5 / 60);
    const hours = Math.floor(rounded);
    const minutes = Math.floor((rounded - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  return {
    Fajr: format(adjust(times.fajr)),
    Sunrise: format(adjust(times.sunrise)),
    Dhuhr: format(adjust(times.dhuhr)),
    Asr: format(adjust(times.asr)),
    Maghrib: format(adjust(times.sunset)),
    Isha: format(adjust(times.isha)),
    Sunset: format(adjust(times.sunset)),
  };
}

const KAABA = { latitude: 21.4225, longitude: 39.8262 };

/** Great-circle initial bearing from a point to the Kaaba, in degrees from true north. */
export function qiblaDirection(latitude: number, longitude: number): number {
  const dLng = (KAABA.longitude - longitude) * D2R;
  const lat1 = latitude * D2R;
  const lat2 = KAABA.latitude * D2R;
  const y = Math.sin(dLng);
  const x = Math.cos(lat1) * Math.tan(lat2) - Math.sin(lat1) * Math.cos(dLng);
  return (Math.atan2(y, x) * R2D + 360) % 360;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const r = 6371;
  const dLat = (lat2 - lat1) * D2R;
  const dLng = (lng2 - lng1) * D2R;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(a)));
}

export function minutesUntil(time: string, now: Date, timezoneOffsetHours = 0): number {
  const [h, m] = time.split(':').map(Number);
  const target = h * 60 + m;
  const cityNow = new Date(now.getTime() + timezoneOffsetHours * 60 * 60 * 1000);
  const current = cityNow.getUTCHours() * 60 + cityNow.getUTCMinutes();
  return target - current;
}

export function localClockParts(now: Date, timezoneOffsetHours: number): { hour: number; minute: number; totalMinutes: number } {
  const cityNow = new Date(now.getTime() + timezoneOffsetHours * 60 * 60 * 1000);
  const hour = cityNow.getUTCHours();
  const minute = cityNow.getUTCMinutes();
  return { hour, minute, totalMinutes: hour * 60 + minute };
}

/**
 * Current wall-clock time in a city, re-anchored onto a date the device clock
 * agrees on. Used to convert a computed local prayer time (HH:MM) into an
 * absolute `Date` for one-shot scheduling, so the trigger stays correct even
 * when the device clock timezone differs from the selected city.
 */
export function cityTimeOn(
  reference: Date,
  time: string,
  timezoneOffsetHours: number,
): Date {
  const [hour, minute] = time.split(':').map(Number);
  const cityNow = new Date(reference.getTime() + timezoneOffsetHours * 60 * 60 * 1000);
  const year = cityNow.getUTCFullYear();
  const month = cityNow.getUTCMonth();
  const day = cityNow.getUTCDate();
  // Interpret the target as UTC, then drop the city offset to get the absolute instant.
  const wallClock = Date.UTC(year, month, day, hour, minute, 0, 0);
  return new Date(wallClock - timezoneOffsetHours * 60 * 60 * 1000);
}

export function formatCountdown(totalMinutes: number): string {
  const mins = Math.max(0, totalMinutes);
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/** Convert the internal 24-hour HH:MM value into a compact 12-hour display. */
export function formatClockTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
