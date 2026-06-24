import {
  replaceWorldCupMatchStatistics,
  upsertWorldCupMatch,
  type WorldCupStatisticInput,
} from '@/lib/persistence/worldCupRepository';
// @ts-expect-error pdf-parse não possui tipos oficiais neste projeto.
import pdfParse from 'pdf-parse';

const SOURCE_KEY = 'fifa';
const FIFA_REPORT_HUB_URL = 'https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub.php';
const FIFA_MEDIA_BASE_URL = 'https://www.fifatrainingcentre.com';

export type FifaStatsImportOptions = {
  pdfLimit?: number;
  pdfOffset?: number;
};

export type FifaWorldCupStatsImportResult = {
  source: typeof SOURCE_KEY;
  configured: boolean;
  matchesFetched: number;
  matchesUpserted: number;
  matchStatisticsInserted: number;
  notes: string[];
};

type Side = 'home' | 'away';
type AnyRecord = Record<string, unknown>;
type MetricKind = 'number' | 'decimal' | 'percent' | 'text';

type NormalizedFifaMatch = {
  fifaMatchId: string;
  fixtureKey: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number | null;
  awayScore?: number | null;
  groupName?: string | null;
  roundName?: string | null;
  status?: string | null;
  raw: unknown;
  statistics: WorldCupStatisticInput[];
};

type MetricDefinition = {
  key: string;
  name: string;
  labels: string[];
  kind: MetricKind;
  exclude?: string[];
};

const FIFA_CODE_TO_TEAM: Record<string, string> = {
  ARG: 'Argentina', AUS: 'Austrália', AUT: 'Áustria', BEL: 'Bélgica', BIH: 'Bósnia e Herzegovina', BRA: 'Brasil',
  CAN: 'Canadá', CIV: 'Costa do Marfim', COL: 'Colômbia', CPV: 'Cabo Verde', CRO: 'Croácia', CZE: 'Tchéquia',
  ECU: 'Equador', EGY: 'Egito', ENG: 'Inglaterra', ESP: 'Espanha', FRA: 'França', GER: 'Alemanha', GHA: 'Gana',
  HAI: 'Haiti', IRN: 'Irã', IRQ: 'Iraque', JOR: 'Jordânia', JPN: 'Japão', KOR: 'Coreia do Sul', MAR: 'Marrocos',
  MEX: 'México', NED: 'Holanda', NOR: 'Noruega', NZL: 'Nova Zelândia', PAN: 'Panamá', PAR: 'Paraguai', POR: 'Portugal',
  QAT: 'Catar', KSA: 'Arábia Saudita', SCO: 'Escócia', SEN: 'Senegal', RSA: 'África do Sul', SUI: 'Suíça', SWE: 'Suécia',
  TUN: 'Tunísia', TUR: 'Turquia', UKR: 'Ucrânia', URU: 'Uruguai', USA: 'EUA', UZB: 'Uzbequistão', ALG: 'Argélia',
};

const METRICS: MetricDefinition[] = [
  { key: 'possession', name: 'Posse de bola', labels: ['possession', 'ball possession', 'posse de bola'], kind: 'percent' },
  { key: 'expected_goals', name: 'Gols esperados (xG)', labels: ['expected goals', 'expected goals xg', 'xg', 'gols esperados'], kind: 'decimal' },
  { key: 'shots', name: 'Finalizações', labels: ['total shots', 'goal attempts', 'attempts at goal', 'attempts', 'shots', 'finalizacoes', 'finalizações'], kind: 'number', exclude: ['on target', 'no gol'] },
  { key: 'shots_on_target', name: 'Chutes no gol', labels: ['shots on target', 'attempts on target', 'on target', 'chutes no gol'], kind: 'number' },
  { key: 'corners', name: 'Escanteios', labels: ['corner kicks', 'corners', 'escanteios'], kind: 'number' },
  { key: 'yellow_cards', name: 'Cartões amarelos', labels: ['yellow cards', 'cartoes amarelos', 'cartões amarelos'], kind: 'number' },
  { key: 'red_cards', name: 'Cartões vermelhos', labels: ['red cards', 'cartoes vermelhos', 'cartões vermelhos'], kind: 'number' },
  { key: 'fouls', name: 'Faltas', labels: ['fouls committed', 'fouls', 'faltas'], kind: 'number' },
  { key: 'offsides', name: 'Impedimentos', labels: ['offsides', 'impedimentos'], kind: 'number' },
  { key: 'passes', name: 'Passes totais', labels: ['total passes', 'passes attempted', 'passes'], kind: 'number', exclude: ['accuracy', 'accurate', 'completion', 'completed', 'precisao', 'precisão'] },
  { key: 'completed_passes', name: 'Passes certos', labels: ['completed passes', 'successful passes', 'accurate passes', 'passes completed'], kind: 'number', exclude: ['accuracy', 'percent', '%'] },
  { key: 'pass_accuracy', name: 'Precisão de passes', labels: ['pass accuracy', 'passing accuracy', 'pass completion', 'precisao de passes', 'precisão de passes'], kind: 'percent' },
  { key: 'goalkeeper_saves', name: 'Defesas do goleiro', labels: ['goalkeeper saves', 'keeper saves', 'saves by goalkeeper', 'defesas do goleiro'], kind: 'number', exclude: ['tackles', 'desarmes', 'clearances', 'interceptions'] },
  { key: 'tackles', name: 'Desarmes', labels: ['tackles', 'desarmes'], kind: 'number', exclude: ['won %', 'accuracy'] },
  { key: 'clearances', name: 'Cortes', labels: ['clearances', 'cortes'], kind: 'number' },
  { key: 'interceptions', name: 'Interceptações', labels: ['interceptions', 'interceptacoes', 'interceptações'], kind: 'number' },
  { key: 'blocks', name: 'Bloqueios', labels: ['blocks', 'blocked shots', 'bloqueios'], kind: 'number' },
  { key: 'crosses', name: 'Cruzamentos', labels: ['crosses', 'cruzamentos'], kind: 'number', exclude: ['accuracy', 'successful'] },
  { key: 'successful_crosses', name: 'Cruzamentos certos', labels: ['successful crosses', 'accurate crosses', 'completed crosses'], kind: 'number' },
  { key: 'duels_won', name: 'Duelos ganhos', labels: ['duels won', 'duelos ganhos'], kind: 'number' },
  { key: 'aerial_duels_won', name: 'Duelos aéreos ganhos', labels: ['aerial duels won', 'duelos aereos ganhos', 'duelos aéreos ganhos'], kind: 'number' },
  { key: 'recoveries', name: 'Bolas recuperadas', labels: ['recoveries', 'ball recoveries', 'bolas recuperadas'], kind: 'number' },
  { key: 'total_distance', name: 'Distância percorrida', labels: ['total distance covered', 'distance covered', 'distancia percorrida', 'distância percorrida'], kind: 'decimal' },
];

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).replace('%', '').replace(',', '.').trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function safePositiveInteger(value: unknown, fallback: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(Math.trunc(number), max);
}

function buildStatistic(teamName: string, side: Side, metric: MetricDefinition, value: unknown, payload: unknown): WorldCupStatisticInput {
  const numeric = cleanNumber(value);
  return {
    teamName,
    teamSide: side,
    period: 'match',
    metricKey: metric.key,
    metricName: metric.name,
    valueNumeric: numeric,
    valueText: numeric === null ? String(value ?? '').trim() || null : null,
    sourceKey: SOURCE_KEY,
    sourcePayload: payload,
    sourceUpdatedAt: new Date().toISOString(),
  };
}

function parseConfiguredPdfUrls(): string[] {
  const raw = process.env.FIFA_WORLD_CUP_MATCH_REPORTS_URLS ?? process.env.FIFA_WORLD_CUP_MATCH_REPORTS_URL ?? '';
  return raw.split(/[\n,;]+/).map((url) => url.trim()).filter((url) => url.endsWith('.pdf'));
}

async function fetchFifaReportUrls(): Promise<string[]> {
  const urls = new Set<string>(parseConfiguredPdfUrls());
  const hubUrl = process.env.FIFA_WORLD_CUP_MATCH_REPORT_HUB_URL ?? FIFA_REPORT_HUB_URL;

  const response = await fetch(hubUrl, { headers: { accept: 'text/html,*/*' }, cache: 'no-store' });
  if (response.ok) {
    const html = await response.text();
    const matches = html.match(/(?:https?:\/\/[^"'\s]+|\/[^"'\s]+)?PMSR-M\d+[-A-Z]+\.pdf/gi) ?? [];
    for (const item of matches) {
      const clean = item.replace(/&amp;/g, '&');
      urls.add(clean.startsWith('http') ? clean : `${FIFA_MEDIA_BASE_URL}${clean.startsWith('/') ? clean : `/${clean}`}`);
    }
  }

  return [...urls].sort((a, b) => {
    const am = Number(a.match(/PMSR-M(\d+)/i)?.[1] ?? 0);
    const bm = Number(b.match(/PMSR-M(\d+)/i)?.[1] ?? 0);
    return am - bm;
  });
}

function parsePdfFileName(url: string): { matchNumber: string; homeCode: string; awayCode: string } | null {
  const decoded = decodeURIComponent(url);
  const match = decoded.match(/PMSR-M(\d+)-([A-Z]{2,3})-V-([A-Z]{2,3})\.pdf/i);
  if (!match) return null;
  return { matchNumber: match[1], homeCode: match[2].toUpperCase(), awayCode: match[3].toUpperCase() };
}

function compactLines(text: string): string[] {
  return text.replace(/\r/g, '\n').split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function numberTokens(line: string): string[] {
  return line.match(/\d+\s*\/\s*\d+(?:\s*\(\s*\d+%\s*\))?|\d+(?:[.,]\d+)?%?/g) ?? [];
}

function tokenToValue(token: string, metric: MetricDefinition): number | string | null {
  const text = token.trim();
  if (!text) return null;
  if (text.includes('/')) return text.replace(/\s+/g, ' ');
  const number = cleanNumber(text);
  if (number === null) return null;
  if (metric.kind === 'percent' && number <= 1) return Math.round(number * 100);
  return number;
}

function looksLikeMetric(line: string, metric: MetricDefinition): boolean {
  const text = normalize(line);
  return metric.labels.some((label) => text.includes(normalize(label))) && !(metric.exclude ?? []).some((label) => text.includes(normalize(label)));
}

function extractPairFromLine(line: string, metric: MetricDefinition): { home: number | string | null; away: number | string | null } | null {
  const tokens = numberTokens(line);
  if (tokens.length < 2) return null;
  const home = tokenToValue(tokens[0], metric);
  const away = tokenToValue(tokens[tokens.length - 1], metric);
  if (home === null && away === null) return null;

  if (metric.kind === 'percent') {
    const h = typeof home === 'number' ? home : null;
    const a = typeof away === 'number' ? away : null;
    if (h === null || a === null || h < 0 || a < 0 || h > 100 || a > 100 || h + a < 95 || h + a > 105) return null;
  }

  return { home, away };
}

function extractPairNearMetric(lines: string[], index: number, metric: MetricDefinition): { home: number | string | null; away: number | string | null } | null {
  for (const offset of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
    const line = lines[index + offset];
    if (!line) continue;
    const pair = extractPairFromLine(line, metric);
    if (pair) return pair;
  }
  return null;
}

function parseScore(text: string): { home: number | null; away: number | null } {
  const match = text.match(/\b(\d+)\s*[-–]\s*(\d+)\b/);
  return { home: match ? Number(match[1]) : null, away: match ? Number(match[2]) : null };
}

function parseStatistics(lines: string[], homeTeamName: string, awayTeamName: string, sourcePayload: AnyRecord): WorldCupStatisticInput[] {
  const stats: WorldCupStatisticInput[] = [];
  const seen = new Set<string>();

  for (const metric of METRICS) {
    const indexes = lines.map((line, index) => ({ line, index })).filter((item) => looksLikeMetric(item.line, metric)).map((item) => item.index);
    for (const index of indexes) {
      const pair = extractPairNearMetric(lines, index, metric);
      if (!pair) continue;
      const key = `${metric.key}:${String(pair.home)}:${String(pair.away)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      stats.push(buildStatistic(homeTeamName, 'home', metric, pair.home, { ...sourcePayload, line: lines[index] }));
      stats.push(buildStatistic(awayTeamName, 'away', metric, pair.away, { ...sourcePayload, line: lines[index] }));
      break;
    }
  }

  return stats;
}

async function extractPdfText(url: string): Promise<{ text: string; lines: string[] }> {
  const response = await fetch(url, { headers: { accept: 'application/pdf,*/*' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`FIFA PDF retornou ${response.status}: ${url}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const parsed = await pdfParse(buffer);
  const text = String(parsed?.text ?? '');
  return { text, lines: compactLines(text) };
}

async function parseFifaPdfReport(url: string): Promise<NormalizedFifaMatch | null> {
  const file = parsePdfFileName(url);
  if (!file) return null;

  const homeTeamName = FIFA_CODE_TO_TEAM[file.homeCode] ?? file.homeCode;
  const awayTeamName = FIFA_CODE_TO_TEAM[file.awayCode] ?? file.awayCode;
  const extracted = await extractPdfText(url);
  const score = parseScore(extracted.text);
  const raw = { url, matchNumber: file.matchNumber, homeCode: file.homeCode, awayCode: file.awayCode };

  return {
    fifaMatchId: `M${file.matchNumber}`,
    fixtureKey: `fifa:pdf:M${file.matchNumber}:${normalize(homeTeamName).replace(/\s+/g, '_')}:${normalize(awayTeamName).replace(/\s+/g, '_')}`,
    homeTeamName,
    awayTeamName,
    homeScore: score.home,
    awayScore: score.away,
    status: 'finished',
    groupName: null,
    roundName: 'Rodada',
    raw,
    statistics: parseStatistics(extracted.lines, homeTeamName, awayTeamName, raw),
  };
}

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : null;
}

function findArrayDeep(value: unknown, names: string[], depth = 0): unknown[] {
  if (depth > 4) return [];
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];

  for (const name of names) {
    const found = record[name];
    if (Array.isArray(found)) return found;
  }

  for (const item of Object.values(record)) {
    const found = findArrayDeep(item, names, depth + 1);
    if (found.length > 0) return found;
  }

  return [];
}

async function fetchConfiguredFifaPayload(): Promise<unknown | null> {
  const url = process.env.FIFA_WORLD_CUP_STATS_URL;
  if (!url) return null;
  const response = await fetch(url, { headers: { accept: 'application/json,text/plain,*/*' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`FIFA stats source returned ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('FIFA stats source did not return valid JSON.');
  }
}

function valueFromRecord(record: AnyRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  }
  return null;
}

function metricFromName(name: unknown): MetricDefinition | null {
  const text = normalize(name);
  if (!text) return null;
  return METRICS.find((metric) => looksLikeMetric(text, metric)) ?? METRICS.find((metric) => metric.key === text.replace(/\s+/g, '_')) ?? null;
}

function extractJsonPair(raw: unknown, metric: MetricDefinition): { home: unknown; away: unknown } | null {
  const record = asRecord(raw);
  if (!record) return null;

  const directHome = valueFromRecord(record, ['home', 'homeValue', 'home_value', 'homeTeamValue', 'home_team_value', 'homeStat', 'home_stat']);
  const directAway = valueFromRecord(record, ['away', 'awayValue', 'away_value', 'awayTeamValue', 'away_team_value', 'awayStat', 'away_stat']);
  if (directHome !== null || directAway !== null) return { home: directHome, away: directAway };

  const values = findArrayDeep(record, ['values', 'items', 'competitors', 'teams'], 0);
  if (values.length >= 2) {
    const first = asRecord(values[0]);
    const second = asRecord(values[1]);
    const home = first ? valueFromRecord(first, ['value', 'statValue', 'numericValue', 'displayValue', 'score']) : values[0];
    const away = second ? valueFromRecord(second, ['value', 'statValue', 'numericValue', 'displayValue', 'score']) : values[1];
    return { home, away };
  }

  const pair = extractPairFromLine(JSON.stringify(raw), metric);
  return pair ? { home: pair.home, away: pair.away } : null;
}

function parseJsonStatistics(raw: AnyRecord, homeTeamName: string, awayTeamName: string): WorldCupStatisticInput[] {
  const stats: WorldCupStatisticInput[] = [];
  const seen = new Set<string>();
  const candidates = [raw.statistics, raw.stats, raw.matchStatistics, raw.teamStatistics, raw.match_stats, raw.team_stats].filter(Boolean);

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const record = asRecord(item);
        if (!record) continue;
        const metric = metricFromName(valueFromRecord(record, ['metricKey', 'metric_key', 'key', 'type', 'name', 'label', 'title', 'statName', 'stat_name']));
        if (!metric) continue;
        const pair = extractJsonPair(record, metric);
        if (!pair) continue;
        const key = `${metric.key}:${String(pair.home)}:${String(pair.away)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        stats.push(buildStatistic(homeTeamName, 'home', metric, pair.home, item));
        stats.push(buildStatistic(awayTeamName, 'away', metric, pair.away, item));
      }
    } else {
      const record = asRecord(candidate);
      if (!record) continue;
      for (const [key, value] of Object.entries(record)) {
        const metric = metricFromName(key);
        if (!metric) continue;
        let pair: { home: unknown; away: unknown } | null = null;
        if (Array.isArray(value) && value.length >= 2) pair = { home: value[0], away: value[1] };
        if (!pair) pair = extractJsonPair(value, metric);
        if (!pair) continue;
        const dedupe = `${metric.key}:${String(pair.home)}:${String(pair.away)}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        stats.push(buildStatistic(homeTeamName, 'home', metric, pair.home, { key, value }));
        stats.push(buildStatistic(awayTeamName, 'away', metric, pair.away, { key, value }));
      }
    }
  }

  return stats;
}

function normalizeJsonMatch(raw: unknown): NormalizedFifaMatch | null {
  const match = asRecord(raw);
  if (!match) return null;
  const homeTeamName = String(match.homeTeamName ?? match.home_team_name ?? asRecord(match.homeTeam)?.name ?? asRecord(match.home_team)?.name ?? '').trim();
  const awayTeamName = String(match.awayTeamName ?? match.away_team_name ?? asRecord(match.awayTeam)?.name ?? asRecord(match.away_team)?.name ?? '').trim();
  if (!homeTeamName || !awayTeamName) return null;

  const fifaMatchId = String(match.id ?? match.matchId ?? match.fifaMatchId ?? match.match_id ?? `${homeTeamName}-${awayTeamName}`);
  return {
    fifaMatchId,
    fixtureKey: `fifa:json:${fifaMatchId}:${normalize(homeTeamName).replace(/\s+/g, '_')}:${normalize(awayTeamName).replace(/\s+/g, '_')}`,
    homeTeamName,
    awayTeamName,
    homeScore: cleanNumber(match.homeScore ?? match.home_score ?? asRecord(match.score)?.home),
    awayScore: cleanNumber(match.awayScore ?? match.away_score ?? asRecord(match.score)?.away),
    groupName: String(match.groupName ?? match.group ?? '').trim() || null,
    roundName: String(match.roundName ?? match.round ?? match.stage ?? 'Rodada'),
    status: String(match.status ?? 'finished'),
    raw,
    statistics: parseJsonStatistics(match, homeTeamName, awayTeamName),
  };
}

async function fetchFifaPdfReports(notes: string[], options: Required<FifaStatsImportOptions>): Promise<NormalizedFifaMatch[]> {
  const urls = await fetchFifaReportUrls();
  const batch = urls.slice(options.pdfOffset, options.pdfOffset + options.pdfLimit);
  const matches: NormalizedFifaMatch[] = [];
  let failed = 0;

  for (const url of batch) {
    try {
      const match = await parseFifaPdfReport(url);
      if (match) matches.push(match);
    } catch (error) {
      failed += 1;
      if (failed <= 5) notes.push(error instanceof Error ? error.message : `Falha ao processar PDF FIFA ${url}.`);
    }
  }

  notes.push(`FIFA Match Report Hub: ${urls.length} PDFs localizados. Lote offset=${options.pdfOffset}, limit=${options.pdfLimit}: ${matches.length} processados, ${failed} falhas.`);
  return matches;
}

export async function importWorldCupFromFifaStats(options: FifaStatsImportOptions = {}): Promise<FifaWorldCupStatsImportResult> {
  const notes: string[] = [];
  const result: FifaWorldCupStatsImportResult = {
    source: SOURCE_KEY,
    configured: true,
    matchesFetched: 0,
    matchesUpserted: 0,
    matchStatisticsInserted: 0,
    notes,
  };

  const resolvedOptions: Required<FifaStatsImportOptions> = {
    pdfOffset: safePositiveInteger(options.pdfOffset ?? process.env.FIFA_WORLD_CUP_PDF_OFFSET, 0, 500),
    pdfLimit: safePositiveInteger(options.pdfLimit ?? process.env.FIFA_WORLD_CUP_PDF_LIMIT, 3, 10) || 3,
  };

  const jsonPayload = await fetchConfiguredFifaPayload();
  const jsonMatches = jsonPayload
    ? findArrayDeep(jsonPayload, ['matches', 'games', 'fixtures', 'data']).map(normalizeJsonMatch).filter((match): match is NormalizedFifaMatch => Boolean(match))
    : [];
  const pdfMatches = await fetchFifaPdfReports(notes, resolvedOptions);
  const matchesByKey = new Map<string, NormalizedFifaMatch>();

  for (const match of [...jsonMatches, ...pdfMatches]) {
    const key = `${normalize(match.homeTeamName)}__${normalize(match.awayTeamName)}`;
    const existing = matchesByKey.get(key);
    if (!existing || match.statistics.length > existing.statistics.length) matchesByKey.set(key, match);
  }

  const matches = [...matchesByKey.values()];
  result.matchesFetched = matches.length;

  for (const match of matches) {
    const matchId = await upsertWorldCupMatch({
      fixtureKey: match.fixtureKey,
      fifaMatchId: match.fifaMatchId,
      homeTeamName: match.homeTeamName,
      awayTeamName: match.awayTeamName,
      stage: 'Copa do Mundo 2026',
      groupName: match.groupName,
      roundName: match.roundName,
      status: match.status ?? 'finished',
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      sourceKey: SOURCE_KEY,
      sourcePayload: match.raw,
      sourceUpdatedAt: new Date().toISOString(),
    });
    result.matchesUpserted += 1;
    if (match.statistics.length > 0) {
      result.matchStatisticsInserted += await replaceWorldCupMatchStatistics(matchId, match.statistics, SOURCE_KEY);
    }
  }

  if (matches.length === 0) notes.push('Nenhum jogo FIFA reconhecível foi encontrado no lote atual.');
  if (matches.length > 0 && result.matchStatisticsInserted === 0) notes.push('Jogos FIFA reconhecidos, mas nenhuma estatística de equipe foi mapeada neste lote.');
  if (result.matchStatisticsInserted > 0) notes.push('Importação FIFA expandida: JSON configurado e PDFs oficiais agora tentam mapear métricas adicionais de equipe.');
  return result;
}
