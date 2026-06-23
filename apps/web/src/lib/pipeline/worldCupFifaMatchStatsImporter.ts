import {
  replaceWorldCupMatchStatistics,
  upsertWorldCupMatch,
  type WorldCupStatisticInput,
} from '@/lib/persistence/worldCupRepository';

const SOURCE_KEY = 'fifa';

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
  if (key.includes('save')) return 'goalkeeper_saves';
  if (key.includes('expected') || key === 'xg') return 'expected_goals';
  if (key.includes('pass accuracy')) return 'pass_accuracy';
  if (key.includes('pass')) return 'passes';
  return key.replace(/\s+/g, '_');
}

function extractTeamName(team: unknown): string | null {
  const record = asRecord(team);
  if (!record) return textValue(team);
  return textValue(
    record.name,
    record.teamName,
    record.shortName,
    record.abbreviation,
    asRecord(record.team)?.name,
    asRecord(record.competitor)?.name
  );
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

function rowToStatistic(row: unknown, homeName: string, awayName: string, matchRaw: unknown): WorldCupStatisticInput[] {
  const record = asRecord(row);
  if (!record) return [];

  const name = textValue(record.name, record.metricName, record.metric, record.title, record.label, record.type) ?? 'Estatística';
  const key = metricKey(name);
  const period = textValue(record.period, record.phase) ?? 'match';

  const homeValue = record.homeValue ?? record.home ?? record.homeTeamValue ?? record.valueHome ?? record.home_value;
  const awayValue = record.awayValue ?? record.away ?? record.awayTeamValue ?? record.valueAway ?? record.away_value;

  if (homeValue !== undefined || awayValue !== undefined) {
    return [
      buildStatistic(homeName, 'home', key, name, homeValue, period, row),
      buildStatistic(awayName, 'away', key, name, awayValue, period, row),
    ];
  }

  const teamName = extractTeamName(record.team ?? record.competitor) ?? textValue(record.teamName, record.competitorName);
  const side = normalize(teamName) === normalize(homeName) ? 'home' : normalize(teamName) === normalize(awayName) ? 'away' : null;
  const value = record.value ?? record.statValue ?? record.amount ?? record.total;

  if (teamName && value !== undefined) {
    return [buildStatistic(teamName, side, key, name, value, period, row)];
  }

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
    return [
      buildStatistic(homeName, 'home', key, name, homeFromPayload, period, row),
      buildStatistic(awayName, 'away', key, name, awayFromPayload, period, row),
    ];
  }

  return [];
}

function buildStatistic(
  teamName: string,
  side: 'home' | 'away' | null,
  key: string,
  name: string,
  value: unknown,
  period: string,
  sourcePayload: unknown
): WorldCupStatisticInput {
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
    roundName: textValue(match.roundName, match.stage, match.round, match.phase),
    venue: textValue(match.venue, asRecord(match.stadium)?.name),
    referee: textValue(match.referee, asRecord(match.referee)?.name),
    raw,
    statistics,
  };
}

async function fetchConfiguredFifaPayload(): Promise<unknown | null> {
  const url = process.env.FIFA_WORLD_CUP_STATS_URL ?? process.env.FIFA_WORLD_CUP_MATCH_REPORTS_URL;
  if (!url) return null;

  const response = await fetch(url, {
    headers: { accept: 'application/json,text/plain,*/*' },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`FIFA stats source returned ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json();

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('FIFA stats source did not return valid JSON.');
  }
}

export async function importWorldCupFromFifaStats(): Promise<FifaWorldCupStatsImportResult> {
  const notes: string[] = [];
  const result: FifaWorldCupStatsImportResult = {
    source: SOURCE_KEY,
    configured: Boolean(process.env.FIFA_WORLD_CUP_STATS_URL ?? process.env.FIFA_WORLD_CUP_MATCH_REPORTS_URL),
    matchesFetched: 0,
    matchesUpserted: 0,
    matchStatisticsInserted: 0,
    notes,
  };

  const payload = await fetchConfiguredFifaPayload();
  if (!payload) {
    notes.push('FIFA_WORLD_CUP_STATS_URL não configurada. Elencos FIFA continuam como fonte oficial; estatísticas pós-jogo usam fallback 365Scores.');
    return result;
  }

  const rawMatches = findArrayDeep(payload, ['matches', 'games', 'fixtures', 'data']);
  const matches = rawMatches.map(normalizeMatch).filter((match): match is NormalizedFifaMatch => Boolean(match));
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

    if (match.statistics.length > 0) {
      result.matchStatisticsInserted += await replaceWorldCupMatchStatistics(matchId, match.statistics, SOURCE_KEY);
    }
  }

  if (matches.length === 0) notes.push('Fonte FIFA configurada, mas nenhum jogo reconhecível foi encontrado no JSON.');
  if (matches.length > 0 && result.matchStatisticsInserted === 0) notes.push('Jogos FIFA reconhecidos, mas nenhuma estatística de equipe foi mapeada.');

  return result;
}
