/**
 * Shared utility: fetch halftime corner statistics from SofaScore.
 * Used by both the API route and the AI chat route so they share
 * identical logic and identical results.
 */

const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';
const SS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
  'Cache-Control': 'no-cache',
};

export interface HalftimeTeamStats {
  team: string;
  teamId: number;
  matches: number;
  avgCorners1stHalf: number;
  avgCornersAgainst1stHalf: number;
  avgCorners2ndHalf: number;
  avgCornersAgainst2ndHalf: number;
  avgTotal1stHalf: number;
  avgTotal2ndHalf: number;
  avgTotalCorners: number;
}

export interface HalftimeResult {
  tournamentId: number;
  seasonId: number;
  teams: HalftimeTeamStats[];
  matchesAnalyzed: number;
  lastUpdated: string;
}

function round1(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 10) / 10 : 0;
}

/**
 * Fetch corner stats per half for a tournament.
 * Uses parallel requests so it's fast enough for server-side AI context.
 *
 * @param tournamentId  SofaScore unique-tournament id
 * @param seasonId      SofaScore season id
 * @param maxMatches    How many finished matches to analyse (default 20)
 */
export async function fetchHalftimeTeamStats(
  tournamentId: number,
  seasonId: number,
  maxMatches = 20
): Promise<HalftimeResult> {
  // ── 1. Fetch the list of recent events ───────────────────────────────────
  const eventsRes = await fetch(
    `${SOFASCORE_BASE}/unique-tournament/${tournamentId}/season/${seasonId}/events/last/0`,
    { headers: SS_HEADERS }
  );

  if (!eventsRes.ok) {
    throw new Error(`SofaScore events returned ${eventsRes.status}`);
  }

  const eventsData = (await eventsRes.json()) as {
    events?: Array<{
      id: number;
      homeTeam: { id: number; name: string };
      awayTeam: { id: number; name: string };
      status?: { type: string };
    }>;
  };

  const finished = (eventsData.events || [])
    .filter((e) => e.status?.type === 'finished')
    .slice(0, maxMatches);

  if (finished.length === 0) {
    return {
      tournamentId,
      seasonId,
      teams: [],
      matchesAnalyzed: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ── 2. Fetch ALL match statistics in PARALLEL ─────────────────────────────
  const statResults = await Promise.allSettled(
    finished.map(async (event) => {
      const res = await fetch(`${SOFASCORE_BASE}/event/${event.id}/statistics`, {
        headers: SS_HEADERS,
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        statistics?: Array<{
          period: string;
          groups: Array<{
            statisticsItems: Array<{
              key: string;
              name?: string;
              homeValue?: number;
              awayValue?: number;
              home?: string;
              away?: string;
            }>;
          }>;
        }>;
      };

      return { event, statistics: data.statistics || [] };
    })
  );

  // ── 3. Accumulate per-team stats ─────────────────────────────────────────
  const acc: Record<
    string,
    {
      team: string;
      teamId: number;
      m: number;
      c1: number; // home corners 1st half (from home team's perspective)
      ca1: number;
      c2: number;
      ca2: number;
      ct: number;
      cat: number;
    }
  > = {};

  const init = (id: string, name: string, teamId: number) => {
    if (!acc[id])
      acc[id] = { team: name, teamId, m: 0, c1: 0, ca1: 0, c2: 0, ca2: 0, ct: 0, cat: 0 };
  };

  for (const result of statResults) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const { event, statistics } = result.value;

    let h1 = 0,
      a1 = 0,
      h2 = 0,
      a2 = 0,
      ht = 0,
      at = 0;

    for (const period of statistics) {
      for (const group of period.groups) {
        for (const item of group.statisticsItems) {
          const isCorner =
            item.key === 'cornerKicks' || item.name?.toLowerCase().includes('corner');
          if (!isCorner) continue;

          const hv =
            item.homeValue !== undefined ? item.homeValue : parseInt(item.home || '0') || 0;
          const av =
            item.awayValue !== undefined ? item.awayValue : parseInt(item.away || '0') || 0;

          if (period.period === '1ST') {
            h1 = hv;
            a1 = av;
          } else if (period.period === '2ND') {
            h2 = hv;
            a2 = av;
          } else if (period.period === 'ALL') {
            ht = hv;
            at = av;
          }
        }
      }
    }

    // Skip match if SofaScore didn't provide per-half breakdowns
    if (h1 === 0 && a1 === 0 && h2 === 0 && a2 === 0) continue;

    init(String(event.homeTeam.id), event.homeTeam.name, event.homeTeam.id);
    init(String(event.awayTeam.id), event.awayTeam.name, event.awayTeam.id);

    const hk = String(event.homeTeam.id);
    acc[hk].m++;
    acc[hk].c1 += h1;
    acc[hk].ca1 += a1;
    acc[hk].c2 += h2;
    acc[hk].ca2 += a2;
    acc[hk].ct += ht;
    acc[hk].cat += at;

    const ak = String(event.awayTeam.id);
    acc[ak].m++;
    acc[ak].c1 += a1;
    acc[ak].ca1 += h1;
    acc[ak].c2 += a2;
    acc[ak].ca2 += h2;
    acc[ak].ct += at;
    acc[ak].cat += ht;
  }

  // ── 4. Build output array ────────────────────────────────────────────────
  const teams: HalftimeTeamStats[] = Object.values(acc)
    .filter((t) => t.m > 0)
    .map((t) => ({
      team: t.team,
      teamId: t.teamId,
      matches: t.m,
      avgCorners1stHalf: round1(t.c1, t.m),
      avgCornersAgainst1stHalf: round1(t.ca1, t.m),
      avgCorners2ndHalf: round1(t.c2, t.m),
      avgCornersAgainst2ndHalf: round1(t.ca2, t.m),
      avgTotal1stHalf: round1(t.c1 + t.ca1, t.m),
      avgTotal2ndHalf: round1(t.c2 + t.ca2, t.m),
      avgTotalCorners: round1(t.ct + t.cat, t.m),
    }))
    .sort((a, b) => b.avgTotal1stHalf - a.avgTotal1stHalf);

  const matchesWithData = statResults.filter(
    (r) => r.status === 'fulfilled' && r.value !== null
  ).length;

  return {
    tournamentId,
    seasonId,
    teams,
    matchesAnalyzed: matchesWithData,
    lastUpdated: new Date().toISOString(),
  };
}
