import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

type Tab = 'home' | 'questions' | 'explore' | 'profile';
type Screen =
  | 'tabs'
  | 'ask'
  | 'category'
  | 'answer'
  | 'myQuestions'
  | 'saved'
  | 'settings';

type Category = {
  name: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  tint: string;
};

type Answer = {
  id: string;
  title: string;
  category: string;
  scholar: string;
  institution: string;
  excerpt: string;
  body: string;
  date: string;
  helpful: number;
  sourceUrl?: string;
};

type UserQuestion = {
  id: string;
  title: string;
  category: string;
  submittedAt: string;
  status: 'Submitted' | 'Under review' | 'Answered';
  answer?: string;
  answeredBy?: string;
};

const STORE_KEYS = {
  profile: '@fatwa/profile',
  questions: '@fatwa/questions',
  saved: '@fatwa/saved',
  helpful: '@fatwa/helpful',
  notifications: '@fatwa/notifications',
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

const categories: Category[] = [
  { name: 'Aqeedah', subtitle: 'Faith & beliefs', icon: 'star-crescent', color: 'forest', tint: 'mint' },
  { name: 'Namaz', subtitle: 'Prayer & its rulings', icon: 'hands-pray', color: 'teal', tint: 'mint' },
  { name: 'Roza', subtitle: 'Fasting & Ramadan', icon: 'moon-waning-crescent', color: 'coral', tint: 'mint' },
  { name: 'Zakat', subtitle: 'Charity & giving', icon: 'hand-heart-outline', color: 'blue', tint: 'mint' },
  { name: 'Hajj & Umrah', subtitle: 'Pilgrimage & travel', icon: 'compass-outline', color: 'purple', tint: 'mint' },
  { name: 'Nikah & Family', subtitle: 'Marriage & family life', icon: 'heart-multiple-outline', color: 'pink', tint: 'mint' },
  { name: 'Muamalat', subtitle: 'Transactions & finance', icon: 'swap-horizontal', color: 'orange', tint: 'mint' },
  { name: 'Tafseer & Quran', subtitle: 'Quran & its explanation', icon: 'book-open-page-variant-outline', color: 'forest', tint: 'mint' },
];

const seedAnswers: Answer[] = [
  {
    id: 'sample-1',
    title: 'How can I make up a prayer I missed?',
    category: 'Namaz',
    scholar: 'Fatwa editorial team',
    institution: 'Sample guidance',
    excerpt: 'A sample answer card showing how a verified scholar’s guidance will appear.',
    body: 'This is example content for the app preview, not a religious ruling. The details of missed prayers can depend on a person’s circumstances and the school of thought they follow. Please submit your situation to a qualified scholar for guidance specific to you.',
    date: '2 days ago',
    helpful: 124,
  },
  {
    id: 'sample-2',
    title: 'What should I know before calculating Zakat?',
    category: 'Zakat',
    scholar: 'Fatwa editorial team',
    institution: 'Sample guidance',
    excerpt: 'A clear, step-by-step response from a qualified scholar will be shown here.',
    body: 'This sample demonstrates the answer layout only. Zakat calculations can depend on the type of assets, liabilities, dates, and scholarly guidance followed. For a reliable answer, share your details with a qualified scholar or trusted local institution.',
    date: '5 days ago',
    helpful: 86,
  },
  {
    id: 'sample-3',
    title: 'Can I fast while travelling?',
    category: 'Roza',
    scholar: 'Fatwa editorial team',
    institution: 'Sample guidance',
    excerpt: 'Browse practical answers and the scholarly context behind them.',
    body: 'This is sample content and should not be treated as a fatwa. The answer may depend on travel distance, duration, health, and the scholarly tradition followed. Please ask a qualified scholar about your own situation.',
    date: '1 week ago',
    helpful: 102,
  },
  {
    id: 'sample-4',
    title: 'How do I prepare for Hajj with my family?',
    category: 'Hajj & Umrah',
    scholar: 'Fatwa editorial team',
    institution: 'Sample guidance',
    excerpt: 'Guidance for pilgrimage questions, travel, and preparation.',
    body: 'This example is included to preview the app experience, not as a religious ruling. Hajj requirements and practical arrangements can vary; speak with a qualified scholar and an authorized travel provider for advice that fits your circumstances.',
    date: '1 week ago',
    helpful: 67,
  },
  {
    id: 'sample-5',
    title: 'Where can I find a clear explanation of a verse?',
    category: 'Tafseer & Quran',
    scholar: 'Fatwa editorial team',
    institution: 'Sample guidance',
    excerpt: 'Answers will include references and their scholarly context.',
    body: 'This sample screen illustrates where a scholar’s explanation and references will appear. For interpretation of a specific verse, ask a qualified teacher or scholar and include the verse and context you are asking about.',
    date: '2 weeks ago',
    helpful: 54,
  },
];

const colorKey = (name: string, colors: ReturnType<typeof useColors>) => {
  const palette: Record<string, string> = {
    forest: colors.forest,
    teal: colors.teal,
    coral: colors.coral,
    blue: colors.blue,
    purple: colors.purple,
    pink: colors.pink,
    orange: colors.orange,
  };
  return palette[name] ?? colors.primary;
};

function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/images/icon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.23 }}
      accessibilityLabel="Fatwa logo"
    />
  );
}

function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={[styles.actionText, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [screen, setScreen] = useState<Screen>('tabs');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAnswer, setSelectedAnswer] = useState<Answer>(seedAnswers[0]);
  const [search, setSearch] = useState('');
  const [askStep, setAskStep] = useState(0);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionCategory, setQuestionCategory] = useState('Namaz');
  const [questions, setQuestions] = useState<UserQuestion[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [helpfulIds, setHelpfulIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [submittedQuestion, setSubmittedQuestion] = useState<UserQuestion | null>(null);
  const [remoteAnswers, setRemoteAnswers] = useState<Answer[] | null>(null);

  useEffect(() => {
    let active = true;
    const loadLocalData = async () => {
      try {
        const values = await AsyncStorage.multiGet(Object.values(STORE_KEYS));
        if (!active) return;
        const data = Object.fromEntries(values);
        const profile = data[STORE_KEYS.profile] ? JSON.parse(data[STORE_KEYS.profile]!) as { name?: string; city?: string } : {};
        setName(profile.name ?? '');
        setCity(profile.city ?? '');
        setQuestions(data[STORE_KEYS.questions] ? JSON.parse(data[STORE_KEYS.questions]!) as UserQuestion[] : []);
        setSavedIds(data[STORE_KEYS.saved] ? JSON.parse(data[STORE_KEYS.saved]!) as string[] : []);
        setHelpfulIds(data[STORE_KEYS.helpful] ? JSON.parse(data[STORE_KEYS.helpful]!) as string[] : []);
        setNotifications(data[STORE_KEYS.notifications] ? JSON.parse(data[STORE_KEYS.notifications]!) as boolean : true);
      } catch {
        Alert.alert('Could not load saved data', 'Your app will still work, but locally saved changes may not be available.');
      } finally {
        if (active) setHydrated(true);
      }
    };
    void loadLocalData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!API_BASE_URL) return;
    let active = true;
    const loadRemoteFatwas = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/fatwas`);
        if (!response.ok) return;
        const payload = await response.json() as { fatwas?: Array<Record<string, unknown>> };
        const answers = (payload.fatwas ?? []).map((item) => ({
          id: String(item.id),
          title: String(item.title),
          category: String(item.category),
          scholar: String(item.scholar),
          institution: String(item.institution),
          excerpt: String(item.answer),
          body: String(item.answer),
          date: String(item.publishedAt ?? 'Recently'),
          helpful: 0,
          sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : undefined,
        })) as Answer[];
        if (active && answers.length) setRemoteAnswers(answers);
      } catch {
        // Keep bundled sample content available when the backend is offline.
      }
    };
    void loadRemoteFatwas();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const saveLocalData = async () => {
      try {
        await AsyncStorage.multiSet([
          [STORE_KEYS.profile, JSON.stringify({ name, city })],
          [STORE_KEYS.questions, JSON.stringify(questions)],
          [STORE_KEYS.saved, JSON.stringify(savedIds)],
          [STORE_KEYS.helpful, JSON.stringify(helpfulIds)],
          [STORE_KEYS.notifications, JSON.stringify(notifications)],
        ]);
      } catch {
        Alert.alert('Could not save changes', 'Check your device storage and try again.');
      }
    };
    void saveLocalData();
  }, [hydrated, name, city, questions, savedIds, helpfulIds, notifications]);

  const allAnswers = useMemo(() => {
    return (remoteAnswers ?? seedAnswers).map((answer) => ({
      ...answer,
      helpful: answer.helpful + (helpfulIds.includes(answer.id) ? 1 : 0),
    }));
  }, [helpfulIds, remoteAnswers]);

  const visibleAnswers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allAnswers.filter((answer) => {
      const categoryMatches =
        screen === 'category'
          ? answer.category === selectedCategory
          : tab !== 'explore' || selectedCategory === 'All' || answer.category === selectedCategory;
      const searchMatches =
        !term ||
        answer.title.toLowerCase().includes(term) ||
        answer.category.toLowerCase().includes(term) ||
        answer.excerpt.toLowerCase().includes(term);
      return categoryMatches && searchMatches;
    });
  }, [allAnswers, screen, selectedCategory, search, tab]);

  const goTab = (next: Tab) => {
    void Haptics.selectionAsync();
    setTab(next);
    setScreen('tabs');
    setSearch('');
    if (next === 'explore') setSelectedCategory('All');
  };

  const openCategory = (category: string) => {
    setSelectedCategory(category);
    setSearch('');
    setScreen('category');
  };

  const openAnswer = (answer: Answer) => {
    setSelectedAnswer(answer);
    setScreen('answer');
  };

  const toggleSaved = (id: string) => {
    void Haptics.selectionAsync();
    setSavedIds((current) =>
      current.includes(id) ? current.filter((saved) => saved !== id) : [...current, id],
    );
  };

  const toggleHelpful = (id: string) => {
    void Haptics.selectionAsync();
    setHelpfulIds((current) =>
      current.includes(id) ? current.filter((helpful) => helpful !== id) : [...current, id],
    );
  };

  const shareAnswer = async (answer: Answer) => {
    try {
      await Share.share({
        title: answer.title,
        message: `${answer.title}\n\n${answer.excerpt}\n\nShared from Fatwa. This sample content is for preview only.`,
      });
    } catch {
      Alert.alert('Unable to share', 'Please try again from your device.');
    }
  };

  const clearLocalData = () => {
    Alert.alert(
      'Clear local data?',
      'This removes your profile, saved answers, helpful votes, and submitted questions from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear data',
          style: 'destructive',
          onPress: () => {
            setName('');
            setCity('');
            setQuestions([]);
            setSavedIds([]);
            setHelpfulIds([]);
            setNotifications(true);
            Alert.alert('Data cleared', 'Your local Fatwa preview data has been removed.');
          },
        },
      ],
    );
  };

  const startAsk = () => {
    setTab('questions');
    setAskStep(0);
    setQuestionText('');
    setQuestionCategory('Namaz');
    setSubmittedQuestion(null);
    setScreen('ask');
  };

  const continueAsk = () => {
    if (askStep === 0) {
      if (name.trim().length < 2 || city.trim().length < 2) {
        Alert.alert('A little more detail', 'Enter your name and city or country to continue.');
        return;
      }
      setAskStep(1);
      return;
    }
    if (questionText.trim().length < 20) {
      Alert.alert('Add more detail', 'Please describe your question in at least 20 characters.');
      return;
    }
    setAskStep(2);
  };

  const submitQuestion = async () => {
    const entry: UserQuestion = {
      id: `FAT-${Date.now().toString().slice(-8)}`,
      title: questionText.trim(),
      category: questionCategory,
      submittedAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'Submitted',
    };
    setQuestions((current) => [entry, ...current]);
    setSubmittedQuestion(entry);
    setAskStep(3);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (API_BASE_URL) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, city, question: questionText.trim(), category: questionCategory }),
        });
        if (response.ok) {
          const remote = await response.json() as { id?: string; status?: string; answer?: string; answeredBy?: string };
          setQuestions((current) => current.map((item) => item.id === entry.id ? {
            ...item,
            id: remote.id ?? item.id,
            status: remote.status === 'answered' ? 'Answered' : remote.status === 'under_review' ? 'Under review' : 'Submitted',
            answer: remote.answer,
            answeredBy: remote.answeredBy,
          } : item));
        }
      } catch {
        // Keep the local submission if the API is temporarily unavailable.
      }
    }
  };

  const header = (title?: string, backAction?: () => void) => (
    <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 67 : 4 }]}>
      {backAction ? (
        <Pressable
          onPress={backAction}
          style={styles.headerBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="header-back"
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </Pressable>
      ) : (
        <View style={styles.brandLockup}>
          <LogoMark size={34} />
          <Text style={[styles.brandName, { color: colors.forest }]}>Fatwa</Text>
        </View>
      )}
      {title ? <Text style={[styles.topBarTitle, { color: colors.foreground }]}>{title}</Text> : null}
      <Pressable
        style={styles.headerIcon}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={() => Alert.alert('You’re all caught up', 'Question updates and alerts will appear here.')}
      >
        <Feather name="bell" size={20} color={colors.foreground} />
        <View style={[styles.notificationDot, { backgroundColor: colors.green }]} />
      </Pressable>
    </View>
  );

  const searchBar = (placeholder: string) => (
    <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="search" size={17} color={colors.mutedForeground} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.searchInput, { color: colors.foreground }]}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        testID="answer-search"
      />
      {search.length > 0 ? (
        <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear search">
          <Feather name="x-circle" size={18} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );

  const categoryRow = (category: Category, compact = false) => (
    <Pressable
      key={category.name}
      onPress={() => openCategory(category.name)}
      style={({ pressed }) => [
        compact ? styles.categoryTile : styles.categoryRow,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.86 : 1 },
      ]}
      accessibilityRole="button"
      testID={`category-${category.name}`}
    >
      <View style={[compact ? styles.categoryIconCompact : styles.categoryIcon, { backgroundColor: colors[category.tint as 'mint'] }]}>
        <MaterialCommunityIcons
          name={category.icon}
          size={compact ? 20 : 19}
          color={colorKey(category.color, colors)}
        />
      </View>
      <View style={styles.categoryTextWrap}>
        <Text style={[styles.categoryName, { color: colors.foreground }]}>{category.name}</Text>
        {!compact ? <Text style={[styles.categorySubtitle, { color: colors.mutedForeground }]}>{category.subtitle}</Text> : null}
      </View>
      {compact ? <Text style={[styles.categoryMiniLabel, { color: colors.mutedForeground }]}>{category.name}</Text> : <Feather name="chevron-right" size={17} color={colors.mutedForeground} />}
    </Pressable>
  );

  const answerCard = (answer: Answer, showCategory = true) => (
    <View key={answer.id} style={[styles.answerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.answerCardTop}>
        <View style={[styles.answerBadge, { backgroundColor: colors.mint }]}>
          <MaterialCommunityIcons
            name={categories.find((item) => item.name === answer.category)?.icon ?? 'book-open-outline'}
            size={14}
            color={colors.primary}
          />
          <Text style={[styles.answerBadgeText, { color: colors.primary }]}>{showCategory ? answer.category : 'Sample answer'}</Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            toggleSaved(answer.id);
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={savedIds.includes(answer.id) ? 'Remove saved answer' : 'Save answer'}
          testID={`save-${answer.id}`}
        >
          <Feather
            name={savedIds.includes(answer.id) ? 'bookmark' : 'bookmark'}
            size={19}
            color={savedIds.includes(answer.id) ? colors.primary : colors.mutedForeground}
          />
        </Pressable>
      </View>
      <Pressable
        onPress={() => openAnswer(answer)}
        accessibilityRole="button"
        accessibilityLabel={`Read answer: ${answer.title}`}
        testID={`answer-${answer.id}`}
      >
        <Text style={[styles.answerTitle, { color: colors.foreground }]} numberOfLines={2}>{answer.title}</Text>
        <Text style={[styles.answerExcerpt, { color: colors.mutedForeground }]} numberOfLines={2}>{answer.excerpt}</Text>
        <View style={[styles.answerMeta, { borderTopColor: colors.border }]}>
          <View style={styles.scholarMeta}>
            <View style={[styles.scholarAvatar, { backgroundColor: colors.secondary }]}>
              <Feather name="user" size={14} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.scholarName, { color: colors.foreground }]}>{answer.scholar}</Text>
              <Text style={[styles.answerDate, { color: colors.mutedForeground }]}>{answer.date} · Sample</Text>
            </View>
          </View>
          <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
        </View>
      </Pressable>
    </View>
  );

  const disclaimer = () => (
    <View style={[styles.disclaimer, { backgroundColor: colors.mint }]}>
      <Feather name="info" size={16} color={colors.primary} />
      <Text style={[styles.disclaimerText, { color: colors.secondaryForeground }]}>
        Sample content for preview only. For a personal ruling, ask a qualified scholar.
      </Text>
    </View>
  );

  const renderHome = () => (
    <>
      {header()}
      <View style={styles.pagePadding}>
        <View style={styles.greetingRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>ASSALAMU ALAIKUM</Text>
            <Text style={[styles.greeting, { color: colors.foreground }]}>{name.trim() ? `Welcome, ${name.trim().split(' ')[0]}` : 'Find trusted guidance'}</Text>
          </View>
          <View style={[styles.greetingIcon, { backgroundColor: colors.mint }]}>
            <MaterialCommunityIcons name="hands-pray" size={20} color={colors.primary} />
          </View>
        </View>

        <LinearGradient
          colors={[colors.forest, colors.green, colors.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroText}>
            <View style={styles.heroPill}>
              <View style={styles.heroPillDot} />
              <Text style={styles.heroPillText}>HERE TO HELP</Text>
            </View>
            <Text style={styles.heroTitle}>A question on your mind?</Text>
            <Text style={styles.heroSubtitle}>Ask a qualified scholar in a private, thoughtful space.</Text>
            <Pressable
              style={({ pressed }) => [styles.heroButton, { opacity: pressed ? 0.84 : 1 }]}
              onPress={startAsk}
              accessibilityRole="button"
              testID="ask-a-question"
            >
              <Feather name="edit-3" size={15} color={colors.forest} />
              <Text style={[styles.heroButtonText, { color: colors.forest }]}>Ask a question</Text>
              <Feather name="arrow-up-right" size={15} color={colors.forest} />
            </Pressable>
          </View>
          <View style={styles.heroArt} pointerEvents="none">
            <View style={[styles.heroMoon, { backgroundColor: colors.gold }]} />
            <MaterialCommunityIcons name="mosque" size={116} color="#FFFFFF" style={styles.mosqueArt} />
            <View style={[styles.heroHorizon, { backgroundColor: 'rgba(3, 57, 47, 0.4)' }]} />
          </View>
        </LinearGradient>

        {disclaimer()}

        <View style={styles.quickActions}>
          <Pressable
            onPress={() => goTab('explore')}
            style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.86 : 1 }]}
            accessibilityRole="button"
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.mint }]}>
              <Feather name="book-open" size={19} color={colors.primary} />
            </View>
            <Text style={[styles.quickTitle, { color: colors.foreground }]}>Browse answers</Text>
            <Text style={[styles.quickSub, { color: colors.mutedForeground }]}>Read sample guidance</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setTab('questions');
              setScreen('myQuestions');
            }}
            style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.86 : 1 }]}
            accessibilityRole="button"
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="message-circle" size={19} color={colors.teal} />
            </View>
            <Text style={[styles.quickTitle, { color: colors.foreground }]}>My questions</Text>
            <Text style={[styles.quickSub, { color: colors.mutedForeground }]}>{questions.length ? `${questions.length} submitted` : 'Track your requests'}</Text>
          </Pressable>
        </View>

        <SectionTitle title="Explore topics" action="View all" onAction={() => goTab('explore')} />
        <View style={styles.categoryGrid}>{categories.slice(0, 4).map((category) => categoryRow(category, true))}</View>

        <SectionTitle title="Recently answered" action="Browse" onAction={() => goTab('explore')} />
        {seedAnswers.slice(0, 2).map((answer) => answerCard(answer))}
      </View>
    </>
  );

  const renderBrowse = (title: string, isCategory = false) => (
    <>
      {header(isCategory ? title : undefined, isCategory ? () => { setScreen('tabs'); setTab('explore'); } : undefined)}
      <View style={styles.pagePadding}>
        {isCategory ? (
          <View style={[styles.categoryIntro, { backgroundColor: colors.mint }]}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>TOPIC</Text>
            <Text style={[styles.categoryIntroTitle, { color: colors.forest }]}>{selectedCategory}</Text>
            <Text style={[styles.categoryIntroSubtitle, { color: colors.slate }]}>
              {categories.find((item) => item.name === selectedCategory)?.subtitle ?? 'Questions and guidance'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.pageIntro, { color: colors.mutedForeground }]}>Explore answers and topics from the Fatwa community.</Text>
            {searchBar('Search for a topic or answer')}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
              <Pressable
                onPress={() => setSelectedCategory('All')}
                style={[styles.chip, { backgroundColor: selectedCategory === 'All' ? colors.primary : colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.chipText, { color: selectedCategory === 'All' ? colors.primaryForeground : colors.foreground }]}>All topics</Text>
              </Pressable>
              {categories.slice(0, 5).map((category) => (
                <Pressable
                  key={category.name}
                  onPress={() => setSelectedCategory(category.name)}
                  style={[styles.chip, { backgroundColor: selectedCategory === category.name ? colors.primary : colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.chipText, { color: selectedCategory === category.name ? colors.primaryForeground : colors.foreground }]}>{category.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <SectionTitle title="Browse by topic" />
            {categories.map((category) => categoryRow(category))}
            <SectionTitle title="Answers to explore" />
          </>
        )}
        {isCategory ? searchBar(`Search ${selectedCategory.toLowerCase()} answers`) : null}
        {disclaimer()}
        {visibleAnswers.length > 0 ? visibleAnswers.map((answer) => answerCard(answer, !isCategory)) : (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No answers found</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Try another search or choose a different topic.</Text>
          </View>
        )}
      </View>
    </>
  );

  const renderQuestionList = () => (
    <>
      {header()}
      <View style={styles.pagePadding}>
        <Text style={[styles.pageIntro, { color: colors.mutedForeground }]}>Follow your submissions and see when a response is ready.</Text>
        <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={startAsk} accessibilityRole="button" testID="submit-new-question">
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Ask a question</Text>
        </Pressable>
        <SectionTitle title="Your submissions" />
        {questions.length ? questions.map((question) => (
          <View key={question.id} style={[styles.submissionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.submissionTop}>
              <View style={[styles.statusDot, { backgroundColor: question.status === 'Answered' ? colors.green : colors.gold }]} />
              <Text style={[styles.statusText, { color: question.status === 'Answered' ? colors.primary : colors.slate }]}>{question.status}</Text>
              <Text style={[styles.submissionDate, { color: colors.mutedForeground }]}>{question.submittedAt}</Text>
            </View>
            <Text style={[styles.submissionTitle, { color: colors.foreground }]} numberOfLines={3}>{question.title}</Text>
            {question.answer ? <View style={[styles.questionAnswer, { backgroundColor: colors.mint }]}><Text style={[styles.answerBodyLabel, { color: colors.primary }]}>ANSWER FROM {question.answeredBy?.toUpperCase() ?? 'SCHOLAR'}</Text><Text style={[styles.questionAnswerText, { color: colors.foreground }]}>{question.answer}</Text></View> : null}
            <View style={styles.submissionBottom}>
              <Text style={[styles.categoryMiniLabel, { color: colors.mutedForeground }]}>{question.category}</Text>
              <Text style={[styles.submissionId, { color: colors.mutedForeground }]}>ID {question.id}</Text>
            </View>
          </View>
        )) : (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.mint }]}><Feather name="message-circle" size={23} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No questions yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Your private submissions and updates will show up here.</Text>
          </View>
        )}
      </View>
    </>
  );

  const renderProfile = () => (
    <>
      {header()}
      <View style={styles.pagePadding}>
        <LinearGradient colors={[colors.forest, colors.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileBanner}>
          <View style={styles.profileAvatar}><Feather name="user" size={27} color={colors.primary} /></View>
          <View style={styles.profileIdentity}>
            <Text style={styles.profileName}>{name.trim() || 'Guest reader'}</Text>
            <Text style={styles.profileEmail}>{city.trim() || 'Your private Fatwa profile'}</Text>
          </View>
          <Pressable onPress={() => setScreen('settings')} accessibilityRole="button" accessibilityLabel="Settings">
            <Feather name="settings" size={20} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground, marginTop: 28, marginBottom: 10 }]}>YOUR SPACE</Text>
        <ProfileRow icon="message-square" title="My questions" subtitle={`${questions.length} submissions`} onPress={() => setScreen('myQuestions')} />
        <ProfileRow icon="bookmark" title="Saved answers" subtitle={`${savedIds.length} saved`} onPress={() => setScreen('saved')} />
        <ProfileRow icon="bell" title="Notifications" subtitle="Alerts and updates" onPress={() => setScreen('settings')} />
        <ProfileRow icon="settings" title="Settings" subtitle="App preferences" onPress={() => setScreen('settings')} />
        <Text style={[styles.eyebrow, { color: colors.mutedForeground, marginTop: 25, marginBottom: 10 }]}>ABOUT</Text>
        <ProfileRow icon="info" title="About Fatwa" subtitle="Islamic guidance for a better life" onPress={() => Alert.alert('About Fatwa', 'Fatwa helps you find topics and submit private questions to qualified scholars. Sample answers in this preview are for demonstration only.')} />
        <View style={[styles.privacyNote, { backgroundColor: colors.mint }]}>
          <Feather name="lock" size={16} color={colors.primary} />
          <Text style={[styles.privacyText, { color: colors.secondaryForeground }]}>Your profile details stay on this device in this preview.</Text>
        </View>
      </View>
    </>
  );

  const renderAsk = () => (
    <>
      {header(askStep === 3 ? 'Question submitted' : 'Ask a question', () => {
        if (askStep > 0 && askStep < 3) setAskStep(askStep - 1);
        else setScreen('tabs');
      })}
      {askStep < 3 ? (
        <View style={[styles.pagePadding, styles.formContent]}>
          <View style={styles.stepsRow}>
            {['Your details', 'Question', 'Review'].map((label, index) => (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepCircle, { backgroundColor: askStep >= index ? colors.primary : colors.secondary }]}>
                  <Text style={[styles.stepNumber, { color: askStep >= index ? colors.primaryForeground : colors.mutedForeground }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, { color: askStep >= index ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
              </View>
            ))}
          </View>
          {askStep === 0 ? (
            <>
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Your details</Text>
              <Text style={[styles.formHelper, { color: colors.mutedForeground }]}>This information helps the scholar understand your question. It stays private.</Text>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Full name *</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Enter your name" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} autoCapitalize="words" returnKeyType="next" testID="ask-name" />
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>City / country *</Text>
              <TextInput value={city} onChangeText={setCity} placeholder="Enter your city or country" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} autoCapitalize="words" returnKeyType="done" testID="ask-city" />
              <View style={[styles.privacyCard, { backgroundColor: colors.mint }]}>
                <Feather name="lock" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.privacyTitle, { color: colors.foreground }]}>Your identity stays private</Text>
                  <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>Your details are only included with your question for the scholar.</Text>
                </View>
              </View>
            </>
          ) : askStep === 1 ? (
            <>
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Your question</Text>
              <Text style={[styles.formHelper, { color: colors.mutedForeground }]}>Share the details that will help a scholar understand your situation.</Text>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Choose a category *</Text>
              <View style={styles.formCategoryGrid}>
                {categories.map((category) => (
                  <Pressable
                    key={category.name}
                    onPress={() => setQuestionCategory(category.name)}
                    style={[styles.formChip, { backgroundColor: questionCategory === category.name ? colors.mint : colors.card, borderColor: questionCategory === category.name ? colors.primary : colors.border }]}
                  >
                    <Text style={[styles.formChipText, { color: questionCategory === category.name ? colors.primary : colors.foreground }]}>{category.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Describe your question *</Text>
              <TextInput
                value={questionText}
                onChangeText={setQuestionText}
                placeholder="Include the details that may help a scholar understand your situation…"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, styles.questionInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                multiline
                textAlignVertical="top"
                maxLength={1200}
                testID="ask-question-text"
              />
              <Text style={[styles.characterCount, { color: colors.mutedForeground }]}>{questionText.length}/1200 characters</Text>
            </>
          ) : (
            <>
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Review your question</Text>
              <Text style={[styles.formHelper, { color: colors.mutedForeground }]}>Check your details before sending to the scholar.</Text>
              <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ReviewRow label="Name" value={name} />
                <ReviewRow label="Location" value={city} />
                <ReviewRow label="Category" value={questionCategory} />
                <View style={[styles.reviewQuestion, { borderTopColor: colors.border }]}>
                  <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>QUESTION</Text>
                  <Text style={[styles.reviewValue, { color: colors.foreground }]}>{questionText}</Text>
                </View>
              </View>
              {disclaimer()}
            </>
          )}
          <Pressable
            onPress={askStep === 2 ? submitQuestion : continueAsk}
            style={({ pressed }) => [styles.primaryButton, styles.formNext, { backgroundColor: colors.primary, opacity: pressed ? 0.86 : 1 }]}
            accessibilityRole="button"
            testID={askStep === 2 ? 'confirm-question' : 'continue-question'}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{askStep === 2 ? 'Submit question' : 'Continue'}</Text>
            <Feather name={askStep === 2 ? 'send' : 'arrow-right'} size={17} color={colors.primaryForeground} />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.pagePadding, styles.successContent]}>
          <View style={[styles.successMark, { backgroundColor: colors.mint }]}>
            <Feather name="check" size={31} color={colors.primary} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Question submitted</Text>
          <Text style={[styles.successBody, { color: colors.mutedForeground }]}>Your question has been saved on this device. You can follow its status from My Questions.</Text>
          <View style={[styles.submissionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>QUESTION ID</Text>
            <Text style={[styles.successId, { color: colors.foreground }]}>{submittedQuestion?.id}</Text>
            <View style={[styles.reviewQuestion, { borderTopColor: colors.border }]}>
              <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>CATEGORY</Text>
              <Text style={[styles.reviewValue, { color: colors.foreground }]}>{submittedQuestion?.category}</Text>
            </View>
            <View style={styles.statusTimeline}>
              <View style={[styles.statusTimelineDot, { backgroundColor: colors.primary }]} />
              <View>
                <Text style={[styles.scholarName, { color: colors.foreground }]}>Submitted</Text>
                <Text style={[styles.answerDate, { color: colors.mutedForeground }]}>Saved on this device</Text>
              </View>
            </View>
            <View style={styles.statusTimeline}>
              <View style={[styles.statusTimelineDot, { backgroundColor: colors.gold }]} />
              <View>
                <Text style={[styles.scholarName, { color: colors.foreground }]}>Awaiting review</Text>
                <Text style={[styles.answerDate, { color: colors.mutedForeground }]}>Connect a scholar service to receive responses.</Text>
              </View>
            </View>
          </View>
          <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => { setScreen('myQuestions'); setTab('questions'); }} accessibilityRole="button">
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>View my questions</Text>
            <Feather name="arrow-right" size={17} color={colors.primaryForeground} />
          </Pressable>
          <Pressable style={styles.textButton} onPress={() => setScreen('tabs')} accessibilityRole="button">
            <Text style={[styles.actionText, { color: colors.primary }]}>Back to home</Text>
          </Pressable>
        </View>
      )}
    </>
  );

  const renderAnswer = () => {
    const answer = allAnswers.find((item) => item.id === selectedAnswer.id) ?? selectedAnswer;
    const liked = helpfulIds.includes(answer.id);
    return (
      <>
        {header('Answer details', () => setScreen(tab === 'profile' ? 'saved' : 'tabs'))}
        <View style={[styles.pagePadding, styles.answerDetailContent]}>
          <View style={[styles.verifiedBanner, { backgroundColor: colors.mint }]}>
            <Feather name="info" size={17} color={colors.primary} />
            <Text style={[styles.verifiedText, { color: colors.secondaryForeground }]}>Preview answer · sample content, not a fatwa</Text>
          </View>
          <View style={[styles.detailCategory, { backgroundColor: colors.mint }]}>
            <Text style={[styles.answerBadgeText, { color: colors.primary }]}>{answer.category}</Text>
          </View>
          <Text style={[styles.detailTitle, { color: colors.foreground }]}>{answer.title}</Text>
          <View style={styles.detailScholar}>
            <View style={[styles.scholarAvatarLarge, { backgroundColor: colors.secondary }]}>
              <Feather name="user" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.scholarName, { color: colors.foreground }]}>{answer.scholar}</Text>
              <Text style={[styles.answerDate, { color: colors.mutedForeground }]}>{answer.institution} · {answer.date}</Text>
            </View>
          </View>
          <View style={[styles.answerBodyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.answerBodyLabel, { color: colors.primary }]}>ABOUT THIS SAMPLE</Text>
            <Text style={[styles.answerBody, { color: colors.foreground }]}>{answer.body}</Text>
          </View>
          <View style={[styles.referenceCard, { backgroundColor: colors.secondary }]}>
            <Feather name="book-open" size={17} color={colors.primary} />
            <Text style={[styles.referenceText, { color: colors.secondaryForeground }]}>A real answer should include the scholar’s references and context. Ask a qualified scholar for guidance specific to you.</Text>
          </View>
          {answer.sourceUrl ? <Text style={[styles.sourceText, { color: colors.mutedForeground }]}>Source: {answer.institution} · {answer.sourceUrl}</Text> : null}
          <View style={styles.detailActions}>
            <Pressable onPress={() => toggleHelpful(answer.id)} style={[styles.detailActionButton, { backgroundColor: liked ? colors.mint : colors.card, borderColor: colors.border }]} accessibilityRole="button" testID="helpful-answer">
              <Feather name="thumbs-up" size={17} color={liked ? colors.primary : colors.foreground} />
              <Text style={[styles.detailActionText, { color: liked ? colors.primary : colors.foreground }]}>{liked ? 'Helpful' : 'Was this helpful?'} · {answer.helpful}</Text>
            </Pressable>
            <Pressable onPress={() => toggleSaved(answer.id)} style={[styles.detailActionButton, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
              <Feather name="bookmark" size={17} color={savedIds.includes(answer.id) ? colors.primary : colors.foreground} />
              <Text style={[styles.detailActionText, { color: colors.foreground }]}>{savedIds.includes(answer.id) ? 'Saved' : 'Save'}</Text>
            </Pressable>
            <Pressable onPress={() => void shareAnswer(answer)} style={[styles.detailActionButton, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Share answer">
              <Feather name="share-2" size={17} color={colors.foreground} />
              <Text style={[styles.detailActionText, { color: colors.foreground }]}>Share</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  };

  const renderSaved = () => {
    const saved = allAnswers.filter((answer) => savedIds.includes(answer.id));
    return (
      <>
        {header('Saved answers', () => { setScreen('tabs'); setTab('profile'); })}
        <View style={styles.pagePadding}>
          <Text style={[styles.pageIntro, { color: colors.mutedForeground }]}>Keep useful answers close for later.</Text>
          {saved.length ? saved.map((answer) => answerCard(answer)) : (
            <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.mint }]}><Feather name="bookmark" size={22} color={colors.primary} /></View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing saved yet</Text>
              <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Tap the bookmark on an answer to keep it here.</Text>
              <Pressable onPress={() => { setScreen('tabs'); setTab('explore'); }} style={styles.textButton}>
                <Text style={[styles.actionText, { color: colors.primary }]}>Browse answers</Text>
              </Pressable>
            </View>
          )}
        </View>
      </>
    );
  };

  const renderSettings = () => (
    <>
      {header('Settings', () => { setScreen('tabs'); setTab('profile'); })}
      <View style={styles.pagePadding}>
        <Text style={[styles.settingsSectionTitle, { color: colors.foreground }]}>Profile</Text>
        <Text style={[styles.formHelper, { color: colors.mutedForeground }]}>These details are stored only on this device until a scholar service is connected.</Text>
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Full name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Enter your name" placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.settingInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} autoCapitalize="words" />
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>City / country</Text>
        <TextInput value={city} onChangeText={setCity} placeholder="Enter your city or country" placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.settingInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} autoCapitalize="words" />
        <View style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.quickIcon, { backgroundColor: colors.mint }]}><Feather name="bell" size={18} color={colors.primary} /></View>
          <View style={styles.settingText}>
            <Text style={[styles.quickTitle, { color: colors.foreground }]}>Question notifications</Text>
            <Text style={[styles.categorySubtitle, { color: colors.mutedForeground }]}>Updates when a response is ready</Text>
          </View>
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: colors.border, true: colors.teal }} thumbColor="#FFFFFF" accessibilityLabel="Question notifications" />
        </View>
        <View style={[styles.privacyNote, { backgroundColor: colors.mint }]}>
          <Feather name="shield" size={17} color={colors.primary} />
          <Text style={[styles.privacyText, { color: colors.secondaryForeground }]}>This preview keeps your profile, saved answers, and questions on this device. No account or scholar service is connected yet.</Text>
        </View>
        <Text style={[styles.settingsSectionTitle, { color: colors.foreground, marginTop: 8 }]}>Data controls</Text>
        <Pressable onPress={clearLocalData} style={[styles.dangerButton, { borderColor: colors.border }]} accessibilityRole="button">
          <Feather name="trash-2" size={17} color={colors.coral} />
          <Text style={[styles.detailActionText, { color: colors.coral }]}>Clear local data</Text>
        </Pressable>
      </View>
    </>
  );

  let content: React.ReactNode;
  let activeTab = tab;

  if (screen === 'ask') content = renderAsk();
  else if (screen === 'category') content = renderBrowse(selectedCategory, true);
  else if (screen === 'answer') content = renderAnswer();
  else if (screen === 'myQuestions') content = renderQuestionList();
  else if (screen === 'saved') content = renderSaved();
  else if (screen === 'settings') content = renderSettings();
  else if (tab === 'home') content = renderHome();
  else if (tab === 'questions') content = renderQuestionList();
  else if (tab === 'explore') {
    activeTab = 'explore';
    content = renderBrowse('Browse answers');
  } else content = renderProfile();

  const showTabBar = screen === 'tabs';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={[styles.app, { backgroundColor: colors.background }]}>
        <KeyboardAwareScrollViewCompat
          style={styles.mainScroll}
          contentContainerStyle={styles.mainScrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          enabled
        >
          {content}
        </KeyboardAwareScrollViewCompat>
        {showTabBar ? (
          <View style={[styles.tabBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 8) }]}>
            {([
              { key: 'home', label: 'Home', icon: 'home' },
              { key: 'questions', label: 'Questions', icon: 'message-circle' },
              { key: 'explore', label: 'Explore', icon: 'compass' },
              { key: 'profile', label: 'Profile', icon: 'user' },
            ] as const).map((item) => {
              const selected = activeTab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => goTab(item.key)}
                  style={styles.tabItem}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.label}
                  testID={`tab-${item.key}`}
                >
                  <Feather name={item.icon} size={20} color={selected ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.tabLabel, { color: selected ? colors.primary : colors.mutedForeground }]}>{item.label}</Text>
                  {selected ? <View style={[styles.activeTabDot, { backgroundColor: colors.primary }]} /> : <View style={styles.activeTabDot} />}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function ProfileRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.profileRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.86 : 1 }]}
      accessibilityRole="button"
    >
      <View style={[styles.profileRowIcon, { backgroundColor: colors.background }]}>
        <Feather name={icon} size={18} color={colors.foreground} />
      </View>
      <View style={styles.profileRowText}>
        <Text style={[styles.profileRowTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.categorySubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
    </Pressable>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.reviewRow}>
      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.reviewValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  app: { flex: 1 },
  mainScroll: { flex: 1 },
  mainScrollContent: { flexGrow: 1, paddingBottom: 10 },
  pagePadding: { paddingHorizontal: 20, paddingBottom: 24 },
  topBar: { minHeight: 58, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.7 },
  topBarTitle: { position: 'absolute', left: 70, right: 66, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  headerBack: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', zIndex: 2 },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notificationDot: { width: 7, height: 7, borderRadius: 4, position: 'absolute', top: 9, right: 8 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.25, marginBottom: 5 },
  greeting: { fontSize: 23, fontWeight: '700', letterSpacing: -0.5 },
  greetingIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 24, minHeight: 194, padding: 19, overflow: 'hidden', flexDirection: 'row', position: 'relative', marginBottom: 14 },
  heroText: { width: '67%', zIndex: 2 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 11 },
  heroPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B6F1D6' },
  heroPillText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: '#E3F6ED' },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 27, letterSpacing: -0.35, maxWidth: 220 },
  heroSubtitle: { fontSize: 12, lineHeight: 18, color: '#E0F1EA', marginTop: 7, maxWidth: 210 },
  heroButton: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 13, paddingVertical: 10, marginTop: 15 },
  heroButtonText: { fontSize: 12, fontWeight: '700' },
  heroArt: { position: 'absolute', right: -7, bottom: 0, width: 150, height: 160, justifyContent: 'flex-end', alignItems: 'center', opacity: 0.92 },
  heroMoon: { position: 'absolute', width: 27, height: 27, borderRadius: 14, right: 27, top: 18, opacity: 0.93 },
  mosqueArt: { marginBottom: 6, opacity: 0.88 },
  heroHorizon: { position: 'absolute', height: 21, bottom: 0, left: 0, right: 0 },
  disclaimer: { borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 17 },
  disclaimerText: { fontSize: 11, lineHeight: 16, flex: 1 },
  quickActions: { flexDirection: 'row', gap: 11, marginBottom: 23 },
  quickAction: { flex: 1, borderRadius: 18, padding: 13, borderWidth: 1, minHeight: 123 },
  quickIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  quickSub: { fontSize: 10, lineHeight: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.25 },
  actionText: { fontSize: 12, fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  categoryTile: { width: '48%', minHeight: 90, borderWidth: 1, borderRadius: 17, padding: 12, justifyContent: 'space-between' },
  categoryIconCompact: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  categoryMiniLabel: { fontSize: 11, fontWeight: '600' },
  categoryRow: { borderWidth: 1, borderRadius: 15, paddingVertical: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9, minHeight: 64 },
  categoryIcon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  categoryTextWrap: { flex: 1 },
  categoryName: { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  categorySubtitle: { fontSize: 11 },
  answerCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 11 },
  answerCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  answerBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  answerBadgeText: { fontSize: 10, fontWeight: '600' },
  answerTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', marginBottom: 5 },
  answerExcerpt: { fontSize: 12, lineHeight: 17, marginBottom: 13 },
  answerMeta: { borderTopWidth: 1, paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scholarMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scholarAvatar: { height: 30, width: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  scholarName: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  answerDate: { fontSize: 10 },
  pageIntro: { fontSize: 13, lineHeight: 19, marginTop: 3, marginBottom: 16 },
  searchBar: { borderWidth: 1, borderRadius: 15, height: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 13, height: '100%' },
  categoryChips: { gap: 8, paddingBottom: 16, paddingRight: 20 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontSize: 11, fontWeight: '600' },
  categoryIntro: { borderRadius: 18, padding: 16, marginTop: 3, marginBottom: 15 },
  categoryIntroTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  categoryIntroSubtitle: { fontSize: 12 },
  emptyState: { borderWidth: 1, borderRadius: 20, minHeight: 190, padding: 24, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  emptyIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 5, textAlign: 'center' },
  emptyCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 260 },
  primaryButton: { minHeight: 50, borderRadius: 16, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 20 },
  primaryButtonText: { fontSize: 14, fontWeight: '700' },
  submissionCard: { borderWidth: 1, borderRadius: 17, padding: 14, marginBottom: 11 },
  submissionTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  statusText: { fontSize: 11, fontWeight: '600', flex: 1 },
  submissionDate: { fontSize: 10 },
  submissionTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 12 },
  questionAnswer: { borderRadius: 12, padding: 11, marginBottom: 12 },
  questionAnswerText: { fontSize: 12, lineHeight: 18 },
  submissionBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submissionId: { fontSize: 10 },
  profileBanner: { borderRadius: 21, minHeight: 110, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 7 },
  profileAvatar: { height: 52, width: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  profileIdentity: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  profileEmail: { fontSize: 11, color: '#E0F1EA' },
  profileRow: { minHeight: 65, borderRadius: 15, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  profileRowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  profileRowText: { flex: 1, gap: 3 },
  profileRowTitle: { fontSize: 13, fontWeight: '600' },
  privacyNote: { padding: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 18, marginBottom: 18 },
  privacyText: { fontSize: 11, lineHeight: 16, flex: 1 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 29 },
  stepItem: { alignItems: 'center', gap: 7, minWidth: 76 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { fontSize: 11, fontWeight: '700' },
  stepLabel: { fontSize: 10, fontWeight: '500' },
  formScroll: { flex: 1 },
  formContent: { flexGrow: 1, paddingBottom: 30 },
  formTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginBottom: 7 },
  formHelper: { fontSize: 12, lineHeight: 18, marginBottom: 21 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 13, marginBottom: 18 },
  privacyCard: { borderRadius: 14, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 3 },
  privacyTitle: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  formCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  formChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 9 },
  formChipText: { fontSize: 11, fontWeight: '500' },
  questionInput: { minHeight: 145, paddingTop: 13, lineHeight: 19 },
  characterCount: { fontSize: 10, textAlign: 'right', marginTop: -12, marginBottom: 15 },
  formNext: { marginTop: 16 },
  reviewCard: { borderWidth: 1, borderRadius: 17, padding: 15, marginBottom: 14 },
  reviewRow: { paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E8EFEB' },
  reviewLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.9, marginBottom: 6 },
  reviewValue: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  reviewQuestion: { borderTopWidth: 1, paddingTop: 13, marginTop: 1 },
  successContent: { flexGrow: 1, alignItems: 'stretch', justifyContent: 'center', paddingTop: 20 },
  successMark: { width: 64, height: 64, borderRadius: 32, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  successTitle: { fontSize: 22, textAlign: 'center', fontWeight: '700', marginBottom: 8 },
  successBody: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 20, paddingHorizontal: 12 },
  successId: { fontSize: 14, fontWeight: '700', marginBottom: 14 },
  statusTimeline: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14 },
  statusTimelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
  textButton: { alignItems: 'center', padding: 12 },
  verifiedBanner: { borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, marginBottom: 20 },
  verifiedText: { fontSize: 11, fontWeight: '500', flex: 1 },
  detailCategory: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 15, marginBottom: 12 },
  detailTitle: { fontSize: 23, fontWeight: '700', lineHeight: 29, letterSpacing: -0.5, marginBottom: 17 },
  detailScholar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: '#E1EAE5', marginBottom: 16 },
  scholarAvatarLarge: { height: 45, width: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  answerBodyCard: { borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 12 },
  answerBodyLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  answerBody: { fontSize: 14, lineHeight: 23 },
  referenceCard: { borderRadius: 14, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 18 },
  referenceText: { fontSize: 11, lineHeight: 17, flex: 1 },
  sourceText: { fontSize: 10, lineHeight: 15, marginBottom: 16 },
  detailActions: { flexDirection: 'row', gap: 9, marginBottom: 25 },
  detailActionButton: { flex: 1, minHeight: 45, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  detailActionText: { fontSize: 11, fontWeight: '600' },
  answerDetailContent: { paddingTop: 4, paddingBottom: 28 },
  settingsSectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 7, marginBottom: 7 },
  settingInput: { marginBottom: 14 },
  settingRow: { borderRadius: 16, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingText: { flex: 1 },
  dangerButton: { minHeight: 46, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 },
  tabBar: { minHeight: 62, paddingTop: 9, paddingHorizontal: 13, borderTopWidth: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around' },
  tabItem: { minWidth: 66, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabLabel: { fontSize: 9, fontWeight: '600' },
  activeTabDot: { height: 3, width: 14, borderRadius: 2 },
});
