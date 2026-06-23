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

type NormalizedFifaMatch = {
  fifaMatchId: string;
  fixtureKey: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number | null;
  awayScore?: number | null;
  groupName?: string | null;
  roundName?: string | null;
  raw: unknown;
  statistics: WorldCupStatisticInput[];
};

type MetricDefinition = {
  key: string;
  name: string;
  labels: string[];
  kind: 'number' | 'decimal' | 'percent' | 'text';
  exclude?: string[];
};

const FIFA_CODE_TO_TEAM: Record<string, string> = {
  ARG: 'Argentina', AUS: 'Austrália', AUT: 'Áustria', BEL: 'Bélgica', BIH: 'Bósnia e Herzegovina', BRA: 'Brasil',
  CAN: 'Canadá', CIV: 'Costa do Marfim', COL: 'Colômbia', CPV: 'Cabo Verde', CRO: 'Croácia', CZE: 'Tchéquia',
  ECU: 'Equador', EGY: 'Egito', ENG: 'Inglaterra', ESP: 'Espanha', FRA: 'França', GER: 'Alemanha', GHA: 'Gana',
  HAI: 'Haiti', IRN: 'Irã', IRQ: 'Iraque', JOR: 'Jordânia', JPN: 'Japão', KOR: 'Coreia do Sul', MAR: 'Marrocos',
  MEX: 'México', NED: 'Holanda', NOR: 'Noruega', NZL: 'Nova Zelândia', PAN: 'Panamá', PAR: 'Paraguai', POR: 'Portugal',
  QAT: 'Catar', KSA: 'Arábia Saudita', SCO: 'Escócia', SEN: 'Senegal', RSA: 'África do Sul', SUI: 'Suíça', SWE: 'Suécia',
  TUN: 'Tunísia', TUR: 'Turquia', UKR: 'Ucrânia', URU: 'Uruguai', USA: 'EUA', UZB: 'Uzbequistão',
};

const METRICS: MetricDefinition[] = [
  { key: 'possession', name: 'Posse de bola', labels: ['possession', 'ball possession', 'posse de bola'], kind: 'percent' },
  { key: 'expected_goals', name: 'Gols esperados (xG)', labels: ['expected goals', 'xg', 'gols esperados'], kind: 'decimal' },
  { key: 'shots', name: 'Finalizações', labels: ['total shots', 'goal attempts', 'attempts at goal', 'shots', 'finalizacoes', 'finalizações'], kind: 'number' },
  { key: 'shots_on_target', name: 'Chutes no gol', labels: ['shots on target', 'on target', 'chutes no gol'], kind: 'number' },
  { key: 'corners', name: 'Escanteios', labels: ['corner kicks', 'corners', 'escanteios'], kind: 'number' },
  { key: 'yellow_cards', name: 'Cartões amarelos', labels: ['yellow cards', 'cartoes amarelos', 'cartões amarelos'], kind: 'number' },
  { key: 'red_cards', name: 'Cartões vermelhos', labels: ['red cards', 'cartoes vermelhos', 'cartões vermelhos'], kind: 'number' },
  { key: 'fouls', name: 'Faltas', labels: ['fouls', 'faltas'], kind: 'number' },
  { key: 'offsides', name: 'Impedimentos', labels: ['offsides', 'impedimentos'], kind: 'number' },
  { key: 'passes', name: 'Passes totais', labels: ['total passes', 'passes attempted', 'passes'], kind: 'number', exclude: ['accuracy', 'accurate', 'completion', 'precisao', 'precisão'] },
  { key: 'pass_accuracy', name: 'Precisão de passes', labels: ['pass accuracy', 'passing accuracy', 'pass completion', 'precisao de passes', 'precisão de passes'], kind: 'percent' },
  { key: 'goalkeeper_saves', name: 'Defesas do goleiro', labels: ['goalkeeper saves', 'keeper saves', 'defesas do goleiro'], kind: 'number', exclude: ['tackles', 'desarmes', 'clearances', 'interceptions'] },
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
  const number = Number(String(value).replace('%', '').replace(',', '.').trim());
  return Number.isFinite(number) ? number : null;
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

  const response = await fetch(hubUrl, { headers: { accept: 'text/html,*/*' }, next: { revalidate: 300 } });
  if (response.ok) {
    const html = await response.text();
    const matches = html.match(/(?:https?:\/\/[^"'\s]+|\/[^"'\s]+)?PMSR-M\d+[-A-Z]+\.pdf/gi) ?? [];
    for (const item of matches) {
      const clean = item.replace(/&amp;/g, '&');
      urls.add(clean.startsWith('http') ? clean : `${FIFA_MEDIA_BASE_URL}${clean.startsWith('/') ? clean : `/${clean}`}`);
    }
  }

  return [...urls];
}

function parsePdfFileName(url: string): { matchNumber: string; homeCode: string; awayCode: string } | null {
  const decoded = decodeURIComponent(url);
  const match = decoded.match(/PMSR-M(\d+)-([A-Z]{2,3})-V-([A-Z]{2,3})\.pdf/i);
  if (!match) return null;
  return { matchNumber: match[1], homeCode: match[2].toUpperCase(), awayCode: match[3].toUpperCase() };
}

function compactLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function numberTokens(line: string): string[] {
  return line.match(/\d+(?:[.,]\d+)?%?|\d+\s*\/\s*\d+(?:\s*\(\s*\d+%\s*\))?/g) ?? [];
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
  for (const offset of [0, 1, -1, 2, -2, 3, -3]) {
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

  for (const metric of METRICS) {
    const index = lines.findIndex((line) => looksLikeMetric(line, metric));
    if (index < 0) continue;
    const pair = extractPairNearMetric(lines, index, metric);
    if (!pair) continue;
    stats.push(buildStatistic(homeTeamName, 'home', metric, pair.home, { ...sourcePayload, line: lines[index] }));
    stats.push(buildStatistic(awayTeamName, 'away', metric, pair.away, { ...sourcePayload, line: lines[index] }));
  }

  return stats;
}

async function extractPdfText(url: string): Promise<{ text: string; lines: string[] }> {
  const response = await fetch(url, { headers: { accept: 'application/pdf,*/*' }, next: { revalidate: 3600 } });
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
  const statistics = parseStatistics(extracted.lines, homeTeamName, awayTeamName, raw);

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
    statistics,
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
  const response = await fetch(url, { headers: { accept: 'application/json,text/plain,*/*' }, next: { revalidate: 300 } });
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

function normalizeJsonMatch(raw: unknown): NormalizedFifaMatch | null {
  const match = asRecord(raw);
  if (!match) return null;
  const homeTeamName = String(match.homeTeamName ?? match.home_team_name ?? asRecord(match.homeTeam)?.name ?? '').trim();
  const awayTeamName = String(match.awayTeamName ?? match.away_team_name ?? asRecord(match.awayTeam)?.name ?? '').trim();
  if (!homeTeamName || !awayTeamName) return null;

  const rawStats = findArrayDeep(match, ['statistics', 'stats', 'teamStatistics', 'matchStatistics']);
  const statistics = rawStats.flatMap((row) => {
    const record = asRecord(row);
    if (!record) return [];
    const name = String(record.name ?? record.metricName ?? record.metric ?? record.label ?? 'Estatística');
    const metric = METRICS.find((item) => item.key === normalize(name).replace(/\s+/g, '_') || item.labels.some((label) => normalize(name).includes(normalize(label)))) ?? { key: normalize(name).replace(/\s+/g, '_') || 'unknown', name, labels: [], kind: 'number' as const };
    const homeValue = record.homeValue ?? record.home ?? record.valueHome ?? record.home_value;
    const awayValue = record.awayValue ?? record.away ?? record.valueAway ?? record.away_value;
    if (homeValue === undefined && awayValue === undefined) return [];
    return [buildStatistic(homeTeamName, 'home', metric, homeValue, row), buildStatistic(awayTeamName, 'away', metric, awayValue, row)];
  });

  const fifaMatchId = String(match.id ?? match.matchId ?? match.fifaMatchId ?? `${homeTeamName}-${awayTeamName}`);
  return {
    fifaMatchId,
    fixtureKey: `fifa:json:${fifaMatchId}:${normalize(homeTeamName).replace(/\s+/g, '_')}:${normalize(awayTeamName).replace(/\s+/g, '_')}`,
    homeTeamName,
    awayTeamName,
    homeScore: cleanNumber(match.homeScore ?? match.home_score),
    awayScore: cleanNumber(match.awayScore ?? match.away_score),
    groupName: String(match.groupName ?? match.group ?? '').trim() || null,
    roundName: String(match.roundName ?? match.round ?? match.stage ?? 'Rodada'),
    raw,
    statistics,
  };
}

async function fetchFifaPdfReports(notes: string[]): Promise<NormalizedFifaMatch[]> {
  const urls = await fetchFifaReportUrls();
  const matches: NormalizedFifaMatch[] = [];
  let failed = 0;

  for (const url of urls.slice(0, 80)) {
    try {
      const match = await parseFifaPdfReport(url);
      if (match) matches.push(match);
    } catch (error) {
      failed += 1;
      if (failed <= 5) notes.push(error instanceof Error ? error.message : `Falha ao processar PDF FIFA ${url}.`);
    }
  }

  notes.push(`FIFA Match Report Hub: ${urls.length} PDFs localizados, ${matches.length} processados, ${failed} falhas.`);
  return matches;
}

export async function importWorldCupFromFifaStats(): Promise<FifaWorldCupStatsImportResult> {
  const notes: string[] = [];
  const result: FifaWorldCupStatsImportResult = {
    source: SOURCE_KEY,
    configured: true,
    matchesFetched: 0,
    matchesUpserted: 0,
    matchStatisticsInserted: 0,
    notes,
  };

  const jsonPayload = await fetchConfiguredFifaPayload();
  const jsonMatches = jsonPayload
    ? findArrayDeep(jsonPayload, ['matches', 'games', 'fixtures', 'data']).map(normalizeJsonMatch).filter((match): match is NormalizedFifaMatch => Boolean(match))
    : [];
  const pdfMatches = await fetchFifaPdfReports(notes);
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

  if (matches.length === 0) notes.push('Nenhum jogo FIFA reconhecível foi encontrado no JSON ou nos PDFs oficiais.');
  if (matches.length > 0 && result.matchStatisticsInserted === 0) notes.push('Jogos FIFA reconhecidos, mas nenhuma estatística de equipe foi mapeada.');
  return result;
}
