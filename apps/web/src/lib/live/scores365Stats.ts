type Match = {
  id: number;
  sourceIds?: { scores365?: number };
  competition?: string;
  homeTeam: { id: number };
  awayTeam: { id: number };
};

export type Scores365Statistic = {
  id?: number; name?: string; competitorId?: number; value?: number | string;
  categoryId?: number; categoryName?: string; isMajor?: boolean;
  order?: number; categoryOrder?: number;
};

export const MAX_SCORES365_STATS = 12;

// This endpoint accepts a list but returns statistics for its first game only.
// One request per event also prevents mixing counters from different fixtures.
export async function collectScores365Stats<T extends Match>(
  matches: T[], headers: HeadersInit, priorityIds: number[] = [],
): Promise<Map<number, { statistics: Scores365Statistic[]; observedAt: string }>> {
  const priority = new Map(priorityIds.map((id, index) => [id, index]));
  const rank = (match: T) => priority.get(match.sourceIds?.scores365 ?? match.id)
    ?? (priorityIds.length + (/brasileir[aã]o/i.test(match.competition ?? '') ? 0 : 1));
  const candidates = [...new Map([...matches].sort((a, b) => rank(a) - rank(b))
    .filter(m => Number.isSafeInteger(m.sourceIds?.scores365) && Number(m.sourceIds?.scores365) > 0)
    .map(m => [m.sourceIds!.scores365!, m])).values()].slice(0, MAX_SCORES365_STATS);
  const results = new Map<number, { statistics: Scores365Statistic[]; observedAt: string }>();
  await Promise.all(candidates.map(async match => {
    const id = match.sourceIds!.scores365!;
    try {
      const response = await fetch(`https://webws.365scores.com/web/game/stats/?appTypeId=5&langId=31&games=${id}`, {
        headers, cache: 'no-store', signal: AbortSignal.timeout(4_500),
      });
      if (!response.ok) return;
      const data = await response.json() as { statistics?: Scores365Statistic[]; games?: { id: number }[] };
      if (Array.isArray(data.games) && data.games.length && !data.games.some(game => game.id === id)) return;
      if (!Array.isArray(data.statistics)) return;
      const statistics = data.statistics.filter(stat =>
        stat.competitorId === match.homeTeam.id || stat.competitorId === match.awayTeam.id);
      if (statistics.length) results.set(id, { statistics, observedAt: new Date().toISOString() });
    } catch {
      // A failed or uncovered game must not discard successful games or the listing.
    }
  }));
  return results;
}
