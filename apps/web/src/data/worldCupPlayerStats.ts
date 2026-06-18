export type WorldCupPlayerStats = {
  playerName: string;
  team: string;
  matches?: number | null;
  minutes?: number | null;
  goals?: number | null;
  assists?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
};

export const worldCupPlayerStats: WorldCupPlayerStats[] = [];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findWorldCupPlayerStats(
  playerName: string,
  team?: string
): WorldCupPlayerStats | null {
  const playerKey = normalize(playerName);
  const teamKey = team ? normalize(team) : '';

  return (
    worldCupPlayerStats.find((item) => {
      const samePlayer = normalize(item.playerName) === playerKey;
      const sameTeam = !teamKey || normalize(item.team) === teamKey;
      return samePlayer && sameTeam;
    }) ?? null
  );
}
