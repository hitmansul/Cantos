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

function nullableText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nullableDate(value: string | null | undefined): string | null {
  const text = nullableText(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function calculateAge(dateOfBirth: string | null, now = new Date()): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime())) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
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
  const payload = JSON.stringify({
    code: team.code,
    page: team.page,
    coach: team.coach ?? null,
  });

  const rows = await sql`
    INSERT INTO world_cup_teams (
      competition_key,
      fifa_code,
      name,
      source_key,
      source_payload,
      source_updated_at
    )
    VALUES (
      ${WORLD_CUP_2026_KEY},
      ${nullableText(team.code)},
      ${team.team},
      'fifa',
      ${payload}::jsonb,
      ${sourceUpdatedAt}
    )
    ON CONFLICT (competition_key, fifa_code) DO UPDATE SET
      name = EXCLUDED.name,
      source_payload = EXCLUDED.source_payload,
      source_updated_at = EXCLUDED.source_updated_at,
      updated_at = NOW()
    RETURNING id
  `;

  return Number(rows[0]?.id);
}

async function upsertPlayer(
  teamId: number,
  player: FifaSquadPlayer,
  sourceUpdatedAt: string | null
): Promise<void> {
  const dateOfBirth = nullableDate(player.dateOfBirth);
  const payload = JSON.stringify({
    firstName: player.firstName,
    lastName: player.lastName,
    shirtName: player.shirtName,
    rawDateOfBirth: player.dateOfBirth,
  });

  await sql`
    INSERT INTO world_cup_players (
      team_id,
      shirt_number,
      name,
      position,
      club,
      height_cm,
      date_of_birth,
      age,
      source_key,
      source_payload,
      source_updated_at
    )
    VALUES (
      ${teamId},
      ${player.number},
      ${player.playerName},
      ${player.position},
      ${nullableText(player.club)},
      ${player.heightCm},
      ${dateOfBirth},
      ${calculateAge(dateOfBirth)},
      'fifa',
      ${payload}::jsonb,
      ${sourceUpdatedAt}
    )
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

export async function upsertFifaWorldCupSquads(
  teams: FifaSquad[],
  sourceUpdatedAt: string | null
): Promise<WorldCupImportResult> {
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

  return {
    competitionKey: WORLD_CUP_2026_KEY,
    teamsUpserted,
    playersUpserted,
    sourceUpdatedAt,
  };
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
      COUNT(*) FILTER (WHERE p.position = 'FW')::int AS forwards
    FROM world_cup_teams t
    LEFT JOIN world_cup_players p ON p.team_id = t.id
    WHERE t.competition_key = ${WORLD_CUP_2026_KEY}
  `;
  return rows[0] ?? null;
}
