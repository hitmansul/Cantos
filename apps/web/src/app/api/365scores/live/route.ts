/**
 * Live matches endpoint — uses Sofascore as primary source (most reliable),
 * with API-Football as secondary source for corner statistics.
 *
 * Sofascore's /sport/football/events/live returns ALL live football matches globally.
 */
import { NextResponse } from 'next/server';
import { apiFootballGet } from '../../utils/apiFootball';

interface LiveMatch {
  id: number;
  minute: number | string;
  statusText: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  competition?: string;
  competitionId: number;
  corners?: { home: number; away: number; total: number };
  liveStats?: LiveStatRow[];
  statsSource?: '365scores' | 'sofascore' | 'api-football';
  source?: string;
  sourceIds?: {
    scores365?: number;
    sofascore?: number;
    apiFootball?: number;
  };
  stoppage?: StoppageInfo;
}

interface StoppageIncident {
  startAt: string;
  endAt?: string;
  durationMs: number;
  reason: string;
  period?: string;
  timeline?: string;
}

interface StoppageInfo {
  totalStoppedMs: number;
  totalStoppedMinutes: number;
  predictedAddedMs: number;
  predictedAddedMinutes: number;
  source:
    | '365scores-actual-play-time'
    | '365scores-sportradar'
    | '365scores-announced-added-time'
    | 'sofascore-announced-added-time'
    | 'api-football-announced-added-time';
  kind?: 'calculated-stoppage' | 'announced-added-time';
  incidents: StoppageIncident[];
}

interface Scores365Game {
  id: number;
  sportId?: number;
  statusGroup?: number;
  statusText?: string;
  gameTime?: number;
  competitionId?: number;
  competitionDisplayName?: string;
  competition?: { name?: string };
  homeCompetitor?: { id?: number; name?: string; score?: number; sportId?: number; countryId?: number };
  awayCompetitor?: { id?: number; name?: string; score?: number; sportId?: number; countryId?: number };
  actualPlayTime?: Scores365ActualPlayTime;
  gameTimeDisplay?: string;
  preciseGameTime?: string;
}

interface Scores365ActualPlayTime {
  title?: string;
  actualTime?: { name?: string; progress?: number };
  totalTime?: { name?: string; progress?: number };
}

interface Scores365Statistic {
  id?: number;
  name?: string;
  competitorId?: number;
  categoryId?: number;
  categoryName?: string;
  isMajor?: boolean;
  value?: number | string;
  order?: number;
  categoryOrder?: number;
}

interface LiveStatRow {
  key: string;
  label: string;
  home: string;
  away: string;
  order: number;
  categoryOrder: number;
  category?: string;
  isMajor?: boolean;
}

interface PlayByPlayMessage {
  Comment?: string;
  LastModified?: string;
  Period?: string;
  Timeline?: string;
}

interface ApiFootballLiveFixture {
  fixture: {
    id: number;
    status: { elapsed?: number; extra?: number; short?: string; long?: string };
  };
  league: { id: number; name: string; country: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
}

interface ApiFootballTeamStatistics {
  team: { id: number; name?: string };
  statistics: Array<{ type: string; value: number | string | null }>;
}

const SCORES365_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

const SCORES365_COUNTRIES: Record<number, string> = {
  18: 'EUA',
  24: 'Suecia',
  25: 'Finlandia',
  51: 'Equador',
  70: 'Etiopia',
  73: 'Camaroes',
  86: 'Coreia do Sul',
  113: 'Bolivia',
  121: 'Uzbequistao',
  146: 'Panama',
  252: 'Aruba',
};

const MAX_STOPPAGE_ENRICHMENT = 24;
const MAX_API_FOOTBALL_STATS_ENRICHMENT = 8;
const LIVE_CACHE_TTL_MS = 45_000;
const STOPPAGE_MIN_DURATION_MS = 15_000;
const STOPPAGE_MAX_OPEN_DURATION_MS = 7 * 60_000;
const STOPPAGE_FETCH_TIMEOUT_MS = 4_500;

let liveResponseCache:
  | {
      expiresAt: number;
      body: {
        matches: LiveMatch[];
        count: number;
        lastUpdated: string;
        sources: { scores365: number; sofascore: number; apiFootball: number };
      };
    }
  | undefined;

const STOPPAGE_START_TERMS = [
  'interrupted',
  'match is stopped',
  'play has been stopped',
  'waits before resuming play',
  'down injured',
  'still down',
  'down on the field',
  'receiving treatment',
  'medical staff',
  'var check',
  'video assistant referee',
  'interromp',
  'paralis',
  'atendimento',
  'lesionado',
  'revisao do var',
  'cheque do var',
];

const STOPPAGE_END_TERMS = [
  'back on his feet',
  'back on her feet',
  'back on the field',
  'play resumes',
  'resume play',
  'back underway',
  'retoma',
  'jogo recomeca',
  'bola volta',
  'de volta ao campo',
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatScores365Competition(game: Scores365Game) {
  const baseName = game.competitionDisplayName ?? game.competition?.name ?? 'Competicao';
  const homeCountry = game.homeCompetitor?.countryId
    ? SCORES365_COUNTRIES[game.homeCompetitor.countryId]
    : undefined;
  const awayCountry = game.awayCompetitor?.countryId
    ? SCORES365_COUNTRIES[game.awayCompetitor.countryId]
    : undefined;
  const sharedCountry = homeCountry && homeCountry === awayCountry ? homeCountry : undefined;

  if (!sharedCountry) return baseName;
  if (normalizeText(baseName).includes(normalizeText(sharedCountry))) return baseName;
  if (baseName.includes('(')) return baseName;

  return `${baseName} (${sharedCountry})`;
}

function matchKey(match: Pick<LiveMatch, 'homeTeam' | 'awayTeam'>) {
  const clean = (value: string) =>
    normalizeText(value)
      .replace(/\b(fc|cf|sc|ac|ec|club|clube|futebol|sport|sporting|real|atletico)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return `${clean(match.homeTeam.name)}-${clean(match.awayTeam.name)}`;
}

function mergeMatch(base: LiveMatch, incoming: LiveMatch): LiveMatch {
  return {
    ...base,
    competition: base.competition ?? incoming.competition,
    competitionId: base.competitionId || incoming.competitionId,
    corners: incoming.corners ?? base.corners,
    liveStats: incoming.liveStats ?? base.liveStats,
    statsSource: incoming.statsSource ?? base.statsSource,
    stoppage: base.stoppage ?? incoming.stoppage,
    sourceIds: {
      ...base.sourceIds,
      ...incoming.sourceIds,
    },
  };
}

function hasTerm(comment: string, terms: string[]) {
  const normalized = normalizeText(comment);
  return terms.some((term) => normalized.includes(term));
}

function toRoundedMinutes(ms: number) {
  return Math.round((ms / 60_000) * 10) / 10;
}

function parseClockMs(value?: string) {
  if (!value) return null;
  const match = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] ? Number(match[3]) : null;
  if (!Number.isFinite(first) || !Number.isFinite(second) || (third !== null && !Number.isFinite(third))) {
    return null;
  }

  const hours = third === null ? 0 : first;
  const minutes = third === null ? first : second;
  const seconds = third === null ? second : third;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function calculateStoppageFromActualPlayTime(
  actualPlayTime?: Scores365ActualPlayTime
): StoppageInfo | undefined {
  const ballInPlayMs = parseClockMs(actualPlayTime?.actualTime?.name ?? actualPlayTime?.title);
  const totalElapsedMs = parseClockMs(actualPlayTime?.totalTime?.name);
  if (ballInPlayMs === null || totalElapsedMs === null) return undefined;

  const totalStoppedMs = totalElapsedMs - ballInPlayMs;
  if (totalStoppedMs < STOPPAGE_MIN_DURATION_MS) return undefined;

  const predictedAddedMs = Math.round(totalStoppedMs * 0.8);
  return {
    totalStoppedMs,
    totalStoppedMinutes: toRoundedMinutes(totalStoppedMs),
    predictedAddedMs,
    predictedAddedMinutes: toRoundedMinutes(predictedAddedMs),
    source: '365scores-actual-play-time',
    kind: 'calculated-stoppage',
    incidents: [],
  };
}

function parseAddedTimeMinutes(value?: string | number | null) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(/\s+/g, '');
  const match = normalized.match(/(?:45|90|105|120)\+(\d{1,2})/);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function calculateAnnouncedAddedTime(
  addedMinutes: number | null,
  source: StoppageInfo['source'],
  reason: string,
  timeline?: string
): StoppageInfo | undefined {
  if (!addedMinutes || addedMinutes <= 0) return undefined;
  const predictedAddedMs = addedMinutes * 60_000;
  return {
    totalStoppedMs: 0,
    totalStoppedMinutes: 0,
    predictedAddedMs,
    predictedAddedMinutes: addedMinutes,
    source,
    kind: 'announced-added-time',
    incidents: [],
  };
}

function statDisplayValue(value: Scores365Statistic['value']) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function parseStatNumber(value: string) {
  const numeric = Number(value.replace('%', '').replace(',', '.').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function statKey(stat: Scores365Statistic) {
  return `${stat.id ?? 'stat'}:${normalizeText(stat.name ?? '')}`;
}

function extractRowsForMatch(stats: Scores365Statistic[], match: LiveMatch): LiveStatRow[] {
  const rows = new Map<string, LiveStatRow>();
  const homeId = match.homeTeam.id;
  const awayId = match.awayTeam.id;

  for (const stat of stats) {
    if (stat.competitorId !== homeId && stat.competitorId !== awayId) continue;

    const key = statKey(stat);
    const current =
      rows.get(key) ??
      ({
        key,
        label: stat.name ?? 'Estatistica',
        home: '-',
        away: '-',
        order: stat.order ?? 999,
        categoryOrder: stat.categoryOrder ?? 999,
        category: stat.categoryName,
        isMajor: stat.isMajor,
      } satisfies LiveStatRow);

    if (stat.competitorId === homeId) current.home = statDisplayValue(stat.value);
    if (stat.competitorId === awayId) current.away = statDisplayValue(stat.value);
    current.isMajor = current.isMajor || stat.isMajor;
    rows.set(key, current);
  }

  return [...rows.values()].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
    return a.label.localeCompare(b.label, 'pt-BR');
  });
}

function extractCornersFromRows(rows: LiveStatRow[]) {
  const cornerRow = rows.find((row) => {
    const label = normalizeText(row.label);
    return label.includes('escanteio') || label.includes('corner');
  });

  if (!cornerRow) return undefined;

  const home = parseStatNumber(cornerRow.home);
  const away = parseStatNumber(cornerRow.away);
  if (home === null || away === null) return undefined;

  return { home, away, total: home + away };
}

function apiFootballStatValue(value: number | string | null) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function extractApiFootballRows(
  stats: ApiFootballTeamStatistics[],
  homeTeamId: number,
  awayTeamId: number
): LiveStatRow[] {
  const rows = new Map<string, LiveStatRow>();

  for (const teamStats of stats) {
    const side = teamStats.team.id === homeTeamId ? 'home' : teamStats.team.id === awayTeamId ? 'away' : null;
    if (!side) continue;

    teamStats.statistics.forEach((stat, index) => {
      const key = normalizeText(stat.type);
      const current =
        rows.get(key) ??
        ({
          key,
          label: stat.type,
          home: '-',
          away: '-',
          order: index,
          categoryOrder: 0,
          category: 'API-Football',
          isMajor: ['corner kicks', 'shots on goal', 'ball possession', 'yellow cards', 'red cards'].includes(key),
        } satisfies LiveStatRow);

      current[side] = apiFootballStatValue(stat.value);
      rows.set(key, current);
    });
  }

  return [...rows.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pt-BR'));
}

async function fetchApiFootballStats(match: LiveMatch): Promise<Pick<LiveMatch, 'corners' | 'liveStats' | 'statsSource'> | null> {
  const response = await apiFootballGet<ApiFootballTeamStatistics[]>('/fixtures/statistics', {
    params: { fixture: match.sourceIds?.apiFootball ?? match.id },
    cache: 'no-store',
    timeoutMs: 8_000,
  });

  const stats = response?.response ?? [];
  if (stats.length === 0) return null;

  const liveStats = extractApiFootballRows(stats, match.homeTeam.id, match.awayTeam.id);
  if (liveStats.length === 0) return null;

  return {
    corners: extractCornersFromRows(liveStats) ?? match.corners,
    liveStats,
    statsSource: 'api-football',
  };
}

async function enrichWithApiFootballStats(matches: LiveMatch[]): Promise<LiveMatch[]> {
  const enrichedMatches = [...matches];
  const candidates = enrichedMatches
    .map((match, index) => ({ match, index }))
    .filter(({ match }) => Boolean(match.sourceIds?.apiFootball))
    .slice(0, MAX_API_FOOTBALL_STATS_ENRICHMENT);

  await Promise.all(
    candidates.map(async ({ match, index }) => {
      const stats = await fetchApiFootballStats(match);
      if (!stats) return;
      enrichedMatches[index] = {
        ...match,
        corners: stats.corners,
        liveStats: stats.liveStats,
        statsSource: stats.statsSource,
      };
    })
  );

  return enrichedMatches;
}

async function enrichWith365Stats(matches: LiveMatch[]): Promise<LiveMatch[]> {
  const ids = [...new Set(matches.map((match) => match.sourceIds?.scores365 ?? match.id))].filter(
    (id) => Number.isFinite(id) && id > 0
  );

  if (ids.length === 0) return matches;

  try {
    const statsRes = await fetchWithTimeout(
      `https://webws.365scores.com/web/game/stats/?appTypeId=5&langId=31&games=${ids.join(',')}`,
      {
        headers: {
          ...SCORES365_HEADERS,
          Referer: 'https://www.365scores.com/pt-br',
          Origin: 'https://www.365scores.com',
        },
        cache: 'no-store',
      }
    );

    if (!statsRes.ok) return matches;

    const data = (await statsRes.json()) as { statistics?: Scores365Statistic[] };
    const stats = data.statistics ?? [];
    if (stats.length === 0) return matches;

    return matches.map((match) => {
      const liveStats = extractRowsForMatch(stats, match);
      if (liveStats.length === 0) return match;

      return {
        ...match,
        corners: extractCornersFromRows(liveStats) ?? match.corners,
        liveStats,
        statsSource: '365scores',
      };
    });
  } catch (err) {
    console.warn('[live/365scores/stats] error:', err);
    return matches;
  }
}

function messageTime(message: PlayByPlayMessage) {
  if (!message.LastModified) return null;
  const timestamp = Date.parse(message.LastModified);
  return Number.isFinite(timestamp) ? timestamp : null;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = STOPPAGE_FETCH_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function calculateStoppageInfo(messages: PlayByPlayMessage[]): StoppageInfo | undefined {
  const sortedMessages = messages
    .map((message) => ({ message, timestamp: messageTime(message) }))
    .filter(
      (entry): entry is { message: PlayByPlayMessage; timestamp: number } =>
        typeof entry.timestamp === 'number' && Boolean(entry.message.Comment)
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  const incidents: StoppageIncident[] = [];
  let openIncident:
    | {
        startMs: number;
        startAt: string;
        reason: string;
        period?: string;
        timeline?: string;
      }
    | undefined;

  for (const entry of sortedMessages) {
    const comment = entry.message.Comment ?? '';

    if (!openIncident && hasTerm(comment, STOPPAGE_START_TERMS)) {
      openIncident = {
        startMs: entry.timestamp,
        startAt: new Date(entry.timestamp).toISOString(),
        reason: comment,
        period: entry.message.Period,
        timeline: entry.message.Timeline,
      };
      continue;
    }

    if (openIncident && hasTerm(comment, STOPPAGE_END_TERMS)) {
      const durationMs = entry.timestamp - openIncident.startMs;
      if (durationMs >= STOPPAGE_MIN_DURATION_MS && durationMs <= STOPPAGE_MAX_OPEN_DURATION_MS) {
        incidents.push({
          startAt: openIncident.startAt,
          endAt: new Date(entry.timestamp).toISOString(),
          durationMs,
          reason: openIncident.reason,
          period: openIncident.period,
          timeline: openIncident.timeline,
        });
      }
      openIncident = undefined;
    }
  }

  if (openIncident) {
    const durationMs = Math.min(Date.now() - openIncident.startMs, STOPPAGE_MAX_OPEN_DURATION_MS);
    if (durationMs >= STOPPAGE_MIN_DURATION_MS) {
      incidents.push({
        startAt: openIncident.startAt,
        durationMs,
        reason: openIncident.reason,
        period: openIncident.period,
        timeline: openIncident.timeline,
      });
    }
  }

  const totalStoppedMs = incidents.reduce((sum, incident) => sum + incident.durationMs, 0);
  if (totalStoppedMs <= 0) return undefined;

  const predictedAddedMs = Math.round(totalStoppedMs * 0.8);
  return {
    totalStoppedMs,
    totalStoppedMinutes: toRoundedMinutes(totalStoppedMs),
    predictedAddedMs,
    predictedAddedMinutes: toRoundedMinutes(predictedAddedMs),
    source: '365scores-sportradar',
    kind: 'calculated-stoppage',
    incidents,
  };
}

async function fetchStoppageInfo(gameId: number): Promise<StoppageInfo | undefined> {
  try {
    const detailRes = await fetchWithTimeout(
      `https://webws.365scores.com/web/game/?appTypeId=5&langId=31&gameId=${gameId}`,
      {
        headers: SCORES365_HEADERS,
        cache: 'no-store',
      }
    );

    if (!detailRes.ok) return undefined;

    const detail = (await detailRes.json()) as {
      game?: {
        actualPlayTime?: Scores365ActualPlayTime;
        playByPlay?: {
          feedURL?: string;
        };
      };
    };

    const fromActualPlayTime = calculateStoppageFromActualPlayTime(detail.game?.actualPlayTime);
    if (fromActualPlayTime) return fromActualPlayTime;

    const feedURL = detail.game?.playByPlay?.feedURL;
    if (!feedURL) return undefined;

    const playByPlayRes = await fetchWithTimeout(feedURL, {
      headers: SCORES365_HEADERS,
      cache: 'no-store',
    });

    if (!playByPlayRes.ok) return undefined;

    const playByPlay = (await playByPlayRes.json()) as { Messages?: PlayByPlayMessage[] };
    return calculateStoppageInfo(playByPlay.Messages ?? []);
  } catch (err) {
    console.warn('[live/365scores/stoppage] error:', err);
    return undefined;
  }
}

async function enrichWithStoppage(matches: LiveMatch[]): Promise<LiveMatch[]> {
  const enrichedMatches = [...matches];
  const limit = Math.min(enrichedMatches.length, MAX_STOPPAGE_ENRICHMENT);

  await Promise.all(
    enrichedMatches.slice(0, limit).map(async (match, index) => {
      const stoppage = await fetchStoppageInfo(match.id);
      if (stoppage) {
        enrichedMatches[index] = { ...match, stoppage };
      }
    })
  );

  return enrichedMatches;
}

async function fetchFrom365Scores(): Promise<LiveMatch[]> {
  try {
    const res = await fetch('https://webws.365scores.com/web/games/?appTypeId=5&langId=31&statuses=2', {
      headers: SCORES365_HEADERS,
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      games?: Scores365Game[];
    };

    const liveMatches = (data.games ?? [])
      .filter((game) => {
        const isFootball = game.sportId === 1 || game.homeCompetitor?.sportId === 1;
        return isFootball && game.statusGroup === 3 && game.homeCompetitor && game.awayCompetitor;
      })
      .map((game) => {
        const displayMinute = game.gameTimeDisplay ?? game.preciseGameTime ?? game.statusText;
        const addedTimeMinutes = parseAddedTimeMinutes(displayMinute);
        const calculatedStoppage = calculateStoppageFromActualPlayTime(game.actualPlayTime);
        const announcedAddedTime = calculateAnnouncedAddedTime(
          addedTimeMinutes,
          '365scores-announced-added-time',
          'Acréscimo anunciado no relógio da 365Scores.',
          displayMinute
        );

        return {
          id: game.id,
          minute:
            displayMinute && addedTimeMinutes
              ? displayMinute
              : typeof game.gameTime === 'number' && game.gameTime >= 0
                ? game.gameTime
                : game.statusText || 'AO VIVO',
          statusText: game.statusText || 'Ao vivo',
          homeTeam: {
            id: game.homeCompetitor?.id ?? 0,
            name: game.homeCompetitor?.name ?? 'Mandante',
            score: Math.max(0, game.homeCompetitor?.score ?? 0),
          },
          awayTeam: {
            id: game.awayCompetitor?.id ?? 0,
            name: game.awayCompetitor?.name ?? 'Visitante',
            score: Math.max(0, game.awayCompetitor?.score ?? 0),
          },
          competition: formatScores365Competition(game),
          competitionId: game.competitionId ?? 0,
          source: '365scores',
          sourceIds: { scores365: game.id },
          stoppage: calculatedStoppage ?? announcedAddedTime,
        };
      });

    const withStats = await enrichWith365Stats(liveMatches);
    return enrichWithStoppage(withStats);
  } catch (err) {
    console.error('[live/365scores] error:', err);
    return [];
  }
}

// ── Sofascore live (primary) ──────────────────────────────────────────────────

async function fetchFromSofascore(): Promise<LiveMatch[]> {
  try {
    const res = await fetch('https://api.sofascore.com/api/v1/sport/football/events/live', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: 'https://www.sofascore.com/',
        Origin: 'https://www.sofascore.com',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn('[live/sofascore] status:', res.status);
      return [];
    }

    const data = (await res.json()) as {
      events?: Array<{
        id: number;
        startTimestamp: number;
        tournament?: {
          name: string;
          uniqueTournament?: { id?: number; name: string };
        };
        homeTeam: { id: number; name: string };
        awayTeam: { id: number; name: string };
        homeScore?: { current?: number; display?: number };
        awayScore?: { current?: number; display?: number };
        status?: { description?: string; type?: string; period?: string };
        time?: { currentPeriodStartTimestamp?: number; played?: number; extra?: number };
      }>;
    };

    const events = data.events ?? [];
    console.log('[live/sofascore] events:', events.length);

    return events.map((ev) => {
      // Calculate elapsed minutes
      let minute: number | string = ev.status?.description ?? 'AO VIVO';
      if (ev.time?.currentPeriodStartTimestamp && ev.status?.period) {
        const elapsed = Math.floor((Date.now() / 1000 - ev.time.currentPeriodStartTimestamp) / 60);
        if (ev.status.period === '1st' || ev.status.period === 'HT') {
          minute = Math.min(45, elapsed);
        } else if (ev.status.period === '2nd') {
          minute = Math.min(90, 45 + elapsed);
        } else if (ev.status.period === 'OT') {
          minute = 90 + elapsed;
        }
      }

      const announcedAddedTime = calculateAnnouncedAddedTime(
        typeof ev.time?.extra === 'number'
          ? ev.time.extra
          : parseAddedTimeMinutes(ev.status?.description),
        'sofascore-announced-added-time',
        'Acréscimo anunciado pelo relógio/status do SofaScore.',
        ev.status?.description
      );

      return {
        id: ev.id,
        minute,
        statusText: ev.status?.description ?? 'Ao vivo',
        homeTeam: {
          id: ev.homeTeam.id,
          name: ev.homeTeam.name,
          score: ev.homeScore?.current ?? ev.homeScore?.display ?? 0,
        },
        awayTeam: {
          id: ev.awayTeam.id,
          name: ev.awayTeam.name,
          score: ev.awayScore?.current ?? ev.awayScore?.display ?? 0,
        },
        competition: ev.tournament?.uniqueTournament?.name ?? ev.tournament?.name ?? 'Competição',
        competitionId: ev.tournament?.uniqueTournament?.id ?? 0,
        source: 'sofascore',
        sourceIds: { sofascore: ev.id },
        stoppage: announcedAddedTime,
      };
    });
  } catch (err) {
    console.error('[live/sofascore] error:', err);
    return [];
  }
}

// ── API-Football live (for corner stats) ──────────────────────────────────────

async function fetchFromApiFootball(): Promise<LiveMatch[]> {
  try {
    const data = await apiFootballGet<ApiFootballLiveFixture[]>('/fixtures', {
      params: { live: 'all' },
      cache: 'no-store',
      timeoutMs: 12_000,
    });

    const matches = (data?.response ?? []).map((item) => {
      const announcedAddedTime = calculateAnnouncedAddedTime(
        typeof item.fixture.status.extra === 'number'
          ? item.fixture.status.extra
          : parseAddedTimeMinutes(item.fixture.status.short ?? item.fixture.status.long),
        'api-football-announced-added-time',
        'Acréscimo anunciado pela API-Football.',
        item.fixture.status.short ?? item.fixture.status.long
      );

      return {
        id: item.fixture.id,
        minute:
          item.fixture.status.extra && item.fixture.status.elapsed
            ? `${item.fixture.status.elapsed}+${item.fixture.status.extra}'`
            : item.fixture.status.elapsed ?? item.fixture.status.short ?? 'AO VIVO',
        statusText: item.fixture.status.long ?? 'Em andamento',
        homeTeam: {
          id: item.teams.home.id,
          name: item.teams.home.name,
          score: item.goals.home ?? 0,
        },
        awayTeam: {
          id: item.teams.away.id,
          name: item.teams.away.name,
          score: item.goals.away ?? 0,
        },
        competition: `${item.league.name} (${item.league.country})`,
        competitionId: item.league.id,
        source: 'api-football',
        sourceIds: { apiFootball: item.fixture.id },
        stoppage: announcedAddedTime,
      };
    });

    return enrichWithApiFootballStats(matches);
  } catch (err) {
    console.error('[live/api-football] error:', err);
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    if (liveResponseCache && liveResponseCache.expiresAt > Date.now()) {
      return NextResponse.json({
        ...liveResponseCache.body,
        cached: true,
      });
    }

    const [scores365Result, sofascoreResult, apiFootballResult] = await Promise.allSettled([
      fetchFrom365Scores(),
      fetchFromSofascore(),
      fetchFromApiFootball(),
    ]);

    const scores365Matches = scores365Result.status === 'fulfilled' ? scores365Result.value : [];
    const sfMatches = sofascoreResult.status === 'fulfilled' ? sofascoreResult.value : [];
    const afMatches = apiFootballResult.status === 'fulfilled' ? apiFootballResult.value : [];

    const allMatches: LiveMatch[] = [];
    const indexByKey = new Map<string, number>();

    const addOrMerge = (match: LiveMatch) => {
      const key = matchKey(match);
      const existingIndex = indexByKey.get(key);
      if (existingIndex === undefined) {
        indexByKey.set(key, allMatches.length);
        allMatches.push(match);
      } else {
        allMatches[existingIndex] = mergeMatch(allMatches[existingIndex], match);
      }
    };

    for (const match of scores365Matches) addOrMerge(match);
    for (const match of sfMatches) addOrMerge(match);
    for (const match of afMatches) addOrMerge(match);

    const body = {
      matches: allMatches,
      count: allMatches.length,
      lastUpdated: new Date().toISOString(),
      sources: {
        scores365: scores365Matches.length,
        sofascore: sfMatches.length,
        apiFootball: afMatches.length,
      },
    };

    liveResponseCache = {
      expiresAt: Date.now() + LIVE_CACHE_TTL_MS,
      body,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error('[live] error:', error);
    return NextResponse.json(
      { matches: [], error: 'Failed to fetch live matches' },
      { status: 500 }
    );
  }
}
