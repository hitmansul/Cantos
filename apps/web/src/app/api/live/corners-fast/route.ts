import { NextRequest, NextResponse } from 'next/server';
import { apiFootballGet } from '../../utils/apiFootball';

type LiveStatRow = { key?: string; label?: string; home?: string; away?: string };
type LiveMatch = {
  id: number;
  minute: number | string;
  statusText?: string;
  competition?: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  corners?: { home: number; away: number; total: number };
  liveStats?: LiveStatRow[];
  statsSource?: string;
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  [key: string]: unknown;
};
type ApiFixture = {
  fixture: { id: number; status?: { elapsed?: number | null; extra?: number | null } };
  teams: { home: { name: string }; away: { name: string } };
  goals?: { home?: number | null; away?: number | null };
};
type ApiTeamStats = {
  team: { name?: string };
  statistics: Array<{ type: string; value: number | string | null }>;
};

const MAX_MONITORED = 12;
const FALLBACK_MONITORED = 3;
const MAX_FOLLOWED_FALLBACK = 4;
const MIN_TEAM_SIMILARITY = 0.72;
const MIN_FIXTURE_SIMILARITY = 0.8;

function normalize(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function canonicalTeam(value: string) {
  return normalize(value).replace(/\b(football|futebol|club|clube|fc|cf|sc|ac|ec|afc|fk)\b/g, ' ').replace(/\bunder\s*(\d{2})\b/g, 'u$1').replace(/\bu\s+(\d{2})\b/g, 'u$1').replace(/\b(women|woman|feminino|feminina|fem)\b/g, 'women').replace(/\s+/g, ' ').trim();
}
function minuteValue(value: number | string) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const match = String(value).match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  return match ? Number(match[1]) + Number(match[2] ?? 0) : 0;
}
function hasUsefulLiveData(match: LiveMatch) { return Boolean(match.corners || (Array.isArray(match.liveStats) && match.liveStats.length > 0)); }
function sourceIds(match: LiveMatch) { return [match.id, match.sourceIds?.scores365, match.sourceIds?.sofascore, match.sourceIds?.apiFootball].filter((value): value is number => typeof value === 'number' && Number.isFinite(value)); }
function matchesAnyId(match: LiveMatch, ids: Set<number>) { return sourceIds(match).some((id) => ids.has(id)); }
function sameRequestedMatch(match: LiveMatch, eventId: number, home: string, away: string) {
  if (eventId > 0 && sourceIds(match).includes(eventId)) return true;
  return Boolean(home && away && canonicalTeam(match.homeTeam.name) === canonicalTeam(home) && canonicalTeam(match.awayTeam.name) === canonicalTeam(away));
}
function qualityScore(match: LiveMatch) {
  let score = 0;
  if (match.corners) score += 100;
  if (match.liveStats?.length) score += Math.min(match.liveStats.length, 30) * 3;
  if (match.statsSource === '365scores') score += 15;
  if (match.sourceIds?.scores365) score += 5;
  const minute = minuteValue(match.minute);
  if (minute >= 15 && minute <= 92) score += 10;
  if (minute > 120) score -= 25;
  return score;
}
function numeric(value: number | string | null) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace('%', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}
function statValue(rows: ApiTeamStats['statistics'], names: string[]) {
  const wanted = names.map(normalize);
  const row = rows.find((item) => wanted.includes(normalize(item.type)));
  return row ? numeric(row.value) : null;
}
function teamSimilarity(left: string, right: string) {
  const a = canonicalTeam(left);
  const b = canonicalTeam(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if ((a.includes(b) && b.length >= 4) || (b.includes(a) && a.length >= 4)) return 0.92;
  const aTokens = new Set(a.split(' ').filter((token) => token.length > 1));
  const bTokens = new Set(b.split(' ').filter((token) => token.length > 1));
  if (!aTokens.size || !bTokens.size) return 0;
  let common = 0;
  for (const token of aTokens) if (bTokens.has(token)) common += 1;
  return (2 * common) / (aTokens.size + bTokens.size);
}
function fixtureSimilarity(match: LiveMatch, fixture: ApiFixture) {
  const directHome = teamSimilarity(match.homeTeam.name, fixture.teams.home.name);
  const directAway = teamSimilarity(match.awayTeam.name, fixture.teams.away.name);
  const swappedHome = teamSimilarity(match.homeTeam.name, fixture.teams.away.name);
  const swappedAway = teamSimilarity(match.awayTeam.name, fixture.teams.home.name);
  const direct = Math.min(directHome, directAway) >= MIN_TEAM_SIMILARITY ? (directHome + directAway) / 2 : 0;
  const swapped = Math.min(swappedHome, swappedAway) >= MIN_TEAM_SIMILARITY ? (swappedHome + swappedAway) / 2 : 0;
  let score = Math.max(direct, swapped);
  if (score < MIN_FIXTURE_SIMILARITY) return 0;

  const fixtureMinute = Number(fixture.fixture.status?.elapsed ?? 0) + Number(fixture.fixture.status?.extra ?? 0);
  const localMinute = minuteValue(match.minute);
  if (fixtureMinute > 0 && localMinute > 0) {
    const diff = Math.abs(fixtureMinute - localMinute);
    if (diff <= 3) score += 0.04;
    else if (diff > 15) score -= 0.08;
  }

  const homeGoal = fixture.goals?.home;
  const awayGoal = fixture.goals?.away;
  if (typeof homeGoal === 'number' && typeof awayGoal === 'number') {
    const directScore = homeGoal === match.homeTeam.score && awayGoal === match.awayTeam.score;
    const swappedScore = homeGoal === match.awayTeam.score && awayGoal === match.homeTeam.score;
    if (directScore || swappedScore) score += 0.05;
  }
  return score;
}
function findBestFixture(match: LiveMatch, fixtures: ApiFixture[]) {
  let best: { fixture: ApiFixture; score: number } | null = null;
  for (const fixture of fixtures) {
    const score = fixtureSimilarity(match, fixture);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { fixture, score };
  }
  return best?.fixture ?? null;
}
function bestTeamStats(teams: ApiTeamStats[], name: string, fallbackIndex: number) {
  let best: { team: ApiTeamStats; score: number } | null = null;
  for (const team of teams) {
    const score = teamSimilarity(name, team.team.name ?? '');
    if (!best || score > best.score) best = { team, score };
  }
  return best && best.score >= MIN_TEAM_SIMILARITY ? best.team.statistics : teams[fallbackIndex]?.statistics ?? [];
}
async function enrichFollowedFallback(matches: LiveMatch[], followedIds: Set<number>) {
  const targets = matches.filter((match) => matchesAnyId(match, followedIds) && !hasUsefulLiveData(match)).slice(0, MAX_FOLLOWED_FALLBACK);
  if (!targets.length) return matches;
  try {
    const live = await apiFootballGet<ApiFixture[]>('/fixtures', { params: { live: 'all' }, cache: 'no-store', timeoutMs: 8_000 });
    const fixtures = live?.response ?? [];
    const replacements = new Map<number, LiveMatch>();
    await Promise.all(targets.map(async (match) => {
      const fixture = findBestFixture(match, fixtures);
      if (!fixture) return;
      const result = await apiFootballGet<ApiTeamStats[]>('/fixtures/statistics', { params: { fixture: fixture.fixture.id }, cache: 'no-store', timeoutMs: 8_000 });
      const teams = result?.response ?? [];
      if (teams.length < 2) return;
      const homeStats = bestTeamStats(teams, match.homeTeam.name, 0);
      const awayStats = bestTeamStats(teams, match.awayTeam.name, 1);
      const cornersHome = statValue(homeStats, ['Corner Kicks', 'Corners']);
      const cornersAway = statValue(awayStats, ['Corner Kicks', 'Corners']);
      const shotsHome = statValue(homeStats, ['Total Shots']);
      const shotsAway = statValue(awayStats, ['Total Shots']);
      const dangerousHome = statValue(homeStats, ['Dangerous Attacks']);
      const dangerousAway = statValue(awayStats, ['Dangerous Attacks']);
      const liveStats: LiveStatRow[] = [];
      if (cornersHome !== null || cornersAway !== null) liveStats.push({ key: 'corners', label: 'Escanteios', home: String(cornersHome ?? 0), away: String(cornersAway ?? 0) });
      if (shotsHome !== null || shotsAway !== null) liveStats.push({ key: 'shots', label: 'Finalizações', home: String(shotsHome ?? 0), away: String(shotsAway ?? 0) });
      if (dangerousHome !== null || dangerousAway !== null) liveStats.push({ key: 'dangerous-attacks', label: 'Ataques perigosos', home: String(dangerousHome ?? 0), away: String(dangerousAway ?? 0) });
      if (!liveStats.length) return;
      replacements.set(match.id, {
        ...match,
        corners: cornersHome !== null || cornersAway !== null ? { home: cornersHome ?? 0, away: cornersAway ?? 0, total: (cornersHome ?? 0) + (cornersAway ?? 0) } : match.corners,
        liveStats,
        statsSource: 'api-football',
        sourceIds: { ...match.sourceIds, apiFootball: fixture.fixture.id },
      });
    }));
    return matches.map((match) => replacements.get(match.id) ?? match);
  } catch (error) {
    console.warn('[live/followed-fallback] API-Football indisponível.', error);
    return matches;
  }
}

export async function GET(request: NextRequest) {
  const requestedEventId = Number(request.nextUrl.searchParams.get('eventId') ?? '0');
  const requestedHome = request.nextUrl.searchParams.get('home') ?? '';
  const requestedAway = request.nextUrl.searchParams.get('away') ?? '';
  const followedIds = new Set((request.nextUrl.searchParams.get('follow') ?? '').split(',').map(Number).filter((value) => Number.isFinite(value) && value > 0));
  const rawUrl = new URL('/api/365scores/live', request.nextUrl.origin);
  rawUrl.searchParams.set('raw', '1');
  let payload: Record<string, unknown> & { matches?: LiveMatch[] };
  try {
    const response = await fetch(rawUrl, { cache: 'no-store' });
    payload = (await response.json()) as Record<string, unknown> & { matches?: LiveMatch[] };
    if (!response.ok) return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ matches: [], error: 'Erro ao carregar jogos ao vivo' }, { status: 502 });
  }
  let matches = Array.isArray(payload.matches) ? payload.matches : [];
  matches = await enrichFollowedFallback(matches, followedIds);
  const sorted = [...matches].sort((a, b) => qualityScore(b) - qualityScore(a));
  const useful = sorted.filter(hasUsefulLiveData);
  let monitored: LiveMatch[];
  if (requestedEventId > 0 || (requestedHome && requestedAway)) {
    const requested = sorted.find((match) => sameRequestedMatch(match, requestedEventId, requestedHome, requestedAway));
    monitored = requested ? [requested] : [];
  } else {
    const selected = new Map<number, LiveMatch>();
    for (const match of sorted) { if (matchesAnyId(match, followedIds)) selected.set(match.id, match); if (selected.size >= MAX_MONITORED) break; }
    for (const match of useful) { if (selected.size >= MAX_MONITORED) break; selected.set(match.id, match); }
    if (selected.size === 0) for (const match of sorted.slice(0, FALLBACK_MONITORED)) selected.set(match.id, match);
    monitored = [...selected.values()].slice(0, MAX_MONITORED);
  }
  return NextResponse.json({
    ...payload, matches: monitored, count: monitored.length, lastUpdated: new Date().toISOString(),
    cornerCoverage: {
      total: monitored.length,
      withCorners: monitored.filter((match) => Boolean(match.corners)).length,
      withStats: monitored.filter((match) => Boolean(match.liveStats?.length)).length,
      followedRequested: followedIds.size,
      followedFound: monitored.filter((match) => matchesAnyId(match, followedIds)).length,
      followedWithStats: monitored.filter((match) => matchesAnyId(match, followedIds) && hasUsefulLiveData(match)).length,
      baseMatches: matches.length,
      usefulBaseMatches: useful.length,
      statsSources: monitored.reduce<Record<string, number>>((acc, match) => { const source = match.statsSource ?? 'sem-estatistica'; acc[source] = (acc[source] ?? 0) + 1; return acc; }, {}),
    },
    enrichmentPolicy: 'trust-base-live-stats-v4-user-follow-fuzzy-api-football-fallback',
  });
}
