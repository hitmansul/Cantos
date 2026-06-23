import sql from '@/app/api/utils/sql';
import type { FifaSquad, FifaSquadPlayer } from '@/lib/fifaWorldCup';
import { assertPersistentDatabaseConfigured } from './database';

export const WORLD_CUP_2026_KEY = 'world_cup_2026';

export type WorldCupImportResult = {
  competitionKey: string;
  teamsUpserted: number;
  playersUpserted: number;
  sourceUpdatedAt: string | null;
};

export type WorldCupMatchInput = {
  fixtureKey: string;
  fifaMatchId?: string | null;
  scores365EventId?: string | number | null;
  apiFootballFixtureId?: string | number | null;
  homeTeamName: string;
  awayTeamName: string;
  homeExternalId?: string | number | null;
  awayExternalId?: string | number | null;
  stage?: string | null;
  groupName?: string | null;
  roundName?: string | null;
  status?: string | null;
  kickoffAt?: string | null;
  venue?: string | null;
  referee?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  sourceKey: string;
  sourcePayload?: unknown;
  sourceUpdatedAt?: string | null;
};

export type WorldCupStandingInput = {
  teamName: string;
  teamExternalId?: string | number | null;
  groupName?: string | null;
  position?: number | null;
  played?: number | null;
  won?: number | null;
  drawn?: number | null;
  lost?: number | null;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  goalDifference?: number | null;
  points?: number | null;
  livePoints?: number | null;
  liveGoalDifference?: number | null;
  sourceKey: string;
  sourcePayload?: unknown;
  sourceUpdatedAt?: string | null;
};

export type WorldCupStatisticInput = {
  teamName?: string | null;
  teamExternalId?: string | number | null;
  teamSide?: 'home' | 'away' | null;
  teamId?: number | null;
  period?: string | null;
  metricKey: string;
  metricName: string;
  valueNumeric?: number | null;
  valueText?: string | null;
  sourceKey: string;
  sourcePayload?: unknown;
  sourceUpdatedAt?: string | null;
};

export type WorldCupPlayerStatisticInput = {
  playerName: string;
  teamName?: string | null;
  shirtNumber?: number | null;
  period?: string | null;
  metricKey: string;
  metricName: string;
  valueNumeric?: number | null;
  valueText?: string | null;
  sourceKey: string;
  sourcePayload?: unknown;
  sourceUpdatedAt?: string | null;
};

export type WorldCupPersistentImportResult = {
  matchesUpserted: number;
  matchStatisticsInserted: number;
  playerStatisticsInserted: number;
  standingsUpserted: number;
};

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\u0000/g, '').normalize('NFC').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace('%', '').replace(',', '.').trim());
  return Number.isFinite(number) ? number : null;
}

function cleanInteger(value: unknown): number | null {
  const number = cleanNumber(value);
  return number === null ? null : Math.trunc(number);
}

function nullableDate(value: string | null | undefined): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function nullableTimestamp(value: string | null | undefined): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function calculateAge(dateOfBirth: string | null, now = new Date()): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime())) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

function cleanJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null).replace(/\\u0000|\u0000/g, '')) as T;
}

function normalizeText(value: unknown): string {
  return cleanText(value)?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
}

const TEAM_ALIAS_TO_FIFA_NAME: Record<string, string> = {
  brasil: 'brazil',
  'estados unidos': 'usa',
  eua: 'usa',
  mexico: 'mexico',
  'coreia do sul': 'korea republic',
  coreia: 'korea republic',
  'africa do sul': 'south africa',
  alemanha: 'germany',
  espanha: 'spain',
  franca: 'france',
  inglaterra: 'england',
  argentina: 'argentina',
  portugal: 'portugal',
  marrocos: 'morocco',
  haiti: 'haiti',
  escocia: 'scotland',
  suica: 'switzerland',
  suecia: 'sweden',
  japao: 'japan',
  ira: 'ir iran',
  iran: 'ir iran',
  catar: 'qatar',
  'arabia saudita': 'saudi arabia',
  'costa do marfim': "cote d'ivoire",
  congo: 'congo dr',
  'rd congo': 'congo dr',
  'dr congo': 'congo dr',
  'republica democratica do congo': 'congo dr',
  holanda: 'netherlands',
  'paises baixos': 'netherlands',
  turquia: 'turkiye',
  egito: 'egypt',
  uruguai: 'uruguay',
  paraguai: 'paraguay',
  colombia: 'colombia',
  equador: 'ecuador',
  panama: 'panama',
  canada: 'canada',
  australia: 'australia',
  'nova zelandia': 'new zealand',
  uzbequistao: 'uzbekistan',
  tunisia: 'tunisia',
  argelia: 'algeria',
  gana: 'ghana',
  senegal: 'senegal',
  noruega: 'norway',
  belgica: 'belgium',
  croacia: 'croatia',
  austria: 'austria',
  iraque: 'iraq',
  jordania: 'jordan',
  curacao: 'curacao',
  tchequia: 'czechia',
  'republica tcheca': 'czechia',
  'cabo verde': 'cape verde islands',
  bosnia: 'bosnia and herzegovina',
  'bosnia e herzegovina': 'bosnia and herzegovina',
};

function canonicalTeamKey(value: unknown): string {
  const normalized = normalizeText(value);
  return TEAM_ALIAS_TO_FIFA_NAME[normalized] ?? normalized;
}

function slug(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, '_') || 'unknown';
}

async function ensureWorldCupCompetition(): Promise<void> {
  await sql`
    INSERT INTO data_sources (source_key, name, priority, base_url, notes)
    VALUES
      ('fifa', 'FIFA Football Data Platform', 1, 'https://fdp.fifa.org', 'Fonte principal da Copa do Mundo.'),
      ('365scores', '365Scores', 2, 'https://webws.365scores.com', 'Complemento para agenda, placar, tempo real e estatisticas ao vivo.'),
      ('api-football', 'API-Football', 3, 'https://v3.football.api-sports.io', 'Complemento para odds, arbitros, estatisticas e fixtures.'),
      ('local-static', 'Arquivos locais legados', 4, NULL, 'Compatibilidade temporaria ate a migracao completa para banco.')
    ON CONFLICT (source_key) DO UPDATE SET
      name = EXCLUDED.name,
      priority = EXCLUDED.priority,
      base_url = EXCLUDED.base_url,
      notes = EXCLUDED.notes,
      updated_at = NOW()
  `;

  await sql`
    INSERT INTO competitions (competition_key, name, season, country, type, source_priority, metadata)
    VALUES (
      ${WORLD_CUP_2026_KEY},
      'Copa do Mundo 2026',
      '2026',
      'FIFA',
      'cup',
      '["fifa", "365scores", "api-football"]'::jsonb,
      '{"status":"prepared_for_official_updates"}'::jsonb
    )
    ON CONFLICT (competition_key) DO UPDATE SET
      name = EXCLUDED.name,
      season = EXCLUDED.season,
      country = EXCLUDED.country,
      type = EXCLUDED.type,
      source_priority = EXCLUDED.source_priority,
      metadata = competitions.metadata || EXCLUDED.metadata,
      updated_at = NOW()
  `;
}

async function upsertTeam(team: FifaSquad, sourceUpdatedAt: string | null): Promise<number> {
  const payload = cleanJson({ code: cleanText(team.code), page: team.page, coach: team.coach ?? null });
  const rows = await sql`
    INSERT INTO world_cup_teams (competition_key, fifa_code, name, source_key, source_payload, source_updated_at)
    VALUES (${WORLD_CUP_2026_KEY}, ${cleanText(team.code)}, ${cleanText(team.team) ?? 'Selecao sem nome'}, 'fifa', ${JSON.stringify(payload)}::jsonb, ${nullableTimestamp(sourceUpdatedAt)})
    ON CONFLICT (competition_key, fifa_code) DO UPDATE SET
      name = EXCLUDED.name,
      source_payload = EXCLUDED.source_payload,
      source_updated_at = EXCLUDED.source_updated_at,
      updated_at = NOW()
    RETURNING id
  `;
  return Number(rows[0]?.id);
}

async function upsertPlayer(teamId: number, player: FifaSquadPlayer, sourceUpdatedAt: string | null): Promise<void> {
  const dateOfBirth = nullableDate(player.dateOfBirth);
  const payload = cleanJson({ firstName: cleanText(player.firstName), lastName: cleanText(player.lastName), shirtName: cleanText(player.shirtName), rawDateOfBirth: cleanText(player.dateOfBirth) });
  await sql`
    INSERT INTO world_cup_players (team_id, shirt_number, name, position, club, height_cm, date_of_birth, age, source_key, source_payload, source_updated_at)
    VALUES (${teamId}, ${cleanInteger(player.number)}, ${cleanText(player.playerName) ?? 'Jogador sem nome'}, ${cleanText(player.position)}, ${cleanText(player.club)}, ${cleanInteger(player.heightCm)}, ${dateOfBirth}, ${calculateAge(dateOfBirth)}, 'fifa', ${JSON.stringify(payload)}::jsonb, ${nullableTimestamp(sourceUpdatedAt)})
    ON CONFLICT (team_id, shirt_number, name) DO UPDATE SET
      position = EXCLUDED.position,
      club = EXCLUDED.club,
      height_cm = EXCLUDED.height_cm,
      date_of_birth = EXCLUDED.date_of_birth,
      age = EXCLUDED.age,
      source_payload = EXCLUDED.source_payload,
      source_updated_at = EXCLUDED.source_updated_at,
      updated_at = NOW()
  `;
}

async function resolveWorldCupTeamId(teamName: string, sourceKey: string, externalId?: string | number | null): Promise<number> {
  const targetKey = canonicalTeamKey(teamName);
  const teams = await sql`SELECT id, name, fifa_code FROM world_cup_teams WHERE competition_key = ${WORLD_CUP_2026_KEY}`;
  const matched = teams.find((row) => {
    const nameKey = canonicalTeamKey(row.name);
    const codeKey = normalizeText(row.fifa_code);
    return nameKey === targetKey || codeKey === targetKey || nameKey.includes(targetKey) || targetKey.includes(nameKey);
  });
  if (matched?.id) return Number(matched.id);

  const fallbackCode = `${sourceKey.toUpperCase().replace(/[^A-Z0-9]/g, '')}_${externalId ?? slug(teamName)}`;
  const payload = cleanJson({ externalId: externalId ?? null, originalName: teamName });
  const rows = await sql`
    INSERT INTO world_cup_teams (competition_key, fifa_code, name, source_key, source_payload, source_updated_at)
    VALUES (${WORLD_CUP_2026_KEY}, ${fallbackCode}, ${cleanText(teamName) ?? 'Selecao sem nome'}, ${sourceKey}, ${JSON.stringify(payload)}::jsonb, NOW())
    ON CONFLICT (competition_key, fifa_code) DO UPDATE SET
      name = EXCLUDED.name,
      source_payload = EXCLUDED.source_payload,
      source_updated_at = EXCLUDED.source_updated_at,
      updated_at = NOW()
    RETURNING id
  `;
  return Number(rows[0]?.id);
}

async function findWorldCupPlayerId(playerName: string, teamName?: string | null, shirtNumber?: number | null): Promise<number | null> {
  const targetPlayer = normalizeText(playerName);
  const targetTeam = teamName ? canonicalTeamKey(teamName) : null;
  const rows = await sql`
    SELECT p.id, p.name, p.shirt_number, t.name AS team_name
    FROM world_cup_players p
    JOIN world_cup_teams t ON t.id = p.team_id
    WHERE t.competition_key = ${WORLD_CUP_2026_KEY}
  `;
  const matched = rows.find((row) => {
    const samePlayer = normalizeText(row.name) === targetPlayer;
    const sameNumber = shirtNumber ? Number(row.shirt_number) === shirtNumber : true;
    const sameTeam = targetTeam ? canonicalTeamKey(row.team_name) === targetTeam : true;
    return samePlayer && sameNumber && sameTeam;
  });
  return matched?.id ? Number(matched.id) : null;
}

export async function upsertFifaWorldCupSquads(teams: FifaSquad[], sourceUpdatedAt: string | null): Promise<WorldCupImportResult> {
  assertPersistentDatabaseConfigured();
  await ensureWorldCupCompetition();
  let teamsUpserted = 0;
  let playersUpserted = 0;
  for (const team of teams) {
    const teamId = await upsertTeam(team, sourceUpdatedAt);
    teamsUpserted += 1;
    for (const player of team.players) {
      await upsertPlayer(teamId, player, sourceUpdatedAt);
      playersUpserted += 1;
    }
  }
  return { competitionKey: WORLD_CUP_2026_KEY, teamsUpserted, playersUpserted, sourceUpdatedAt };
}

export async function upsertWorldCupMatch(input: WorldCupMatchInput): Promise<number> {
  assertPersistentDatabaseConfigured();
  await ensureWorldCupCompetition();
  const fixtureKey = cleanText(input.fixtureKey) ?? `${slug(input.homeTeamName)}_${slug(input.awayTeamName)}_${Date.now()}`;
  const homeTeamId = await resolveWorldCupTeamId(input.homeTeamName, input.sourceKey, input.homeExternalId);
  const awayTeamId = await resolveWorldCupTeamId(input.awayTeamName, input.sourceKey, input.awayExternalId);
  const payload = cleanJson(input.sourcePayload ?? input);
  const existing = await sql`SELECT id FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} AND fixture_key = ${fixtureKey} LIMIT 1`;

  if (existing[0]?.id) {
    const rows = await sql`
      UPDATE world_cup_matches SET
        fifa_match_id = COALESCE(${cleanText(input.fifaMatchId)}, fifa_match_id),
        scores365_event_id = COALESCE(${cleanText(input.scores365EventId)}, scores365_event_id),
        api_football_fixture_id = COALESCE(${cleanText(input.apiFootballFixtureId)}, api_football_fixture_id),
        home_team_id = ${homeTeamId},
        away_team_id = ${awayTeamId},
        home_team_name = ${cleanText(input.homeTeamName) ?? 'Mandante'},
        away_team_name = ${cleanText(input.awayTeamName) ?? 'Visitante'},
        stage = ${cleanText(input.stage)},
        group_name = ${cleanText(input.groupName)},
        round_name = ${cleanText(input.roundName)},
        status = ${cleanText(input.status) ?? 'unknown'},
        kickoff_at = ${nullableTimestamp(input.kickoffAt)},
        venue = ${cleanText(input.venue)},
        referee = ${cleanText(input.referee)},
        home_score = ${cleanInteger(input.homeScore)},
        away_score = ${cleanInteger(input.awayScore)},
        source_key = ${input.sourceKey},
        source_payload = ${JSON.stringify(payload)}::jsonb,
        source_updated_at = ${nullableTimestamp(input.sourceUpdatedAt) ?? new Date().toISOString()},
        updated_at = NOW()
      WHERE id = ${Number(existing[0].id)}
      RETURNING id
    `;
    return Number(rows[0]?.id);
  }

  const rows = await sql`
    INSERT INTO world_cup_matches (competition_key, fixture_key, fifa_match_id, scores365_event_id, api_football_fixture_id, home_team_id, away_team_id, home_team_name, away_team_name, stage, group_name, round_name, status, kickoff_at, venue, referee, home_score, away_score, source_key, source_payload, source_updated_at)
    VALUES (${WORLD_CUP_2026_KEY}, ${fixtureKey}, ${cleanText(input.fifaMatchId)}, ${cleanText(input.scores365EventId)}, ${cleanText(input.apiFootballFixtureId)}, ${homeTeamId}, ${awayTeamId}, ${cleanText(input.homeTeamName) ?? 'Mandante'}, ${cleanText(input.awayTeamName) ?? 'Visitante'}, ${cleanText(input.stage)}, ${cleanText(input.groupName)}, ${cleanText(input.roundName)}, ${cleanText(input.status) ?? 'unknown'}, ${nullableTimestamp(input.kickoffAt)}, ${cleanText(input.venue)}, ${cleanText(input.referee)}, ${cleanInteger(input.homeScore)}, ${cleanInteger(input.awayScore)}, ${input.sourceKey}, ${JSON.stringify(payload)}::jsonb, ${nullableTimestamp(input.sourceUpdatedAt) ?? new Date().toISOString()})
    RETURNING id
  `;
  return Number(rows[0]?.id);
}

export async function replaceWorldCupMatchStatistics(matchId: number, statistics: WorldCupStatisticInput[], sourceKey = '365scores'): Promise<number> {
  assertPersistentDatabaseConfigured();
  await sql`DELETE FROM world_cup_match_statistics WHERE match_id = ${matchId} AND source_key = ${sourceKey}`;
  let inserted = 0;
  for (const stat of statistics) {
    const teamId = stat.teamId ?? (stat.teamName ? await resolveWorldCupTeamId(stat.teamName, stat.sourceKey, stat.teamExternalId) : null);
    if (!teamId) continue;
    const payload = cleanJson(stat.sourcePayload ?? stat);
    await sql`
      INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, value_text, source_key, source_payload, source_updated_at)
      VALUES (${matchId}, ${teamId}, ${cleanText(stat.period) ?? 'match'}, ${cleanText(stat.metricKey) ?? 'unknown'}, ${cleanText(stat.metricName) ?? 'Estatística'}, ${cleanNumber(stat.valueNumeric)}, ${cleanText(stat.valueText)}, ${stat.sourceKey}, ${JSON.stringify(payload)}::jsonb, ${nullableTimestamp(stat.sourceUpdatedAt) ?? new Date().toISOString()})
    `;
    inserted += 1;
  }
  return inserted;
}

export async function replaceWorldCupPlayerStatistics(matchId: number, statistics: WorldCupPlayerStatisticInput[], sourceKey = '365scores'): Promise<number> {
  assertPersistentDatabaseConfigured();
  await sql`DELETE FROM world_cup_player_statistics WHERE match_id = ${matchId} AND source_key = ${sourceKey}`;
  let inserted = 0;
  for (const stat of statistics) {
    const playerId = await findWorldCupPlayerId(stat.playerName, stat.teamName, stat.shirtNumber);
    if (!playerId) continue;
    const payload = cleanJson(stat.sourcePayload ?? stat);
    await sql`
      INSERT INTO world_cup_player_statistics (match_id, player_id, period, metric_key, metric_name, value_numeric, value_text, source_key, source_payload, source_updated_at)
      VALUES (${matchId}, ${playerId}, ${cleanText(stat.period) ?? 'match'}, ${cleanText(stat.metricKey) ?? 'unknown'}, ${cleanText(stat.metricName) ?? 'Estatística'}, ${cleanNumber(stat.valueNumeric)}, ${cleanText(stat.valueText)}, ${stat.sourceKey}, ${JSON.stringify(payload)}::jsonb, ${nullableTimestamp(stat.sourceUpdatedAt) ?? new Date().toISOString()})
    `;
    inserted += 1;
  }
  return inserted;
}

export async function replaceWorldCupStandings(standings: WorldCupStandingInput[], sourceKey = '365scores'): Promise<number> {
  assertPersistentDatabaseConfigured();
  await ensureWorldCupCompetition();
  await sql`DELETE FROM world_cup_standings WHERE competition_key = ${WORLD_CUP_2026_KEY} AND source_key = ${sourceKey}`;
  let inserted = 0;
  for (const standing of standings) {
    const teamId = await resolveWorldCupTeamId(standing.teamName, standing.sourceKey, standing.teamExternalId);
    const payload = cleanJson(standing.sourcePayload ?? standing);
    const goalsFor = cleanInteger(standing.goalsFor) ?? 0;
    const goalsAgainst = cleanInteger(standing.goalsAgainst) ?? 0;
    const goalDifference = cleanInteger(standing.goalDifference) ?? goalsFor - goalsAgainst;
    await sql`
      INSERT INTO world_cup_standings (competition_key, team_id, group_name, position, played, won, drawn, lost, goals_for, goals_against, goal_difference, points, live_points, live_goal_difference, source_key, source_payload, source_updated_at)
      VALUES (${WORLD_CUP_2026_KEY}, ${teamId}, ${cleanText(standing.groupName)}, ${cleanInteger(standing.position) ?? 0}, ${cleanInteger(standing.played) ?? 0}, ${cleanInteger(standing.won) ?? 0}, ${cleanInteger(standing.drawn) ?? 0}, ${cleanInteger(standing.lost) ?? 0}, ${goalsFor}, ${goalsAgainst}, ${goalDifference}, ${cleanInteger(standing.points) ?? 0}, ${cleanInteger(standing.livePoints) ?? cleanInteger(standing.points) ?? 0}, ${cleanInteger(standing.liveGoalDifference) ?? goalDifference}, ${standing.sourceKey}, ${JSON.stringify(payload)}::jsonb, ${nullableTimestamp(standing.sourceUpdatedAt) ?? new Date().toISOString()})
    `;
    inserted += 1;
  }
  return inserted;
}

export async function getWorldCupDatabaseSummary() {
  assertPersistentDatabaseConfigured();
  const rows = await sql`
    SELECT
      COUNT(DISTINCT t.id)::int AS teams,
      COUNT(p.id)::int AS players,
      COUNT(*) FILTER (WHERE p.position = 'GK')::int AS goalkeepers,
      COUNT(*) FILTER (WHERE p.position = 'DF')::int AS defenders,
      COUNT(*) FILTER (WHERE p.position = 'MF')::int AS midfielders,
      COUNT(*) FILTER (WHERE p.position = 'FW')::int AS forwards,
      (SELECT COUNT(*)::int FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY}) AS matches,
      (SELECT COUNT(*)::int FROM world_cup_match_statistics ms JOIN world_cup_matches m ON m.id = ms.match_id WHERE m.competition_key = ${WORLD_CUP_2026_KEY}) AS match_statistics,
      (SELECT COUNT(*)::int FROM world_cup_player_statistics ps JOIN world_cup_matches m ON m.id = ps.match_id WHERE m.competition_key = ${WORLD_CUP_2026_KEY}) AS player_statistics,
      (SELECT COUNT(*)::int FROM world_cup_standings WHERE competition_key = ${WORLD_CUP_2026_KEY}) AS standings
    FROM world_cup_teams t
    LEFT JOIN world_cup_players p ON p.team_id = t.id
    WHERE t.competition_key = ${WORLD_CUP_2026_KEY}
  `;
  return rows[0] ?? null;
}
