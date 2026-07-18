import { NextRequest, NextResponse } from 'next/server';

type PeriodKey = 'firstHalf' | 'secondHalf';
type StoppageCategory =
  | 'medical'
  | 'var'
  | 'goal'
  | 'substitution'
  | 'penalty'
  | 'card'
  | 'confusion'
  | 'time-wasting'
  | 'routine'
  | 'unknown';

type StoppageIncident = {
  startAt: string;
  endAt?: string;
  durationMs: number;
  reason: string;
  period?: PeriodKey;
  timeline?: string;
  category?: StoppageCategory;
  considered?: boolean;
  weight?: number;
  consideredMs?: number;
  decisionReason?: string;
};

type PeriodSummary = {
  totalStoppedMs?: number | null;
  totalStoppedMinutes?: number | null;
  rawStoppedMs?: number | null;
  rawStoppedMinutes?: number | null;
  consideredStoppedMs?: number | null;
  consideredStoppedMinutes?: number | null;
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
  statusText?: string;
  competition?: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  periodStoppage?: Partial<Record<PeriodKey, PeriodSummary>>;
  stoppage?: { periods?: Partial<Record<PeriodKey, PeriodSummary>>; [key: string]: unknown };
};

type CacheEntry = { firstHalf?: number; secondHalf?: number; updatedAt: number };
type Scores365Game = {
  id: number;
  sportId?: number;
  homeCompetitor?: { name?: string; sportId?: number };
  awayCompetitor?: { name?: string; sportId?: number };
};
type Scores365ActualPlayTime = {
  title?: string;
  actualTime?: { name?: string };
  totalTime?: { name?: string };
};
type PlayByPlayMessage = {
  Comment?: string;
  LastModified?: string;
  Period?: string;
  Timeline?: string;
};

const addedTimeMemory = new Map<string, CacheEntry>();
const MAX_MEMORY_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_365_DETAIL_ENRICHMENT = 18;
const DETAIL_TIMEOUT_MS = 5_000;
const MIN_STOPPAGE_MS = 15_000;
const MAX_OPEN_DISPLAY_MS = 7 * 60_000;
const MAX_OPEN_CONSIDERED_MS = 2 * 60_000;
const MAX_PLAUSIBLE_ADDED_MS = 15 * 60_000;

const SCORES365_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://www.365scores.com/pt-br',
  Origin: 'https://www.365scores.com',
};

const TEAM_ALIASES: Record<string, string> = {
  'red bull bragantino': 'bragantino',
  'rb bragantino': 'bragantino',
  'bragantino red bull': 'bragantino',
  'athletico paranaense': 'athletico pr',
  'atletico paranaense': 'athletico pr',
  'atletico mineiro': 'atletico mg',
  'america mineiro': 'america mg',
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

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|ec|club|clube|futebol|sport|sporting|real)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTeam(value: unknown) {
  const normalized = normalize(value);
  return TEAM_ALIASES[normalized] ?? normalized;
}
function competitionKey(value: unknown) {
  const key = normalize(value);
  return key.includes('serie a') && (key.includes('brazil') || key.includes('brasil'))
    ? 'serie a brazil'
    : key;
}
function matchKey(match: Pick<LiveMatch, 'homeTeam' | 'awayTeam'>) {
  return [canonicalTeam(match.homeTeam?.name), canonicalTeam(match.awayTeam?.name)]
    .sort()
    .join('__vs__');
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function roundedMinutes(ms: number) {
  return Math.round((ms / 60_000) * 10) / 10;
}
function hasTerm(value: string, terms: string[]) {
  const text = normalize(value);
  return terms.some((term) => text.includes(term));
}
function isVerifiedSource(source?: string, kind?: string) {
  return (
    kind === 'announced-added-time' &&
    Boolean(source) &&
    ['365scores-announced-added-time', 'sofascore-announced-added-time', 'verified-live-cache'].includes(
      source!
    )
  );
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
    rawStoppedMs: positive(base.rawStoppedMs) ? base.rawStoppedMs : incoming.rawStoppedMs,
    rawStoppedMinutes: positive(base.rawStoppedMinutes)
      ? base.rawStoppedMinutes
      : incoming.rawStoppedMinutes,
    consideredStoppedMs: positive(base.consideredStoppedMs)
      ? base.consideredStoppedMs
      : incoming.consideredStoppedMs,
    consideredStoppedMinutes: positive(base.consideredStoppedMinutes)
      ? base.consideredStoppedMinutes
      : incoming.consideredStoppedMinutes,
    predictedAddedMs: positive(base.predictedAddedMs)
      ? base.predictedAddedMs
      : incoming.predictedAddedMs,
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

function periodsFrom(match: LiveMatch) {
  return match.periodStoppage ?? match.stoppage?.periods ?? {};
}
function periodFromMatch(match: LiveMatch): PeriodKey {
  const raw = normalize(`${match.minute ?? ''} ${match.statusText ?? ''}`);
  if (/\b(2h|2nd|second|segundo)\b/.test(raw)) return 'secondHalf';
  if (/\b(1h|1st|first|primeiro|ht|intervalo)\b/.test(raw)) return 'firstHalf';
  const numeric = Number(String(match.minute ?? '').match(/\d{1,3}/)?.[0]);
  return Number.isFinite(numeric) && numeric > 45 ? 'secondHalf' : 'firstHalf';
}
function periodFromMessage(message: PlayByPlayMessage): PeriodKey | undefined {
  const raw = normalize(`${message.Period ?? ''} ${message.Timeline ?? ''}`);
  if (/\b(2|2h|2nd|second|segundo|secondhalf)\b/.test(raw)) return 'secondHalf';
  if (/\b(1|1h|1st|first|primeiro|firsthalf|ht|intervalo)\b/.test(raw)) return 'firstHalf';
  const minute = Number(String(message.Timeline ?? '').match(/\d{1,3}/)?.[0]);
  return Number.isFinite(minute) ? (minute > 45 ? 'secondHalf' : 'firstHalf') : undefined;
}

function parseClockMs(value?: string) {
  if (!value) return null;
  const match = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] ? Number(match[3]) : null;
  if (![first, second, third ?? 0].every(Number.isFinite)) return null;
  const hours = third === null ? 0 : first;
  const minutes = third === null ? first : second;
  const seconds = third === null ? second : third;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function classifyIncident(incident: StoppageIncident) {
  const text = normalize(incident.reason);
  let category: StoppageCategory = 'unknown';
  let weight = 1;
  let decisionReason = 'Parada relevante contabilizada integralmente.';
  if (/var|video assistant|revisao/.test(text)) category = 'var';
  else if (/injur|medical|treatment|atendimento|lesion|maca|stretcher/.test(text)) category = 'medical';
  else if (/goal|gol|celebration|comemor/.test(text)) category = 'goal';
  else if (/substitut|replacement|alteracao/.test(text)) category = 'substitution';
  else if (/penalt|penalty/.test(text)) category = 'penalty';
  else if (/red card|expuls|cartao vermelho/.test(text)) category = 'card';
  else if (/fight|confus|invasion|invasao|crowd/.test(text)) category = 'confusion';
  else if (/time wasting|delaying|demora|waste time/.test(text)) {
    category = 'time-wasting';
    weight = 0.5;
    decisionReason = 'Cera/demora contabilizada parcialmente (50%).';
  } else if (/corner|escanteio|throw in|lateral|goal kick|tiro de meta|free kick|falta comum/.test(text)) {
    category = 'routine';
    weight = 0;
    decisionReason = 'Reinício rotineiro não entra na previsão.';
  }

  if (incident.durationMs < 20_000 && !['var', 'medical', 'goal', 'penalty'].includes(category)) {
    weight = 0;
    decisionReason = 'Parada inferior a 20 segundos ignorada.';
  }

  const durationForRule = incident.endAt
    ? incident.durationMs
    : Math.min(incident.durationMs, MAX_OPEN_CONSIDERED_MS);
  if (!incident.endAt && durationForRule < incident.durationMs) {
    decisionReason = `${decisionReason} Parada ainda aberta limitada provisoriamente a 2 minutos.`;
  }
  const consideredMs = Math.round(durationForRule * weight);
  return { category, weight, considered: consideredMs > 0, consideredMs, decisionReason };
}

function auditIncidents(incidents: StoppageIncident[]): PeriodSummary | undefined {
  if (incidents.length === 0) return undefined;
  const audited = incidents.map((incident) => ({ ...incident, ...classifyIncident(incident) }));
  const rawStoppedMs = audited.reduce((sum, incident) => sum + incident.durationMs, 0);
  const consideredStoppedMs = Math.min(
    audited.reduce((sum, incident) => sum + (incident.consideredMs ?? 0), 0),
    MAX_PLAUSIBLE_ADDED_MS
  );
  if (rawStoppedMs <= 0 || consideredStoppedMs <= 0) return undefined;
  return {
    totalStoppedMs: consideredStoppedMs,
    totalStoppedMinutes: roundedMinutes(consideredStoppedMs),
    rawStoppedMs,
    rawStoppedMinutes: roundedMinutes(rawStoppedMs),
    consideredStoppedMs,
    consideredStoppedMinutes: roundedMinutes(consideredStoppedMs),
    predictedAddedMs: consideredStoppedMs,
    predictedAddedMinutes: roundedMinutes(consideredStoppedMs),
    actualAddedMinutes: null,
    source: '365scores-sportradar',
    kind: 'rules-audited-stoppage',
    incidents: audited,
  };
}

function firstHalfFallback(actualPlayTime?: Scores365ActualPlayTime): PeriodSummary | undefined {
  const played = parseClockMs(actualPlayTime?.actualTime?.name ?? actualPlayTime?.title);
  const elapsed = parseClockMs(actualPlayTime?.totalTime?.name);
  if (played === null || elapsed === null || elapsed <= played) return undefined;
  const stopped = elapsed - played;
  if (stopped < MIN_STOPPAGE_MS || stopped > MAX_PLAUSIBLE_ADDED_MS) return undefined;
  const predicted = Math.min(Math.round(stopped * 0.8), MAX_PLAUSIBLE_ADDED_MS);
  return {
    totalStoppedMs: stopped,
    totalStoppedMinutes: roundedMinutes(stopped),
    rawStoppedMs: stopped,
    rawStoppedMinutes: roundedMinutes(stopped),
    consideredStoppedMs: stopped,
    consideredStoppedMinutes: roundedMinutes(stopped),
    predictedAddedMs: predicted,
    predictedAddedMinutes: roundedMinutes(predicted),
    actualAddedMinutes: null,
    source: '365scores-actual-play-time',
    kind: 'calculated-stoppage-first-half-only',
    incidents: [],
  };
}

function messageTime(message: PlayByPlayMessage) {
  const value = Date.parse(message.LastModified ?? '');
  return Number.isFinite(value) ? value : null;
}
function incidentsFromMessages(messages: PlayByPlayMessage[]) {
  const sorted = messages
    .map((message) => ({ message, time: messageTime(message) }))
    .filter(
      (item): item is { message: PlayByPlayMessage; time: number } =>
        item.time !== null && Boolean(item.message.Comment)
    )
    .sort((a, b) => a.time - b.time);
  const incidents: StoppageIncident[] = [];
  let open: { start: number; reason: string; period?: PeriodKey; timeline?: string } | undefined;

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
      if (durationMs >= MIN_STOPPAGE_MS && durationMs <= MAX_OPEN_DISPLAY_MS) {
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
    const durationMs = Math.min(Date.now() - open.start, MAX_OPEN_DISPLAY_MS);
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
  return incidents;
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DETAIL_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: SCORES365_HEADERS,
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchScores365LiveIndex() {
  try {
    const response = await fetchWithTimeout(
      'https://webws.365scores.com/web/games/?appTypeId=5&langId=31&statuses=2'
    );
    if (!response.ok) return new Map<string, Scores365Game>();
    const payload = (await response.json()) as { games?: Scores365Game[] };
    const index = new Map<string, Scores365Game>();
    for (const game of payload.games ?? []) {
      const isFootball = game.sportId === 1 || game.homeCompetitor?.sportId === 1;
      if (!isFootball || !game.homeCompetitor?.name || !game.awayCompetitor?.name) continue;
      index.set(
        [canonicalTeam(game.homeCompetitor.name), canonicalTeam(game.awayCompetitor.name)]
          .sort()
          .join('__vs__'),
        game
      );
    }
    return index;
  } catch (error) {
    console.warn('[api/live] 365Scores live index failed:', error);
    return new Map<string, Scores365Game>();
  }
}

async function enrichStoppageAudit(matches: LiveMatch[]) {
  const index = await fetchScores365LiveIndex();
  if (index.size === 0) return matches;
  const enriched = [...matches];
  const candidates = enriched
    .map((match, matchIndex) => ({ match, matchIndex, game: index.get(matchKey(match)) }))
    .filter(({ game }) => Boolean(game))
    .slice(0, MAX_365_DETAIL_ENRICHMENT);

  await Promise.all(
    candidates.map(async ({ match, matchIndex, game }) => {
      if (!game) return;
      try {
        const response = await fetchWithTimeout(
          `https://webws.365scores.com/web/game/?appTypeId=5&langId=31&gameId=${game.id}`
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          game?: {
            actualPlayTime?: Scores365ActualPlayTime;
            playByPlay?: { feedURL?: string };
          };
        };
        let messageIncidents: StoppageIncident[] = [];
        const feedURL = payload.game?.playByPlay?.feedURL;
        if (feedURL) {
          const feedResponse = await fetchWithTimeout(feedURL);
          if (feedResponse.ok) {
            const feed = (await feedResponse.json()) as { Messages?: PlayByPlayMessage[] };
            messageIncidents = incidentsFromMessages(feed.Messages ?? []);
          }
        }

        const period = periodFromMatch(match);
        const periodIncidents = messageIncidents.filter(
          (incident) => !incident.period || incident.period === period
        );
        const audited = auditIncidents(periodIncidents);
        // O actualPlayTime é cumulativo em muitos jogos. No segundo tempo ele gerava
        // previsões como +23 ou +35. Portanto, só é usado como fallback no 1º tempo.
        const fallback = period === 'firstHalf' ? firstHalfFallback(payload.game?.actualPlayTime) : undefined;
        const summary = audited ?? fallback;
        if (!summary) return;

        const currentPeriods = periodsFrom(match);
        const nextPeriods = {
          ...currentPeriods,
          [period]: mergeSummary(currentPeriods[period], summary),
        };
        enriched[matchIndex] = {
          ...match,
          sourceIds: { ...match.sourceIds, scores365: game.id },
          periodStoppage: nextPeriods,
          stoppage: {
            ...(match.stoppage ?? {}),
            totalStoppedMs: summary.totalStoppedMs,
            totalStoppedMinutes: summary.totalStoppedMinutes,
            predictedAddedMs: summary.predictedAddedMs,
            predictedAddedMinutes: summary.predictedAddedMinutes,
            source: summary.source,
            kind: summary.kind,
            incidents: summary.incidents,
            periods: nextPeriods,
          },
        };
      } catch (error) {
        console.warn('[api/live] stoppage audit failed:', game.id, error);
      }
    })
  );
  return enriched;
}

function persistVerifiedAddedTime(match: LiveMatch): LiveMatch {
  const key = `${competitionKey(match.competition)}__${matchKey(match)}`;
  const remembered = addedTimeMemory.get(key);
  const current = periodsFrom(match);
  const next: Partial<Record<PeriodKey, PeriodSummary>> = {
    firstHalf: current.firstHalf,
    secondHalf: current.secondHalf,
  };

  (['firstHalf', 'secondHalf'] as const).forEach((period) => {
    const summary = current[period];
    const verified =
      positive(summary?.actualAddedMinutes) && isVerifiedSource(summary?.source, summary?.kind)
        ? summary.actualAddedMinutes
        : undefined;
    if (positive(verified)) {
      const previous = addedTimeMemory.get(key) ?? { updatedAt: Date.now() };
      addedTimeMemory.set(key, { ...previous, [period]: verified, updatedAt: Date.now() });
      next[period] = summary;
      return;
    }
    const cached = remembered?.[period];
    if (positive(cached)) {
      next[period] = mergeSummary(summary, {
        actualAddedMinutes: cached,
        source: 'verified-live-cache',
        kind: 'announced-added-time',
        incidents: [],
      });
      return;
    }
    if (summary && (!isVerifiedSource(summary.source, summary.kind) || !positive(summary.actualAddedMinutes))) {
      next[period] = { ...summary, actualAddedMinutes: null };
    }
  });

  return {
    ...match,
    periodStoppage: next,
    stoppage: match.stoppage ? { ...match.stoppage, periods: next } : match.stoppage,
  };
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
  const auditedMatches = await enrichStoppageAudit(rawMatches);
  const matches = auditedMatches.map(persistVerifiedAddedTime);

  return NextResponse.json({
    ...payload,
    matches,
    count: matches.length,
    lastUpdated: new Date().toISOString(),
    addedTimePolicy: 'referee-announced-only-v5',
    stoppageAuditPolicy: 'weighted-incidents-v2-no-cumulative-second-half',
  });
}
