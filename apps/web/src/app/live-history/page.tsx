'use client';

import { useEffect, useState } from 'react';
import LiveHistoryPageBase from './LiveHistoryPageBase';

type RawSnapshot = Record<string, unknown>;

type RawPair = {
  total: number | null;
};

const historyCache = new Map<string, RawSnapshot[]>();

function numeric(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pairTotal(value: unknown): RawPair {
  if (!value || typeof value !== 'object') return { total: null };
  const item = value as Record<string, unknown>;
  const total = numeric(item.total);
  if (total !== null) return { total };
  const home = numeric(item.home);
  const away = numeric(item.away);
  return { total: home !== null && away !== null ? home + away : null };
}

function minuteNumber(value: unknown) {
  const match = String(value ?? '').match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  if (!match) return 0;
  return Number(match[1]) + Number(match[2] ?? 0);
}

function snapshotKey(snapshot: RawSnapshot) {
  if (typeof snapshot.capturedAt === 'string' && snapshot.capturedAt) return snapshot.capturedAt;
  return [
    snapshot.minute,
    snapshot.homeScore,
    snapshot.awayScore,
    pairTotal(snapshot.corners).total,
    pairTotal(snapshot.shots).total,
    pairTotal(snapshot.dangerousAttacks).total,
  ].join('|');
}

function mergeHistory(previous: RawSnapshot[], incoming: RawSnapshot[]) {
  const merged = new Map<string, RawSnapshot>();
  for (const snapshot of [...previous, ...incoming]) merged.set(snapshotKey(snapshot), snapshot);
  return [...merged.values()]
    .sort((a, b) => {
      const left = typeof a.capturedAt === 'string' ? Date.parse(a.capturedAt) : 0;
      const right = typeof b.capturedAt === 'string' ? Date.parse(b.capturedAt) : 0;
      return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
    })
    .slice(-12);
}

function delta(latest: RawSnapshot, baseline: RawSnapshot, field: 'corners' | 'shots' | 'dangerousAttacks') {
  const current = pairTotal(latest[field]).total;
  const previous = pairTotal(baseline[field]).total;
  return current !== null && previous !== null ? current - previous : 0;
}

function deriveTrend(history: RawSnapshot[]) {
  if (history.length < 2) {
    return {
      pace: 'insufficient-data',
      cornersDelta: 0,
      shotsDelta: 0,
      dangerousAttacksDelta: 0,
      stoppedMinutesDelta: 0,
    };
  }

  const latest = history.at(-1)!;
  const latestMinute = minuteNumber(latest.minute);
  const candidates = history.filter((snapshot) => latestMinute - minuteNumber(snapshot.minute) <= 10);
  const baseline = candidates[0] ?? history[0];
  const cornersDelta = delta(latest, baseline, 'corners');
  const shotsDelta = delta(latest, baseline, 'shots');
  const dangerousAttacksDelta = delta(latest, baseline, 'dangerousAttacks');
  const activity = Math.max(cornersDelta, 0) * 3 + Math.max(shotsDelta, 0) + Math.max(dangerousAttacksDelta, 0) * 0.25;
  const pace = candidates.length < 2
    ? 'insufficient-data'
    : activity >= 8
      ? 'accelerating'
      : activity <= 1
        ? 'cooling'
        : 'stable';

  return {
    pace,
    cornersDelta,
    shotsDelta,
    dangerousAttacksDelta,
    stoppedMinutesDelta: 0,
  };
}

function enrichMatch(value: unknown) {
  if (!value || typeof value !== 'object') return value;
  const match = value as Record<string, unknown>;
  const id = String(match.id ?? '');
  if (!id) return match;

  const incoming = Array.isArray(match.engineHistory)
    ? match.engineHistory.filter((item): item is RawSnapshot => Boolean(item) && typeof item === 'object')
    : [];
  const history = mergeHistory(historyCache.get(id) ?? [], incoming);
  historyCache.set(id, history);

  return {
    ...match,
    engineHistory: history,
    engineTrend: deriveTrend(history),
  };
}

function inputUrl(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function isCentralRequest(input: RequestInfo | URL) {
  return inputUrl(input).includes('/api/live/central?');
}

function forceCentralRefresh(input: RequestInfo | URL): RequestInfo | URL {
  if (!isCentralRequest(input)) return input;
  if (typeof input !== 'string' && !(input instanceof URL)) return input;

  const url = new URL(inputUrl(input), window.location.origin);
  url.searchParams.set('refresh', '1');
  return url;
}

export default function LiveHistoryPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const effectiveInput = forceCentralRefresh(input);
      const response = await originalFetch(effectiveInput, init);
      if (!response.ok || !isCentralRequest(effectiveInput)) return response;

      try {
        const data = await response.clone().json() as Record<string, unknown>;
        if (!Array.isArray(data.matches)) return response;
        const enriched = { ...data, matches: data.matches.map(enrichMatch) };
        const headers = new Headers(response.headers);
        headers.set('content-type', 'application/json');
        headers.delete('content-length');
        return new Response(JSON.stringify(enriched), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch {
        return response;
      }
    };

    window.fetch = wrappedFetch;
    setReady(true);

    return () => {
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    };
  }, []);

  if (!ready) {
    return <main className="mx-auto w-full max-w-7xl px-4 py-6 text-sm text-muted-foreground">Preparando acompanhamento ao vivo...</main>;
  }

  return <LiveHistoryPageBase />;
}
