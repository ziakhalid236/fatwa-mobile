import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EmptyState, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { fetchSurah, fetchSurahs, fetchWorkPage, fetchWorks, rightsLabel, searchLibrary, verificationLabel, type Ayah, type Hit, type Passage, type Surah, type Work } from '@/lib/library';
import { useNav } from '@/lib/nav';

const LANG: Record<string, string> = { ar: 'العربية', ur: 'اردو', en: 'English' };
const rtl = (lang?: string | null) => lang === 'ar' || lang === 'ur';

function Badge({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'plain' }) {
  const colors = useColors();
  const bg = tone === 'ok' ? colors.primarySoft : tone === 'warn' ? colors.accent : colors.muted;
  const fg = tone === 'ok' ? colors.primary : tone === 'warn' ? colors.accentForeground : colors.mutedForeground;
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[styles.badgeText, { color: fg }]}>{text}</Text></View>;
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
      <View style={styles.badgeRow}><Badge text={hit.source} tone="plain" /><Badge text={rightsLabel(hit.rights).text} tone={rightsLabel(hit.rights).tone} /></View>
      {open && hit.url ? <Pressable onPress={() => void Linking.openURL(hit.url)}><Text style={{ color: colors.primary, fontWeight: '700', marginTop: 8 }}>Open original source</Text></Pressable> : null}
    </Pressable>
  );
}

export default function LibraryScreen() {
  const colors = useColors();
  const nav = useNav();
  const works = useLoad(fetchWorks, []);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) { setHits(null); return; }
    setSearching(true); setSearchError('');
    try { setHits(await searchLibrary(q)); } catch (e) { setSearchError(e instanceof Error ? e.message : 'Search failed.'); } finally { setSearching(false); }
  };

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
  const fiqh = groups.filter((g) => g.genre !== 'hadith');

  const bookCard = (g: (typeof groups)[number]) => (
    <View key={g.key} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
      <View style={styles.badgeRow}><Badge text={rightsLabel(g.works[0].rights).text} tone={rightsLabel(g.works[0].rights).tone} /></View>
    </View>
  );

  return (
    <View style={uiStyles.screenPadding}>
      <LinearGradient colors={[colors.forestDeep, colors.forest, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon}><MaterialCommunityIcons name="book-open-page-variant" size={22} color={colors.gold} /></View>
        <Text style={styles.heroTitle}>The Library</Text>
        <Text style={styles.heroCopy}>Read the Quran, hadith and classical Hanafi books — and search them in English, اردو or العربية.</Text>
      </LinearGradient>

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
          <Pressable onPress={() => nav.push({ name: 'quranList' })} style={[styles.quranCard, { backgroundColor: colors.card, borderColor: colors.goldSoft }]} accessibilityRole="button" testID="library-quran">
            <View style={[styles.quranIcon, { backgroundColor: colors.primarySoft }]}><MaterialCommunityIcons name="book-open-variant" size={24} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>The Noble Quran</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>114 surahs · Arabic with Urdu (Jalandhry) and English (Sahih International)</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>

          <Status loading={works.loading} error={works.error} retry={works.retry} />
          {hadith.length ? <><SectionTitle title="Hadith" subtitle="Tap a language to start reading" />{hadith.map(bookCard)}</> : null}
          {fiqh.length ? <><SectionTitle title="Hanafi fiqh books" subtitle="Classical texts, searchable by the AI" />{fiqh.map(bookCard)}</> : null}

          <Pressable onPress={() => nav.push({ name: 'fatwaList' })} style={[styles.card, styles.rowCard, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]} accessibilityRole="button">
            <MaterialCommunityIcons name="scale-balance" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Published rulings</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>Reviewed question-and-answer fatwas</Text></View>
            <Feather name="chevron-right" size={20} color={colors.primary} />
          </Pressable>
          <Text style={[styles.note, { color: colors.mutedForeground }]}>Texts come from open sources and are labelled with their license. Most books are not yet reviewed by a scholar. For personal rulings, ask a qualified mufti.</Text>
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
  const rights = w ? rightsLabel(w.rights) : null;
  return (
    <View style={uiStyles.screenPadding}>
      {w ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{w.title}</Text>
          {w.author ? <Text style={[styles.muted, { color: colors.mutedForeground }]}>{w.author}</Text> : null}
          <View style={styles.badgeRow}>
            <Badge text={w.source ?? 'Source'} tone="plain" />
            {rights ? <Badge text={rights.text} tone={rights.tone} /> : null}
            <Badge text={verificationLabel(w.verification)} tone="warn" />
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
  hero: { borderRadius: 26, padding: 20, marginTop: 4, marginBottom: 14, overflow: 'hidden' },
  heroIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  heroCopy: { color: '#D5E7DB', fontSize: 12.5, lineHeight: 19, marginTop: 6, maxWidth: 320 },
  searchBar: { borderWidth: 1, borderRadius: 17, height: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 13.5, height: '100%' },
  card: { borderWidth: 1, borderRadius: 20, padding: 15, marginBottom: 10 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quranCard: { borderWidth: 1.5, borderRadius: 22, padding: 16, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 13 },
  quranIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
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
