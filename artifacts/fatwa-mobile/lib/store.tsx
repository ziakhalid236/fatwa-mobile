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
import { AppState as NativeAppState } from 'react-native';
import { defaultCity, fatwas as seedFatwas, posts as seedPosts, prayerCities } from '@/data/content';
import { notifyNow } from '@/lib/adhan';
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
  questions: '@fatwa/questions',
  likedPosts: '@fatwa/likedPosts',
  savedPosts: '@fatwa/savedPosts',
  viewedPosts: '@fatwa/viewedPosts',
  notifications: '@fatwa/notifications',
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
  clearLocalData: () => void;
};

const AppContext = createContext<AppState | null>(null);

const emptyProfile: Profile = { name: '', city: '' };

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfileState] = useState<Profile>(emptyProfile);
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
  const [remotePosts, setRemotePosts] = useState<Post[] | null>(null);
  const [remoteFatwas, setRemoteFatwas] = useState<Fatwa[] | null>(null);

  const writeQueue = useRef(Promise.resolve());

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
        const profileValue = parse<unknown>(STORE_KEYS.profile, emptyProfile);
        setProfileState(
          isRecord(profileValue)
            ? {
                name: typeof profileValue.name === 'string' ? profileValue.name : '',
                city: typeof profileValue.city === 'string' ? profileValue.city : '',
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
        const cityName = data[STORE_KEYS.cityName];
        if (typeof cityName === 'string') {
          const match = prayerCities.find((city) => city.name === cityName);
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
    if (!API_BASE_URL) return;
    let active = true;
    const syncRemoteNotifications = async () => {
      try {
        const deviceId = await AsyncStorage.getItem(STORE_KEYS.deviceId);
        if (!deviceId || !active) return;
        const response = await fetch(`${API_BASE_URL}/api/notifications?deviceId=${encodeURIComponent(deviceId)}`);
        if (!response.ok || !active) return;
        const payload = (await response.json()) as {
          notifications?: Array<{ id?: string; title?: string; body?: string; createdAt?: string; readAt?: string | null; questionId?: string }>;
        };
        const remote = Array.isArray(payload.notifications)
          ? payload.notifications.map((item): AppNotification => ({
              id: `remote-${String(item.id ?? makeId('note'))}`,
              kind: String(item.title ?? '').toLowerCase().includes('answered') ? 'answer' : 'system',
              title: String(item.title ?? 'Fatwa update'),
              body: String(item.body ?? ''),
              createdAt: String(item.createdAt ?? new Date().toISOString()),
              read: Boolean(item.readAt),
              refId: typeof item.questionId === 'string' ? item.questionId : undefined,
            }))
          : [];
        setNotifications((current) => {
          const currentIds = new Set(current.map((item) => item.id));
          const fresh = remote.filter((item) => !currentIds.has(item.id));
          if (fresh.length) void notifyNow(fresh[0].title, fresh[0].body);
          const local = current.filter((item) => !item.id.startsWith('remote-'));
          const next = [...remote, ...local].slice(0, 60);
          persist([[STORE_KEYS.notifications, next]]);
          return next;
        });
      } catch {
        // Local notifications remain available when Cloudflare is temporarily offline.
      }
    };
    const syncRemoteQuestions = async () => {
      try {
        const deviceId = await AsyncStorage.getItem(STORE_KEYS.deviceId);
        if (!deviceId || !active) return;
        const response = await fetch(`${API_BASE_URL}/api/questions?deviceId=${encodeURIComponent(deviceId)}`);
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
        const [postsResponse, fatwasResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/posts`),
          fetch(`${API_BASE_URL}/api/fatwas`),
        ]);
        if (!active) return;
        if (postsResponse.ok) {
          const payload = (await postsResponse.json()) as { posts?: Array<Record<string, unknown>> };
          if (Array.isArray(payload.posts) && payload.posts.length) {
            const mapCategory = (value: unknown): Post['category'] => {
              const category = String(value ?? '').toLowerCase();
              if (category.includes('history')) return 'History';
              if (category.includes('poetry')) return 'Poetry';
              if (category.includes('reflection')) return 'Reflection';
              if (category.includes('seerah')) return 'Seerah';
              return 'Islamic';
            };
            setRemotePosts([
              ...seedPosts,
              ...payload.posts.map((item) => ({
                id: String(item.id),
                title: String(item.title ?? 'Untitled post'),
                body: String(item.body ?? ''),
                category: mapCategory(item.category),
                author: String(item.author ?? 'Fatwa editorial team'),
                source: typeof item.source === 'string' ? item.source : undefined,
                views: Number(item.views ?? 0),
                likes: Number(item.likes ?? 0),
                date: String(item.date ?? item.createdAt ?? 'Recently'),
                accent: String(item.accent ?? 'teal'),
                icon: String(item.icon ?? 'book-open-outline'),
                translations:
                  item.translations !== null && typeof item.translations === 'object'
                    ? (item.translations as Post['translations'])
                    : legacyTranslations[String(item.title ?? '')],
              })),
            ]);
          }
        }
        if (fatwasResponse.ok) {
          const payload = (await fatwasResponse.json()) as { fatwas?: Array<Record<string, unknown>> };
          if (Array.isArray(payload.fatwas) && payload.fatwas.length) {
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
      await syncRemoteNotifications();
      await syncRemoteQuestions();
    };
    void loadRemote();
    const interval = setInterval(() => {
      void syncRemoteNotifications();
      void syncRemoteQuestions();
    }, 30_000);
    const appState = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncRemoteNotifications();
        void syncRemoteQuestions();
      }
    });
    return () => {
      active = false;
      clearInterval(interval);
      appState.remove();
    };
  }, [persist]);

  const setProfile = useCallback(
    (patch: Partial<Profile>) => {
      setProfileState((current) => {
        const next = { ...current, ...patch };
        persist([[STORE_KEYS.profile, next]]);
        return next;
      });
    },
    [persist],
  );

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
      persist([[STORE_KEYS.cityName, city.name]]);
    },
    [persist],
  );

  const toggleLike = useCallback(
    (id: string) => {
      setLikedPostIds((current) => {
        const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
        persist([[STORE_KEYS.likedPosts, next]]);
        return next;
      });
    },
    [persist],
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
      setNotifications((current) => {
        const next = current.map((item) => (item.id === id ? { ...item, read: true } : item));
        persist([[STORE_KEYS.notifications, next]]);
        return next;
      });
      if (id.startsWith('remote-') && API_BASE_URL) {
        void AsyncStorage.getItem(STORE_KEYS.deviceId).then((deviceId) => {
          if (!deviceId) return;
          return fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(id.slice(7))}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId }),
          }).catch(() => undefined);
        });
      }
    },
    [persist],
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((current) => {
      const next = current.map((item) => ({ ...item, read: true }));
      persist([[STORE_KEYS.notifications, next]]);
      return next;
    });
  }, [persist]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    persist([[STORE_KEYS.notifications, []]]);
  }, [persist]);

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
      setProfile({ name: input.name, city: input.city });

      if (API_BASE_URL) {
        try {
          const storedDeviceId = await AsyncStorage.getItem(STORE_KEYS.deviceId);
          const deviceId = storedDeviceId ?? `fatwa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          if (!storedDeviceId) await AsyncStorage.setItem(STORE_KEYS.deviceId, deviceId);
          const response = await fetch(`${API_BASE_URL}/api/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId,
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
    [persist, pushNotification, setProfile],
  );

  const clearLocalData = useCallback(() => {
    setProfileState(emptyProfile);
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

  const posts = useMemo(() => remotePosts ?? seedPosts, [remotePosts]);
  const fatwaList = useMemo(() => remoteFatwas ?? seedFatwas, [remoteFatwas]);

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
