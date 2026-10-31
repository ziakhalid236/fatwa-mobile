import type { AppLanguage } from '@/lib/store';
function cityDate(date: Date, timezoneOffsetHours: number): Date {
  return new Date(date.getTime() + timezoneOffsetHours * 60 * 60 * 1000);
}
export function formatIslamicDate(date: Date, language: AppLanguage, timezoneOffsetHours = 0): string {
  const locale = language === 'ur' ? 'ur-PK-u-ca-islamic-umalqura' : language === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura';
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(cityDate(date, timezoneOffsetHours));
  } catch {
    return new Intl.DateTimeFormat(language === 'ur' ? 'ur-PK' : language === 'ar' ? 'ar-SA' : 'en', { dateStyle: 'medium', timeZone: 'UTC' }).format(cityDate(date, timezoneOffsetHours));
  }
}
export function formatGregorianDate(date: Date, timezoneOffsetHours = 0): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(cityDate(date, timezoneOffsetHours));
  } catch {
    return cityDate(date, timezoneOffsetHours).toUTCString();
  }
}
