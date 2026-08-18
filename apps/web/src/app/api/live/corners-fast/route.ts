import { NextRequest, NextResponse } from 'next/server';

type LiveMatch = {
  id: number;
  minute: number | string;
  corners?: { home: number; away: number; total: number };
  liveStats?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

const MAX_MONITORED_WITH_STATS = 12;
const MAX_FALLBACK_COLLECTING = 3;
const ENRICHED_TIMEOUT_MS = 12_000;

function minuteValue(value: number | string) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const match = String(value).match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  if (!match) return 0;
  return Number(match[1]) + Number(match[2] ?? 0);
}

function hasUsefulStats(match: LiveMatch) {
  return Boolean(match.corners) || (match.liveStats?.length ?? 0) > 0;
}

function priority(match: LiveMatch) {
  const minute = minuteValue(match.minute);
  const usefulWindow = minute >= 15 && minute <= 92 ? 1 : 0;
  const hasCorners = match.corners ? 1 : 0;
  const statsCount = match.liveStats?.length ?? 0;
  return usefulWindow * 10_000 + hasCorners * 1_000 + statsCount * 10 + minute;
}

export async function GET(request: NextRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENRICHED_TIMEOUT_MS);

  try {
    const upstream = new URL('/api/live/enriched', request.nextUrl.origin);
    const response = await fetch(upstream, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });

    const payload = await response.json().catch(() => ({ matches: [] })) as Record<string, unknown> & {
      matches?: LiveMatch[];
      statisticsCoverage?: Record<string, unknown>;
    };

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    const matches = Array.isArray(payload.matches) ? payload.matches : [];
    const sorted = [...matches].sort((a, b) => priority(b) - priority(a));
    const withStats = sorted.filter(hasUsefulStats).slice(0, MAX_MONITORED_WITH_STATS);
    const monitored = withStats.length > 0
      ? withStats
      : sorted.slice(0, MAX_FALLBACK_COLLECTING);

    return NextResponse.json({
      ...payload,
      matches: monitored,
      count: monitored.length,
      lastUpdated: new Date().toISOString(),
      cornerCoverage: {
        total: monitored.length,
        withCorners: monitored.filter((match) => Boolean(match.corners)).length,
        withStatistics: monitored.filter((match) => (match.liveStats?.length ?? 0) > 0).length,
        upstreamTotal: matches.length,
        usefulUpstream: matches.filter(hasUsefulStats).length,
      },
      enrichmentPolicy: 'mvp1-enriched-useful-set-v2',
    });
  } catch (error) {
    return NextResponse.json(
      {
        matches: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Falha ao enriquecer jogos ao vivo',
        enrichmentPolicy: 'mvp1-enriched-useful-set-v2',
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
