export type TabKey = 'home' | 'fatwa' | 'questions' | 'alarm' | 'profile';

export type PostCategory = 'Islamic' | 'History' | 'Poetry' | 'Reflection' | 'Seerah';

export type Post = {
  id: string;
  title: string;
  body: string;
  category: PostCategory;
  author: string;
  source?: string;
  views: number;
  likes: number;
  date: string;
  accent: string;
  icon: string;
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
  city: string;
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
};

export type PrayerCity = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: number;
};
