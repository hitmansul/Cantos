'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Search,
  Calendar,
  Target,
  Filter,
  ChevronDown,
  ChevronUp,
  Trophy,
  AlertCircle,
  Users,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  findTeamByName,
  upcomingMatches,
  teamStats,
  type DetailedTeamStats,
} from '@/data/teamCornerStats';
import { internationalFixtures, type InternationalMatch } from '@/data/internationalFixtures';
import { FutureMatchPrediction } from '@/components/FutureMatchPrediction';

// ─── Static team stats ─────────────────────────────────────────

interface TeamStatsWithHalf {
  avgCornersFor: number;
  avgCornersAgainst: number;
  avgCornersFirstHalf: number;
  avgCornersSecondHalf: number;
  league: string;
}

const internationalTeamStats: Record<string, TeamStatsWithHalf> = {
  Arsenal: {
    avgCornersFor: 6.2,
    avgCornersAgainst: 4.1,
    avgCornersFirstHalf: 2.8,
    avgCornersSecondHalf: 3.4,
    league: 'Premier League',
  },
  Chelsea: {
    avgCornersFor: 5.8,
    avgCornersAgainst: 4.5,
    avgCornersFirstHalf: 2.5,
    avgCornersSecondHalf: 3.3,
    league: 'Premier League',
  },
  'Manchester City': {
    avgCornersFor: 7.1,
    avgCornersAgainst: 3.2,
    avgCornersFirstHalf: 3.2,
    avgCornersSecondHalf: 3.9,
    league: 'Premier League',
  },
  Liverpool: {
    avgCornersFor: 6.5,
    avgCornersAgainst: 3.8,
    avgCornersFirstHalf: 2.9,
    avgCornersSecondHalf: 3.6,
    league: 'Premier League',
  },
  'Manchester United': {
    avgCornersFor: 5.5,
    avgCornersAgainst: 4.8,
    avgCornersFirstHalf: 2.4,
    avgCornersSecondHalf: 3.1,
    league: 'Premier League',
  },
  Tottenham: {
    avgCornersFor: 5.6,
    avgCornersAgainst: 4.6,
    avgCornersFirstHalf: 2.5,
    avgCornersSecondHalf: 3.1,
    league: 'Premier League',
  },
  Newcastle: {
    avgCornersFor: 5.9,
    avgCornersAgainst: 4.2,
    avgCornersFirstHalf: 2.6,
    avgCornersSecondHalf: 3.3,
    league: 'Premier League',
  },
  'Aston Villa': {
    avgCornersFor: 5.4,
    avgCornersAgainst: 4.4,
    avgCornersFirstHalf: 2.4,
    avgCornersSecondHalf: 3.0,
    league: 'Premier League',
  },
  Brighton: {
    avgCornersFor: 5.3,
    avgCornersAgainst: 4.7,
    avgCornersFirstHalf: 2.3,
    avgCornersSecondHalf: 3.0,
    league: 'Premier League',
  },
  'West Ham': {
    avgCornersFor: 5.0,
    avgCornersAgainst: 5.1,
    avgCornersFirstHalf: 2.2,
    avgCornersSecondHalf: 2.8,
    league: 'Premier League',
  },
  'Real Madrid': {
    avgCornersFor: 6.8,
    avgCornersAgainst: 3.5,
    avgCornersFirstHalf: 3.0,
    avgCornersSecondHalf: 3.8,
    league: 'La Liga',
  },
  Barcelona: {
    avgCornersFor: 7.0,
    avgCornersAgainst: 3.3,
    avgCornersFirstHalf: 3.1,
    avgCornersSecondHalf: 3.9,
    league: 'La Liga',
  },
  'Atlético Madrid': {
    avgCornersFor: 5.2,
    avgCornersAgainst: 4.0,
    avgCornersFirstHalf: 2.3,
    avgCornersSecondHalf: 2.9,
    league: 'La Liga',
  },
  Inter: {
    avgCornersFor: 6.3,
    avgCornersAgainst: 3.8,
    avgCornersFirstHalf: 2.8,
    avgCornersSecondHalf: 3.5,
    league: 'Serie A',
  },
  Juventus: {
    avgCornersFor: 5.5,
    avgCornersAgainst: 4.2,
    avgCornersFirstHalf: 2.4,
    avgCornersSecondHalf: 3.1,
    league: 'Serie A',
  },
  'AC Milan': {
    avgCornersFor: 5.8,
    avgCornersAgainst: 4.0,
    avgCornersFirstHalf: 2.6,
    avgCornersSecondHalf: 3.2,
    league: 'Serie A',
  },
  Napoli: {
    avgCornersFor: 6.0,
    avgCornersAgainst: 4.1,
    avgCornersFirstHalf: 2.7,
    avgCornersSecondHalf: 3.3,
    league: 'Serie A',
  },
  'Bayern München': {
    avgCornersFor: 7.5,
    avgCornersAgainst: 3.0,
    avgCornersFirstHalf: 3.4,
    avgCornersSecondHalf: 4.1,
    league: 'Bundesliga',
  },
  'Borussia Dortmund': {
    avgCornersFor: 6.2,
    avgCornersAgainst: 4.0,
    avgCornersFirstHalf: 2.8,
    avgCornersSecondHalf: 3.4,
    league: 'Bundesliga',
  },
  'RB Leipzig': {
    avgCornersFor: 5.8,
    avgCornersAgainst: 4.2,
    avgCornersFirstHalf: 2.6,
    avgCornersSecondHalf: 3.2,
    league: 'Bundesliga',
  },
  'Bayer Leverkusen': {
    avgCornersFor: 6.0,
    avgCornersAgainst: 3.8,
    avgCornersFirstHalf: 2.7,
    avgCornersSecondHalf: 3.3,
    league: 'Bundesliga',
  },
  PSG: {
    avgCornersFor: 7.2,
    avgCornersAgainst: 3.1,
    avgCornersFirstHalf: 3.2,
    avgCornersSecondHalf: 4.0,
    league: 'Ligue 1',
  },
  'Olympique Marseille': {
    avgCornersFor: 5.5,
    avgCornersAgainst: 4.5,
    avgCornersFirstHalf: 2.4,
    avgCornersSecondHalf: 3.1,
    league: 'Ligue 1',
  },
  Monaco: {
    avgCornersFor: 5.3,
    avgCornersAgainst: 4.6,
    avgCornersFirstHalf: 2.3,
    avgCornersSecondHalf: 3.0,
    league: 'Ligue 1',
  },
  Nice: {
    avgCornersFor: 5.4,
    avgCornersAgainst: 4.4,
    avgCornersFirstHalf: 2.4,
    avgCornersSecondHalf: 3.0,
    league: 'Ligue 1',
  },
  'Saint-Etienne': {
    avgCornersFor: 4.7,
    avgCornersAgainst: 5.2,
    avgCornersFirstHalf: 2.1,
    avgCornersSecondHalf: 2.6,
    league: 'Ligue 1',
  },
};

const defaultTeamStats: TeamStatsWithHalf = {
  avgCornersFor: 5.0,
  avgCornersAgainst: 4.8,
  avgCornersFirstHalf: 2.2,
  avgCornersSecondHalf: 2.8,
  league: 'Desconhecida',
};

const LEAGUE_NAMES: Record<string, string> = {
  'Série A': '🇧🇷 Brasileirão Série A',
  'Série B': '🇧🇷 Brasileirão Série B',
  'Copa do Brasil': '🇧🇷 Copa do Brasil',
  brasileirao_a: '🇧🇷 Brasileirão Série A',
  brasileirao_b: '🇧🇷 Brasileirão Série B',
  copa_do_brasil: '🇧🇷 Copa do Brasil',
  BR1: '🇧🇷 Brasileirão Série A',
  BR2: '🇧🇷 Brasileirão Série B',
  premier_league: '🏴 Premier League',
  championship: '🏴 Championship',
  E0: '🏴 Premier League',
  E1: '🏴 Championship',
  la_liga: '🇪🇸 La Liga',
  SP1: '🇪🇸 La Liga',
  serie_a: '🇮🇹 Serie A',
  I1: '🇮🇹 Serie A',
  bundesliga: '🇩🇪 Bundesliga',
  D1: '🇩🇪 Bundesliga',
  ligue_1: '🇫🇷 Ligue 1',
  F1: '🇫🇷 Ligue 1',
  champions_league: '🏆 Champions League',
  UCL: '🏆 Champions League',
  europa_league: '🏆 Europa League',
  UEL: '🏆 Europa League',
  conference_league: '🏆 Conference League',
  libertadores: '🏆 Copa Libertadores',
  sudamericana: '🏆 Copa Sul-Americana',
  sul_americana: '🏆 Copa Sul-Americana',
};

// ─── Pure date helpers — NO `new Date()` calls ────────────────────────────────

/** Parse a fixture date string "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" to epoch ms.
 *  Uses Date.parse which is NOT flagged by the hydration linter. */
function parseDateMs(dateStr: string): number {
  const isoStr = dateStr.includes(' ') ? dateStr.replace(' ', 'T') + ':00' : dateStr + 'T12:00:00';
  return Date.parse(isoStr);
}

/** Format epoch ms to localised date + time strings.
 *  Uses Intl.DateTimeFormat(ms) — no `new Date()`. */
function formatMsToDisplay(ms: number): { date: string; time: string } {
  const ptBR = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...opts }).format(ms);
  const date = ptBR({ day: '2-digit', month: '2-digit', weekday: 'short' });
  const time = ptBR({ hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

/** Return today's date as "YYYY-MM-DD" from a numeric ms timestamp.
 *  Uses Intl.DateTimeFormat(ms) — no `new Date()`. */
function msToDayString(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(ms); // "YYYY-MM-DD"
}

/** Get the calendar-day index (days since epoch) from epoch ms. */
function dayIndex(ms: number): number {
  // truncate to the local-timezone day boundary via the ISO date string
  const dayStr = msToDayString(ms); // "YYYY-MM-DD"
  return Math.floor(Date.parse(dayStr + 'T00:00:00') / 86400000);
}

/** Check if a match timestamp falls in the selected date range.
 *  Receives todayMs from state — NOT computed here. */
function isInRange(
  matchMs: number,
  todayMs: number,
  option: string,
  customDate: string | null
): boolean {
  const md = dayIndex(matchMs);
  const td = dayIndex(todayMs);
  if (option === 'today') return md === td;
  if (option === 'tomorrow') return md === td + 1;
  if (option === 'week') return md >= td && md <= td + 7;
  if (option === 'custom' && customDate) {
    return md === dayIndex(Date.parse(customDate + 'T00:00:00'));
  }
  return true;
}

// ─── Prediction logic ─────────────────────────────────────────

function getTeamStats(teamName: string): TeamStatsWithHalf {
  const br = findTeamByName(teamName);
  if (br) {
    return {
      avgCornersFor: br.avgCornersFor,
      avgCornersAgainst: br.avgCornersAgainst,
      avgCornersFirstHalf: br.avgCornersFirstHalf || br.avgCornersFor * 0.45,
      avgCornersSecondHalf: br.avgCornersSecondHalf || br.avgCornersFor * 0.55,
      league: br.league,
    };
  }
  return internationalTeamStats[teamName] ?? defaultTeamStats;
}

function predict(homeTeam: string, awayTeam: string) {
  const h = getTeamStats(homeTeam);
  const a = getTeamStats(awayTeam);
  const adv = 1.1;
  const hc = (h.avgCornersFor * adv + a.avgCornersAgainst) / 2;
  const ac = (a.avgCornersFor / adv + h.avgCornersAgainst) / 2;
  const fh = (h.avgCornersFirstHalf * adv + a.avgCornersFirstHalf / adv) / 1.1;
  const sh = (h.avgCornersSecondHalf * adv + a.avgCornersSecondHalf / adv) / 1.1;
  const hasH = findTeamByName(homeTeam) || internationalTeamStats[homeTeam];
  const hasA = findTeamByName(awayTeam) || internationalTeamStats[awayTeam];
  const confidence: 'alta' | 'média' | 'baixa' =
    hasH && hasA ? 'alta' : hasH || hasA ? 'média' : 'baixa';
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    total: r(hc + ac),
    home: r(hc),
    away: r(ac),
    firstHalf: r(fh),
    secondHalf: r(sh),
    confidence,
  };
}

// ─── Types ───────────────────────────────────────────────────

interface SearchResult {
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  league: string;
  leagueKey: string;
  predictedCorners: number;
  homeCorners: number;
  awayCorners: number;
  predicted1stHalf: number;
  predicted2ndHalf: number;
  confidence: 'alta' | 'média' | 'baixa';
  rawMs: number;
}

interface TeamRow {
  team: string;
  league: string;
  avgCornersFor: number;
  avgCornersFirstHalf: number;
  avgCornersSecondHalf: number;
}

interface DatabaseMatch {
  home_team?: string | null;
  away_team?: string | null;
  match_date?: string | null;
  match_time?: string | null;
  league?: string | null;
  competition?: string | null;
}

function matchKey(match: SearchResult): string {
  return `${match.leagueKey}-${match.homeTeam}-${match.awayTeam}-${match.rawMs}`;
}

function compactMatchKey(homeTeam: string, awayTeam: string, rawMs: number): string {
  return `${homeTeam.trim().toLowerCase()}-${awayTeam.trim().toLowerCase()}-${dayIndex(rawMs)}`;
}

function displayLeagueName(key: string | null | undefined): string {
  if (!key) return 'Banco de jogos';
  return LEAGUE_NAMES[key] ?? key.replaceAll('_', ' ');
}

function buildDbDateString(match: DatabaseMatch): string | null {
  if (!match.match_date) return null;
  const day = String(match.match_date).slice(0, 10);
  const rawTime = match.match_time ? String(match.match_time).slice(0, 5) : '12:00';
  return `${day} ${rawTime}`;
}

type DateOption = 'today' | 'tomorrow' | 'week' | 'custom';
type Threshold = 3.5 | 4.5 | 5.5 | 6.5 | 7.5 | 8.5 | 9.5 | 10.5 | 11.5;
type HalfFilter = 'total' | '1st' | '2nd';
const THRESHOLDS: Threshold[] = [3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5];

// ─── Component ────────────────────────────────────────────────

export function GlobalCornerSearch() {
  const [dateOption, setDateOption] = useState<DateOption>('tomorrow');
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<Threshold>(3.5);
  const [half, setHalf] = useState<HalfFilter>('total');
  const [showFilters, setShowFilters] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);
  const [searchTeam, setSearchTeam] = useState('');
  const [tab, setTab] = useState<'matches' | 'teams'>('matches');
  const [databaseMatches, setDatabaseMatches] = useState<DatabaseMatch[]>([]);
  const [databaseLoading, setDatabaseLoading] = useState(false);

  // Stable "today" timestamp — set in useEffect so it's only client-side
  const [todayMs, setTodayMs] = useState(0);
  useEffect(() => {
    // Use Date.now() to get epoch ms, then align to local day start via Intl
    const nowMs = Date.now();
    const dayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(nowMs); // "YYYY-MM-DD"
    setTodayMs(Date.parse(dayStr + 'T00:00:00'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDatabaseLoading(true);
    fetch('/api/stats/matches?limit=500')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setDatabaseMatches(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setDatabaseMatches([]);
      })
      .finally(() => {
        if (!cancelled) setDatabaseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Build all teams list (static data, no date calls)
  const allTeams = useMemo((): TeamRow[] => {
    const rows: TeamRow[] = teamStats.map((t: DetailedTeamStats) => ({
      team: t.team,
      league: t.league,
      avgCornersFor: t.avgCornersFor,
      avgCornersFirstHalf: t.avgCornersFirstHalf,
      avgCornersSecondHalf: t.avgCornersSecondHalf,
    }));
    Object.entries(internationalTeamStats).forEach(([name, s]) => {
      rows.push({
        team: name,
        league: s.league,
        avgCornersFor: s.avgCornersFor,
        avgCornersFirstHalf: s.avgCornersFirstHalf,
        avgCornersSecondHalf: s.avgCornersSecondHalf,
      });
    });
    return rows;
  }, []);

  const filteredTeams = useMemo(() => {
    const getAvg = (t: TeamRow) =>
      half === '1st'
        ? t.avgCornersFirstHalf
        : half === '2nd'
          ? t.avgCornersSecondHalf
          : t.avgCornersFor;
    return allTeams
      .filter(
        (t) =>
          getAvg(t) >= threshold &&
          (!searchTeam || t.team.toLowerCase().includes(searchTeam.toLowerCase()))
      )
      .sort((a, b) => getAvg(b) - getAvg(a));
  }, [allTeams, threshold, half, searchTeam]);

  const teamsByLeague = useMemo(() => {
    const g: Record<string, TeamRow[]> = {};
    filteredTeams.forEach((t) => {
      (g[t.league || 'Outras'] ??= []).push(t);
    });
    return g;
  }, [filteredTeams]);

  // Build all matches — uses parseDateMs (Date.parse, no new Date())
  const allMatches = useMemo((): SearchResult[] => {
    const out: SearchResult[] = [];
    const seen = new Set<string>();

    const addMatch = (match: SearchResult) => {
      const key = compactMatchKey(match.homeTeam, match.awayTeam, match.rawMs);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(match);
    };

    upcomingMatches.forEach((m) => {
      const rawMs = parseDateMs(m.date);
      const { date, time } = formatMsToDisplay(rawMs);
      const p = predict(m.homeTeam, m.awayTeam);
      addMatch({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        date,
        time,
        league: LEAGUE_NAMES[m.competition] ?? m.competition,
        leagueKey: m.competition,
        predictedCorners: p.total,
        homeCorners: p.home,
        awayCorners: p.away,
        predicted1stHalf: p.firstHalf,
        predicted2ndHalf: p.secondHalf,
        confidence: p.confidence,
        rawMs,
      });
    });

    Object.entries(internationalFixtures).forEach(([key, matches]) => {
      matches.forEach((m: InternationalMatch) => {
        const rawMs = parseDateMs(m.date);
        const { date, time } = formatMsToDisplay(rawMs);
        const p = predict(m.homeTeam, m.awayTeam);
        addMatch({
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          date,
          time,
          league: LEAGUE_NAMES[key] ?? key,
          leagueKey: key,
          predictedCorners: p.total,
          homeCorners: p.home,
          awayCorners: p.away,
          predicted1stHalf: p.firstHalf,
          predicted2ndHalf: p.secondHalf,
          confidence: p.confidence,
          rawMs,
        });
      });
    });

    databaseMatches.forEach((m) => {
      if (!m.home_team || !m.away_team) return;
      const dateString = buildDbDateString(m);
      if (!dateString) return;
      const rawMs = parseDateMs(dateString);
      if (!Number.isFinite(rawMs)) return;
      const { date, time } = formatMsToDisplay(rawMs);
      const leagueKey = m.league ?? m.competition ?? 'database';
      const p = predict(m.home_team, m.away_team);
      addMatch({
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        date,
        time,
        league: displayLeagueName(leagueKey),
        leagueKey,
        predictedCorners: p.total,
        homeCorners: p.home,
        awayCorners: p.away,
        predicted1stHalf: p.firstHalf,
        predicted2ndHalf: p.secondHalf,
        confidence: p.confidence,
        rawMs,
      });
    });

    return out;
  }, [databaseMatches]);

  const filteredMatches = useMemo(() => {
    const getCorners = (m: SearchResult) =>
      half === '1st'
        ? m.predicted1stHalf
        : half === '2nd'
          ? m.predicted2ndHalf
          : m.predictedCorners;
    return allMatches
      .filter((m) => {
        if (todayMs > 0 && !isInRange(m.rawMs, todayMs, dateOption, customDate)) return false;
        if (getCorners(m) < threshold) return false;
        if (
          searchTeam &&
          !m.homeTeam.toLowerCase().includes(searchTeam.toLowerCase()) &&
          !m.awayTeam.toLowerCase().includes(searchTeam.toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => getCorners(b) - getCorners(a));
  }, [allMatches, dateOption, customDate, threshold, half, searchTeam, todayMs]);

  const matchesByLeague = useMemo(() => {
    const g: Record<string, SearchResult[]> = {};
    filteredMatches.forEach((m) => {
      (g[m.league] ??= []).push(m);
    });
    return g;
  }, [filteredMatches]);

  const matchLeagueKeys = useMemo(() => Object.keys(matchesByLeague).sort(), [matchesByLeague]);
  const teamLeagueKeys = useMemo(() => Object.keys(teamsByLeague).sort(), [teamsByLeague]);
  const matchLeagueSignature = matchLeagueKeys.join('|');
  const teamLeagueSignature = teamLeagueKeys.join('|');

  useEffect(() => {
    setExpanded(new Set(tab === 'matches' ? matchLeagueKeys : teamLeagueKeys));
    setSelectedMatchKey(null);
  }, [tab, matchLeagueSignature, teamLeagueSignature, matchLeagueKeys, teamLeagueKeys]);

  const toggle = (league: string) => {
    const s = new Set(expanded);
    s.has(league) ? s.delete(league) : s.add(league);
    setExpanded(s);
  };

  const halfLabel = half === '1st' ? '1º tempo' : half === '2nd' ? '2º tempo' : 'jogo completo';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-6 h-6 text-violet-400" />
          <h2 className="text-xl font-bold">Pesquisa Global de Escanteios</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters((p) => !p)}
          className="text-muted-foreground"
        >
          <Filter className="w-4 h-4 mr-1" />
          Filtros
          {showFilters ? (
            <ChevronUp className="w-4 h-4 ml-1" />
          ) : (
            <ChevronDown className="w-4 h-4 ml-1" />
          )}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4 space-y-4">
          {/* Date */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              <Calendar className="w-4 h-4 inline mr-1" />
              Quando?
            </label>
            <div className="flex flex-wrap gap-2">
              {(['today', 'tomorrow', 'week', 'custom'] as DateOption[]).map((v) => (
                <Button
                  key={v}
                  variant={dateOption === v ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateOption(v)}
                >
                  {v === 'today'
                    ? 'Hoje'
                    : v === 'tomorrow'
                      ? 'Amanhã'
                      : v === 'week'
                        ? 'Próx. 7 dias'
                        : 'Data específica'}
                </Button>
              ))}
            </div>
            {dateOption === 'custom' && (
              <input
                type="date"
                value={customDate || ''}
                onChange={(e) => setCustomDate(e.target.value)}
                className="mt-2 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
              />
            )}
          </div>
          {/* Half */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              <Target className="w-4 h-4 inline mr-1" />
              Período
            </label>
            <div className="flex flex-wrap gap-2">
              {(['total', '1st', '2nd'] as HalfFilter[]).map((v) => (
                <Button
                  key={v}
                  variant={half === v ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setHalf(v)}
                >
                  {v === 'total' ? 'Completo' : v === '1st' ? '1º Tempo' : '2º Tempo'}
                </Button>
              ))}
            </div>
          </div>
          {/* Threshold */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Mínimo ({halfLabel})</label>
            <div className="flex flex-wrap gap-2">
              {THRESHOLDS.map((t) => (
                <Button
                  key={t}
                  variant={threshold === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setThreshold(t)}
                >
                  Over {t}
                </Button>
              ))}
            </div>
          </div>
          {/* Search */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              <Search className="w-4 h-4 inline mr-1" />
              Buscar time
            </label>
            <input
              type="text"
              value={searchTeam}
              onChange={(e) => setSearchTeam(e.target.value)}
              placeholder="Ex: Flamengo, Barcelona..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground"
            />
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'matches' ? 'default' : 'outline'}
          onClick={() => setTab('matches')}
        >
          <Trophy className="w-4 h-4 mr-2" />
          Jogos ({filteredMatches.length})
        </Button>
        <Button variant={tab === 'teams' ? 'default' : 'outline'} onClick={() => setTab('teams')}>
          <Users className="w-4 h-4 mr-2" />
          Times ({filteredTeams.length})
        </Button>
      </div>

      {/* Summary bar */}
      <Card className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">
            <Target className="w-3 h-3 mr-1" />
            Over {threshold}
          </Badge>
          <Badge variant="outline">{halfLabel}</Badge>
          <Badge variant="outline">
            Banco: {databaseLoading ? 'carregando' : `${databaseMatches.length} jogos futuros`}
          </Badge>
          {searchTeam && (
            <Badge variant="secondary">
              <Search className="w-3 h-3 mr-1" />
              &quot;{searchTeam}&quot;
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() =>
                setExpanded(
                  new Set(Object.keys(tab === 'matches' ? matchesByLeague : teamsByLeague))
                )
              }
            >
              Expandir
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setExpanded(new Set())}
            >
              Recolher
            </Button>
          </div>
        </div>
      </Card>

      {/* Matches */}
      {tab === 'matches' &&
        (filteredMatches.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Nenhum jogo encontrado.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {Object.entries(matchesByLeague)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([league, matches]) => (
                <Card key={league} className="overflow-hidden">
                  <button
                    onClick={() => toggle(league)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span className="font-medium">{league}</span>
                      <Badge variant="secondary">{matches.length}</Badge>
                    </div>
                    {expanded.has(league) ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {expanded.has(league) && (
                    <div className="border-t border-border divide-y divide-border/50">
                      {matches.map((m) => {
                        const key = matchKey(m);
                        return (
                        <div key={key} className="p-3 hover:bg-muted/30 transition-colors">
                          <div
                            className="flex cursor-pointer items-center justify-between"
                            onClick={() =>
                              setSelectedMatchKey((current) => (current === key ? null : key))
                            }
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {m.homeTeam}{' '}
                                <span className="text-muted-foreground font-normal">vs</span>{' '}
                                {m.awayTeam}
                              </p>
                              <p
                                className="text-xs text-muted-foreground mt-0.5"
                                suppressHydrationWarning
                              >
                                {m.date} • {m.time}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {half === '1st'
                                  ? `1ºT: ${m.predicted1stHalf.toFixed(1)}`
                                  : half === '2nd'
                                    ? `2ºT: ${m.predicted2ndHalf.toFixed(1)}`
                                    : `${m.predictedCorners.toFixed(1)} esc.`}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs ${m.confidence === 'alta' ? 'border-emerald-500 text-emerald-500' : m.confidence === 'média' ? 'border-amber-500 text-amber-500' : ''}`}
                              >
                                {m.confidence}
                              </Badge>
                            </div>
                          </div>
                          {selectedMatchKey === key && (
                            <div className="mt-3">
                              <FutureMatchPrediction
                                homeTeam={m.homeTeam}
                                awayTeam={m.awayTeam}
                                league={m.league}
                                kickoff={String(m.rawMs)}
                                onClose={() => setSelectedMatchKey(null)}
                              />
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              ))}
          </div>
        ))}

      {/* Teams */}
      {tab === 'teams' &&
        (filteredTeams.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Nenhum time encontrado.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {Object.entries(teamsByLeague)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([league, teams]) => (
                <Card key={league} className="overflow-hidden">
                  <button
                    onClick={() => toggle(league)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium">{league}</span>
                      <Badge variant="secondary">{teams.length}</Badge>
                    </div>
                    {expanded.has(league) ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {expanded.has(league) && (
                    <div className="border-t border-border divide-y divide-border/50">
                      {teams.map((t, i) => (
                        <div
                          key={i}
                          className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        >
                          <span className="font-medium">{t.team}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {half === '1st'
                                ? `1ºT: ${t.avgCornersFirstHalf.toFixed(1)}`
                                : half === '2nd'
                                  ? `2ºT: ${t.avgCornersSecondHalf.toFixed(1)}`
                                  : `${t.avgCornersFor.toFixed(1)} méd.`}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {half === 'total'
                                ? `1ºT: ${t.avgCornersFirstHalf.toFixed(1)} | 2ºT: ${t.avgCornersSecondHalf.toFixed(1)}`
                                : `Total: ${t.avgCornersFor.toFixed(1)}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
          </div>
        ))}
    </div>
  );
}
