import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Constants from 'expo-constants';
import { AppState as NativeAppState, Platform } from 'react-native';
import { defaultCity, prayerCities } from '@/data/content';
import { notifyNow } from '@/lib/adhan';
import { registerDevicePush } from '@/lib/push';
import { uploadImage } from '@/lib/upload';
import type * as ImagePicker from 'expo-image-picker';
import type {
  AdhanAlarm,
  AppNotification,
  Fatwa,
  NotificationKind,
  Post,
  PrayerCity,
  Profile,
  UserQuestion,
} from '@/lib/types';

const STORE_KEYS = {
  profile: '@fatwa/profile',
  deviceId: '@fatwa/device-id',
  token: '@fatwa/session-token',
  onboarded: '@fatwa/onboarded',
  questions: '@fatwa/questions',
  likedPosts: '@fatwa/likedPosts',
  savedPosts: '@fatwa/savedPosts',
  viewedPosts: '@fatwa/viewedPosts',
  notifications: '@fatwa/notifications',
  notificationsReadAt: '@fatwa/notifications-read-at',
  clearedNotifications: '@fatwa/notifications-cleared',
  alarms: '@fatwa/alarms',
  cityName: '@fatwa/prayerCity',
  settings: '@fatwa/settings',
};

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://fatwa-api.ziakhalid236.workers.dev').replace(/\/$/, '');

export type AppLanguage = 'en' | 'ur' | 'ar';
type Settings = { notificationsEnabled: boolean; adhanSound: boolean; language: AppLanguage; autoLanguage: boolean; autoTranslate: boolean };

const legacyTranslations: Record<string, NonNullable<Post['translations']>> = {
  'A quiet place for careful questions': {
    ur: { title: 'سوچ سمجھ کر سوال کرنے کے لیے پرسکون جگہ', body: 'اچھی رہنمائی کے لیے ضروری ہے کہ سوال سے پہلے مکمل پس منظر سمجھا جائے۔ غور کریں، اہم تفصیلات لکھیں اور پھر سوال کریں۔' },
    ar: { title: 'مساحة هادئة للأسئلة المتأنية', body: 'تبدأ الإرشادات الجيدة بفهم السياق. اقرأ وتأمل واذكر التفاصيل المهمة عندما تطرح سؤالك.' },
  },
  'Intention gives a small act its direction': {
    ur: { title: 'نیت چھوٹے عمل کو سمت دیتی ہے', body: 'کسی حکم کے بارے میں پوچھنے سے پہلے اپنے عمل کی نیت پر غور کریں۔ دل کی وضاحت سوال کی وضاحت میں مدد دیتی ہے۔' },
    ar: { title: 'النية تمنح العمل الصغير اتجاهه', body: 'قبل البحث عن الحكم توقف عند نيتك. صفاء القلب يساعد على وضوح السؤال.' },
  },
  'Specific questions deserve specific details': {
    ur: { title: 'مخصوص سوال کے لیے مکمل تفصیل ضروری ہے', body: 'درست جواب صورتحال پر منحصر ہوتا ہے۔ کیا ہوا، کب ہوا اور آپ آگے کیا کرنا چاہتے ہیں، یہ سب واضح کریں۔' },
    ar: { title: 'الأسئلة المحددة تحتاج إلى تفاصيل محددة', body: 'تعتمد الإجابة الدقيقة على الحالة. اذكر ما حدث ومتى حدث وما الذي تريد فعله بعد ذلك.' },
  },
  'Traceable answers build trust': {
    ur: { title: 'حوالہ دار جوابات اعتماد پیدا کرتے ہیں', body: 'عوامی رہنمائی کے ساتھ اس کا پس منظر اور ماخذ بھی ہونا چاہیے۔ واضح نسبت قارئین کو مزید سیکھنے میں مدد دیتی ہے۔' },
    ar: { title: 'الإجابات الموثقة تبني الثقة', body: 'ينبغي أن تحمل الإرشادات العامة سياقها ومصدرها، فإظهار النسبة يساعد القارئ على مواصلة التعلم.' },
  },
};

type AppState = {
  hydrated: boolean;
  profile: Profile;
  posts: Post[];
  fatwas: Fatwa[];
  questions: UserQuestion[];
  notifications: AppNotification[];
  alarms: AdhanAlarm[];
  likedPostIds: string[];
  savedPostIds: string[];
  viewedPostIds: string[];
  prayerCity: PrayerCity;
  settings: Settings;
  unreadCount: number;
  signedIn: boolean;
  onboarded: boolean;
  completeOnboarding: () => void;
  saveProfile: (input: { name: string; country: string; city: string; notifyPosts?: boolean }) => Promise<void>;
  uploadAvatar: (asset: ImagePicker.ImagePickerAsset) => Promise<void>;
  authHeaders: () => Record<string, string>;
  applyAuth: (payload: { sessionToken: string; user: { id?: string; name?: string; country?: string; city?: string; avatarUrl?: string; email?: string; bio?: string } }) => void;
  setBio: (bio: string) => Promise<void>;
  setProfile: (patch: Partial<Profile>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setPrayerCity: (city: PrayerCity) => void;
  toggleLike: (id: string) => void;
  toggleSaved: (id: string) => void;
  registerView: (id: string) => void;
  submitQuestion: (input: {
    name: string;
    gender: UserQuestion['gender'];
    city: string;
    country: string;
    question: string;
    category: UserQuestion['category'];
  }) => Promise<UserQuestion>;
  setAlarms: (alarms: AdhanAlarm[]) => void;
  updateAlarm: (prayer: AdhanAlarm['prayer'], patch: Partial<AdhanAlarm>) => void;
  pushNotification: (input: {
    kind: NotificationKind;
    title: string;
    body: string;
    refId?: string;
  }) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  refreshContent: () => void;
  clearLocalData: () => void;
};

const AppContext = createContext<AppState | null>(null);

const emptyProfile: Profile = { name: '', country: '', city: '' };

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORE_KEYS.deviceId);
  if (existing) return existing;
  const created = `fatwa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(STORE_KEYS.deviceId, created);
  return created;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfileState] = useState<Profile>(emptyProfile);
  const [sessionToken, setSessionToken] = useState('');
  const [onboarded, setOnboarded] = useState(false);
  const tokenRef = useRef('');
  const profileRef = useRef<Profile>(emptyProfile);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  const [questions, setQuestions] = useState<UserQuestion[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [viewedPostIds, setViewedPostIds] = useState<string[]>([]);
  const [alarms, setAlarmsState] = useState<AdhanAlarm[]>([]);
  const [prayerCity, setPrayerCityState] = useState<PrayerCity>(defaultCity);
  const [settings, setSettingsState] = useState<Settings>({
    notificationsEnabled: true,
    adhanSound: true,
    language: 'ur',
    autoLanguage: true,
    autoTranslate: true,
  });

  const settingsRef = useRef<Settings>(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const [remotePosts, setRemotePosts] = useState<Post[] | null>(null);
  const [remoteFatwas, setRemoteFatwas] = useState<Fatwa[] | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const writeQueue = useRef(Promise.resolve());
  // Remember what the user cleared or read locally so a background refresh does
  // not bring dismissed notifications back or re-flag them as unread.
  const clearedRef = useRef<string[]>([]);
  const readRef = useRef<string[]>([]);
  const persist = useCallback((entries: [string, unknown][]) => {
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.multiSet(entries.map(([key, value]) => [key, JSON.stringify(value)])))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const values = await AsyncStorage.multiGet(Object.values(STORE_KEYS));
        if (!active) return;
        const data = Object.fromEntries(values) as Record<string, string | null>;
        const parse = <T,>(key: string, fallback: T): T => {
          const raw = data[key];
          if (!raw) return fallback;
          try {
            return JSON.parse(raw) as T;
          } catch {
            return fallback;
          }
        };
        const isRecord = (value: unknown): value is Record<string, unknown> =>
          value !== null && typeof value === 'object' && !Array.isArray(value);
        const parseArray = <T,>(key: string, isValid: (value: unknown) => value is T): T[] => {
          const value = parse<unknown>(key, []);
          return Array.isArray(value) ? value.filter(isValid) : [];
        };
        const storedToken = parse<unknown>(STORE_KEYS.token, '');
        if (typeof storedToken === 'string' && storedToken) { tokenRef.current = storedToken; setSessionToken(storedToken); }
        setOnboarded(parse<unknown>(STORE_KEYS.onboarded, false) === true);
        const profileValue = parse<unknown>(STORE_KEYS.profile, emptyProfile);
        setProfileState(
          isRecord(profileValue)
            ? {
                name: typeof profileValue.name === 'string' ? profileValue.name : '',
                country: typeof profileValue.country === 'string' ? profileValue.country : '',
                city: typeof profileValue.city === 'string' ? profileValue.city : '',
                avatarUri: typeof profileValue.avatarUri === 'string' ? profileValue.avatarUri : undefined,
              }
            : emptyProfile,
        );
        setQuestions(
          parseArray<UserQuestion>(STORE_KEYS.questions, (value): value is UserQuestion =>
            isRecord(value) &&
            typeof value.id === 'string' &&
            typeof value.name === 'string' &&
            typeof value.question === 'string' &&
            typeof value.category === 'string' &&
            typeof value.status === 'string',
          ),
        );
        const stringArray = (key: string) =>
          parseArray<string>(key, (value): value is string => typeof value === 'string');
        setLikedPostIds(stringArray(STORE_KEYS.likedPosts));
        setSavedPostIds(stringArray(STORE_KEYS.savedPosts));
        setViewedPostIds(stringArray(STORE_KEYS.viewedPosts));
        setNotifications(
          parseArray<AppNotification>(STORE_KEYS.notifications, (value): value is AppNotification =>
            isRecord(value) &&
            typeof value.id === 'string' &&
            typeof value.kind === 'string' &&
            typeof value.title === 'string' &&
            typeof value.body === 'string' &&
            typeof value.createdAt === 'string' &&
            typeof value.read === 'boolean',
          ),
        );
        clearedRef.current = parseArray<string>(STORE_KEYS.clearedNotifications, (value): value is string => typeof value === 'string');
        readRef.current = parseArray<string>(STORE_KEYS.notificationsReadAt, (value): value is string => typeof value === 'string');
        setAlarmsState(
          parseArray<AdhanAlarm>(STORE_KEYS.alarms, (value): value is AdhanAlarm =>
            isRecord(value) &&
            typeof value.prayer === 'string' &&
            typeof value.time === 'string' &&
            typeof value.enabled === 'boolean',
          ),
        );
        const settingsValue = parse<unknown>(STORE_KEYS.settings, {});
        setSettingsState({
          notificationsEnabled:
            isRecord(settingsValue) && typeof settingsValue.notificationsEnabled === 'boolean'
              ? settingsValue.notificationsEnabled
              : true,
          adhanSound:
            isRecord(settingsValue) && typeof settingsValue.adhanSound === 'boolean'
              ? settingsValue.adhanSound
              : true,
          language:
            isRecord(settingsValue) && (settingsValue.language === 'en' || settingsValue.language === 'ur' || settingsValue.language === 'ar')
              ? settingsValue.language
              : 'ur',
          autoLanguage:
            isRecord(settingsValue) && typeof settingsValue.autoLanguage === 'boolean'
              ? settingsValue.autoLanguage
              : true,
          autoTranslate:
            isRecord(settingsValue) && typeof settingsValue.autoTranslate === 'boolean'
              ? settingsValue.autoTranslate
              : true,
        });
        const storedCity = parse<unknown>(STORE_KEYS.cityName, null);
        if (isRecord(storedCity) && typeof storedCity.name === 'string' && typeof storedCity.latitude === 'number' && typeof storedCity.longitude === 'number' && typeof storedCity.timezone === 'number') {
          setPrayerCityState({ name: storedCity.name, latitude: storedCity.latitude, longitude: storedCity.longitude, timezone: storedCity.timezone });
        } else if (typeof storedCity === 'string') {
          const match = prayerCities.find((city) => city.name === storedCity);
          if (match) setPrayerCityState(match);
        }
      } catch (error) {
        console.error('Unable to restore saved Fatwa data', error);
      } finally {
        if (active) setHydrated(true);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !sessionToken || !API_BASE_URL) return;
    void registerDevicePush(API_BASE_URL, sessionToken);
  }, [hydrated, sessionToken, settings.notificationsEnabled]);

  const feedCity = profile.city.trim();
  const feedCountry = profile.country.trim();
  useEffect(() => {
    if (!API_BASE_URL) return;
    let active = true;
    const syncRemoteNotifications = async (options: { announce?: boolean } = {}) => {
      try {
        if (!tokenRef.current || !active) return;
        const response = await fetch(`${API_BASE_URL}/api/notifications`, { headers: { Authorization: `Bearer ${tokenRef.current}` } });
        if (!response.ok || !active) return;
        const payload = (await response.json()) as {
          notifications?: Array<{ id?: string; title?: string; body?: string; kind?: string; imageUrl?: string | null; createdAt?: string; readAt?: string | null; questionId?: string; postId?: string }>;
        };
        const remote = Array.isArray(payload.notifications)
          ? payload.notifications.map((item): AppNotification => ({
              id: `remote-${String(item.id ?? makeId('note'))}`,
              kind: item.kind === 'post_approved' || typeof item.postId === 'string' ? 'post' : item.kind === 'question_answered' || String(item.title ?? '').toLowerCase().includes('answered') ? 'answer' : 'system',
              imageUrl: typeof item.imageUrl === 'string' && item.imageUrl ? item.imageUrl : undefined,
              tone: item.kind === 'broadcast' ? 'broadcast' : item.kind === 'post_pending' ? 'pending' : item.kind === 'post_approved' ? 'approved' : item.kind === 'post_rejected' ? 'rejected' : undefined,
              title: String(item.title ?? 'Fatwa update'),
              body: String(item.body ?? ''),
              createdAt: String(item.createdAt ?? new Date().toISOString()),
              read: Boolean(item.readAt),
              refId: typeof item.postId === 'string' ? item.postId : typeof item.questionId === 'string' ? item.questionId : undefined,
            }))
          : [];
        setNotifications((current) => {
          const local = current.filter((item) => !item.id.startsWith('remote-'));
          const clearedIds = new Set(clearedRef.current);
          const readIds = new Set(readRef.current);
          const currentById = new Map(current.map((item) => [item.id, item]));
          const fresh = remote.filter((item) => !currentById.has(item.id) && !clearedIds.has(item.id) && item.tone !== 'broadcast');
          const merged = remote
            .filter((item) => !clearedIds.has(item.id))
            .map((item) => {
              const existing = currentById.get(item.id);
              // Keep a locally read notification read even if the server has not
              // caught up yet, so the unread badge does not flicker back on.
              return { ...item, read: item.read || Boolean(existing?.read) || readIds.has(item.id) };
            });
          // Announce genuinely new items once; the periodic refresh stays silent.
          if (options.announce && fresh.length && settingsRef.current.notificationsEnabled) {
            void notifyNow(fresh[0].title, fresh[0].body, { kind: fresh[0].kind, refId: fresh[0].refId });
          }
          const next = [...merged, ...local].slice(0, 60);
          persist([[STORE_KEYS.notifications, next]]);
          return next;
        });
      } catch {
        // Local notifications remain available when Cloudflare is temporarily offline.
      }
    };
    const syncRemoteQuestions = async () => {
      try {
        if (!tokenRef.current || !active) return;
        const response = await fetch(`${API_BASE_URL}/api/questions`, { headers: { Authorization: `Bearer ${tokenRef.current}` } });
        if (!response.ok || !active) return;
        const payload = (await response.json()) as { questions?: Array<Record<string, unknown>> };
        if (!Array.isArray(payload.questions)) return;
        const remote = payload.questions.map((item): UserQuestion => ({
          id: String(item.id),
          name: String(item.name ?? ''),
          gender: item.gender === 'male' || item.gender === 'female' ? item.gender : 'unspecified',
          country: String(item.country ?? ''),
          city: String(item.city ?? ''),
          question: String(item.question ?? ''),
          category: String(item.category) as UserQuestion['category'],
          status: item.status === 'answered' ? 'Answered' : item.status === 'under_review' ? 'Under review' : 'Submitted',
          answer: typeof item.answer === 'string' ? item.answer : undefined,
          answeredBy: typeof item.answeredBy === 'string' ? item.answeredBy : undefined,
          submittedAt: String(item.createdAt ?? new Date().toISOString()),
          updatedAt: String(item.updatedAt ?? item.createdAt ?? new Date().toISOString()),
        }));
        setQuestions((current) => {
          const remoteIds = new Set(remote.map((item) => item.id));
          const next = [...remote, ...current.filter((item) => !remoteIds.has(item.id))];
          persist([[STORE_KEYS.questions, next]]);
          return next;
        });
      } catch {
        // Keep local questions when the remote history is unavailable.
      }
    };
    const loadRemote = async () => {
      try {
        const deviceId = await getDeviceId();
        const [postsResponse, fatwasResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/posts?deviceId=${encodeURIComponent(deviceId)}&city=${encodeURIComponent(feedCity)}&country=${encodeURIComponent(feedCountry)}`),
          fetch(`${API_BASE_URL}/api/fatwas`),
        ]);
        if (!active) return;
        if (postsResponse.ok) {
          const payload = (await postsResponse.json()) as { posts?: Array<Record<string, unknown>> };
          if (Array.isArray(payload.posts)) {
            const mapCategory = (value: unknown): Post['category'] => {
              const category = String(value ?? '').toLowerCase();
              if (category.includes('quran') || category.includes('tafseer')) return 'Quran & Tafseer';
              if (category.includes('hadith') || category.includes('sunnah')) return 'Hadith & Sunnah';
              if (category.includes('history') || category.includes('seerah')) return 'Seerah & History';
              if (category.includes('prayer') || category.includes('worship')) return 'Prayer & Worship';
              if (category.includes('family') || category.includes('character')) return 'Family & Character';
              if (category.includes('community') || category.includes('public')) return 'Community & Public Benefit';
              if (category.includes('poetry') || category.includes('reflection')) return 'Poetry & Reflection';
              if (category.includes('announcement')) return 'Announcements';
              if (category.includes('islamic')) return 'Islamic Guidance';
              return 'General';
            };
            setRemotePosts([
              ...payload.posts.map((item) => ({
                id: String(item.id),
                title: String(item.title ?? 'Untitled post'),
                body: String(item.body ?? ''),
                category: mapCategory(item.category),
                author: String(item.author ?? 'Community contributor'),
                authorId: typeof item.authorId === 'string' && item.authorId ? item.authorId : undefined,
                authorImageUrl: typeof item.authorImageUrl === 'string' && item.authorImageUrl ? item.authorImageUrl : undefined,
                city: typeof item.city === 'string' ? item.city : undefined,
                country: typeof item.country === 'string' ? item.country : undefined,
                createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
                imageUrl: typeof item.imageUrl === 'string' && item.imageUrl ? item.imageUrl : undefined,
                source: typeof item.source === 'string' ? item.source : undefined,
                views: Number(item.views ?? 0),
                likes: Math.max(0, Number(item.likes ?? 0) - (item.likedByDevice === true ? 1 : 0)),
                date: String(item.date ?? item.createdAt ?? 'Recently'),
                accent: String(item.accent ?? 'teal'),
                icon: String(item.icon ?? 'book-open-outline'),
                translations:
                  item.translations !== null && typeof item.translations === 'object'
                    ? (item.translations as Post['translations'])
                    : legacyTranslations[String(item.title ?? '')],
              })),
            ]);
            const remoteIds = new Set(payload.posts.map((item) => String(item.id)));
            const remoteLikedIds = payload.posts.filter((item) => item.likedByDevice === true).map((item) => String(item.id));
            setLikedPostIds((current) => {
              const next = [...current.filter((id) => !remoteIds.has(id)), ...remoteLikedIds];
              persist([[STORE_KEYS.likedPosts, next]]);
              return next;
            });
          }
        }
        if (fatwasResponse.ok) {
          const payload = (await fatwasResponse.json()) as { fatwas?: Array<Record<string, unknown>> };
          if (Array.isArray(payload.fatwas)) {
            setRemoteFatwas(
              payload.fatwas.map((item) => ({
                id: String(item.id),
                question: String(item.question ?? item.title ?? ''),
                answer: String(item.answer ?? ''),
                category: String(item.category) as Fatwa['category'],
                scholar: String(item.scholar ?? 'Darul Ifta'),
                institution: String(item.institution ?? ''),
                sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : undefined,
                date: String(item.publishedAt ?? 'Recently'),
                views: Number(item.views ?? 0),
              })),
            );
          }
        }
      } catch {
        // Bundled content remains available when the API is offline.
      }
      await syncRemoteNotifications({ announce: true });
      await syncRemoteQuestions();
    };
    void loadRemote();
    // Periodic refreshes stay silent so a foreground app does not buzz every
    // 30 seconds; the app only announces items discovered on resume or load.
    const interval = setInterval(() => {
      void syncRemoteNotifications();
      void syncRemoteQuestions();
    }, 30_000);
    const appState = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncRemoteNotifications({ announce: true });
        void syncRemoteQuestions();
      }
    });
    return () => {
      active = false;
      clearInterval(interval);
      appState.remove();
    };
  }, [persist, refreshNonce, sessionToken, feedCity, feedCountry]);

  const authHeaders = useCallback((): Record<string, string> => (tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}), []);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storeSession = useCallback((token: string) => {
    tokenRef.current = token;
    setSessionToken(token);
    persist([[STORE_KEYS.token, token]]);
  }, [persist]);

  const saveProfile = useCallback(
    async (input: { name: string; country: string; city: string; notifyPosts?: boolean }) => {
      const deviceId = await getDeviceId();
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ deviceId, name: input.name.trim(), country: input.country.trim(), city: input.city.trim(), ...(typeof input.notifyPosts === 'boolean' ? { notifyPosts: input.notifyPosts } : {}) }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; sessionToken?: string; user?: { id?: string; avatarUrl?: string; email?: string; bio?: string } };
      if (!response.ok || !payload.sessionToken) throw new Error(payload.error ?? 'Could not save your profile. Check your connection and try again.');
      storeSession(payload.sessionToken);
      const next: Profile = { ...profileRef.current, name: input.name.trim(), country: input.country.trim(), city: input.city.trim() };
      if (payload.user?.avatarUrl) next.avatarUri = payload.user.avatarUrl;
      if (payload.user?.id) next.id = payload.user.id;
      if (payload.user?.email) next.email = payload.user.email;
      if (payload.user?.bio !== undefined) next.bio = payload.user.bio;
      profileRef.current = next;
      setProfileState(next);
      persist([[STORE_KEYS.profile, next]]);
    },
    [authHeaders, persist, storeSession],
  );

  const applyAuth = useCallback(
    (payload: { sessionToken: string; user: { id?: string; name?: string; country?: string; city?: string; avatarUrl?: string; email?: string; bio?: string } }) => {
      storeSession(payload.sessionToken);
      const u = payload.user;
      const next: Profile = {
        ...profileRef.current,
        id: u.id, email: u.email, bio: u.bio,
        name: u.name || profileRef.current.name,
        country: u.country || profileRef.current.country,
        city: u.city || profileRef.current.city,
        avatarUri: u.avatarUrl || profileRef.current.avatarUri,
      };
      profileRef.current = next;
      setProfileState(next);
      persist([[STORE_KEYS.profile, next]]);
    },
    [persist, storeSession],
  );

  const setBio = useCallback(
    async (bio: string) => {
      const response = await fetch(`${API_BASE_URL}/api/profile/bio`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ bio }) });
      if (!response.ok) throw new Error('Could not save your bio.');
      const next: Profile = { ...profileRef.current, bio: bio.trim().slice(0, 200) };
      profileRef.current = next;
      setProfileState(next);
      persist([[STORE_KEYS.profile, next]]);
    },
    [authHeaders, persist],
  );

  // Older installs have a session but no stored user id: fetch it once so the profile can load its posts.
  useEffect(() => {
    if (!hydrated || !sessionToken || profileRef.current.id) return;
    void fetch(`${API_BASE_URL}/api/me`, { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { user?: { id?: string; email?: string; bio?: string } } | null) => {
        if (!p?.user?.id) return;
        const next: Profile = { ...profileRef.current, id: p.user.id, email: p.user.email, bio: p.user.bio };
        profileRef.current = next;
        setProfileState(next);
        persist([[STORE_KEYS.profile, next]]);
      })
      .catch(() => undefined);
  }, [hydrated, sessionToken, persist]);

  const uploadAvatar = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      if (!tokenRef.current) throw new Error('Create your profile first.');
      const response = await uploadImage(`${API_BASE_URL}/api/profile/avatar`, asset, 'avatar', {}, authHeaders());
      const payload = (await response.json().catch(() => ({}))) as { error?: string; user?: { avatarUrl?: string } };
      if (!response.ok || !payload.user?.avatarUrl) throw new Error(payload.error ?? 'Could not upload your picture.');
      const next: Profile = { ...profileRef.current, avatarUri: payload.user.avatarUrl };
      profileRef.current = next;
      setProfileState(next);
      persist([[STORE_KEYS.profile, next]]);
    },
    [authHeaders, persist],
  );

  const completeOnboarding = useCallback(() => {
    setOnboarded(true);
    persist([[STORE_KEYS.onboarded, true]]);
  }, [persist]);

  // Local profile edits (for example the detected city) are saved on this device
  // and synced to the server shortly afterwards when the user has an account.
  const setProfile = useCallback(
    (patch: Partial<Profile>) => {
      setProfileState((current) => {
        const next = { ...current, ...patch };
        profileRef.current = next;
        persist([[STORE_KEYS.profile, next]]);
        return next;
      });
      if (!tokenRef.current) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        const { name, country, city } = profileRef.current;
        if (name.trim().length >= 2 && country.trim().length >= 2 && city.trim().length >= 2) void saveProfile({ name, country, city }).catch(() => undefined);
      }, 1500);
    },
    [persist, saveProfile],
  );

  // Installs from before accounts existed only have a local profile: create the account once.
  // Keep the server's "send me community post alerts" flag in line with the Notifications switch.
  const syncedAlertsRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!hydrated || !sessionToken || !API_BASE_URL) return;
    const wanted = settings.notificationsEnabled;
    if (syncedAlertsRef.current === null) { syncedAlertsRef.current = wanted; if (wanted) return; }
    if (syncedAlertsRef.current === wanted && wanted) return;
    const current = profileRef.current;
    if (current.name.trim().length < 2 || current.country.trim().length < 2 || current.city.trim().length < 2) return;
    syncedAlertsRef.current = wanted;
    void saveProfile({ name: current.name, country: current.country, city: current.city, notifyPosts: wanted }).catch(() => { syncedAlertsRef.current = null; });
  }, [hydrated, sessionToken, settings.notificationsEnabled, saveProfile]);

  // Anonymous visit ping (device id + connection country/city, resolved on the server) for the admin traffic charts.
  useEffect(() => {
    if (!hydrated || !API_BASE_URL) return;
    let last = 0;
    const ping = () => {
      if (Date.now() - last < 10 * 60 * 1000) return;
      last = Date.now();
      void getDeviceId().then((deviceId) => fetch(`${API_BASE_URL}/api/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ deviceId, platform: Platform.OS, appVersion: Constants.expoConfig?.version ?? '' }),
      })).catch(() => undefined);
    };
    ping();
    const sub = NativeAppState.addEventListener('change', (state) => { if (state === 'active') ping(); });
    return () => sub.remove();
  }, [hydrated, sessionToken, authHeaders]);

  const setSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettingsState((current) => {
        const next = { ...current, ...patch };
        persist([[STORE_KEYS.settings, next]]);
        return next;
      });
    },
    [persist],
  );

  const setPrayerCity = useCallback(
    (city: PrayerCity) => {
      setPrayerCityState(city);
      persist([[STORE_KEYS.cityName, city]]);
    },
    [persist],
  );

  const toggleLike = useCallback(
    (id: string) => {
      const liked = !likedPostIds.includes(id);
      setLikedPostIds((current) => {
        const next = liked ? [...current, id] : current.filter((item) => item !== id);
        persist([[STORE_KEYS.likedPosts, next]]);
        return next;
      });
      if (API_BASE_URL) {
        void (async () => {
          const deviceId = await getDeviceId();
          const response = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(id)}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, liked }),
          });
          if (!response.ok) return;
          const result = (await response.json()) as { liked?: boolean; likes?: number };
          setLikedPostIds((current) => {
            const next = result.liked ? [...new Set([...current, id])] : current.filter((item) => item !== id);
            persist([[STORE_KEYS.likedPosts, next]]);
            return next;
          });
          if (typeof result.likes === 'number') {
            setRemotePosts((current) => current?.map((post) => post.id === id ? { ...post, likes: Math.max(0, result.likes! - (result.liked ? 1 : 0)) } : post) ?? null);
          }
        })().catch(() => undefined);
      }
    },
    [likedPostIds, persist],
  );

  const toggleSaved = useCallback(
    (id: string) => {
      setSavedPostIds((current) => {
        const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
        persist([[STORE_KEYS.savedPosts, next]]);
        return next;
      });
    },
    [persist],
  );

  const registerView = useCallback(
    (id: string) => {
      setViewedPostIds((current) => {
        if (current.includes(id)) return current;
        const next = [...current, id];
        persist([[STORE_KEYS.viewedPosts, next]]);
        return next;
      });
    },
    [persist],
  );

  const pushNotification = useCallback(
    (input: { kind: NotificationKind; title: string; body: string; refId?: string }) => {
      if (!settingsRef.current.notificationsEnabled) return;
      setNotifications((current) => {
        const next: AppNotification[] = [
          {
            id: makeId('note'),
            createdAt: new Date().toISOString(),
            read: false,
            ...input,
          },
          ...current,
        ].slice(0, 60);
        persist([[STORE_KEYS.notifications, next]]);
        return next;
      });
    },
    [persist],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      readRef.current = [...new Set([...readRef.current, id])].slice(-200);
      persist([[STORE_KEYS.notificationsReadAt, readRef.current]]);
      setNotifications((current) => {
        const next = current.map((item) => (item.id === id ? { ...item, read: true } : item));
        persist([[STORE_KEYS.notifications, next]]);
        return next;
      });
      if (id.startsWith('remote-') && API_BASE_URL) {
        void fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(id.slice(7))}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: '{}',
        }).catch(() => undefined);
      }
    },
    [persist, authHeaders],
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((current) => {
      readRef.current = [...new Set([...readRef.current, ...current.map((item) => item.id)])].slice(-200);
      const next = current.map((item) => ({ ...item, read: true }));
      persist([[STORE_KEYS.notificationsReadAt, readRef.current], [STORE_KEYS.notifications, next]]);
      return next;
    });
    if (API_BASE_URL) {
      void fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: '{}',
      }).catch(() => undefined);
    }
  }, [persist, authHeaders]);

  const clearNotifications = useCallback(() => {
    setNotifications((current) => {
      // Dismiss remote notifications for good; a later refresh must not restore them.
      clearedRef.current = [...new Set([...clearedRef.current, ...current.map((item) => item.id)])].slice(-200);
      persist([[STORE_KEYS.clearedNotifications, clearedRef.current], [STORE_KEYS.notifications, []]]);
      return [];
    });
  }, [persist]);

  const refreshContent = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  const setAlarms = useCallback(
    (next: AdhanAlarm[]) => {
      setAlarmsState(next);
      persist([[STORE_KEYS.alarms, next]]);
    },
    [persist],
  );

  const updateAlarm = useCallback(
    (prayer: AdhanAlarm['prayer'], patch: Partial<AdhanAlarm>) => {
      setAlarmsState((current) => {
        const exists = current.some((item) => item.prayer === prayer);
        const next = exists
          ? current.map((item) => (item.prayer === prayer ? { ...item, ...patch } : item))
          : patch.time
            ? [...current, { prayer, time: patch.time, enabled: patch.enabled ?? false }]
            : current;
        persist([[STORE_KEYS.alarms, next]]);
        return next;
      });
    },
    [persist],
  );

  const submitQuestion = useCallback(
    async (input: {
      name: string;
      gender: UserQuestion['gender'];
      city: string;
      country: string;
      question: string;
      category: UserQuestion['category'];
    }) => {
      const timestamp = new Date().toISOString();
      const entry: UserQuestion = {
        id: `FAT-${Date.now().toString().slice(-8)}`,
        name: input.name,
        gender: input.gender,
        city: input.city,
        country: input.country,
        question: input.question,
        category: input.category,
        status: 'Submitted',
        submittedAt: timestamp,
        updatedAt: timestamp,
      };
      let returnedEntry = entry;
      setQuestions((current) => {
        const next = [entry, ...current];
        persist([[STORE_KEYS.questions, next]]);
        return next;
      });
      pushNotification({
        kind: 'system',
        title: 'Question received',
        body: 'Your question has been sent for review. You will be notified when an answer is ready.',
        refId: entry.id,
      });

      if (API_BASE_URL) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              name: input.name,
              gender: input.gender,
              city: input.city,
              country: input.country,
              question: input.question,
              category: input.category,
            }),
          });
          if (!response.ok) {
            const failure = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(failure.error ?? `Question submission failed (${response.status})`);
          }
          if (response.ok) {
            const remote = (await response.json()) as {
              id?: string;
              status?: string;
              answer?: string;
              answeredBy?: string;
              createdAt?: string;
            };
            returnedEntry = {
              ...entry,
              id: remote.id ?? entry.id,
              status:
                remote.status === 'answered'
                  ? 'Answered'
                  : remote.status === 'under_review'
                    ? 'Under review'
                    : 'Submitted',
              answer: remote.answer,
              answeredBy: remote.answeredBy,
              submittedAt: remote.createdAt ?? entry.submittedAt,
            };
            setQuestions((current) => {
              const next: UserQuestion[] = current.map((item) =>
                item.id === entry.id
                  ? {
                      ...item,
                      id: remote.id ?? item.id,
                      status:
                        remote.status === 'answered'
                          ? 'Answered'
                          : remote.status === 'under_review'
                            ? 'Under review'
                            : 'Submitted',
                      answer: remote.answer,
                      answeredBy: remote.answeredBy,
                    }
                  : item,
              );
              persist([[STORE_KEYS.questions, next]]);
              return next;
            });
          }
        } catch {
          // Keep the local submission when the API is unavailable.
        }
      }
      return returnedEntry;
    },
    [persist, pushNotification, authHeaders],
  );

  const clearLocalData = useCallback(() => {
    setProfileState(emptyProfile);
    tokenRef.current = '';
    setSessionToken('');
    setOnboarded(false);
    setQuestions([]);
    setNotifications([]);
    setLikedPostIds([]);
    setSavedPostIds([]);
    setViewedPostIds([]);
    setAlarmsState([]);
    setPrayerCityState(defaultCity);
    setSettingsState({ notificationsEnabled: true, adhanSound: true, language: 'ur', autoLanguage: true, autoTranslate: true });
    void AsyncStorage.multiRemove(Object.values(STORE_KEYS));
  }, []);

  const posts = useMemo(() => remotePosts ?? [], [remotePosts]);
  const fatwaList = useMemo(() => remoteFatwas ?? [], [remoteFatwas]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const value = useMemo<AppState>(
    () => ({
      hydrated,
      profile,
      posts,
      fatwas: fatwaList,
      questions,
      notifications,
      alarms,
      likedPostIds,
      savedPostIds,
      viewedPostIds,
      prayerCity,
      settings,
      unreadCount,
      signedIn: Boolean(sessionToken),
      onboarded,
      completeOnboarding,
      saveProfile,
      uploadAvatar,
      authHeaders,
      applyAuth,
      setBio,
      setProfile,
      setSettings,
      setPrayerCity,
      toggleLike,
      toggleSaved,
      registerView,
      submitQuestion,
      setAlarms,
      updateAlarm,
      pushNotification,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      refreshContent,
      clearLocalData,
    }),
    [
      hydrated,
      profile,
      posts,
      fatwaList,
      questions,
      notifications,
      alarms,
      likedPostIds,
      savedPostIds,
      viewedPostIds,
      prayerCity,
      settings,
      unreadCount,
      sessionToken,
      onboarded,
      completeOnboarding,
      saveProfile,
      uploadAvatar,
      authHeaders,
      applyAuth,
      setBio,
      setProfile,
      setSettings,
      setPrayerCity,
      toggleLike,
      toggleSaved,
      registerView,
      submitQuestion,
      setAlarms,
      updateAlarm,
      pushNotification,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      refreshContent,
      clearLocalData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
