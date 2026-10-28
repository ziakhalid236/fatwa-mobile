export type TabKey = 'home' | 'fatwa' | 'questions' | 'alarm' | 'profile';

export type PostCategory =
  | 'Islamic'
  | 'History'
  | 'Poetry'
  | 'Reflection'
  | 'Seerah'
  | 'Islamic Guidance'
  | 'Quran & Tafseer'
  | 'Hadith & Sunnah'
  | 'Seerah & History'
  | 'Prayer & Worship'
  | 'Family & Character'
  | 'Community & Public Benefit'
  | 'Poetry & Reflection'
  | 'Announcements'
  | 'General';

export const POST_CATEGORIES: PostCategory[] = [
  'Islamic Guidance',
  'Quran & Tafseer',
  'Hadith & Sunnah',
  'Seerah & History',
  'Prayer & Worship',
  'Family & Character',
  'Community & Public Benefit',
  'Poetry & Reflection',
  'Announcements',
  'General',
];
export type PostLanguage = 'en' | 'ur' | 'ar';

export type PostTranslation = { title: string; body: string };

export type Post = {
  id: string;
  title: string;
  body: string;
  category: PostCategory;
  author: string;
  authorImageUrl?: string;
  city?: string;
  imageUrl?: string;
  source?: string;
  views: number;
  likes: number;
  date: string;
  accent: string;
  icon: string;
  translations?: Partial<Record<Exclude<PostLanguage, 'en'>, PostTranslation>>;
};

export type FatwaCategory =
  | 'Aqeedah'
  | 'Namaz'
  | 'Roza'
  | 'Zakat'
  | 'Hajj & Umrah'
  | 'Nikah & Family'
  | 'Muamalat'
  | 'Tafseer & Quran';

export type Fatwa = {
  id: string;
  question: string;
  answer: string;
  category: FatwaCategory;
  scholar: string;
  institution: string;
  sourceUrl?: string;
  date: string;
  views: number;
};

export type QuestionStatus = 'Submitted' | 'Under review' | 'Answered';

export type UserQuestion = {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'unspecified';
  city: string;
  country: string;
  question: string;
  category: FatwaCategory;
  status: QuestionStatus;
  answer?: string;
  answeredBy?: string;
  submittedAt: string;
  updatedAt: string;
};

export type NotificationKind = 'answer' | 'fatwa' | 'post' | 'system';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  refId?: string;
};

export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export type AdhanAlarm = {
  prayer: PrayerName;
  time: string;
  enabled: boolean;
};

export type Profile = {
  name: string;
  city: string;
  avatarUri?: string;
};

export type PrayerCity = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: number;
};
