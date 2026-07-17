import { NextRequest, NextResponse } from 'next/server';

type PeriodKey = 'firstHalf' | 'secondHalf';

type StoppageIncident = {
  startAt: string;
  endAt?: string;
  durationMs: number;
  reason: string;
  period?: PeriodKey;
  timeline?: string;
};

type PeriodSummary = {
  totalStoppedMs?: number | null;
  totalStoppedMinutes?: number | null;
  predictedAddedMs?: number | null;
  predictedAddedMinutes?: number | null;
  actualAddedMinutes?: number | null;
  source?: string;
  kind?: string;
  incidents?: StoppageIncident[];
};

type LiveMatch = Record<string, unknown> & {
  id: number;
  minute: number | string;
  statusText: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  competition?: string;
  source?: string;
  statsSource?: string;
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  periodStoppage?: { firstHalf?: PeriodSummary; secondHalf?: PeriodSummary };
  stoppage?: {
    totalStoppedMs?: number | null;
    totalStoppedMinutes?: number | null;
    predictedAddedMs?: number | null;
    predictedAddedMinutes?: number | null;
    actualAddedMinutes?: number | null;
    source?: string;
    kind?: string;
    incidents?: StoppageIncident[];
    periods?: { firstHalf?: PeriodSummary; secondHalf?: PeriodSummary };
  };
};

type PlayByPlayMessage = {
  Comment?: string;
  LastModified?: string;
  Period?: string;
  Timeline?: string;
};

type CacheEntry = { firstHalf?: number; secondHalf?: number; updatedAt: number };

const addedTimeMemory = new Map<string, CacheEntry>();
const MAX_MEMORY_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_STOPPAGE_ENRICHMENT = 14;
const FETCH_TIMEOUT_MS = 4500;
const MIN_STOPPAGE_MS = 15_000;
const MAX_OPEN_STOPPAGE_MS = 8 * 60_000;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://www.365scores.com/pt-br',
  Origin: 'https://www.365scores.com',
};

const START_TERMS = [
  'interrupted',
  'match is stopped',
  'play has been stopped',
  'waits before resuming play',
  'down injured',
  'still down',
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

const END_TERMS = [
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

const TEAM_ALIASES: Record<string, string> = {
  brasil: 'brazil',
  brazil: 'brazil',
  espanha: 'spain',
  spain: 'spain',
  belgica: 'belgium',
  belgium: 'belgium',
  franca: 'france',
  france: 'france',
  marrocos: 'morocco',
  morocco: 'morocco',
  inglaterra: 'england',
  england: 'england',
  noruega: 'norway',
  norway: 'norway',
  egito: 'egypt',
  egypt: 'egypt',
  suica: 'switzerland',
  switzerland: 'switzerland',
  alemanha: 'germany',
  germany: 'germany',
  holanda: 'netherlands',
  netherlands: 'netherlands',
  eua: 'usa',
  usa: 'usa',
  'estados unidos': 'usa',
  'rd congo': 'congo dr',
  'dr congo': 'congo dr',
};

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|ec|club|clube|futebol|sport|sporting|real|atletico)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTeam(value: unknown) {
  const key = normalize(value);
  return TEAM_ALIASES[key] ?? key;
}

function competitionKey(value: unknown) {
  const key = normalize(value);
  if (key.includes('world cup') || key.includes('copa do mundo')) return 'world cup';
  if (key.includes('serie a') && (key.includes('brazil') || key.includes('brasil'))) return 'serie a brazil';
  return key;
}

function matchKey(match: LiveMatch) {
  const teams = [canonicalTeam(match.homeTeam?.name), canonicalTeam(match.awayTeam?.name)].sort();
  return `${competitionKey(match.competition)}__${teams.join('__vs__')}`;
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function roundedMinutes(ms: number) {
  return Math.round((ms / 60_000) * 10) / 10;
}

function periodFromMatch(match: LiveMatch): PeriodKey {
  const raw = normalize(`${match.minute ?? ''} ${match.statusText ?? ''}`);
  if (/2h|2nd|second|segundo/.test(raw)) return 'secondHalf';
  const minute = Number(raw.match(/\d{1,3}/)?.[0]);
  return Number.isFinite(minute) && minute > 45 ? 'secondHalf' : 'firstHalf';
}

function periodFromMessage(message: PlayByPlayMessage): PeriodKey | undefined {
  const raw = normalize(`${message.Period ?? ''} ${message.Timeline ?? ''}`);
  if (/\b(2|2h|2nd|second|segundo|secondhalf)\b/.test(raw)) return 'secondHalf';
  if (/\b(1|1h|1st|first|primeiro|firsthalf|ht|intervalo)\b/.test(raw)) return 'firstHalf';
  const minute = Number(String(message.Timeline ?? '').match(/\d{1,3}/)?.[0]);
  if (!Number.isFinite(minute)) return undefined;
  return minute > 45 ? 'secondHalf' : 'firstHalf';
}

function parseAddedTime(match: LiveMatch, period: PeriodKey) {
  const raw = `${match.minute ?? ''} ${match.statusText ?? ''}`;
  const explicit = raw.match(/(?:45|90|105|120)\s*\+\s*(\d{1,2})/);
  if (explicit) return Number(explicit[1]);
  const minute = typeof match.minute === 'number' ? match.minute : Number(String(match.minute).match(/\d{1,3}/)?.[0]);
  if (!Number.isFinite(minute)) return null;
  if (period === 'firstHalf' && minute > 45 && minute <= 60) return minute - 45;
  if (period === 'secondHalf' && minute > 90 && minute <= 125) return minute - 90;
  return null;
}

function mergeSummary(base?: PeriodSummary, incoming?: PeriodSummary): PeriodSummary | undefined {
  if (!base) return incoming;
  if (!incoming) return base;
  return {
    ...base,
    totalStoppedMs: positive(base.totalStoppedMs) ? base.totalStoppedMs : incoming.totalStoppedMs,
    totalStoppedMinutes: positive(base.totalStoppedMinutes)
      ? base.totalStoppedMinutes
      : incoming.totalStoppedMinutes,
    predictedAddedMs: positive(base.predictedAddedMs) ? base.predictedAddedMs : incoming.predictedAddedMs,
    predictedAddedMinutes: positive(base.predictedAddedMinutes)
      ? base.predictedAddedMinutes
      : incoming.predictedAddedMinutes,
    actualAddedMinutes: positive(base.actualAddedMinutes)
      ? base.actualAddedMinutes
      : incoming.actualAddedMinutes,
    source: base.source ?? incoming.source,
    kind: base.kind ?? incoming.kind,
    incidents:
      (incoming.incidents?.length ?? 0) > (base.incidents?.length ?? 0)
        ? incoming.incidents
        : base.incidents,
  };
}

function currentPeriods(match: LiveMatch) {
  return match.periodStoppage ?? match.stoppage?.periods ?? {};
}

function enrichRememberedAddedTime(match: LiveMatch): LiveMatch {
  const key = matchKey(match);
  const remembered = addedTimeMemory.get(key);
  const period = periodFromMatch(match);
  const inferred = parseAddedTime(match, period);
  const existing = currentPeriods(match);

  const firstHalf = mergeSummary(
    existing.firstHalf,
    positive(remembered?.firstHalf)
      ? { actualAddedMinutes: remembered?.firstHalf, source: 'persistent-live-cache' }
      : undefined
  );
  const secondHalf = mergeSummary(
    existing.secondHalf,
    positive(remembered?.secondHalf)
      ? { actualAddedMinutes: remembered?.secondHalf, source: 'persistent-live-cache' }
      : undefined
  );

  const next = { firstHalf, secondHalf };
  const existingActual = next[period]?.actualAddedMinutes;
  const finalValue = positive(existingActual) ? existingActual : positive(inferred) ? inferred : undefined;

  if (positive(finalValue)) {
    next[period] = mergeSummary(next[period], {
      actualAddedMinutes: finalValue,
      source: positive(existingActual) ? next[period]?.source : 'clock-or-merged-feed',
      kind: 'announced-added-time',
    });
    addedTimeMemory.set(key, {
      firstHalf: period === 'firstHalf' ? finalValue : remembered?.firstHalf,
      secondHalf: period === 'secondHalf' ? finalValue : remembered?.secondHalf,
      updatedAt: Date.now(),
    });
  }

  return { ...match, periodStoppage: next };
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: HEADERS, cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseClockMs(value?: string) {
  if (!value) return null;
  const match = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  const c = match[3] ? Number(match[3]) : null;
  if (![a, b, c ?? 0].every(Number.isFinite)) return null;
  const hours = c === null ? 0 : a;
  const minutes = c === null ? a : b;
  const seconds = c === null ? b : c;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function summaryFromActualPlayTime(actualPlayTime: unknown, period: PeriodKey): PeriodSummary | undefined {
  const value = actualPlayTime as {
    title?: string;
    actualTime?: { name?: string };
    totalTime?: { name?: string };
  } | null;
  if (!value) return undefined;
  const played = parseClockMs(value.actualTime?.name ?? value.title);
  const elapsed = parseClockMs(value.totalTime?.name);
  if (played === null || elapsed === null || elapsed <= played) return undefined;
  const stopped = elapsed - played;
  if (stopped < MIN_STOPPAGE_MS) return undefined;
  return {
    totalStoppedMs: stopped,
    totalStoppedMinutes: roundedMinutes(stopped),
    predictedAddedMs: Math.round(stopped * 0.8),
    predictedAddedMinutes: roundedMinutes(Math.round(stopped * 0.8)),
    actualAddedMinutes: null,
    source: '365scores-actual-play-time',
    kind: 'calculated-stoppage',
    incidents: [],
  };
}

function messageTime(message: PlayByPlayMessage) {
  const parsed = Date.parse(message.LastModified ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function hasTerm(value: string, terms: string[]) {
  const text = normalize(value);
  return terms.some((term) => text.includes(term));
}

function summariesFromMessages(messages: PlayByPlayMessage[]) {
  const sorted = messages
    .map((message) => ({ message, time: messageTime(message) }))
    .filter((item): item is { message: PlayByPlayMessage; time: number } => item.time !== null && Boolean(item.message.Comment))
    .sort((a, b) => a.time - b.time);

  const incidents: StoppageIncident[] = [];
  let open:
    | { start: number; reason: string; period?: PeriodKey; timeline?: string }
    | undefined;

  for (const item of sorted) {
    const comment = item.message.Comment ?? '';
    if (!open && hasTerm(comment, START_TERMS)) {
      open = {
        start: item.time,
        reason: comment,
        period: periodFromMessage(item.message),
        timeline: item.message.Timeline,
      };
      continue;
    }
    if (open && hasTerm(comment, END_TERMS)) {
      const durationMs = item.time - open.start;
      if (durationMs >= MIN_STOPPAGE_MS && durationMs <= MAX_OPEN_STOPPAGE_MS) {
        incidents.push({
          startAt: new Date(open.start).toISOString(),
          endAt: new Date(item.time).toISOString(),
          durationMs,
          reason: open.reason,
          period: open.period,
          timeline: open.timeline,
        });
      }
      open = undefined;
    }
  }

  if (open) {
    const durationMs = Math.min(Date.now() - open.start, MAX_OPEN_STOPPAGE_MS);
    if (durationMs >= MIN_STOPPAGE_MS) {
      incidents.push({
        startAt: new Date(open.start).toISOString(),
        durationMs,
        reason: open.reason,
        period: open.period,
        timeline: open.timeline,
      });
    }
  }

  const result: { firstHalf?: PeriodSummary; secondHalf?: PeriodSummary } = {};
  (['firstHalf', 'secondHalf'] as const).forEach((period) => {
    const periodIncidents = incidents.filter((incident) => incident.period === period);
    const totalStoppedMs = periodIncidents.reduce((sum, incident) => sum + incident.durationMs, 0);
    if (totalStoppedMs <= 0) return;
    result[period] = {
      totalStoppedMs,
      totalStoppedMinutes: roundedMinutes(totalStoppedMs),
      predictedAddedMs: Math.round(totalStoppedMs * 0.8),
      predictedAddedMinutes: roundedMinutes(Math.round(totalStoppedMs * 0.8)),
      actualAddedMinutes: null,
      source: '365scores-sportradar',
      kind: 'calculated-stoppage',
      incidents: periodIncidents,
    };
  });
  return result;
}

async function fetchScores365Stoppage(match: LiveMatch) {
  const gameId = match.sourceIds?.scores365;
  if (!gameId) return match;

  try {
    const detailResponse = await fetchWithTimeout(
      `https://webws.365scores.com/web/game/?appTypeId=5&langId=31&gameId=${gameId}`
    );
    if (!detailResponse.ok) return match;
    const detail = (await detailResponse.json()) as {
      game?: {
        actualPlayTime?: unknown;
        playByPlay?: { feedURL?: string };
      };
    };

    const period = periodFromMatch(match);
    const actualPlaySummary = summaryFromActualPlayTime(detail.game?.actualPlayTime, period);
    let messageSummaries: { firstHalf?: PeriodSummary; secondHalf?: PeriodSummary } = {};

    const feedURL = detail.game?.playByPlay?.feedURL;
    if (feedURL) {
      const feedResponse = await fetchWithTimeout(feedURL);
      if (feedResponse.ok) {
        const feed = (await feedResponse.json()) as { Messages?: PlayByPlayMessage[] };
        messageSummaries = summariesFromMessages(feed.Messages ?? []);
      }
    }

    const existing = currentPeriods(match);
    const firstHalf = mergeSummary(existing.firstHalf, messageSummaries.firstHalf);
    const secondHalf = mergeSummary(existing.secondHalf, messageSummaries.secondHalf);
    const periods = { firstHalf, secondHalf };
    periods[period] = mergeSummary(periods[period], actualPlaySummary);

    const allSummaries = [periods.firstHalf, periods.secondHalf].filter(Boolean) as PeriodSummary[];
    const totalStoppedMs = allSummaries.reduce((sum, summary) => sum + (summary.totalStoppedMs ?? 0), 0);
    const predictedAddedMs = allSummaries.reduce((sum, summary) => sum + (summary.predictedAddedMs ?? 0), 0);
    const incidents = allSummaries.flatMap((summary) => summary.incidents ?? []);

    return {
      ...match,
      periodStoppage: periods,
      stoppage: {
        ...(match.stoppage ?? {}),
        totalStoppedMs: totalStoppedMs || match.stoppage?.totalStoppedMs || null,
        totalStoppedMinutes: totalStoppedMs ? roundedMinutes(totalStoppedMs) : match.stoppage?.totalStoppedMinutes ?? null,
        predictedAddedMs: predictedAddedMs || match.stoppage?.predictedAddedMs || null,
        predictedAddedMinutes: predictedAddedMs
          ? roundedMinutes(predictedAddedMs)
          : match.stoppage?.predictedAddedMinutes ?? null,
        incidents: incidents.length ? incidents : match.stoppage?.incidents ?? [],
        periods,
        source: incidents.length ? '365scores-sportradar' : match.stoppage?.source,
        kind: totalStoppedMs ? 'calculated-stoppage' : match.stoppage?.kind,
      },
    } satisfies LiveMatch;
  } catch (error) {
    console.warn('[api/live/stoppage] failed:', error);
    return match;
  }
}

function cleanupMemory() {
  const cutoff = Date.now() - MAX_MEMORY_AGE_MS;
  for (const [key, value] of addedTimeMemory.entries()) {
    if (value.updatedAt < cutoff) addedTimeMemory.delete(key);
  }
}

export async function GET(request: NextRequest) {
  cleanupMemory();
  const upstream = new URL('/api/365scores/live', request.nextUrl.origin);
  const response = await fetch(upstream, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({ matches: [] }));
  if (!response.ok) return NextResponse.json(payload, { status: response.status });

  const rawMatches = Array.isArray(payload.matches) ? (payload.matches as LiveMatch[]) : [];
  const enriched = [...rawMatches];
  const candidates = enriched
    .map((match, index) => ({ match, index }))
    .filter(({ match }) => Boolean(match.sourceIds?.scores365))
    .slice(0, MAX_STOPPAGE_ENRICHMENT);

  await Promise.all(
    candidates.map(async ({ match, index }) => {
      enriched[index] = await fetchScores365Stoppage(match);
    })
  );

  const matches = enriched.map(enrichRememberedAddedTime);

  return NextResponse.json({
    ...payload,
    matches,
    count: matches.length,
    lastUpdated: new Date().toISOString(),
    stoppageMerge: 'scores365-detail-v2',
  });
}
