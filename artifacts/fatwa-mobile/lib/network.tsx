import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/store';

export type NetworkState = 'checking' | 'online' | 'slow' | 'offline';

type NetworkContextValue = { state: NetworkState; retry: () => void };
const NetworkContext = createContext<NetworkContextValue | null>(null);
const HEALTH_URL = `${API_BASE_URL}/api/health`;

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetworkState>('checking');
  const [tick, setTick] = useState(0);
  const check = useCallback(async () => {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(HEALTH_URL, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('offline');
      setState(Date.now() - started > 1800 ? 'slow' : 'online');
    } catch {
      setState('offline');
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), 20_000);
    return () => clearInterval(timer);
  }, [check, tick]);

  const value = useMemo(() => ({ state, retry: () => { setState('checking'); setTick((current) => current + 1); } }), [state]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetworkStatus must be used within NetworkStatusProvider');
  return context;
}
