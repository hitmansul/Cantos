/**
 * Comprehensive sync endpoint:
 * 1. Imports upcoming fixtures for all major leagues from Sofascore
 * 2. Auto-fills corners for pending (past, no data) matches from Sofascore
 *
 * Usage: POST /api/admin/sync-all
 *   body: { task: 'import' | 'fill' | 'all', leagues?: string[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { isAdmin } from '@/app/api/utils/adminAuth';

// ── Sofascore config ──────────────────────────────────────────────────────────
const SF_BASE = 'https://api.sofascore.com/api/v1';
const SF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
};

async function sfFetch(path: string): Promise<unknown> {
  const res = await fetch(`${SF_BASE}${path}`, { headers: SF_HEADERS });
  if (!res.ok) throw new Error(`Sofascore ${res.status}: ${path}`);
  return res.json();
}

// ── League → Sofascore tournament+season mappings ────────────────────────────
// IMPORTANT: tid = tournament ID (stable), sid = season ID (changes each year)
// Season IDs below are for the 2025/2026 season
export const SOFASCORE_LEAGUES: Record<
  string,
  { tid: number; sid: number; name: string; country: string }
> = {
  // Brasil
  brasileirao_a: { tid: 325, sid: 58766, name: 'Brasileirão Série A', country: 'Brasil' },
  brasileirao_b: { tid: 390, sid: 58767, name: 'Brasileirão Série B', country: 'Brasil' },
  copa_do_brasil: { tid: 339, sid: 58770, name: 'Copa do Brasil', country: 'Brasil' },
  // América do Sul
  libertadores: { tid: 384, sid: 58771, name: 'Copa Libertadores', country: 'CONMEBOL' },
  sudamericana: { tid: 480, sid: 58772, name: 'Copa Sul-Americana', country: 'CONMEBOL' },
  argentina: { tid: 155, sid: 61650, name: 'Liga Profesional', country: 'Argentina' },
  chile_primera: { tid: 238, sid: 61648, name: 'Primera División', country: 'Chile' },
  colombia_liga: { tid: 240, sid: 62150, name: 'Liga BetPlay', country: 'Colômbia' },
  ecuador_liga: { tid: 240, sid: 62156, name: 'Liga Pro', country: 'Equador' },
  peru_liga: { tid: 406, sid: 62155, name: 'Liga 1', country: 'Peru' },
  uruguay_primera: { tid: 278, sid: 62161, name: 'Primera División', country: 'Uruguai' },
  // América do Norte
  mls: { tid: 242, sid: 62821, name: 'MLS', country: 'EUA' },
  liga_mx: { tid: 352, sid: 62820, name: 'Liga MX', country: 'México' },
  // Europa Top 5
  premier_league: { tid: 17, sid: 61627, name: 'Premier League', country: 'Inglaterra' },
  la_liga: { tid: 8, sid: 61643, name: 'La Liga', country: 'Espanha' },
  serie_a: { tid: 23, sid: 61639, name: 'Serie A', country: 'Itália' },
  bundesliga: { tid: 35, sid: 63653, name: 'Bundesliga', country: 'Alemanha' },
  ligue_1: { tid: 34, sid: 61632, name: 'Ligue 1', country: 'França' },
  // Europa Outras
  eredivisie: { tid: 37, sid: 61629, name: 'Eredivisie', country: 'Holanda' },
  primeira_liga: { tid: 238, sid: 61648, name: 'Primeira Liga', country: 'Portugal' },
  championship: { tid: 18, sid: 61628, name: 'Championship', country: 'Inglaterra' },
  league_one: { tid: 19, sid: 61631, name: 'League One', country: 'Inglaterra' },
  league_two: { tid: 20, sid: 61630, name: 'League Two', country: 'Inglaterra' },
  segunda_division: { tid: 54, sid: 61647, name: 'Segunda División', country: 'Espanha' },
  serie_b_italy: { tid: 53, sid: 61641, name: 'Serie B', country: 'Itália' },
  bundesliga_2: { tid: 44, sid: 63655, name: '2. Bundesliga', country: 'Alemanha' },
  ligue_2: { tid: 182, sid: 61633, name: 'Ligue 2', country: 'França' },
  scottish_prem: { tid: 36, sid: 61634, name: 'Premiership', country: 'Escócia' },
  belgian_pro: { tid: 144, sid: 61640, name: 'Pro League', country: 'Bélgica' },
  turkish_super: { tid: 52, sid: 61636, name: 'Süper Lig', country: 'Turquia' },
  greek_super: { tid: 310, sid: 61649, name: 'Super League', country: 'Grécia' },
  russian_premier: { tid: 203, sid: 61655, name: 'Premier Liga', country: 'Rússia' },
  danish_super: { tid: 271, sid: 61657, name: 'Superliga', country: 'Dinamarca' },
  swedish_allsvenskan: { tid: 40, sid: 61658, name: 'Allsvenskan', country: 'Suécia' },
  norwegian_eliteserien: { tid: 42, sid: 61659, name: 'Eliteserien', country: 'Noruega' },
  swiss_super: { tid: 215, sid: 61654, name: 'Super League', country: 'Suíça' },
  // UEFA
  champions_league: { tid: 7, sid: 61644, name: 'UEFA Champions League', country: 'UEFA' },
  europa_league: { tid: 679, sid: 61645, name: 'UEFA Europa League', country: 'UEFA' },
  conference_league: { tid: 17015, sid: 61646, name: 'UEFA Conference League', country: 'UEFA' },
  // Ásia
  j1_league: { tid: 188, sid: 57083, name: 'J1 League', country: 'Japão' },
  k_league_1: { tid: 292, sid: 58177, name: 'K League 1', country: 'Coreia do Sul' },
  saudi_pro: { tid: 955, sid: 57789, name: 'Saudi Pro League', country: 'Arábia Saudita' },
};

// Default leagues for "sync all"
export const DEFAULT_SYNC_LEAGUES = [
  'brasileirao_a',
  'brasileirao_b',
  'copa_do_brasil',
  'libertadores',
  'sudamericana',
  'argentina',
  'mls',
  'liga_mx',
  'premier_league',
  'la_liga',
  'serie_a',
  'bundesliga',
  'ligue_1',
  'champions_league',
  'europa_league',
  'conference_league',
];

// ── Sofascore event fetcher ──────────────────────────────────────────────────

interface SFEvent {
  id: number;
  startTimestamp: number;
  roundInfo?: { round?: number; name?: string };
  homeTeam: { name: string; id: number };
  awayTeam: { name: string; id: number };
  status?: { type?: string; description?: string };
}

async function getUpcomingEvents(tid: number, sid: number): Promise<SFEvent[]> {
  const out: SFEvent[] = [];
  for (const page of [0, 1, 2]) {
    try {
      const data = (await sfFetch(
        `/unique-tournament/${tid}/season/${sid}/events/next/${page}`
      )) as { events?: SFEvent[] };
      const evs = data.events ?? [];
      out.push(...evs);
      if (evs.length < 10) break;
    } catch {
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}

async function getLastEvents(tid: number, sid: number): Promise<SFEvent[]> {
  const out: SFEvent[] = [];
  for (const page of [0, 1, 2]) {
    try {
      const data = (await sfFetch(
        `/unique-tournament/${tid}/season/${sid}/events/last/${page}`
      )) as { events?: SFEvent[] };
      const evs = data.events ?? [];
      out.push(...evs);
      if (evs.length === 0) break;
    } catch {
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}

async function getEventCorners(
  eventId: number
): Promise<{ home: number | null; away: number | null }> {
  try {
    const data = (await sfFetch(`/event/${eventId}/statistics`)) as {
      statistics?: Array<{
        period: string;
        groups: Array<{
          statisticsItems: Array<{
            key: string;
            name?: string;
            homeValue?: number;
            awayValue?: number;
            home?: string | number;
            away?: string | number;
          }>;
        }>;
      }>;
    };

    for (const period of data.statistics ?? []) {
      if (period.period !== 'ALL') continue;
      for (const group of period.groups ?? []) {
        for (const item of group.statisticsItems ?? []) {
          const isCorner =
            item.key === 'cornerKicks' ||
            (item.name ?? '').toLowerCase().includes('corner') ||
            (item.name ?? '').toLowerCase().includes('escanteio');
          if (!isCorner) continue;
          const toNum = (v: number | string | undefined): number | null => {
            if (v === undefined || v === null || v === '') return null;
            const n = typeof v === 'number' ? v : parseInt(String(v), 10);
            return isNaN(n) ? null : n;
          };
          const h = item.homeValue !== undefined ? toNum(item.homeValue) : toNum(item.home);
          const a = item.awayValue !== undefined ? toNum(item.awayValue) : toNum(item.away);
          if (h !== null && a !== null) return { home: h, away: a };
        }
      }
    }
  } catch {
    // ignore
  }
  return { home: null, away: null };
}

// ── Fuzzy matching ────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(
      /\b(fc|cf|sc|rc|ac|afc|bfc|fk|sk|rcd|ssd|ss|as|us|ud|cd|sd|ce|esporte|club|clube|futebol|sport|sporting|united|city|town|rovers|wanderers|athletic|atletico|real|racing|union|olympique|dynamo|dinamo|cp|if|bk|gk|ik|sf)\b/gi,
      ''
    )
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamSim(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const ta = new Set(na.split(' ').filter(Boolean));
  const tb = new Set(nb.split(' ').filter(Boolean));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}

function matchSim(sfH: string, sfA: string, dbH: string, dbA: string): number {
  const direct = (teamSim(sfH, dbH) + teamSim(sfA, dbA)) / 2;
  const rev = (teamSim(sfH, dbA) + teamSim(sfA, dbH)) / 2;
  return Math.max(direct, rev);
}

// ── Task 1: Import upcoming fixtures ─────────────────────────────────────────

interface ImportResult {
  league: string;
  name: string;
  inserted: number;
  skipped: number;
  error?: string;
}

async function importUpcoming(leagueKeys: string[]): Promise<{
  total: number;
  results: ImportResult[];
}> {
  let total = 0;
  const results: ImportResult[] = [];

  for (const key of leagueKeys) {
    const cfg = SOFASCORE_LEAGUES[key];
    if (!cfg) {
      results.push({ league: key, name: key, inserted: 0, skipped: 0, error: 'Liga não mapeada' });
      continue;
    }

    try {
      const events = await getUpcomingEvents(cfg.tid, cfg.sid);
      const today = new Date().toISOString().split('T')[0];
      let inserted = 0;
      let skipped = 0;

      for (const ev of events) {
        const evDate = new Date(ev.startTimestamp * 1000);
        const dateStr = evDate.toISOString().split('T')[0];
        if (dateStr < today) continue;

        const timeStr = `${String(evDate.getUTCHours()).padStart(2, '0')}:${String(evDate.getUTCMinutes()).padStart(2, '0')}`;
        const roundNum = ev.roundInfo?.round;
        const roundStr = roundNum ? String(roundNum) : ev.roundInfo?.name || null;

        // Check for duplicates — NEVER update the league of an existing record
        // (the existing record may have been manually corrected by admin)
        const existing = await sql`
          SELECT id FROM upcoming_matches
          WHERE home_team = ${ev.homeTeam.name}
            AND away_team  = ${ev.awayTeam.name}
            AND match_date = ${dateStr}
          LIMIT 1
        `;

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await sql`
          INSERT INTO upcoming_matches
            (home_team, away_team, match_date, match_time, league, round, referee, is_completed)
          VALUES
            (${ev.homeTeam.name}, ${ev.awayTeam.name}, ${dateStr},
             ${timeStr}, ${key}, ${roundStr}, NULL, 0)
        `;
        inserted++;
        total++;
      }

      results.push({ league: key, name: cfg.name, inserted, skipped });
    } catch (err) {
      results.push({
        league: key,
        name: cfg.name,
        inserted: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : 'Erro',
      });
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return { total, results };
}

// ── Task 2: Auto-fill corners for pending past matches ────────────────────────

interface FillDetail {
  id: number;
  match: string;
  status: 'filled' | 'not_found' | 'no_stats' | 'no_mapping' | 'error';
  homeCorners?: number;
  awayCorners?: number;
  note?: string;
}

async function fillPendingCorners(limit = 50): Promise<{
  filled: number;
  notFound: number;
  errors: number;
  details: FillDetail[];
}> {
  const today = new Date().toISOString().split('T')[0];

  const pending = (await sql`
    SELECT id, home_team, away_team, match_date, league
    FROM upcoming_matches
    WHERE match_date < ${today}
      AND (is_completed = 0 OR is_completed IS NULL)
      AND home_corners IS NULL
    ORDER BY match_date DESC
    LIMIT ${limit}
  `) as Array<{
    id: number;
    home_team: string;
    away_team: string;
    match_date: string;
    league: string;
  }>;

  if (pending.length === 0) {
    return { filled: 0, notFound: 0, errors: 0, details: [] };
  }

  // Group by league and fetch events per league
  const byLeague = new Map<string, typeof pending>();
  for (const m of pending) {
    const list = byLeague.get(m.league) ?? [];
    list.push(m);
    byLeague.set(m.league, list);
  }

  let filled = 0;
  let notFound = 0;
  let errors = 0;
  const details: FillDetail[] = [];

  for (const [leagueKey, matches] of byLeague) {
    const cfg = SOFASCORE_LEAGUES[leagueKey];

    if (!cfg) {
      for (const m of matches) {
        details.push({
          id: m.id,
          match: `${m.home_team} vs ${m.away_team}`,
          status: 'no_mapping',
          note: `Liga sem mapeamento Sofascore: ${leagueKey}`,
        });
        notFound++;
      }
      continue;
    }

    let events: SFEvent[] = [];
    try {
      events = await getLastEvents(cfg.tid, cfg.sid);
    } catch (err) {
      console.error(`getLastEvents failed for ${leagueKey}:`, err);
    }

    for (const match of matches) {
      const label = `${match.home_team} vs ${match.away_team} (${match.match_date})`;
      const matchDateMs = new Date(match.match_date).getTime();

      try {
        let bestEvent: SFEvent | null = null;
        let bestScore = 0;

        for (const ev of events) {
          const evDateMs = ev.startTimestamp * 1000;
          const dayDiff = Math.abs(evDateMs - matchDateMs) / 86_400_000;
          if (dayDiff > 3) continue;

          const score = matchSim(
            ev.homeTeam.name,
            ev.awayTeam.name,
            match.home_team,
            match.away_team
          );
          if (score > bestScore) {
            bestScore = score;
            bestEvent = ev;
          }
        }

        if (!bestEvent || bestScore < 0.45) {
          details.push({
            id: match.id,
            match: label,
            status: 'not_found',
            note: `Melhor similaridade: ${(bestScore * 100).toFixed(0)}%`,
          });
          notFound++;
          continue;
        }

        await new Promise((r) => setTimeout(r, 150));
        const corners = await getEventCorners(bestEvent.id);

        if (corners.home === null || corners.away === null) {
          // Mark completed so it leaves the queue
          await sql`UPDATE upcoming_matches SET is_completed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ${match.id}`;
          details.push({
            id: match.id,
            match: label,
            status: 'no_stats',
            note: `ID Sofascore ${bestEvent.id} sem estatísticas`,
          });
          notFound++;
          continue;
        }

        await sql`
          UPDATE upcoming_matches
          SET home_corners = ${corners.home},
              away_corners = ${corners.away},
              is_completed = 1,
              updated_at   = CURRENT_TIMESTAMP
          WHERE id = ${match.id}
        `;

        details.push({
          id: match.id,
          match: label,
          status: 'filled',
          homeCorners: corners.home,
          awayCorners: corners.away,
        });
        filled++;
      } catch (err) {
        details.push({
          id: match.id,
          match: label,
          status: 'error',
          note: err instanceof Error ? err.message : 'Erro',
        });
        errors++;
      }
    }
  }

  return { filled, notFound, errors, details };
}

// ── GET: list available leagues ───────────────────────────────────────────────

export async function GET() {
  const leagues = Object.entries(SOFASCORE_LEAGUES).map(([key, cfg]) => ({
    key,
    name: cfg.name,
    country: cfg.country,
  }));
  return NextResponse.json({ leagues, defaultLeagues: DEFAULT_SYNC_LEAGUES });
}

// ── POST: run sync ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    task?: 'import' | 'fill' | 'all';
    leagues?: string[];
    limit?: number;
  };

  const task = body.task ?? 'all';
  const leagues = body.leagues ?? DEFAULT_SYNC_LEAGUES;
  const limit = body.limit ?? 50;

  const startTime = Date.now();
  let importResult = null;
  let fillResult = null;

  if (task === 'import' || task === 'all') {
    importResult = await importUpcoming(leagues);
  }

  if (task === 'fill' || task === 'all') {
    fillResult = await fillPendingCorners(limit);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  return NextResponse.json({
    success: true,
    duration: `${duration}s`,
    import: importResult
      ? {
          total: importResult.total,
          results: importResult.results,
        }
      : null,
    fill: fillResult
      ? {
          filled: fillResult.filled,
          notFound: fillResult.notFound,
          errors: fillResult.errors,
          details: fillResult.details,
        }
      : null,
    timestamp: new Date().toISOString(),
  });
}
