import type { AppLanguage } from '@/lib/store';

export function formatIslamicDate(date: Date, language: AppLanguage): string {
  const locale = language === 'ur' ? 'ur-PK-u-ca-islamic-umalqura' : language === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura';
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  } catch {
    return new Intl.DateTimeFormat(language === 'ur' ? 'ur-PK' : language === 'ar' ? 'ar-SA' : 'en', { dateStyle: 'medium' }).format(date);
  }
}

export function formatGregorianDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  } catch {
    return date.toDateString();
  }
}
