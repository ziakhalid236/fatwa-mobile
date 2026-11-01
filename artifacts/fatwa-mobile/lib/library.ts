import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/lib/store';

export type Work = {
  id: number; title: string; author: string | null; lang: string | null; genre: string | null; cover?: string | null;
  rights: string; verification: string; source: string | null; sourceUrl: string | null; license: string | null; passages: number;
};
export type Passage = { id: number; ref: string | null; lang: string | null; text: string; url: string | null };
export type Surah = { number: number; name: string; ayat: number };
export type Ayah = { n: number; ar?: string; ur?: string; en?: string };
export type Hit = { id: number; work: string; author: string; ref: string; lang: string; source: string; rights: string; url: string; text: string };

async function get<T>(path: string, cacheKey?: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/library${path}`);
    if (!response.ok) throw new Error(response.status === 429 ? 'Too many searches. Please wait a moment.' : 'Could not load the library. Check your connection.');
    const payload = (await response.json()) as T;
    if (cacheKey) void AsyncStorage.setItem(`@fatwa/library/${cacheKey}`, JSON.stringify(payload));
    return payload;
  } catch (error) {
    if (cacheKey) {
      const cached = await AsyncStorage.getItem(`@fatwa/library/${cacheKey}`);
      if (cached) {
        try { return JSON.parse(cached) as T; } catch { /* discard a corrupted cache entry */ }
      }
    }
    throw error;
  }
}

export const fetchWorks = () => get<{ works: Work[] }>('/works', 'works').then((r) => r.works);
export const fetchWorkPage = (id: number, page: number) => get<{ work: Work; page: number; pages: number; passages: Passage[] }>(`/works/${id}?page=${page}&size=15`, `work-${id}-page-${page}`);
export const fetchSurahs = () => get<{ surahs: Surah[] }>('/quran', 'quran-surahs').then((r) => r.surahs);
export const fetchSurah = (n: number, from: number) => get<{ surah: Surah; from: number; ayat: Ayah[]; next: number | null }>(`/quran/${n}?from=${from}&limit=15`, `quran-${n}-${from}`);
export const searchLibrary = (q: string) => {
  const normalized = q.trim().toLowerCase();
  const cacheKey = `search-${encodeURIComponent(normalized).slice(0, 120)}`;
  return get<{ hits: Hit[] }>(`/search?q=${encodeURIComponent(normalized)}`, cacheKey).then((r) => r.hits);
};

export function rightsLabel(rights: string): { text: string; tone: 'ok' | 'warn' } {
  if (rights === 'open_attribution') return { text: 'Open text · attribution', tone: 'ok' };
  if (rights.startsWith('cc_by_nc')) return { text: 'CC BY-NC-SA · non-commercial', tone: 'warn' };
  if (rights.includes('unverified')) return { text: 'Translation rights unverified', tone: 'warn' };
  if (rights === 'link_only') return { text: 'Link only', tone: 'warn' };
  return { text: 'Rights not confirmed', tone: 'warn' };
}
export const verificationLabel = (v: string) => (v === 'verified' ? 'Scholar-verified' : 'Not yet reviewed by a scholar');
