import { NextRequest, NextResponse } from 'next/server';

type LiveStatRow = {
  key?: string;
  label?: string;
  home?: string;
  away?: string;
};

type LiveMatch = {
  id: number;
  minute: number | string;
  competition?: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  corners?: { home: number; away: number; total: number };
  liveStats?: LiveStatRow[];
  statsSource?: string;
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  [key: string]: unknown;
};

const MAX_MONITORED = 12;
const FALLBACK_MONITORED = 3;

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTeam(value: string) {
  return normalize(value)
    .replace(/\b(football|futebol|club|clube|fc|cf|sc|ac|ec|afc|fk)\b/g, ' ')
    .replace(/\bunder\s*(\d{2})\b/g, 'u$1')
    .replace(/\bu\s+(\d{2})\b/g, 'u$1')
    .replace(/\b(women|woman|feminino|feminina|fem)\b/g, 'women')
    .replace(/\s+/g, ' ')
    .trim();
}

function minuteValue(value: number | string) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const match = String(value).match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  if (!match) return 0;
  return Number(match[1]) + Number(match[2] ?? 0);
}

function hasUsefulLiveData(match: LiveMatch) {
  return Boolean(
    match.corners ||
      (Array.isArray(match.liveStats) && match.liveStats.length > 0)
  );
}

function sameRequestedMatch(match: LiveMatch, eventId: number, home: string, away: string) {
  if (eventId > 0) {
    if (match.id === eventId) return true;
    if (match.sourceIds?.scores365 === eventId) return true;
    if (match.sourceIds?.sofascore === eventId) return true;
    if (match.sourceIds?.apiFootball === eventId) return true;
  }

  if (!home || !away) return false;
  return (
    canonicalTeam(match.homeTeam.name) === canonicalTeam(home) &&
    canonicalTeam(match.awayTeam.name) === canonicalTeam(away)
  );
}

function qualityScore(match: LiveMatch) {
  let score = 0;
  if (match.corners) score += 100;
  if (match.liveStats?.length) score += Math.min(match.liveStats.length, 30) * 3;
  if (match.statsSource === '365scores') score += 15;
  if (match.sourceIds?.scores365) score += 5;

  const minute = minuteValue(match.minute);
  if (minute >= 15 && minute <= 92) score += 10;
  if (minute > 92) score -= 5;
  return score;
}

export async function GET(request: NextRequest) {
  const requestedEventId = Number(request.nextUrl.searchParams.get('eventId') ?? '0');
  const requestedHome = request.nextUrl.searchParams.get('home') ?? '';
  const requestedAway = request.nextUrl.searchParams.get('away') ?? '';

  const rawUrl = new URL('/api/365scores/live', request.nextUrl.origin);
  rawUrl.searchParams.set('raw', '1');

  let payload: Record<string, unknown> & { matches?: LiveMatch[] };
  try {
    const response = await fetch(rawUrl, { cache: 'no-store' });
    payload = (await response.json()) as Record<string, unknown> & { matches?: LiveMatch[] };
    if (!response.ok) return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { matches: [], error: 'Erro ao carregar jogos ao vivo' },
      { status: 502 }
    );
  }

  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  const sorted = [...matches].sort((a, b) => qualityScore(b) - qualityScore(a));
  const useful = sorted.filter(hasUsefulLiveData);

  let monitored: LiveMatch[];
  if (requestedEventId > 0 || (requestedHome && requestedAway)) {
    const requested = sorted.find((match) =>
      sameRequestedMatch(match, requestedEventId, requestedHome, requestedAway)
    );
    monitored = requested ? [requested] : [];
  } else if (useful.length > 0) {
    monitored = useful.slice(0, MAX_MONITORED);
  } else {
    monitored = sorted.slice(0, FALLBACK_MONITORED);
  }

  return NextResponse.json({
    ...payload,
    matches: monitored,
    count: monitored.length,
    lastUpdated: new Date().toISOString(),
    cornerCoverage: {
      total: monitored.length,
      withCorners: monitored.filter((match) => Boolean(match.corners)).length,
      withStats: monitored.filter((match) => Boolean(match.liveStats?.length)).length,
      baseMatches: matches.length,
      usefulBaseMatches: useful.length,
      statsSources: monitored.reduce<Record<string, number>>((acc, match) => {
        const source = match.statsSource ?? 'sem-estatistica';
        acc[source] = (acc[source] ?? 0) + 1;
        return acc;
      }, {}),
    },
    enrichmentPolicy: 'trust-base-live-stats-v1-user-selection-ready',
  });
}
