import { NextRequest, NextResponse } from 'next/server';

const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
};

type JsonObject = Record<string, unknown>;

async function tryFetch(url: string) {
  try {
    const res = await fetch(url, { headers: HEADERS, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as JsonObject;
  } catch {
    return null;
  }
}

function validScore(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeEvent(raw: unknown) {
  const event = { ...(raw as JsonObject) };
  const homeScore = { ...((event.homeScore as JsonObject | undefined) ?? {}) };
  const awayScore = { ...((event.awayScore as JsonObject | undefined) ?? {}) };

  const homeCurrent = validScore(homeScore.current);
  const homeDisplay = validScore(homeScore.display);
  const awayCurrent = validScore(awayScore.current);
  const awayDisplay = validScore(awayScore.display);

  if (homeCurrent === undefined) delete homeScore.current;
  if (homeDisplay === undefined) delete homeScore.display;
  if (awayCurrent === undefined) delete awayScore.current;
  if (awayDisplay === undefined) delete awayScore.display;

  return { ...event, homeScore, awayScore };
}

function hasValidFinalScore(raw: unknown) {
  const event = raw as {
    homeScore?: { current?: number; display?: number };
    awayScore?: { current?: number; display?: number };
  };
  const home = validScore(event.homeScore?.current) ?? validScore(event.homeScore?.display);
  const away = validScore(event.awayScore?.current) ?? validScore(event.awayScore?.display);
  return home !== undefined && away !== undefined;
}

async function resolveSeasonId(tournamentId: string, requestedSeasonId: string | null) {
  const seasons = await tryFetch(`${SOFASCORE_BASE}/unique-tournament/${tournamentId}/seasons`);
  const list = Array.isArray(seasons?.seasons) ? (seasons?.seasons as JsonObject[]) : [];
  const currentYear = new Date().getFullYear();

  const preferred =
    list.find((season) => season.isCurrent === true) ??
    list.find((season) => Number(season.year) === currentYear) ??
    list.find((season) => String(season.name ?? '').includes(String(currentYear))) ??
    list[0];

  const resolved = preferred?.id;
  if (typeof resolved === 'number' || typeof resolved === 'string') return String(resolved);
  return requestedSeasonId || '58766';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;
  const { searchParams } = new URL(request.url);
  const seasonId = await resolveSeasonId(tournamentId, searchParams.get('seasonId'));
  const base = `${SOFASCORE_BASE}/unique-tournament/${tournamentId}/season/${seasonId}`;

  const [lastPage0, lastPage1, lastPage2] = await Promise.all([
    tryFetch(`${base}/events/last/0`),
    tryFetch(`${base}/events/last/1`),
    tryFetch(`${base}/events/last/2`),
  ]);

  const seen = new Set<number>();
  const allEvents: unknown[] = [];

  for (const source of [lastPage0, lastPage1, lastPage2]) {
    const events = Array.isArray(source?.events) ? (source?.events as unknown[]) : [];
    for (const raw of events) {
      const id = Number((raw as { id?: number }).id);
      if (!id || seen.has(id) || !hasValidFinalScore(raw)) continue;
      seen.add(id);
      allEvents.push(normalizeEvent(raw));
    }
  }

  allEvents.sort((a, b) => {
    const ta = Number((a as { startTimestamp?: number }).startTimestamp ?? 0);
    const tb = Number((b as { startTimestamp?: number }).startTimestamp ?? 0);
    return tb - ta;
  });

  return NextResponse.json({ events: allEvents, seasonId });
}
