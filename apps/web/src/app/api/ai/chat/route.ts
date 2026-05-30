import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { teamStats, headToHeadData, upcomingMatches } from '@/data/teamCornerStats';
import {
  libertadoresTeamStats,
  sulAmericanaTeamStats,
  championsLeagueTeamStats,
  europaLeagueTeamStats,
  conferenceLeagueTeamStats,
} from '@/data/cornerStats';
import { scores365Get, SCORES365_COMPETITIONS } from '@/app/api/utils/scores365';

// Extend serverless function timeout to 60s
export const maxDuration = 60;

// ── League key → friendly name + country ─────────────────────────────────────
const LEAGUE_NAMES: Record<string, { name: string; country: string }> = {
  brasileirao_a: { name: 'Brasileirão Série A', country: 'Brasil' },
  brasileirao_b: { name: 'Brasileirão Série B', country: 'Brasil' },
  copa_do_brasil: { name: 'Copa do Brasil', country: 'Brasil' },
  paulistao: { name: 'Campeonato Paulista', country: 'Brasil' },
  carioca: { name: 'Campeonato Carioca', country: 'Brasil' },
  mineiro: { name: 'Campeonato Mineiro', country: 'Brasil' },
  gaucho: { name: 'Campeonato Gaúcho', country: 'Brasil' },
  baiano: { name: 'Campeonato Baiano', country: 'Brasil' },
  libertadores: { name: 'Copa Libertadores', country: 'CONMEBOL' },
  sudamericana: { name: 'Copa Sul-Americana', country: 'CONMEBOL' },
  argentina: { name: 'Liga Profesional', country: 'Argentina' },
  argentina_2: { name: 'Primera Nacional', country: 'Argentina' },
  chile_primera: { name: 'Primera División', country: 'Chile' },
  colombia_liga: { name: 'Liga BetPlay', country: 'Colômbia' },
  ecuador_liga: { name: 'Liga Pro', country: 'Equador' },
  peru_liga: { name: 'Liga 1', country: 'Peru' },
  uruguay_primera: { name: 'Primera División', country: 'Uruguai' },
  venezuela_primera: { name: 'Primera División', country: 'Venezuela' },
  paraguay_primera: { name: 'División Profesional', country: 'Paraguai' },
  mls: { name: 'MLS', country: 'EUA' },
  liga_mx: { name: 'Liga MX', country: 'México' },
  liga_mx_expansion: { name: 'Liga de Expansión MX', country: 'México' },
  concacaf_champions: { name: 'CONCACAF Champions Cup', country: 'CONCACAF' },
  premier_league: { name: 'Premier League', country: 'Inglaterra' },
  championship: { name: 'Championship', country: 'Inglaterra' },
  league_one: { name: 'League One', country: 'Inglaterra' },
  league_two: { name: 'League Two', country: 'Inglaterra' },
  national_league: { name: 'National League', country: 'Inglaterra' },
  la_liga: { name: 'La Liga', country: 'Espanha' },
  segunda_division: { name: 'Segunda División', country: 'Espanha' },
  serie_a: { name: 'Serie A', country: 'Itália' },
  serie_b_italy: { name: 'Serie B', country: 'Itália' },
  bundesliga: { name: 'Bundesliga', country: 'Alemanha' },
  bundesliga_2: { name: '2. Bundesliga', country: 'Alemanha' },
  liga_3: { name: '3. Liga', country: 'Alemanha' },
  ligue_1: { name: 'Ligue 1', country: 'França' },
  ligue_2: { name: 'Ligue 2', country: 'França' },
  eredivisie: { name: 'Eredivisie', country: 'Holanda' },
  primeira_liga: { name: 'Primeira Liga', country: 'Portugal' },
  liga_portugal_2: { name: 'Liga Portugal 2', country: 'Portugal' },
  scottish_prem: { name: 'Scottish Premiership', country: 'Escócia' },
  scottish_champ: { name: 'Scottish Championship', country: 'Escócia' },
  scottish_league_one: { name: 'Scottish League One', country: 'Escócia' },
  scottish_league_two: { name: 'Scottish League Two', country: 'Escócia' },
  belgian_pro: { name: 'Jupiler Pro League', country: 'Bélgica' },
  austrian_bl: { name: 'Bundesliga Österreich', country: 'Áustria' },
  swiss_super: { name: 'Super League', country: 'Suíça' },
  turkish_super: { name: 'Süper Lig', country: 'Turquia' },
  greek_super: { name: 'Super League', country: 'Grécia' },
  russian_premier: { name: 'Premier Liga', country: 'Rússia' },
  ukrainian_premier: { name: 'Premier Liga', country: 'Ucrânia' },
  danish_super: { name: 'Superliga', country: 'Dinamarca' },
  swedish_allsvenskan: { name: 'Allsvenskan', country: 'Suécia' },
  norwegian_eliteserien: { name: 'Eliteserien', country: 'Noruega' },
  polish_ekstraklasa: { name: 'Ekstraklasa', country: 'Polônia' },
  romanian_superliga: { name: 'SuperLiga', country: 'Romênia' },
  czech_first: { name: 'First League', country: 'Rep. Tcheca' },
  croatian_hnl: { name: 'HNL', country: 'Croácia' },
  serbian_superliga: { name: 'SuperLiga', country: 'Sérvia' },
  hungarian_otp: { name: 'OTP Bank Liga', country: 'Hungria' },
  bulgarian_first: { name: 'First League', country: 'Bulgária' },
  israeli_premier: { name: 'Premier League', country: 'Israel' },
  irish_loi: { name: 'League of Ireland', country: 'Irlanda' },
  finnish_veikkaus: { name: 'Veikkausliiga', country: 'Finlândia' },
  champions_league: { name: 'UEFA Champions League', country: 'UEFA' },
  europa_league: { name: 'UEFA Europa League', country: 'UEFA' },
  conference_league: { name: 'UEFA Conference League', country: 'UEFA' },
  nations_league: { name: 'UEFA Nations League', country: 'UEFA' },
  copa_do_mundo: { name: 'Copa do Mundo', country: 'FIFA' },
  copa_america: { name: 'Copa América', country: 'CONMEBOL' },
  j1_league: { name: 'J1 League', country: 'Japão' },
  j2_league: { name: 'J2 League', country: 'Japão' },
  k_league_1: { name: 'K League 1', country: 'Coreia do Sul' },
  k_league_2: { name: 'K League 2', country: 'Coreia do Sul' },
  china_csl: { name: 'Chinese Super League', country: 'China' },
  saudi_pro: { name: 'Saudi Pro League', country: 'Arábia Saudita' },
  uae_pro: { name: 'UAE Pro League', country: 'Emirados Árabes' },
  indian_isl: { name: 'Indian Super League', country: 'Índia' },
  thai_league: { name: 'Thai League 1', country: 'Tailândia' },
  a_league: { name: 'A-League', country: 'Austrália' },
  afc_champions: { name: 'AFC Champions League', country: 'AFC' },
  egypt_premier: { name: 'Premier League', country: 'Egito' },
  moroccan_botola: { name: 'Botola Pro', country: 'Marrocos' },
  south_africa_psl: { name: 'DStv Premiership', country: 'África do Sul' },
  caf_champions: { name: 'CAF Champions League', country: 'CAF' },
};

function leagueDisplay(key: string): string {
  const info = LEAGUE_NAMES[key];
  if (info) return `${info.name} - ${info.country}`;
  return key;
}

// Track question in FAQ table (non-blocking)
async function trackQuestion(question: string) {
  try {
    const normalized = question.trim().toLowerCase().slice(0, 300);
    const existing = await sql`
      SELECT id FROM faq_questions WHERE LOWER(question) = ${normalized} LIMIT 1
    `;
    if ((existing as unknown[]).length > 0) {
      await sql`
        UPDATE faq_questions SET asked_count = asked_count + 1, last_asked_at = NOW()
        WHERE id = ${(existing[0] as { id: number }).id}
      `;
    } else {
      await sql`
        INSERT INTO faq_questions (question, asked_count, last_asked_at, created_at)
        VALUES (${question.trim().slice(0, 300)}, 1, NOW(), NOW())
      `;
    }
  } catch (e) {
    console.error('FAQ tracking error:', e);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 365Scores live data fetcher — LEAN version (max 4 leagues, 6 matches each)
// ──────────────────────────────────────────────────────────────────────────────

interface Live365Match {
  home: string;
  away: string;
  date: string;
  time: string;
  homeScore?: number;
  awayScore?: number;
  roundName?: string;
  status?: string;
}

const KNOWN_UPCOMING_MATCHES: Record<string, Live365Match[]> = {
  champions_league: [
    {
      home: 'Paris Saint-Germain',
      away: 'Arsenal',
      date: '30/05',
      time: '13:00',
      roundName: 'Final',
    },
  ],
};

async function fetch365Results(leagueKey: string): Promise<Live365Match[]> {
  const competition = SCORES365_COMPETITIONS[leagueKey];
  if (!competition) return [];
  try {
    const data = (await scores365Get('/web/games/results/', {
      competitions: competition.id.toString(),
    })) as {
      games?: Array<{
        id: number;
        statusText: string;
        startTime: string;
        roundName?: string;
        homeCompetitor: { name: string; score?: number };
        awayCompetitor: { name: string; score?: number };
      }>;
    };
    if (!data.games) return [];
    return data.games.slice(0, 6).map((g) => {
      const dt = new Date(g.startTime);
      return {
        home: g.homeCompetitor.name,
        away: g.awayCompetitor.name,
        date: `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`,
        time: `${String(dt.getUTCHours() - 3 < 0 ? dt.getUTCHours() + 21 : dt.getUTCHours() - 3).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`,
        homeScore: g.homeCompetitor.score,
        awayScore: g.awayCompetitor.score,
        roundName: g.roundName,
        status: g.statusText,
      };
    });
  } catch {
    return [];
  }
}

async function fetch365Upcoming(leagueKey: string): Promise<Live365Match[]> {
  const competition = SCORES365_COMPETITIONS[leagueKey];
  if (!competition) return [];
  try {
    const data = (await scores365Get('/web/games/', {
      competitions: competition.id.toString(),
      statuses: '1,2',
    })) as {
      games?: Array<{
        startTime: string;
        roundName?: string;
        homeCompetitor: { name: string };
        awayCompetitor: { name: string };
      }>;
    };
    if (!data.games) return KNOWN_UPCOMING_MATCHES[leagueKey] ?? [];
    const future = data.games
      .filter((g) => Date.parse(g.startTime) >= Date.now())
      .slice(0, 6)
      .map((g) => {
        const dt = new Date(g.startTime);
        return {
          home: g.homeCompetitor.name,
          away: g.awayCompetitor.name,
          date: `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`,
          time: `${String(dt.getUTCHours() - 3 < 0 ? dt.getUTCHours() + 21 : dt.getUTCHours() - 3).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`,
          roundName: g.roundName,
        };
      });
    return [...future, ...(KNOWN_UPCOMING_MATCHES[leagueKey] ?? [])].slice(0, 6);
  } catch {
    return KNOWN_UPCOMING_MATCHES[leagueKey] ?? [];
  }
}

function format365Matches(matches: Live365Match[], isResult: boolean): string {
  if (matches.length === 0) return '    (sem dados agora)';
  return matches
    .map((m) => {
      const score =
        isResult && m.homeScore !== undefined && m.awayScore !== undefined
          ? ` | ${m.homeScore}-${m.awayScore}`
          : '';
      const round = m.roundName ? ` [${m.roundName}]` : '';
      return `    - ${m.home} x ${m.away} | ${m.date} ${m.time}${score}${round}`;
    })
    .join('\n');
}

// Only fetch 4 most-requested leagues to keep prompt small and avoid 429
async function buildLive365ScoresSection(): Promise<string> {
  const KEY_LEAGUES: Array<{ key: string; label: string }> = [
    { key: 'brasileirao_a', label: 'Brasileirão Série A' },
    { key: 'brasileirao_b', label: 'Série B' },
    { key: 'copa_do_brasil', label: 'Copa do Brasil' },
    { key: 'libertadores', label: 'Copa Libertadores' },
    { key: 'sudamericana', label: 'Copa Sul-Americana' },
    { key: 'champions_league', label: 'Champions League' },
    { key: 'europa_league', label: 'Europa League' },
    { key: 'conference_league', label: 'Conference League' },
    { key: 'premier_league', label: 'Premier League' },
    { key: 'la_liga', label: 'La Liga' },
    { key: 'serie_a', label: 'Serie A' },
    { key: 'bundesliga', label: 'Bundesliga' },
    { key: 'ligue_1', label: 'Ligue 1' },
  ];

  const [resSettled, upSettled] = await Promise.all([
    Promise.allSettled(KEY_LEAGUES.map((l) => fetch365Results(l.key))),
    Promise.allSettled(KEY_LEAGUES.map((l) => fetch365Upcoming(l.key))),
  ]);

  const sections: string[] = [];
  for (let i = 0; i < KEY_LEAGUES.length; i++) {
    const label = KEY_LEAGUES[i].label;
    const resultSettled = resSettled[i];
    const upcomingSettled = upSettled[i];
    const results = resultSettled.status === 'fulfilled' ? resultSettled.value : [];
    const upcoming = upcomingSettled.status === 'fulfilled' ? upcomingSettled.value : [];
    if (results.length === 0 && upcoming.length === 0) continue;
    sections.push(`  ── ${label} ──`);
    if (results.length > 0) sections.push(`  Resultados:\n${format365Matches(results, true)}`);
    if (upcoming.length > 0) sections.push(`  Próximos:\n${format365Matches(upcoming, false)}`);
  }
  return sections.length > 0 ? sections.join('\n') : '  (dados ao vivo indisponíveis agora)';
}

// ──────────────────────────────────────────────────────────────────────────────
// Static data helpers
// ──────────────────────────────────────────────────────────────────────────────

function buildStaticBrazilianStats(): string {
  if (!teamStats || teamStats.length === 0) return '  (nenhum time no arquivo de estatísticas)';
  return teamStats
    .map(
      (t) =>
        `  - ${t.team} (${t.league}): méd.total ${t.avgTotalCorners} | a favor ${t.avgCornersFor} | contra ${t.avgCornersAgainst} | casa ${t.avgCornersHome} | fora ${t.avgCornersAway} | 1ºT a fav ${t.avgCornersFirstHalf} | 2ºT a fav ${t.avgCornersSecondHalf} | Over 8.5: ${t.over85Pct}% | Over 9.5: ${t.over95Pct}% | Over 10.5: ${t.over105Pct}% | últ.5: [${t.last5Games.join(',')}] méd=${t.avgLast5} | ganhando: ${t.avgCornersWinning} | emp: ${t.avgCornersDrawing} | perd: ${t.avgCornersLosing}`
    )
    .join('\n');
}

function buildStaticHalftimeStats(): string {
  if (!teamStats || teamStats.length === 0) return '  (sem dados de tempo)';
  const serieA = teamStats.filter((t) => t.league === 'Brasileirão Série A');
  const serieB = teamStats.filter((t) => t.league === 'Brasileirão Série B');
  const libertadores = teamStats.filter((t) => t.league === 'Copa Libertadores');
  const fmt = (t: (typeof teamStats)[0]) =>
    `    - ${t.team}: 1ºT a favor ${t.avgCornersFirstHalf} | 2ºT a favor ${t.avgCornersSecondHalf} | total/jogo ${t.avgTotalCorners}`;
  const linesA = serieA.length ? serieA.map(fmt).join('\n') : '    (nenhum)';
  const linesB = serieB.length ? serieB.map(fmt).join('\n') : '    (nenhum)';
  const linesLib = libertadores.length ? libertadores.map(fmt).join('\n') : '    (nenhum)';
  return `  SÉRIE A:\n${linesA}\n\n  SÉRIE B:\n${linesB}\n\n  COPA LIBERTADORES:\n${linesLib}`;
}

function buildStaticH2H(): string {
  if (!headToHeadData || headToHeadData.length === 0) return '  (sem dados de H2H no arquivo)';
  return headToHeadData
    .map(
      (h) =>
        `  - ${h.homeTeam} x ${h.awayTeam}: méd. ${h.avgTotalCorners} escanteios | ${h.matches.length} confrontos | casa méd ${h.avgHomeCorners} | fora méd ${h.avgAwayCorners} | último: ${h.matches[0]?.date ?? 'N/A'}`
    )
    .join('\n');
}

function buildStaticUpcomingMatches(today: string): string {
  if (!upcomingMatches || upcomingMatches.length === 0) return '  (sem jogos agendados no arquivo)';
  const futureMatches = upcomingMatches.filter((m) => m.date >= today);
  if (futureMatches.length === 0) return '  (sem jogos futuros no arquivo)';
  return futureMatches
    .map(
      (m) =>
        `  - ${m.homeTeam} x ${m.awayTeam} | ${m.date} | ${m.competition} | previsão: ${m.predictedCorners} escanteios`
    )
    .join('\n');
}

function buildConmebolStats(): string {
  const libLines = libertadoresTeamStats.map(
    (t) =>
      `  - ${t.team}: a favor ${t.avgCornersFor} | contra ${t.avgCornersAgainst} | total ${t.avgTotalCorners} | Over 8.5: ${t.over85Pct}% | Over 9.5: ${t.over95Pct}% | Over 10.5: ${t.over105Pct}% | jogos: ${t.gamesPlayed}`
  );
  const sulLines = sulAmericanaTeamStats.map(
    (t) =>
      `  - ${t.team}: a favor ${t.avgCornersFor} | contra ${t.avgCornersAgainst} | total ${t.avgTotalCorners} | Over 8.5: ${t.over85Pct}% | Over 9.5: ${t.over95Pct}% | Over 10.5: ${t.over105Pct}% | jogos: ${t.gamesPlayed}`
  );
  return `COPA LIBERTADORES 2026 (fase de grupos — médias por jogo):\n${libLines.join('\n')}\n\nCOPA SUL-AMERICANA 2026 (fase de grupos — médias por jogo):\n${sulLines.join('\n')}`;
}

function buildUefaStats(): string {
  const clLines = championsLeagueTeamStats.map(
    (t) =>
      `  - ${t.team}: a favor ${t.avgCornersFor} | contra ${t.avgCornersAgainst} | total ${t.avgTotalCorners} | Over 8.5: ${t.over85Pct}% | Over 9.5: ${t.over95Pct}% | Over 10.5: ${t.over105Pct}% | jogos: ${t.gamesPlayed}`
  );
  const elLines = europaLeagueTeamStats.map(
    (t) =>
      `  - ${t.team}: a favor ${t.avgCornersFor} | contra ${t.avgCornersAgainst} | total ${t.avgTotalCorners} | Over 8.5: ${t.over85Pct}% | Over 9.5: ${t.over95Pct}% | Over 10.5: ${t.over105Pct}% | jogos: ${t.gamesPlayed}`
  );
  const confLines = conferenceLeagueTeamStats.map(
    (t) =>
      `  - ${t.team}: a favor ${t.avgCornersFor} | contra ${t.avgCornersAgainst} | total ${t.avgTotalCorners} | Over 8.5: ${t.over85Pct}% | Over 9.5: ${t.over95Pct}% | Over 10.5: ${t.over105Pct}% | jogos: ${t.gamesPlayed}`
  );
  return `CHAMPIONS LEAGUE 2024/25 (escanteios por time):\n${clLines.join('\n')}\n\nEUROPA LEAGUE 2024/25 (escanteios por time):\n${elLines.join('\n')}\n\nCONFERENCE LEAGUE 2024/25 (escanteios por time):\n${confLines.join('\n')}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Build the full system prompt — all DB + API queries run in PARALLEL
// ──────────────────────────────────────────────────────────────────────────────
async function buildSystemPrompt(): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  // Run all async operations in parallel — NO SofaScore calls here (too slow/blocked)
  const [
    live365ScoresResult,
    leaguesResult,
    teamsResult,
    matchesResult,
    statsResult,
    h2hResult,
    completedResult,
  ] = await Promise.allSettled([
    buildLive365ScoresSection(),
    sql`SELECT DISTINCT league FROM teams ORDER BY league`,
    sql`SELECT name, league FROM teams ORDER BY league, name`,
    sql`
      SELECT home_team, away_team, match_date, match_time, league, round
      FROM upcoming_matches
      WHERE match_date >= ${today} AND (is_completed = 0 OR is_completed IS NULL)
      ORDER BY match_date, match_time
      LIMIT 30
    `,
    sql`
      SELECT t.name, t.league, ts.games_played, ts.avg_corners, ts.home_avg, ts.away_avg,
             ts.over_85_pct, ts.over_95_pct, ts.over_105_pct, ts.last_5_avg
      FROM team_stats ts
      JOIN teams t ON t.id = ts.team_id
      ORDER BY t.league, t.name
    `,
    sql`
      SELECT team1, team2, total_matches, avg_corners, last_match_date, last_match_corners
      FROM head_to_head
      ORDER BY team1, team2
    `,
    sql`
      SELECT home_team, away_team, match_date, league, round, home_corners, away_corners
      FROM upcoming_matches
      WHERE is_completed = 1
      ORDER BY match_date DESC
      LIMIT 30
    `,
  ]);

  // Extract results safely
  const live365Section =
    live365ScoresResult.status === 'fulfilled'
      ? live365ScoresResult.value
      : '  (dados ao vivo indisponíveis agora)';

  const leagues =
    leaguesResult.status === 'fulfilled' ? (leaguesResult.value as Array<{ league: string }>) : [];
  const teamsData =
    teamsResult.status === 'fulfilled'
      ? (teamsResult.value as Array<{ name: string; league: string }>)
      : [];
  const matchesData =
    matchesResult.status === 'fulfilled'
      ? (matchesResult.value as Array<{
          home_team: string;
          away_team: string;
          match_date: string;
          match_time: string | null;
          league: string;
          round: string | null;
        }>)
      : [];
  const statsData =
    statsResult.status === 'fulfilled'
      ? (statsResult.value as Array<{
          name: string;
          league: string;
          games_played: number | null;
          avg_corners: number | null;
          home_avg: number | null;
          away_avg: number | null;
          over_85_pct: number | null;
          over_95_pct: number | null;
          over_105_pct: number | null;
          last_5_avg: number | null;
        }>)
      : [];
  const h2hData =
    h2hResult.status === 'fulfilled'
      ? (h2hResult.value as Array<{
          team1: string;
          team2: string;
          total_matches: number | null;
          avg_corners: number | null;
          last_match_date: string | null;
          last_match_corners: number | null;
        }>)
      : [];
  const completedData =
    completedResult.status === 'fulfilled'
      ? (completedResult.value as Array<{
          home_team: string;
          away_team: string;
          match_date: string;
          league: string;
          round: string | null;
          home_corners: number | null;
          away_corners: number | null;
        }>)
      : [];

  // Build leagues text
  const allSupportedLeagues = Object.entries(LEAGUE_NAMES)
    .map(([, info]) => `  - ${info.name} (${info.country})`)
    .join('\n');

  let leaguesText = '';
  let teamsByLeague = 'Nenhum time cadastrado ainda.';

  if (leagues.length > 0) {
    const dbLeagueKeys = leagues.map((l) => l.league);
    const withDataList = dbLeagueKeys.map((k) => `  - ${leagueDisplay(k)} ✅`).join('\n');
    leaguesText = `LIGAS COM DADOS NO BANCO:\n${withDataList || '  (nenhuma ainda)'}`;
    const grouped: Record<string, string[]> = {};
    for (const t of teamsData) {
      if (!grouped[t.league]) grouped[t.league] = [];
      grouped[t.league].push(t.name);
    }
    teamsByLeague = Object.entries(grouped)
      .map(([league, teams]) => `  ${league}:\n${teams.map((t) => `    - ${t}`).join('\n')}`)
      .join('\n');
  } else {
    leaguesText = `LIGAS SUPORTADAS (sem dados no banco ainda):\n${allSupportedLeagues}`;
  }

  // Build matches text (DB)
  let matchesText = 'Nenhum jogo no banco de dados.';
  if (matchesData.length > 0) {
    matchesText = matchesData
      .map(
        (m) =>
          `  - ${m.home_team} x ${m.away_team} | ${m.match_date}${m.match_time ? ' ' + m.match_time : ''} | ${leagueDisplay(m.league)}${m.round ? ' - ' + m.round : ''}`
      )
      .join('\n');
  }

  // Build stats text (DB)
  let statsText = 'Estatísticas não disponíveis no banco ainda.';
  if (statsData.length > 0) {
    statsText = statsData
      .map(
        (s) =>
          `  - ${s.name} (${s.league}): méd.total ${s.avg_corners ?? 'N/A'} | casa ${s.home_avg ?? 'N/A'} | fora ${s.away_avg ?? 'N/A'} | Over8.5: ${s.over_85_pct ?? 'N/A'}% | Over9.5: ${s.over_95_pct ?? 'N/A'}% | Over10.5: ${s.over_105_pct ?? 'N/A'}%`
      )
      .join('\n');
  }

  // Build H2H text (DB)
  let h2hText = 'H2H não disponível ainda.';
  if (h2hData.length > 0) {
    h2hText = h2hData
      .map(
        (h) =>
          `  - ${h.team1} x ${h.team2}: méd. ${h.avg_corners ?? 'N/A'} cant. | ${h.total_matches ?? 0} jogos | último: ${h.last_match_date ?? 'N/A'} (${h.last_match_corners ?? 'N/A'})`
      )
      .join('\n');
  }

  // Build completed matches text (DB)
  let completedText = 'Sem resultados no banco ainda.';
  if (completedData.length > 0) {
    completedText = completedData
      .map((m) => {
        const corners =
          m.home_corners !== null && m.away_corners !== null
            ? ` | Cant: ${m.home_corners}-${m.away_corners} (total ${m.home_corners + m.away_corners})`
            : '';
        return `  - ${m.home_team} x ${m.away_team} | ${m.match_date} | ${leagueDisplay(m.league)}${m.round ? ' - ' + m.round : ''}${corners}`;
      })
      .join('\n');
  }

  return `Você é a IA da Cantos — especialista em estatísticas de escanteios de futebol.
Hoje: ${today}. Responda SEMPRE em português brasileiro. NUNCA invente dados.

=== DADOS AO VIVO 365SCORES (Brasileirão + Libertadores) ===
${live365Section}

=== RESULTADOS DO BANCO (admin importou) ===
${completedText}

=== PRÓXIMOS JOGOS DO BANCO ===
${matchesText}

=== LIGAS / TIMES CADASTRADOS ===
${leaguesText}
${teamsByLeague}

=== ESTATÍSTICAS DO BANCO (times/ligas) ===
${statsText}

=== CONFRONTOS DIRETOS DO BANCO (H2H) ===
${h2hText}

=== ESTATÍSTICAS ESTÁTICAS — Brasileirão + Ligas Brasileiras 2026 ===
Formato: time (liga): méd.total | a favor | contra | casa | fora | 1ºT | 2ºT | Over8.5% | Over9.5% | Over10.5% | últ.5 | ganhando | empatando | perdendo
${buildStaticBrazilianStats()}

=== H2H ARQUIVO (confrontos históricos brasileiros) ===
${buildStaticH2H()}

=== ESCANTEIOS POR TEMPO (1º e 2º T) ===
${buildStaticHalftimeStats()}

=== CONMEBOL — Libertadores + Sul-Americana 2026 ===
${buildConmebolStats()}

=== UEFA — Champions, Europa, Conference League 2024/25 ===
${buildUefaStats()}

=== PRÓXIMOS JOGOS (arquivo do app) ===
${buildStaticUpcomingMatches(today)}

=== INSTRUÇÕES ===
- Para resultados recentes e próximos jogos: use a seção "DADOS AO VIVO 365SCORES" primeiro, depois o banco.
- Para análise de escanteios de um jogo: combine as médias dos dois times + H2H + tendência últimos 5 jogos.
- Se o jogo não estiver nos dados, diga que não está disponível e oriente o usuário a verificar as abas no app.
- Para Over/Under: calcule a soma das médias totais dos dois times e compare com a linha desejada.
- Responda de forma objetiva, usando os números disponíveis.
`;
}

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function questionMentionsLeague(normalized: string, league: string): boolean {
  const leagueNorm = normalizeQuestion(league);
  if (normalized.includes(leagueNorm)) return true;
  const aliases: Record<string, string[]> = {
    'brasileirao serie a': ['brasileirao', 'serie a'],
    'brasileirao serie b': ['serie b'],
    'copa libertadores': ['libertadores'],
    'copa sul-americana': ['sul americana', 'sudamericana'],
    'champions league': ['champions'],
    'europa league': ['europa league'],
    'conference league': ['conference'],
    'copa do brasil': ['copa do brasil'],
  };
  return (aliases[leagueNorm] ?? []).some((alias) => normalized.includes(alias));
}

function buildDetailedTeamStatsAnswer(question: string): string | null {
  const normalized = normalizeQuestion(question);
  const matches = teamStats.filter((team) => normalized.includes(normalizeQuestion(team.team)));
  if (matches.length === 0) return null;

  const team = matches.find((item) => questionMentionsLeague(normalized, item.league)) ?? matches[0];

  return `${team.team} na ${team.league}:

- Media a favor: ${team.avgCornersFor} escanteios por jogo.
- Media contra: ${team.avgCornersAgainst} escanteios cedidos por jogo.
- Total medio nos jogos: ${team.avgTotalCorners} escanteios.
- Por tempo: ${team.avgCornersFirstHalf} no 1o tempo e ${team.avgCornersSecondHalf} no 2o tempo.
- Casa/fora: ${team.avgCornersHome} em casa e ${team.avgCornersAway} fora.
- Ultimos 5 jogos: media ${team.avgLast5} (${team.last5Games.join(', ')}).
- Over 8.5: ${team.over85Pct}% | Over 9.5: ${team.over95Pct}% | Over 10.5: ${team.over105Pct}%.
- Amostra: ${team.gamesPlayed} jogos analisados.`;
}

const LOCAL_STATS_SETS = [
  { label: 'Libertadores', stats: libertadoresTeamStats },
  { label: 'Sul-Americana', stats: sulAmericanaTeamStats },
  { label: 'Champions League', stats: championsLeagueTeamStats },
  { label: 'Europa League', stats: europaLeagueTeamStats },
  { label: 'Conference League', stats: conferenceLeagueTeamStats },
  { label: 'Brasileirao', stats: teamStats },
];

function buildLocalStatsAnswer(question: string): string | null {
  const normalized = normalizeQuestion(question);
  if (
    !normalized.includes('escanteio') &&
    !normalized.includes('canto') &&
    !normalized.includes('corner') &&
    !normalized.includes('media')
  )
    return null;

  const detailedAnswer = buildDetailedTeamStatsAnswer(question);
  if (detailedAnswer) return detailedAnswer;

  const preferredSets = LOCAL_STATS_SETS.filter((set) =>
    normalizeQuestion(set.label)
      .split(' ')
      .some((term) => term && normalized.includes(term))
  );
  const sets = preferredSets.length > 0 ? preferredSets : LOCAL_STATS_SETS;

  for (const set of sets) {
    const team = set.stats.find((item) => normalized.includes(normalizeQuestion(item.team)));
    if (!team) continue;

    return `${team.team} na ${set.label}:

- Media a favor: ${team.avgCornersFor} escanteios por jogo.
- Media contra: ${team.avgCornersAgainst} escanteios cedidos por jogo.
- Total medio nos jogos: ${team.avgTotalCorners} escanteios.
- Over 8.5: ${team.over85Pct}% | Over 9.5: ${team.over95Pct}% | Over 10.5: ${team.over105Pct}%.
- Amostra: ${team.gamesPlayed} jogos analisados.`;
  }

  return null;
}

function buildLocalInventoryAnswer(question: string): string | null {
  const normalized = normalizeQuestion(question);
  const asksLocalData =
    (normalized.includes('dados') && normalized.includes('local')) ||
    normalized.includes('base local') ||
    normalized.includes('temos local');

  if (!asksLocalData) return null;

  return `Hoje eu consigo responder localmente, sem gastar Gemini, sobre:

- Escanteios por time: Brasileirao Serie A, Serie B, Copa do Brasil, Libertadores, Sul-Americana, Champions, Europa League e Conference League.
- Medias por tempo: 1o tempo e 2o tempo para a base detalhada brasileira e Libertadores.
- Recortes por contexto: casa/fora, ultimos 5 jogos, primeiro escanteio e linhas Over 8.5, 9.5 e 10.5.
- Jogos e competicoes: proximos jogos/resultados quando a fonte 365Scores ou os arquivos locais retornam dados.
- Cartoes: estatisticas locais de times brasileiros e alguns arbitros cadastrados.

Quando a pergunta bate nessa base local, eu respondo direto por ela. So uso o Gemini para interpretacoes abertas ou dados que nao encontrei localmente.`;
}

function buildLocalLeagueAnswer(question: string): string | null {
  const normalized = normalizeQuestion(question);
  if (!normalized.includes('liga') && !normalized.includes('competicao')) return null;

  return `Ligas e competicoes principais disponiveis no app:

- Brasil: Brasileirao Serie A, Serie B, Copa do Brasil e estaduais.
- America do Sul: Libertadores, Sul-Americana, Copa America, Argentina e outras ligas sul-americanas.
- Europa: Champions League, Europa League, Conference League, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Portugal, Holanda, Escocia, Belgica, Turquia e outras.
- Mundo: Copa do Mundo, MLS, Liga MX, competicoes da CAF e AFC.

Para perguntas de medias de escanteios por time, eu tento responder primeiro pela base local.`;
}

function buildLocalFirstReply(question: string): string | null {
  return (
    buildLocalStatsAnswer(question) ??
    buildLocalInventoryAnswer(question) ??
    buildLocalLeagueAnswer(question)
  );
}

function buildLocalAssistantReply(question: string): string {
  const normalized = normalizeQuestion(question);
  const statsAnswer = buildLocalFirstReply(question);

  if (statsAnswer) return statsAnswer;

  if (normalized.includes('liga') || normalized.includes('competicao')) {
    return `Quando nao consigo consultar o Gemini, respondo pelo guia local do app.

Ligas e competições principais disponíveis:

- Brasil: Brasileirão Série A, Série B, Copa do Brasil e estaduais.
- América do Sul: Libertadores, Sul-Americana, Copa América, Argentina e outras ligas sul-americanas.
- Europa: Champions League, Europa League, Conference League, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Portugal, Holanda, Escócia, Bélgica, Turquia e outras.
- Mundo: Copa do Mundo, MLS, Liga MX, competições da CAF e AFC.

Para ativar respostas completas com análise de dados, configure GEMINI_API_KEY no arquivo .env.local.`;
  }

  if (normalized.includes('over') || normalized.includes('escanteio')) {
    return `Quando nao consigo consultar o Gemini, ainda posso explicar a leitura basica:

- Over 8.5 significa precisar de 9 ou mais escanteios no jogo.
- Over 9.5 significa 10 ou mais escanteios.
- Para analisar uma partida, compare a média total dos dois times, a média a favor, a média contra, casa/fora e os últimos 5 jogos.
- Se os dois times somam médias altas e costumam sofrer escanteios, a linha de over fica mais interessante.`;
  }

  return `A IA completa ainda precisa da chave do Gemini para responder livremente.

Configure GEMINI_API_KEY em .env.local e reinicie o servidor. Enquanto isso, consigo responder perguntas básicas sobre ligas disponíveis, uso do app e interpretação de linhas de escanteios.`;
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = (await request.json()) as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Mensagens obrigatórias' }, { status: 400 });
    }

    // Track the last user question for FAQ (non-blocking)
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      trackQuestion(lastUserMessage.content).catch(() => {});
    }

    const localFirstReply = lastUserMessage ? buildLocalFirstReply(lastUserMessage.content) : null;
    if (localFirstReply) {
      return NextResponse.json({
        reply: localFirstReply,
        provider: 'local-first',
      });
    }

    // Build dynamic system prompt — wrap so a failure doesn't crash the whole handler
    let systemPrompt = '';
    try {
      systemPrompt = await buildSystemPrompt();
    } catch (promptErr) {
      console.error('buildSystemPrompt error:', promptErr);
      const today = new Date().toISOString().split('T')[0];
      systemPrompt = `Você é a IA da Cantos — assistente de estatísticas de escanteios de futebol.
Responda sempre em português brasileiro. Não invente dados.
A data de hoje é ${today}.
${buildStaticBrazilianStats()}
${buildConmebolStats()}`;
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({
        reply: buildLocalAssistantReply(lastUserMessage?.content ?? ''),
        provider: 'local-fallback',
      });
    }

    // Gemini requires conversation to start with a user message
    const validMessages = messages.filter((m, i) => {
      if (i === 0) return m.role === 'user';
      return true;
    });
    const firstUserIdx = validMessages.findIndex((m) => m.role === 'user');
    const trimmedMessages = firstUserIdx >= 0 ? validMessages.slice(firstUserIdx) : validMessages;

    if (trimmedMessages.length === 0) {
      return NextResponse.json({ error: 'Nenhuma mensagem válida encontrada' }, { status: 400 });
    }

    // Convert to Gemini format (role "assistant" → "model")
    const geminiContents = trimmedMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: geminiContents,
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Gemini API error [HTTP ${res.status}]:`, errText);
      const localReply =
        buildLocalFirstReply(lastUserMessage?.content ?? '') ??
        buildLocalAssistantReply(lastUserMessage?.content ?? '');
      const prefix =
        res.status === 429
          ? 'O Gemini gratuito atingiu o limite de uso agora, entao respondi com os dados locais do app.'
          : `O Gemini retornou erro ${res.status}, entao respondi com os dados locais do app.`;

      return NextResponse.json({
        reply: `${prefix}\n\n${localReply}`,
        provider: 'local-fallback',
      });
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      error?: { message: string; code?: number };
    };

    if (data.error) {
      console.error('Gemini API returned error body:', data.error);
      return NextResponse.json({ error: 'Erro da IA: ' + data.error.message }, { status: 500 });
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Não consegui gerar uma resposta. Tente novamente.';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }
}
