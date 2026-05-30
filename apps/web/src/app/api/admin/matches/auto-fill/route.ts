/**
 * Auto-fill pending matches with corner data from Sofascore.
 *
 * Why Sofascore instead of 365Scores:
 * - 365Scores does NOT provide corner statistics in their game detail API
 * - Sofascore has detailed statistics including cornerKicks per period
 *
 * Strategy:
 * 1. Load all pending matches (past, no corners) from DB
 * 2. For each unique league, map to a Sofascore tournament+season
 * 3. Fetch the last finished events from Sofascore (up to 2 pages = ~80 events)
 * 4. Fuzzy-match by team names + date (±2 days)
 * 5. Fetch that event's statistics to extract cornerKicks
 * 6. Save to DB
 */
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { isAdmin } from '@/app/api/utils/adminAuth';

// ── Sofascore ────────────────────────────────────────────────────────────────

const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';
const SF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
};

// ── League key → Sofascore tournament+season ──────────────────────────────────

const LEAGUE_TO_SF: Record<string, { tid: number; sid: number }> = {
  // Brasil
  brasileirao_a: { tid: 325, sid: 58766 },
  brasileirao_b: { tid: 390, sid: 58767 },
  copa_do_brasil: { tid: 339, sid: 58770 },
  paulistao: { tid: 384, sid: 58773 },
  carioca: { tid: 385, sid: 58774 },
  mineiro: { tid: 386, sid: 58775 },
  gaucho: { tid: 387, sid: 58776 },
  baiano: { tid: 386, sid: 58775 }, // aproximado
  // Europa – Top 5
  premier_league: { tid: 17, sid: 61627 },
  championship: { tid: 18, sid: 61628 },
  league_one: { tid: 19, sid: 61631 },
  league_two: { tid: 20, sid: 61630 },
  national_league: { tid: 24, sid: 61660 },
  la_liga: { tid: 8, sid: 61643 },
  segunda_division: { tid: 54, sid: 61647 },
  serie_a: { tid: 23, sid: 61639 },
  serie_b_italy: { tid: 53, sid: 61641 },
  bundesliga: { tid: 35, sid: 63653 },
  bundesliga_2: { tid: 44, sid: 63655 },
  liga_3: { tid: 491, sid: 63656 },
  ligue_1: { tid: 34, sid: 61632 },
  ligue_2: { tid: 182, sid: 61633 },
  // Europa – Outros
  eredivisie: { tid: 37, sid: 61629 },
  primeira_liga: { tid: 238, sid: 61648 },
  liga_portugal_2: { tid: 239, sid: 61652 },
  scottish_prem: { tid: 36, sid: 61634 },
  scottish_champ: { tid: 67, sid: 61635 },
  scottish_league_one: { tid: 68, sid: 61636 },
  scottish_league_two: { tid: 69, sid: 61637 },
  belgian_pro: { tid: 144, sid: 61640 },
  austrian_bl: { tid: 45, sid: 61653 },
  swiss_super: { tid: 215, sid: 61654 },
  turkish_super: { tid: 52, sid: 61636 },
  greek_super: { tid: 310, sid: 61649 },
  russian_premier: { tid: 203, sid: 61655 },
  ukrainian_premier: { tid: 218, sid: 61656 },
  danish_super: { tid: 271, sid: 61657 },
  swedish_allsvenskan: { tid: 40, sid: 61658 },
  norwegian_eliteserien: { tid: 42, sid: 61659 },
  polish_ekstraklasa: { tid: 202, sid: 61670 },
  // UEFA
  champions_league: { tid: 7, sid: 61644 },
  europa_league: { tid: 679, sid: 61645 },
  conference_league: { tid: 17015, sid: 61646 },
  // América do Sul
  libertadores: { tid: 384, sid: 58771 },
  sudamericana: { tid: 480, sid: 58772 },
  argentina: { tid: 155, sid: 61650 },
  argentina_2: { tid: 156, sid: 61651 },
  // América do Norte
  liga_mx: { tid: 352, sid: 62820 },
  mls: { tid: 242, sid: 62821 },
};

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

function tokenSim(a: string, b: string): number {
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

function matchScore(sfH: string, sfA: string, dbH: string, dbA: string): number {
  const direct = (tokenSim(sfH, dbH) + tokenSim(sfA, dbA)) / 2;
  const rev = (tokenSim(sfH, dbA) + tokenSim(sfA, dbH)) / 2;
  return Math.max(direct, rev);
}

// ── Sofascore API ─────────────────────────────────────────────────────────────

interface SFEvent {
  id: number;
  startTimestamp: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  status?: { type?: string };
}

async function sfFetch(path: string): Promise<unknown> {
  const res = await fetch(`${SOFASCORE_BASE}${path}`, { headers: SF_HEADERS });
  if (!res.ok) throw new Error(`Sofascore ${res.status}: ${path}`);
  return res.json();
}

async function getLastEvents(tid: number, sid: number): Promise<SFEvent[]> {
  const out: SFEvent[] = [];
  for (const page of [0, 1]) {
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
    await new Promise((r) => setTimeout(r, 200));
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
    // fall through
  }
  return { home: null, away: null };
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface PendingMatch {
  id: number;
  home_team: string;
  away_team: string;
  match_date: string;
  league: string;
}

type FillStatus = 'filled' | 'not_found' | 'no_corners' | 'error';

interface DetailEntry {
  id: number;
  match: string;
  status: FillStatus;
  homeCorners?: number;
  awayCorners?: number;
  note?: string;
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

  const pending = (await sql`
    SELECT id, home_team, away_team, match_date, league
    FROM upcoming_matches
    WHERE match_date < ${today}
      AND (is_completed = 0 OR is_completed IS NULL)
      AND home_corners IS NULL
    ORDER BY match_date DESC
    LIMIT 100
  `) as PendingMatch[];

  if (pending.length === 0) {
    return NextResponse.json({ filled: 0, notFound: 0, errors: 0, details: [] });
  }

  // Group by league
  const byLeague = new Map<string, PendingMatch[]>();
  for (const m of pending) {
    const list = byLeague.get(m.league) ?? [];
    list.push(m);
    byLeague.set(m.league, list);
  }

  const details: DetailEntry[] = [];
  let filled = 0;
  let notFound = 0;
  let errors = 0;

  for (const [leagueKey, matches] of byLeague) {
    const sfCfg = LEAGUE_TO_SF[leagueKey];

    if (!sfCfg) {
      for (const m of matches) {
        details.push({
          id: m.id,
          match: `${m.home_team} vs ${m.away_team}`,
          status: 'error',
          note: `Liga sem mapeamento Sofascore: ${leagueKey}`,
        });
        errors++;
      }
      continue;
    }

    // Fetch recent events from Sofascore for this tournament
    let events: SFEvent[] = [];
    try {
      events = await getLastEvents(sfCfg.tid, sfCfg.sid);
    } catch (e) {
      console.error(`getLastEvents failed for ${leagueKey}:`, e);
    }

    for (const match of matches) {
      const matchLabel = `${match.home_team} vs ${match.away_team} (${match.match_date})`;
      const matchDateMs = new Date(match.match_date).getTime();

      try {
        let bestEvent: SFEvent | null = null;
        let bestScore = 0;

        for (const ev of events) {
          const evDateMs = ev.startTimestamp * 1000;
          const dayDiff = Math.abs(evDateMs - matchDateMs) / 86_400_000;
          if (dayDiff > 2) continue;

          const score = matchScore(
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
            match: matchLabel,
            status: 'not_found',
            note: `Similaridade máxima: ${(bestScore * 100).toFixed(0)}% (mín. 45%). Times no Sofascore: ${events
              .slice(0, 3)
              .map((e) => `${e.homeTeam.name} vs ${e.awayTeam.name}`)
              .join(' | ')}`,
          });
          notFound++;
          continue;
        }

        // Small delay before fetching statistics
        await new Promise((r) => setTimeout(r, 150));
        const corners = await getEventCorners(bestEvent.id);

        if (corners.home === null || corners.away === null) {
          // Mark as completed to remove from pending queue
          await sql`
            UPDATE upcoming_matches
            SET is_completed = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${match.id}
          `;
          details.push({
            id: match.id,
            match: matchLabel,
            status: 'no_corners',
            note: `Jogo encontrado (Sofascore ID ${bestEvent.id}, ${(bestScore * 100).toFixed(0)}%) mas sem estatísticas de escanteios`,
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
          match: matchLabel,
          status: 'filled',
          homeCorners: corners.home,
          awayCorners: corners.away,
        });
        filled++;
      } catch (err) {
        console.error('auto-fill error for match', match.id, err);
        details.push({
          id: match.id,
          match: matchLabel,
          status: 'error',
          note: err instanceof Error ? err.message : 'Erro desconhecido',
        });
        errors++;
      }
    }
  }

  return NextResponse.json({ filled, notFound, errors, details });
}
