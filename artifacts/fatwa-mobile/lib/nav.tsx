import React, { createContext, useContext } from 'react';
import type { PrayerName, TabKey } from '@/lib/types';

export type Route =
  | { name: 'tabs' }
  | { name: 'post'; postId: string }
  | { name: 'postSubmit' }
  | { name: 'shorts'; postId?: string }
  | { name: 'membership' }
  | { name: 'user'; userId: string }
  | { name: 'fatwa'; fatwaId: string }
  | { name: 'ask' }
  | { name: 'fatwaList' }
  | { name: 'quranList' }
  | { name: 'legalIndex' }
  | { name: 'legal'; pageKey: string }
  | { name: 'surah'; number: number; title: string }
  | { name: 'reader'; workId: number; title: string }
  | { name: 'notifications' }
  | { name: 'saved' }
  | { name: 'myQuestions' }
  | { name: 'questionDetail'; questionId: string }
  | { name: 'settings' }
  | { name: 'prayerSettings' }
  | { name: 'prayerDetail'; prayer: PrayerName }
  | { name: 'qiblaSettings' };

export type Nav = {
  tab: TabKey;
  route: Route;
  goTab: (tab: TabKey) => void;
  push: (route: Route) => void;
  back: () => void;
  openAsk: () => void;
};

const NavContext = createContext<Nav | null>(null);

export function NavProvider({ value, children }: { value: Nav; children: React.ReactNode }) {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const context = useContext(NavContext);
  if (!context) throw new Error('useNav must be used within a NavProvider');
  return context;
}
