import {
  replaceWorldCupMatchStatistics,
  upsertWorldCupMatch,
  type WorldCupStatisticInput,
} from '@/lib/persistence/worldCupRepository';

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

type AnyRecord = Record<string, unknown>;

type NormalizedFifaMatch = {
  fifaMatchId: string;
  fixtureKey: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number | null;
  awayScore?: number | null;
  kickoffAt?: string | null;
  status?: string | null;
  groupName?: string | null;
  roundName?: string | null;
  venue?: string | null;
  referee?: string | null;
  raw: unknown;
  statistics: WorldCupStatisticInput[];
};

type FifaPdfReport = {
  url: string;
  matchNumber: string;
  homeTeamName: string;
  awayTeamName: string;
  homeCode: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  text: string;
  lines: string[];
  statistics: WorldCupStatisticInput[];
};

const FIFA_CODE_TO_TEAM: Record<string, string> = {
  ARG: 'Argentina',
  AUS: 'Austrália',
  AUT: 'Áustria',
  BEL: 'Bélgica',
  BIH: 'Bósnia e Herzegovina',
  BRA: 'Brasil',
  CAN: 'Canadá',
  CIV: 'Costa do Marfim',
  COL: 'Colômbia',
  CPV: 'Cabo Verde',
  CRO: 'Croácia',
  CZE: 'Tchéquia',
  ECU: 'Equador',
  EGY: 'Egito',
  ENG: 'Inglaterra',
  ESP: 'Espanha',
  FRA: 'França',
  GER: 'Alemanha',
  GHA: 'Gana',
  HAI: 'Haiti',
  IRN: 'Irã',
  IRQ: 'Iraque',
  JOR: 'Jordânia',
  JPN: 'Japão',
  KOR: 'Coreia do Sul',
  MAR: 'Marrocos',
  MEX: 'México',
  NED: 'Holanda',
  NOR: 'Noruega',
  NZL: 'Nova Zelândia',
  PAN: 'Panamá',
  PAR: 'Paraguai',
  POR: 'Portugal',
  QAT: 'Catar',
  KSA: 'Arábia Saudita',
  SCO: 'Escócia',
  SEN: 'Senegal',
  RSA: 'África do Sul',
  SUI: 'Suíça',
  SWE: 'Suécia',
  TUN: 'Tunísia',
  TUR: 'Turquia',
  UKR: 'Ucrânia',
  URU: 'Uruguai',
  USA: 'EUA',
  UZB: 'Uzbequistão',
};

const METRICS = [
  { key: 'possession', name: 'Posse de bola', labels: ['possession', 'posse de bola', 'ball possession'], kind: 'percent' },
  { key: 'expected_goals', name: 'Gols esperados (xG)', labels: ['expected goals', 'xg', 'gols esperados'], kind: 'decimal' },
  { key: 'shots', name: 'Finalizações', labels: ['total shots', 'goal attempts', 'attempts at goal', 'shots', 'finalizacoes', 'finalizações', 'chutes'], kind: 'number' },
  { key: 'shots_on_target', name: 'Chutes no gol', labels: ['shots on target', 'on target', 'chutes no gol', 'finalizacoes no gol', 'finalizações no gol'], kind: 'number' },
  { key: 'corners', name: 'Escanteios', labels: ['corner kicks', 'corners', 'escanteios'], kind: 'number' },
  { key: 'yellow_cards', name: 'Cartões amarelos', labels: ['yellow cards', 'cartoes amarelos', 'cartões amarelos'], kind: 'number' },
  { key: 'red_cards', name: 'Cartões vermelhos', labels: ['red cards', 'cartoes vermelhos', 'cartões vermelhos'], kind: 'number' },
  { key: 'fouls', name: 'Faltas', labels: ['fouls', 'faltas'], kind: 'number' },
  { key: 'offsides', name: 'Impedimentos', labels: ['offsides', 'impedimentos'], kind: 'number' },
  { key: 'passes', name: 'Passes totais', labels: ['total passes', 'passes attempted', 'passes'], kind: 'number', exclude: ['accuracy', 'completion', 'accurate', 'precisao', 'precisão'] },
  { key: 'pass_accuracy', name: 'Precisão de passes', labels: ['pass accuracy', 'passing accuracy', 'pass completion', 'precisao de passes', 'precisão de passes'], kind: 'percent' },
  { key: 'goalkeeper_saves', name: 'Defesas do goleiro', labels: ['goalkeeper saves', 'keeper saves', 'saves by goalkeeper', 'defesas do goleiro'], kind: 'number', exclude: ['tackles', 'desarmes', 'clearances', 'interceptions'] },
] as const;

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

function textValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    const number = cleanNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

function metricKey(name?: string | null): string {
  const key = normalize(name);
  if (!key) return 'unknown';
  if (key.includes('corner')) return 'corners';
  if (key.includes('yellow')) return 'yellow_cards';
  if (key.includes('red')) return 'red_cards';
  if (key.includes('possession') || key.includes('ball possession')) return 'possession';
  if (key.includes('on target') || key.includes('target')) return 'shots_on_target';
  if (key.includes('attempt') || key.includes('shot')) return 'shots';
  if (key.includes('foul')) return 'fouls';
  if (key.includes('offside')) return 'offsides';
  if (key.includes('goalkeeper save') || key.includes('keeper save')) return 'goalkeeper_saves';
  if (key.includes('expected') || key === 'xg') return 'expected_goals';
  if (key.includes('pass accuracy')) return 'pass_accuracy';
  if (key.includes('pass')) return 'passes';
  return key.replace(/\s+/g, '_');
}

function extractTeamName(team: unknown): string | null {
  const record = asRecord(team);
  if (!record) return textValue(team);
  return textValue(record.name, record.teamName, record.shortName, record.abbreviation, asRecord(record.team)?.name, asRecord(record.competitor)?.name);
}

function extractMatchTeams(match: AnyRecord): { home: string | null; away: string | null } {
  const home = asRecord(match.homeTeam) ?? asRecord(match.home) ?? asRecord(match.homeCompetitor) ?? asRecord(match.home_team);
  const away = asRecord(match.awayTeam) ?? asRecord(match.away) ?? asRecord(match.awayCompetitor) ?? asRecord(match.away_team);
  return {
    home: extractTeamName(home) ?? textValue(match.homeTeamName, match.home_team_name),
    away: extractTeamName(away) ?? textValue(match.awayTeamName, match.away_team_name),
  };
}

function extractScore(match: AnyRecord, side: 'home' | 'away'): number | null {
  const direct = numberValue(match[`${side}Score`], match[`${side}_score`]);
  if (direct !== null) return direct;
  const team = asRecord(match[`${side}Team`]) ?? asRecord(match[side]) ?? asRecord(match[`${side}Competitor`]);
  return numberValue(team?.score, team?.goals);
}

function buildStatistic(teamName: string, side: 'home' | 'away' | null, key: string, name: string, value: unknown, period: string, sourcePayload: unknown): WorldCupStatisticInput {
  const numeric = cleanNumber(value);
  return {
    teamName,
    teamSide: side,
    period,
    metricKey: key,
    metricName: name,
    valueNumeric: numeric,
    valueText: numeric === null ? textValue(value) : null,
    sourceKey: SOURCE_KEY,
    sourcePayload,
    sourceUpdatedAt: new Date().toISOString(),
  };
}

function rowToStatistic(row: unknown, homeName: string, awayName: string, matchRaw: unknown): WorldCupStatisticInput[] {
  const record = asRecord(row);
  if (!record) return [];
  const name = textValue(record.name, record.metricName, record.metric, record.title, record.label, record.type) ?? 'Estatística';
  const key = metricKey(name);
  const period = textValue(record.period, record.phase) ?? 'match';
  const homeValue = record.homeValue ?? record.home ?? record.homeTeamValue ?? record.valueHome ?? record.home_value;
  const awayValue = record.awayValue ?? record.away ?? record.awayTeamValue ?? record.valueAway ?? record.away_value;

  if (homeValue !== undefined || awayValue !== undefined) {
    return [buildStatistic(homeName, 'home', key, name, homeValue, period, row), buildStatistic(awayName, 'away', key, name, awayValue, period, row)];
  }

  const teamName = extractTeamName(record.team ?? record.competitor) ?? textValue(record.teamName, record.competitorName);
  const side = normalize(teamName) === normalize(homeName) ? 'home' : normalize(teamName) === normalize(awayName) ? 'away' : null;
  const value = record.value ?? record.statValue ?? record.amount ?? record.total;
  if (teamName && value !== undefined) return [buildStatistic(teamName, side, key, name, value, period, row)];

  const values = asArray(record.values ?? record.teams ?? record.competitors);
  if (values.length >= 2) {
    return [
      buildStatistic(homeName, 'home', key, name, asRecord(values[0])?.value ?? values[0], period, row),
      buildStatistic(awayName, 'away', key, name, asRecord(values[1])?.value ?? values[1], period, row),
    ];
  }

  const payloadRecord = asRecord(matchRaw);
  const homeFromPayload = payloadRecord ? payloadRecord[key + 'Home'] ?? payloadRecord[`home_${key}`] : undefined;
  const awayFromPayload = payloadRecord ? payloadRecord[key + 'Away'] ?? payloadRecord[`away_${key}`] : undefined;
  if (homeFromPayload !== undefined || awayFromPayload !== undefined) {
    return [buildStatistic(homeName, 'home', key, name, homeFromPayload, period, row), buildStatistic(awayName, 'away', key, name, awayFromPayload, period, row)];
  }

  return [];
}

function normalizeMatch(raw: unknown): NormalizedFifaMatch | null {
  const match = asRecord(raw);
  if (!match) return null;
  const teams = extractMatchTeams(match);
  if (!teams.home || !teams.away) return null;
  const id = textValue(match.id, match.matchId, match.fifaMatchId, match.fixtureId, match.matchNumber) ?? `${teams.home}-${teams.away}`;
  const rawStats = findArrayDeep(match, ['statistics', 'stats', 'teamStatistics', 'matchStatistics']);
  const statistics = rawStats.flatMap((row) => rowToStatistic(row, teams.home!, teams.away!, raw));

  return {
    fifaMatchId: id,
    fixtureKey: `fifa:${id}:${normalize(teams.home).replace(/\s+/g, '_')}:${normalize(teams.away).replace(/\s+/g, '_')}`,
    homeTeamName: teams.home,
    awayTeamName: teams.away,
    homeScore: extractScore(match, 'home'),
    awayScore: extractScore(match, 'away'),
    kickoffAt: textValue(match.kickoffAt, match.startTime, match.date, match.datetime),
    status: textValue(match.status, match.statusText) ?? 'finished',
    groupName: textValue(match.groupName, match.group, match.group_name),
    roundName: textValue(match.roundName, match.stage, match.round, match.phase) ?? 'Rodada',
    venue: textValue(match.venue, asRecord(match.stadium)?.name),
    referee: textValue(match.referee, asRecord(match.referee)?.name),
    raw,
    statistics,
  };
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

function parseConfiguredPdfUrls(): string[] {
  const raw = process.env.FIFA_WORLD_CUP_MATCH_REPORTS_URLS ?? process.env.FIFA_WORLD_CUP_MATCH_REPORTS_URL ?? '';
  return raw.split(/[\n,;]+/).map((url) => url.trim()).filter((url) => url.endsWith('.pdf'));
}

async function fetchFifaReportUrls(): Promise<string[]> {
  const urls = new Set<string>(parseConfiguredPdfUrls());
  const hubUrl = process.env.FIFA_WORLD_CUP_MATCH_REPORT_HUB_URL ?? FIFA_REPORT_HUB_URL;

  try {
    const response = await fetch(hubUrl, { headers: { accept: 'text/html,*/*' }, next: { revalidate: 300 } });
    if (response.ok) {
      const html = await response.text();
      const matches = html.match(/(?:https?:\/\/[^"'\s]+|\/[^"'\s]+)?PMSR-M\d+[-A-Z]+\.pdf/gi) ?? [];
      for (const item of matches) {
        const clean = item.replace(/&amp;/g, '&');
        if (clean.startsWith('http')) urls.add(clean);
        else urls.add(`${FIFA_MEDIA_BASE_URL}${clean.startsWith('/') ? clean : `/${clean}`}`);
      }
    }
  } catch {
    // Se o hub falhar, ainda usa URLs configuradas manualmente.
  }

  return [...urls];
}

function parsePdfFileName(url: string): { matchNumber: string; homeCode: string; awayCode: string } | null {
  const decoded = decodeURIComponent(url);
  const match = decoded.match(/PMSR-M(\d+)-([A-Z]{2,3})-V-([A-Z]{2,3})\.pdf/i);
  if (!match) return null;
  return { matchNumber: match[1], homeCode: match[2].toUpperCase(), awayCode: match[3].toUpperCase() };
}

function numberTokens(line: string): string[] {
  return line.match(/\d+(?:[.,]\d+)?%?|\d+\s*\/\s*\d+(?:\s*\(\s*\d+%\s*\))?/g) ?? [];
}

function tokenToValue(token: string, kind: string): number | string | null {
  const text = token.trim();
  if (!text) return null;
  if (text.includes('/')) return text.replace(/\s+/g, ' ');
  const number = cleanNumber(text);
  if (number === null) return null;
  if (kind === 'percent' && number <= 1) return Math.round(number * 100);
  return number;
}

function looksLikeMetricLine(line: string, labels: readonly string[], exclude: readonly string[] = []): boolean {
  const text = normalize(line);
  return labels.some((label) => text.includes(normalize(label))) && !exclude.some((label) => text.includes(normalize(label)));
}

function extractPairFromLine(line: string, metric: (typeof METRICS)[number]): { home: number | string | null; away: number | string | null } | null {
  const tokens = numberTokens(line);
  if (tokens.length < 2) return null;
  const home = tokenToValue(tokens[0], metric.kind);
  const away = tokenToValue(tokens[tokens.length - 1], metric.kind);
  if (home === null && away === null) return null;
  if (metric.kind === 'percent') {
    const h = typeof home === 'number' ? home : null;
    const a = typeof away === 'number' ? away : null;
    if (h === null || a === null || h < 0 || a < 0 || h > 100 || a > 100 || h + a < 95 || h + a > 105) return null;
  }
  return { home, away };
}

function extractPairNearLine(lines: string[], index: number, metric: (typeof METRICS)[number]): { home: number | string | null; away: number | string | null } | null {
  for (const offset of [0, 1, -1, 2, -2]) {
    const candidate = lines[index + offset];
    if (!candidate) continue;
    const pair = extractPairFromLine(candidate, metric);
    if (pair) return pair;
  }
  return null;
}

function parseFifaPdfStatistics(report: Omit<FifaPdfReport, 'statistics'>): WorldCupStatisticInput[] {
  const stats: WorldCupStatisticInput[] = [];
  for (const metric of METRICS) {
    const index = report.lines.findIndex((line) => looksLikeMetricLine(line, metric.labels, metric.exclude ?? []));
    if (index < 0) continue;
    const pair = extractPairNearLine(report.lines, index, metric);
    if (!pair) continue;
    stats.push(buildStatistic(report.homeTeamName, 'home', metric.key, metric.name, pair.home, 'match', { url: report.url, line: report.lines[index], matchNumber: report.matchNumber }));
    stats.push(buildStatistic(report.awayTeamName, 'away', metric.key, metric.name, pair.away, 'match', { url: report.url, line: report.lines[index], matchNumber: report.matchNumber }));
  }
  return stats;
}

function parseScoreFromText(text: string): { home: number | null; away: number | null } {
  const line = text.split(/\n+/).find((item) => /\b\d+\s*[-–]\s*\d+\b/.test(item));
  const match = line?.match(/\b(\d+)\s*[-–]\s*(\d+)\b/);
  return { home: match ? Number(match[1]) : null, away: match ? Number(match[2]) : null };
}

async function extractPdfText(url: string): Promise<{ text: string; lines: string[] }> {
  const pdfjs = await (new Function('specifier', 'return import(specifier)'))('pdfjs-dist/legacy/build/pdf.mjs') as { getDocument: (options: AnyRecord) => { promise: Promise<any> } };
  const response = await fetch(url, { headers: { accept: 'application/pdf,*/*' }, next: { revalidate: 3600 } });
  if (!response.ok) throw new Error(`FIFA PDF ${url} retornou ${response.status}`);
  const data = new Uint8Array(await response.arrayBuffer());
  const document = await pdfjs.getDocument({ data, disableWorker: true, useWorkerFetch: false, isEvalSupported: false }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = (content.items ?? []) as Array<{ str?: string; transform?: number[] }>;
    const grouped = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of items) {
      const text = String(item.str ?? '').trim();
      if (!text) continue;
      const transform = item.transform ?? [0, 0, 0, 0, 0, 0];
      const y = Math.round(Number(transform[5] ?? 0));
      const x = Number(transform[4] ?? 0);
      const row = grouped.get(y) ?? [];
      row.push({ x, text });
      grouped.set(y, row);
    }
    const pageLines = [...grouped.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    lines.push(...pageLines);
  }

  return { text: lines.join('\n'), lines };
}

async function parseFifaPdfReport(url: string): Promise<FifaPdfReport | null> {
  const file = parsePdfFileName(url);
  if (!file) return null;
  const homeTeamName = FIFA_CODE_TO_TEAM[file.homeCode] ?? file.homeCode;
  const awayTeamName = FIFA_CODE_TO_TEAM[file.awayCode] ?? file.awayCode;
  const extracted = await extractPdfText(url);
  const score = parseScoreFromText(extracted.text);
  const base = { url, matchNumber: file.matchNumber, homeCode: file.homeCode, awayCode: file.awayCode, homeTeamName, awayTeamName, homeScore: score.home, awayScore: score.away, text: extracted.text, lines: extracted.lines };
  return { ...base, statistics: parseFifaPdfStatistics(base) };
}

async function fetchFifaPdfReports(notes: string[]): Promise<NormalizedFifaMatch[]> {
  const urls = await fetchFifaReportUrls();
  const matches: NormalizedFifaMatch[] = [];
  let failed = 0;

  for (const url of urls.slice(0, 80)) {
    try {
      const report = await parseFifaPdfReport(url);
      if (!report) continue;
      matches.push({
        fifaMatchId: `M${report.matchNumber}`,
        fixtureKey: `fifa:pdf:M${report.matchNumber}:${normalize(report.homeTeamName).replace(/\s+/g, '_')}:${normalize(report.awayTeamName).replace(/\s+/g, '_')}`,
        homeTeamName: report.homeTeamName,
        awayTeamName: report.awayTeamName,
        homeScore: report.homeScore,
        awayScore: report.awayScore,
        status: 'finished',
        groupName: null,
        roundName: 'Rodada',
        raw: { url: report.url, matchNumber: report.matchNumber, homeCode: report.homeCode, awayCode: report.awayCode },
        statistics: report.statistics,
      });
    } catch (error) {
      failed += 1;
      if (failed <= 3) notes.push(error instanceof Error ? error.message : `Falha ao processar PDF FIFA ${url}.`);
    }
  }

  notes.push(`FIFA Match Report Hub: ${urls.length} PDFs localizados, ${matches.length} processados, ${failed} falhas.`);
  return matches;
}

export async function importWorldCupFromFifaStats(): Promise<FifaWorldCupStatsImportResult> {
  const notes: string[] = [];
  const result: FifaWorldCupStatsImportResult = { source: SOURCE_KEY, configured: true, matchesFetched: 0, matchesUpserted: 0, matchStatisticsInserted: 0, notes };
  const jsonPayload = await fetchConfiguredFifaPayload();
  const jsonMatches = jsonPayload ? findArrayDeep(jsonPayload, ['matches', 'games', 'fixtures', 'data']).map(normalizeMatch).filter((match): match is NormalizedFifaMatch => Boolean(match)) : [];
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
      status: match.status,
      kickoffAt: match.kickoffAt,
      venue: match.venue,
      referee: match.referee,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      sourceKey: SOURCE_KEY,
      sourcePayload: match.raw,
      sourceUpdatedAt: new Date().toISOString(),
    });
    result.matchesUpserted += 1;
    if (match.statistics.length > 0) result.matchStatisticsInserted += await replaceWorldCupMatchStatistics(matchId, match.statistics, SOURCE_KEY);
  }

  if (matches.length === 0) notes.push('Nenhum jogo FIFA reconhecível foi encontrado no JSON ou nos PDFs oficiais.');
  if (matches.length > 0 && result.matchStatisticsInserted === 0) notes.push('Jogos FIFA reconhecidos, mas nenhuma estatística de equipe foi mapeada.');
  return result;
}
