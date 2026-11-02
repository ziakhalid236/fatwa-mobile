import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StarPattern } from '@/components/Art';
import { EmptyState, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { fetchSurah, fetchSurahs, fetchWorkPage, fetchWorks, searchLibrary, type Ayah, type Hit, type Passage, type Surah, type Work } from '@/lib/library';
import { useNav } from '@/lib/nav';

const LANG: Record<string, string> = { ar: 'العربية', ur: 'اردو', en: 'English' };
const rtl = (lang?: string | null) => lang === 'ar' || lang === 'ur';
const QURAN_COVER = require('../assets/images/quran-cover.jpg');
const CONTINUE_READING_KEY = '@fatwa/library/continue-reading';
type ContinueReading =
  | { kind: 'quran'; number: number; from: number; title: string; updatedAt: number }
  | { kind: 'book'; workId: number; page: number; title: string; updatedAt: number };

function saveContinueReading(value: ContinueReading) {
  void AsyncStorage.setItem(CONTINUE_READING_KEY, JSON.stringify(value)).catch(() => undefined);
}

function Badge({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'plain' }) {
  const colors = useColors();
  const bg = tone === 'ok' ? colors.primarySoft : tone === 'warn' ? colors.accent : colors.muted;
  const fg = tone === 'ok' ? colors.primary : tone === 'warn' ? colors.accentForeground : colors.mutedForeground;
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[styles.badgeText, { color: fg }]}>{text}</Text></View>;
}

const COVERS: [string, string][] = [['#0f4c3a', '#1f7a5c'], ['#5b3a12', '#a8741f'], ['#1d3557', '#3a6ea5'], ['#4a1d3d', '#8b3a73'], ['#3b3b1f', '#7a7a2e'], ['#23403f', '#2f8f83']];
function BookCover({ title, genre, uri }: { title: string; genre: string; uri?: string | null }) {
  const colors = useColors();
  if (uri) return <Image source={{ uri }} style={styles.cover} resizeMode="cover" />;
  let h = 0; for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = COVERS[h % COVERS.length];
  const arabic = title.split('—')[0].trim();
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
      <StarPattern color="#FFFFFF" opacity={0.14} size={20} stroke={0.8} />
      <View style={styles.coverFrame}>
        <MaterialCommunityIcons name={genre === 'hadith' ? 'format-quote-open' : 'book-open-page-variant'} size={14} color={colors.gold} />
        <Text style={styles.coverText} numberOfLines={4}>{arabic}</Text>
      </View>
    </LinearGradient>
  );
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    load().then((v) => { if (live) setData(v); }).catch((e) => { if (live) setError(e instanceof Error ? e.message : 'Could not load.'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, retry: () => setTick((t) => t + 1) };
}

function Status({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  const colors = useColors();
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!error) return null;
  return (
    <View style={styles.center}>
      <Text style={[styles.muted, { color: colors.mutedForeground }]}>{error}</Text>
      <Pressable onPress={retry} style={[styles.retry, { borderColor: colors.border }]} accessibilityRole="button"><Text style={{ color: colors.primary, fontWeight: '700' }}>Try again</Text></Pressable>
    </View>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const colors = useColors();
  const [jump, setJump] = useState('');
  const go = () => { const n = parseInt(jump, 10); if (n >= 1 && n <= pages) onPage(n); setJump(''); };
  return (
    <View style={styles.pager}>
      <Pressable disabled={page <= 1} onPress={() => onPage(page - 1)} style={[styles.pageBtn, { borderColor: colors.border, opacity: page <= 1 ? 0.4 : 1 }]} accessibilityRole="button" accessibilityLabel="Previous page"><Feather name="chevron-left" size={18} color={colors.foreground} /></Pressable>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={[styles.pageText, { color: colors.foreground }]}>Page {page} of {pages.toLocaleString()}</Text>
        <TextInput value={jump} onChangeText={setJump} onSubmitEditing={go} keyboardType="number-pad" placeholder="Go to…" placeholderTextColor={colors.mutedForeground} style={[styles.jump, { color: colors.foreground, borderColor: colors.border }]} />
      </View>
      <Pressable disabled={page >= pages} onPress={() => onPage(page + 1)} style={[styles.pageBtn, { borderColor: colors.border, opacity: page >= pages ? 0.4 : 1 }]} accessibilityRole="button" accessibilityLabel="Next page"><Feather name="chevron-right" size={18} color={colors.foreground} /></Pressable>
    </View>
  );
}

function HitCard({ hit }: { hit: Hit }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen(!open)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={open ? undefined : 2}>{hit.work}</Text>
      <Text style={[styles.muted, { color: colors.mutedForeground }]} numberOfLines={1}>{hit.ref}</Text>
      <Text style={[rtl(hit.lang) ? styles.bodyRtl : styles.body, { color: colors.foreground }]} numberOfLines={open ? undefined : 4}>{hit.text}</Text>
      <View style={styles.badgeRow}><Badge text={hit.source} tone="plain" /></View>
      {open && hit.url ? <Pressable onPress={() => void Linking.openURL(hit.url)}><Text style={{ color: colors.primary, fontWeight: '700', marginTop: 8 }}>Open original source</Text></Pressable> : null}
    </Pressable>
  );
}

export default function LibraryScreen() {
  const colors = useColors();
  const nav = useNav();
  const works = useLoad(fetchWorks, []);
  const [continueReading, setContinueReading] = useState<ContinueReading | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits(null); return; }
    const timer = setTimeout(() => void runSearch(), 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) { setHits(null); return; }
    setSearching(true); setSearchError('');
    try { setHits(await searchLibrary(q)); } catch (e) { setSearchError(e instanceof Error ? e.message : 'Search failed.'); } finally { setSearching(false); }
  };

  useEffect(() => {
    void AsyncStorage.getItem(CONTINUE_READING_KEY).then((raw) => {
      if (!raw) return;
      try {
        const value = JSON.parse(raw) as ContinueReading;
        if ((value.kind === 'quran' && Number.isFinite(value.number) && Number.isFinite(value.from)) || (value.kind === 'book' && Number.isFinite(value.workId) && Number.isFinite(value.page))) setContinueReading(value);
      } catch {
        // Ignore a corrupted progress record.
      }
    });
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; author: string; genre: string; works: Work[] }>();
    for (const w of works.data ?? []) {
      if (w.genre === 'quran') continue;
      const key = `${w.genre}|${w.author ?? w.title}`;
      const g = map.get(key) ?? { key, author: w.genre === 'hadith' ? w.author ?? w.title : w.title.replace(/\s—.*$/, '') + (w.title.includes('—') ? ' — ' + w.title.split('—').pop()!.trim() : ''), genre: w.genre ?? 'other', works: [] };
      g.works.push(w); map.set(key, g);
    }
    return [...map.values()];
  }, [works.data]);
  const hadith = groups.filter((g) => g.genre === 'hadith');
  const guidance = groups.filter((g) => g.genre === 'hadith_book' || g.genre === 'tasawwuf');
  const tafsir = groups.filter((g) => g.genre === 'tafsir' || g.genre === 'seerah');
  const fiqh = groups.filter((g) => !['hadith', 'hadith_book', 'tasawwuf', 'tafsir', 'seerah'].includes(g.genre));

  const bookCard = (g: (typeof groups)[number]) => (
    <View key={g.key} style={[styles.card, styles.bookRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <BookCover title={g.works[0].title} genre={g.genre} uri={g.works.find((w) => w.cover)?.cover} />
      <View style={{ flex: 1, gap: 8 }}>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{g.author}</Text>
      {g.works[0].author && g.genre !== 'hadith' ? <Text style={[styles.muted, { color: colors.mutedForeground }]} numberOfLines={2}>{g.works[0].author}</Text> : null}
      <View style={styles.badgeRow}>
        {g.works.map((w) => (
          <Pressable key={w.id} onPress={() => nav.push({ name: 'reader', workId: w.id, title: w.title })} style={[styles.langChip, { borderColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`Read ${w.title}`}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{LANG[w.lang ?? ''] ?? w.lang}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 10.5 }}>{w.passages.toLocaleString()}</Text>
          </Pressable>
        ))}
      </View>
      </View>
    </View>
  );

  return (
    <View style={uiStyles.screenPadding}>
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput value={query} onChangeText={(t) => { setQuery(t); if (!t) setHits(null); }} onSubmitEditing={() => void runSearch()} returnKeyType="search" placeholder="Search all books, any language" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} accessibilityLabel="Search the library" testID="library-search" />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : <Pressable onPress={() => void runSearch()} accessibilityRole="button" accessibilityLabel="Search"><Feather name="arrow-right-circle" size={21} color={colors.primary} /></Pressable>}
      </View>

      {searchError ? <Text style={[styles.muted, { color: colors.destructive }]}>{searchError}</Text> : null}
      {hits ? (
        <>
          <SectionTitle title="Results" subtitle={`${hits.length} passages found`} action="Clear" onAction={() => { setHits(null); setQuery(''); }} />
          {hits.length ? hits.map((h) => <HitCard key={h.id} hit={h} />) : <EmptyState icon="search" title="Nothing found" copy="Try different words or another language." />}
        </>
      ) : (
        <>
          <Pressable onPress={() => nav.push({ name: 'shorts' })} style={[styles.card, styles.rowCard, { backgroundColor: colors.forest, borderColor: colors.forest }]} accessibilityRole="button" accessibilityLabel="Watch community videos">
            <View style={styles.shortsIcon}><Feather name="play" size={17} color="#0B6B53" /></View>
            <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>Community Shorts</Text><Text style={[styles.muted, { color: '#D5E7DB' }]}>Watch quick reminders from the community</Text></View>
            <Feather name="chevron-right" size={20} color="#FFFFFF" />
          </Pressable>
          {continueReading ? (
            <Pressable
              onPress={() => continueReading.kind === 'quran'
                ? nav.push({ name: 'surah', number: continueReading.number, title: continueReading.title })
                : nav.push({ name: 'reader', workId: continueReading.workId, title: continueReading.title })}
              style={[styles.continueCard, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}
              accessibilityRole="button"
              accessibilityLabel={`Continue reading ${continueReading.title}`}
            >
              <View style={[styles.continueIcon, { backgroundColor: colors.primary }]}><Feather name="book-open" size={17} color={colors.primaryForeground} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.continueEyebrow, { color: colors.primary }]}>CONTINUE READING</Text>
                <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{continueReading.title}</Text>
                <Text style={[styles.muted, { color: colors.mutedForeground }]}>{continueReading.kind === 'quran' ? `Page ${Math.floor((continueReading.from - 1) / 15) + 1}` : `Page ${continueReading.page}`}</Text>
              </View>
              <Feather name="arrow-right" size={19} color={colors.primary} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => nav.push({ name: 'quranList' })} style={[styles.quranCard, { backgroundColor: colors.card, borderColor: colors.goldSoft }]} accessibilityRole="button" testID="library-quran">
            <Image source={QURAN_COVER} style={styles.quranCover} accessibilityLabel="Quran Majeed cover" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>قرآن مجید</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>The Holy Quran · 114 سورتیں</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>Arabic with Urdu (Jalandhry) and English</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>

          <Status loading={works.loading} error={works.error} retry={works.retry} />
          {hadith.length ? <><SectionTitle title="Hadith" subtitle="Tap a language to start reading" />{hadith.map(bookCard)}</> : null}
          {guidance.length ? <><SectionTitle title="Hadith books & spiritual guidance" subtitle="Riyad as-Salihin, Bulugh al-Maram, Adhkar, Ihya" />{guidance.map(bookCard)}</> : null}
          {tafsir.length ? <><SectionTitle title="Tafsir & Seerah" subtitle="Commentary on the Quran and the life of the Prophet" />{tafsir.map(bookCard)}</> : null}
          {fiqh.length ? <><SectionTitle title="Hanafi fiqh books" subtitle="Classical texts, searchable by the AI" />{fiqh.map(bookCard)}</> : null}

          <Pressable onPress={() => nav.push({ name: 'fatwaList' })} style={[styles.card, styles.rowCard, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]} accessibilityRole="button">
            <MaterialCommunityIcons name="scale-balance" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Published rulings</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>Reviewed question-and-answer fatwas</Text></View>
            <Feather name="chevron-right" size={20} color={colors.primary} />
          </Pressable>
        </>
      )}
    </View>
  );
}

export function QuranListScreen() {
  const colors = useColors();
  const nav = useNav();
  const surahs = useLoad(fetchSurahs, []);
  const [filter, setFilter] = useState('');
  const list = (surahs.data ?? []).filter((s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || String(s.number) === filter.trim());
  return (
    <View style={uiStyles.screenPadding}>
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput value={filter} onChangeText={setFilter} placeholder="Find a surah by name or number" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} accessibilityLabel="Find a surah" />
      </View>
      <Status loading={surahs.loading} error={surahs.error} retry={surahs.retry} />
      {list.map((s: Surah) => (
        <Pressable key={s.number} onPress={() => nav.push({ name: 'surah', number: s.number, title: s.name })} style={[styles.card, styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" testID={`surah-${s.number}`}>
          <View style={[styles.num, { backgroundColor: colors.primarySoft }]}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{s.number}</Text></View>
          <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{s.name}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{s.ayat} ayat</Text></View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      ))}
    </View>
  );
}

export function SurahScreen({ number }: { number: number }) {
  const colors = useColors();
  const [from, setFrom] = useState(1);
  const [showUr, setShowUr] = useState(true);
  const [showEn, setShowEn] = useState(true);
  const page = useLoad(() => fetchSurah(number, from), [number, from]);
  const s = page.data?.surah;
  const pages = s ? Math.ceil(s.ayat / 15) : 1;
  useEffect(() => {
    saveContinueReading({ kind: 'quran', number, from, title: s?.name ?? `Surah ${number}`, updatedAt: Date.now() });
  }, [from, number, s?.name]);
  return (
    <View style={uiStyles.screenPadding}>
      <View style={[styles.surahHead, { backgroundColor: colors.forest }]}>
        <Text style={styles.surahName}>{s?.name ?? '…'}</Text>
        <Text style={styles.surahMeta}>Surah {number}{s ? ` · ${s.ayat} ayat` : ''}</Text>
      </View>
      <View style={styles.badgeRow}>
        {([['ur', showUr, setShowUr], ['en', showEn, setShowEn]] as const).map(([k, on, set]) => (
          <Pressable key={k} onPress={() => set(!on)} style={[styles.langChip, { borderColor: colors.primary, backgroundColor: on ? colors.primary : 'transparent' }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <Text style={{ color: on ? colors.primaryForeground : colors.primary, fontWeight: '800', fontSize: 12 }}>{LANG[k]}</Text>
          </Pressable>
        ))}
      </View>
      <Status loading={page.loading} error={page.error} retry={page.retry} />
      {!page.loading && page.data ? page.data.ayat.map((a: Ayah) => (
        <View key={a.n} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.num, { backgroundColor: colors.primarySoft, marginBottom: 8 }]}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>{number}:{a.n}</Text></View>
          <Text style={[styles.arabic, { color: colors.foreground }]}>{a.ar}</Text>
          {showUr && a.ur ? <Text style={[styles.urdu, { color: colors.foreground }]}>{a.ur}</Text> : null}
          {showEn && a.en ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{a.en}</Text> : null}
        </View>
      )) : null}
      {s ? <Pager page={Math.floor((from - 1) / 15) + 1} pages={pages} onPage={(p) => setFrom((p - 1) * 15 + 1)} /> : null}
      <Text style={[styles.note, { color: colors.mutedForeground }]}>Arabic and translations via Tanzil / alquran.cloud (open, with attribution). Urdu: Fateh Muhammad Jalandhry. English: Sahih International.</Text>
    </View>
  );
}

export function ReaderScreen({ workId }: { workId: number }) {
  const colors = useColors();
  const [page, setPage] = useState(1);
  const data = useLoad(() => fetchWorkPage(workId, page), [workId, page]);
  const w = data.data?.work;
  useEffect(() => {
    if (w) saveContinueReading({ kind: 'book', workId, page, title: w.title, updatedAt: Date.now() });
  }, [page, w, workId]);
  return (
    <View style={uiStyles.screenPadding}>
      {w ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{w.title}</Text>
          {w.author ? <Text style={[styles.muted, { color: colors.mutedForeground }]}>{w.author}</Text> : null}
          <View style={styles.badgeRow}>
            <Badge text={w.source ?? 'Source'} tone="plain" />
          </View>
          {w.license ? <Text style={[styles.note, { color: colors.mutedForeground, marginTop: 8 }]}>{w.license}</Text> : null}
        </View>
      ) : null}
      <Status loading={data.loading} error={data.error} retry={data.retry} />
      {!data.loading && data.data ? data.data.passages.map((p: Passage) => (
        <View key={p.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {p.ref ? <Text style={[styles.ref, { color: colors.primary }]}>{p.ref}</Text> : null}
          <Text style={rtl(p.lang) ? (p.lang === 'ur' ? styles.urduBody : styles.bodyRtl) : styles.body} selectable>{p.text}</Text>
          {p.url ? <Pressable onPress={() => void Linking.openURL(p.url!)}><Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: '700', marginTop: 8 }}>Source link</Text></Pressable> : null}
        </View>
      )) : null}
      {data.data ? <Pager page={page} pages={data.data.pages} onPage={(p) => setPage(p)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bookRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cover: { width: 68, height: 96, borderRadius: 8, overflow: 'hidden', justifyContent: 'center' },
  coverFrame: { flex: 1, margin: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 5, alignItems: 'center', justifyContent: 'center', padding: 4, gap: 4 },
  coverText: { color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center', lineHeight: 16 },
  hero: { borderRadius: 26, padding: 20, marginTop: 4, marginBottom: 14, overflow: 'hidden' },
  heroIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  heroCopy: { color: '#D5E7DB', fontSize: 12.5, lineHeight: 19, marginTop: 6, maxWidth: 320 },
  searchBar: { borderWidth: 1, borderRadius: 17, height: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 13.5, height: '100%' },
  card: { borderWidth: 1, borderRadius: 20, padding: 15, marginBottom: 10 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quranCard: { borderWidth: 1.5, borderRadius: 22, padding: 16, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 13 },
  shortsIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  quranCover: { width: 72, height: 72, borderRadius: 18 },
  continueCard: { borderRadius: 20, padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  continueIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  continueEyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  cardTitle: { fontSize: 14.5, fontWeight: '700', marginBottom: 3 },
  muted: { fontSize: 11.5, lineHeight: 17 },
  body: { fontSize: 14, lineHeight: 22, marginTop: 6 },
  bodyRtl: { fontSize: 18, lineHeight: 32, marginTop: 6, textAlign: 'right', writingDirection: 'rtl' },
  urduBody: { fontSize: 17, lineHeight: 34, marginTop: 6, textAlign: 'right', writingDirection: 'rtl' },
  arabic: { fontSize: 24, lineHeight: 44, textAlign: 'right', writingDirection: 'rtl' },
  urdu: { fontSize: 17, lineHeight: 34, textAlign: 'right', writingDirection: 'rtl', marginTop: 10 },
  ref: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  langChip: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 7, alignItems: 'center' },
  num: { minWidth: 34, height: 28, borderRadius: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  center: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  retry: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  pageBtn: { width: 46, height: 46, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pageText: { fontSize: 12.5, fontWeight: '700' },
  jump: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, minWidth: 80, textAlign: 'center' },
  note: { fontSize: 11, lineHeight: 16, marginTop: 8, marginBottom: 12 },
  surahHead: { borderRadius: 22, padding: 18, alignItems: 'center', marginBottom: 4 },
  surahName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  surahMeta: { color: '#D5E7DB', fontSize: 12, marginTop: 4 },
});
