import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';
import {
  replaceWorldCupMatchStatistics,
  replaceWorldCupStandings,
  upsertWorldCupMatch,
  type WorldCupStatisticInput,
  type WorldCupStandingInput,
} from '@/lib/persistence/worldCupRepository';

const SOURCE_KEY = '365scores';
const LEAGUE_KEY = 'copa_do_mundo';

export type Scores365WorldCupImportResult = {
  source: typeof SOURCE_KEY;
  competition: typeof LEAGUE_KEY;
  matchesFetched: number;
  matchesUpserted: number;
  matchStatisticsInserted: number;
  standingsFetched: number;
  standingsUpserted: number;
  playerStatisticsInserted: number;
  notes: string[];
};

type Raw365Game = {
  id: number;
  statusId?: number;
  statusText?: string;
  startTime: string;
  roundNum?: number;
  roundName?: string;
  homeCompetitor: {
    id: number;
    name: string;
    score?: number;
    symbolicName?: string;
    color?: string;
  };
  awayCompetitor: {
    id: number;
    name: string;
    score?: number;
    symbolicName?: string;
    color?: string;
  };
};

type Scores365Statistic = {
  id?: number;
  name?: string;
  competitorId?: number;
  categoryId?: number;
  categoryName?: string;
  isMajor?: boolean;
  value?: number | string;
  order?: number;
  categoryOrder?: number;
};

type Raw365StandingRow = {
  groupNum?: number;
  position: number;
  competitor: {
    id: number;
    name: string;
    symbolicName?: string;
  };
  gamePlayed: number;
  gamesWon: number;
  gamesEven: number;
  gamesLost: number;
  for: number;
  against: number;
  ratio: number;
  points: number;
};

type Raw365Standing = {
  name?: string;
  groups?: Array<{ num: number; name: string }>;
  rows: Raw365StandingRow[];
};

function nowIso() {
  return new Date().toISOString();
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace('%', '').replace(',', '.').trim());
  return Number.isFinite(number) ? number : null;
}

function fixtureKey(game: Raw365Game): string {
  const date = Number.isFinite(Date.parse(game.startTime))
    ? new Date(game.startTime).toISOString().slice(0, 10)
    : game.startTime.slice(0, 10);
  return [
    'scores365',
    game.id,
    date,
    normalize(game.homeCompetitor.name).replace(/\s+/g, '_'),
    normalize(game.awayCompetitor.name).replace(/\s+/g, '_'),
  ].join(':');
}

function matchStatus(game: Raw365Game): string {
  if (game.statusId === 3) return 'finished';
  if (game.statusId === 2) return 'live';
  if (game.statusId === 1) return 'scheduled';
  const text = normalize(game.statusText);
  if (text.includes('final') || text.includes('encerr') || text.includes('finished')) return 'finished';
  if (text.includes('live') || text.includes('vivo')) return 'live';
  return game.statusText ?? 'unknown';
}

function metricKey(name?: string) {
  const key = normalize(name);
  if (!key) return 'unknown';
  if (key.includes('corner') || key.includes('escanteio')) return 'corners';
  if (key.includes('yellow')) return 'yellow_cards';
  if (key.includes('red')) return 'red_cards';
  if (key.includes('possession') || key.includes('posse')) return 'possession';
  if (key.includes('shots on') || key.includes('chutes no gol') || key.includes('finalizacoes no gol')) return 'shots_on_target';
  if (key.includes('shot') || key.includes('chute') || key.includes('finaliz')) return 'shots';
  if (key.includes('foul') || key.includes('falta')) return 'fouls';
  if (key.includes('offside') || key.includes('imped')) return 'offsides';
  if (key.includes('save') || key.includes('defesa')) return 'goalkeeper_saves';
  if (key.includes('xg') || key.includes('expected')) return 'expected_goals';
  return key.replace(/\s+/g, '_');
}

function extractStatisticsForGame(game: Raw365Game, rawStats: Scores365Statistic[]): WorldCupStatisticInput[] {
  const rows: WorldCupStatisticInput[] = [];
  const seen = new Set<string>();

  for (const stat of rawStats) {
    if (stat.competitorId !== game.homeCompetitor.id && stat.competitorId !== game.awayCompetitor.id) continue;

    const side = stat.competitorId === game.homeCompetitor.id ? 'home' : 'away';
    const team = side === 'home' ? game.homeCompetitor : game.awayCompetitor;
    const normalizedMetricKey = metricKey(stat.name);
    const dedupeKey = `${team.id}:match:${normalizedMetricKey}`;

    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const valueNumeric = cleanNumber(stat.value);
    rows.push({
      teamName: team.name,
      teamExternalId: team.id,
      teamSide: side,
      period: 'match',
      metricKey: normalizedMetricKey,
      metricName: stat.name ?? 'Estatística',
      valueNumeric,
      valueText: valueNumeric === null ? String(stat.value ?? '') : null,
      sourceKey: SOURCE_KEY,
      sourcePayload: stat,
      sourceUpdatedAt: nowIso(),
    });
  }

  return rows;
}

function groupNameForRow(standing: Raw365Standing, row: Raw365StandingRow): string | null {
  const group = standing.groups?.find((item) => item.num === row.groupNum);
  return group?.name ?? standing.name ?? null;
}

async function fetchWorldCupResults(): Promise<Raw365Game[]> {
  const competition = SCORES365_COMPETITIONS[LEAGUE_KEY];
  if (!competition) return [];

  const data = (await scores365Get('/web/games/results/', {
    competitions: competition.id.toString(),
  })) as { games?: Raw365Game[] };

  return data.games ?? [];
}

async function fetchWorldCupStandings(): Promise<Raw365Standing[]> {
  const competition = SCORES365_COMPETITIONS[LEAGUE_KEY];
  if (!competition) return [];

  const data = (await scores365Get('/web/standings/', {
    competitions: competition.id.toString(),
  })) as { standings?: Raw365Standing[] };

  return data.standings ?? [];
}

async function fetchGameStatistics(games: Raw365Game[]): Promise<Scores365Statistic[]> {
  const ids = games.map((game) => game.id).filter((id) => Number.isFinite(id));
  if (ids.length === 0) return [];

  const data = (await scores365Get('/web/game/stats/', {
    games: ids.join(','),
  })) as { statistics?: Scores365Statistic[] };

  return data.statistics ?? [];
}

export async function importWorldCupFrom365Scores(): Promise<Scores365WorldCupImportResult> {
  const notes: string[] = [];
  const result: Scores365WorldCupImportResult = {
    source: SOURCE_KEY,
    competition: LEAGUE_KEY,
    matchesFetched: 0,
    matchesUpserted: 0,
    matchStatisticsInserted: 0,
    standingsFetched: 0,
    standingsUpserted: 0,
    playerStatisticsInserted: 0,
    notes,
  };

  const games = await fetchWorldCupResults();
  result.matchesFetched = games.length;

  const stats = games.length > 0 ? await fetchGameStatistics(games).catch((error) => {
    notes.push(`Estatísticas de jogo não importadas: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    return [] as Scores365Statistic[];
  }) : [];

  for (const game of games) {
    const matchId = await upsertWorldCupMatch({
      fixtureKey: fixtureKey(game),
      scores365EventId: game.id,
      homeTeamName: game.homeCompetitor.name,
      awayTeamName: game.awayCompetitor.name,
      homeExternalId: game.homeCompetitor.id,
      awayExternalId: game.awayCompetitor.id,
      stage: 'Copa do Mundo 2026',
      roundName: game.roundName ?? (game.roundNum ? `Rodada ${game.roundNum}` : null),
      status: matchStatus(game),
      kickoffAt: game.startTime,
      homeScore: game.homeCompetitor.score ?? null,
      awayScore: game.awayCompetitor.score ?? null,
      sourceKey: SOURCE_KEY,
      sourcePayload: game,
      sourceUpdatedAt: nowIso(),
    });
    result.matchesUpserted += 1;

    const gameStats = extractStatisticsForGame(game, stats);
    if (gameStats.length > 0) {
      result.matchStatisticsInserted += await replaceWorldCupMatchStatistics(matchId, gameStats, SOURCE_KEY);
    }
  }

  const standings = await fetchWorldCupStandings();
  const standingRows: WorldCupStandingInput[] = standings.flatMap((standing) =>
    (standing.rows ?? []).map((row) => ({
      teamName: row.competitor.name,
      teamExternalId: row.competitor.id,
      groupName: groupNameForRow(standing, row),
      position: row.position,
      played: row.gamePlayed,
      won: row.gamesWon,
      drawn: row.gamesEven,
      lost: row.gamesLost,
      goalsFor: row.for,
      goalsAgainst: row.against,
      goalDifference: row.ratio,
      points: row.points,
      livePoints: row.points,
      liveGoalDifference: row.ratio,
      sourceKey: SOURCE_KEY,
      sourcePayload: row,
      sourceUpdatedAt: nowIso(),
    }))
  );

  result.standingsFetched = standingRows.length;
  if (standingRows.length > 0) {
    result.standingsUpserted = await replaceWorldCupStandings(standingRows, SOURCE_KEY);
  }

  if (games.length === 0) {
    notes.push('A 365Scores não retornou resultados finalizados da Copa do Mundo para importar agora.');
  }
  if (standingRows.length === 0) {
    notes.push('A 365Scores não retornou classificação da Copa do Mundo para importar agora.');
  }
  notes.push('Estatísticas de jogadores ainda dependem de endpoint com dados individuais por atleta. Nenhum dado fictício foi criado.');

  return result;
}
