'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LiveMatch } from '@/components/LiveMatches';

function useFeed(enabled: boolean) {
  const [data, setData] = useState<{ matches: LiveMatch[]; lastUpdated: string | null }>({ matches: [], lastUpdated: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!enabled || pending.current || document.visibilityState === 'hidden') return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(null);
    try {
      // Keep the existing stoppage audit and provider fallbacks; share one response.
      const response = await fetch('/api/live', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]) });
      const payload = await response.json() as { matches?: LiveMatch[]; lastUpdated?: string; error?: string };
      if (!response.ok || payload.error || !Array.isArray(payload.matches)) throw new Error(payload.error || 'Não foi possível atualizar os jogos ao vivo.');
      if (controller.signal.aborted) return;
      const lastUpdated = payload.lastUpdated && Number.isFinite(Date.parse(payload.lastUpdated)) ? payload.lastUpdated : new Date().toISOString();
      setData({ matches: payload.matches, lastUpdated });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Falha ao atualizar os jogos.');
    } finally {
      if (pending.current === controller) { pending.current = null; setLoading(false); }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return () => { pending.current?.abort(); pending.current = null; };
  }, [enabled, refresh]);
  useEffect(() => {
    if (!enabled || !autoRefresh) return;
    const timer = setInterval(() => void refresh(), 25_000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [enabled, autoRefresh, refresh]);
  return { ...data, loading, error, autoRefresh, setAutoRefresh, refresh };
}

const LiveFeedContext = createContext<ReturnType<typeof useFeed> | null>(null);

export function LiveFeedProvider({ children }: { children: ReactNode }) {
  const feed = useFeed(true);
  return <LiveFeedContext.Provider value={feed}>{children}</LiveFeedContext.Provider>;
}

export function useLiveFeed() {
  const shared = useContext(LiveFeedContext);
  const standalone = useFeed(!shared);
  return shared ?? standalone;
}
