import { normalizeWorldCupText } from './worldCupTeams';

export type WorldCupPlayerStats = {
  team: string;
  playerName: string;
  matches: number;
  minutes: number | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  source: 'fifa-match-report' | '365scores' | 'api-football' | 'manual';
  updatedAt: string;
};

/**
 * Base exclusiva da Copa do Mundo.
 * Deve ser populada pelo cron/importador quando os relatórios oficiais pós-jogo
 * ou as fontes ao vivo enviarem estatísticas individuais.
 */
export const worldCupPlayerStats: WorldCupPlayerStats[] = [];

export function findWorldCupPlayerStats(teamText: string, playerText: string): WorldCupPlayerStats | null {
  const teamKey = normalizeWorldCupText(teamText);
  const playerKey = normalizeWorldCupText(playerText);

  return (
    worldCupPlayerStats.find((item) => {
      const itemTeam = normalizeWorldCupText(item.team);
      const itemPlayer = normalizeWorldCupText(item.playerName);
      return (
        (itemTeam === teamKey || itemTeam.includes(teamKey) || teamKey.includes(itemTeam)) &&
        (itemPlayer === playerKey || itemPlayer.includes(playerKey) || playerKey.includes(itemPlayer))
      );
    }) ?? null
  );
}
