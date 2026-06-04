import { gunzipSync } from 'node:zlib';
import { FIFA_WC_SQUADS_SNAPSHOT_PART_1 } from './fifaWorldCupSquadsSnapshotPart1';
import { FIFA_WC_SQUADS_SNAPSHOT_PART_2 } from './fifaWorldCupSquadsSnapshotPart2';
import { FIFA_WC_SQUADS_SNAPSHOT_PART_3 } from './fifaWorldCupSquadsSnapshotPart3';
import { FIFA_WC_SQUADS_SNAPSHOT_PART_4 } from './fifaWorldCupSquadsSnapshotPart4';
import { FIFA_WC_SQUADS_SNAPSHOT_PART_5 } from './fifaWorldCupSquadsSnapshotPart5';

const SNAPSHOT_GZIP_BASE64 = [
  FIFA_WC_SQUADS_SNAPSHOT_PART_1,
  FIFA_WC_SQUADS_SNAPSHOT_PART_2,
  FIFA_WC_SQUADS_SNAPSHOT_PART_3,
  FIFA_WC_SQUADS_SNAPSHOT_PART_4,
  FIFA_WC_SQUADS_SNAPSHOT_PART_5,
].join('');

let parsedSnapshot: unknown | null = null;

type CompactTeam = [
  string,
  string,
  number,
  [string, string] | null,
  Array<[number, 'GK' | 'DF' | 'MF' | 'FW', string, string, number | null]>,
];

export function getFifaWorldCupSquadsSnapshot(): unknown {
  if (parsedSnapshot) return parsedSnapshot;

  const compact = JSON.parse(gunzipSync(Buffer.from(SNAPSHOT_GZIP_BASE64, 'base64')).toString('utf8')) as {
    s: Record<string, unknown>;
    g: string;
    t: CompactTeam[];
  };

  const teams = compact.t.map(([team, code, page, coach, players]) => ({
    team,
    code,
    page,
    coach: coach
      ? { name: coach[0], firstName: '', lastName: '', nationality: coach[1] }
      : undefined,
    players: players.map(([number, position, playerName, club, heightCm]) => ({
      number,
      position,
      playerName,
      firstName: '',
      lastName: '',
      shirtName: playerName,
      dateOfBirth: '',
      club,
      heightCm,
    })),
  }));

  parsedSnapshot = {
    source: compact.s,
    generatedAt: compact.g,
    totalTeams: teams.length,
    totalPlayers: teams.reduce((sum, team) => sum + team.players.length, 0),
    teams,
  };

  return parsedSnapshot;
}
