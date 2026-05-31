import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { teamStats, headToHeadData, upcomingMatches } from '@/data/teamCornerStats';
import { currentUpcomingMatches } from '@/data/currentFixtures';
import { findReferee, getRefereeStatsSummary } from '@/data/brazilianReferees';
import { findTeamCardStats } from '@/data/teamCardStats';
import {
  libertadoresTeamStats,
  sulAmericanaTeamStats,
  championsLeagueTeamStats,
  europaLeagueTeamStats,
  conferenceLeagueTeamStats,
} from '@/data/cornerStats';
import { scores365Get, SCORES365_COMPETITIONS } from '@/app/api/utils/scores365';

export const maxDuration = 60;

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

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type SimpleTeamStats = {
  team: string;
  league?: string;
  avgCornersFor: number;
  avgCornersAgainst: number;
  avgTotalCorners: number;
  avgCornersFirstHalf?: number;
  avgCornersSecondHalf?: number;
  avgCornersHome?: number;
  avgCornersAway?: number;
  avgLast5?: number;
  last5Games?: number[];
  over85Pct: number;
  over95Pct: number;
  over105Pct: number;
  gamesPlayed: number;
};

type LocalStatsSet = {
  label: string;
  competition: string;
  stats: SimpleTeamStats[];
};

const LOCAL_STATS_SETS: LocalStatsSet[] = [
  { label: 'Brasileirão, Copa do Brasil e Libertadores detalhada', competition: 'Base detalhada', stats: teamStats as SimpleTeamStats[] },
  { label: 'Copa Libertadores', competition: 'CONMEBOL', stats: libertadoresTeamStats as SimpleTeamStats[] },
  { label: 'Copa Sul-Americana', competition: 'CONMEBOL', stats: sulAmericanaTeamStats as SimpleTeamStats[] },
  { label: 'Champions League', competition: 'UEFA', stats: championsLeagueTeamStats as SimpleTeamStats[] },
  { label: 'Europa League', competition: 'UEFA', stats: europaLeagueTeamStats as SimpleTeamStats[] },
  { label: 'Conference League', competition: 'UEFA', stats: conferenceLeagueTeamStats as SimpleTeamStats[] },
];

function leagueDisplay(key: string): string {
  const info = LEAGUE_NAMES[key];
  if (info) return `${info.name} - ${info.country}`;
  return key;
}

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°]/g, 'o');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function buildConversationContext(messages: ChatMessage[]): string {
  return messages
    .slice(-8)
    .map((m) => m.content)
    .join(' ');
}

function buildSupportedLeagueCatalog(): string {
  const grouped: Record<string, string[]> = {};
  Object.values(LEAGUE_NAMES).forEach((info) => {
    (grouped[info.country] ??= []).push(info.name);
  });

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([country, leagues]) => `- ${country}: ${uniqueSorted(leagues).join(', ')}.`)
    .join('\n');
}

function buildLocalStatsCoverage(): string {
  const lines = LOCAL_STATS_SETS.map((set) => {
    const teams = uniqueSorted(set.stats.map((item) => item.team));
    return `- ${set.label}: ${teams.length} times com médias de escanteios (${teams.slice(0, 12).join(', ')}${teams.length > 12 ? '...' : ''}).`;
  });
  return lines.join('\n');
}

function leagueMentionTerms(league: string): string[] {
  const leagueNorm = normalizeQuestion(league);
  const aliases: Record<string, string[]> = {
    'brasileirao serie a': ['brasileirao', 'brasileiro', 'serie a'],
    'brasileirao serie b': ['serie b'],
    'copa libertadores': ['libertadores'],
    'copa sul-americana': ['sul americana', 'sudamericana'],
    'champions league': ['champions'],
    'europa league': ['europa league'],
    'conference league': ['conference'],
    'copa do brasil': ['copa do brasil'],
  };
  return uniqueSorted([leagueNorm, ...(aliases[leagueNorm] ?? [])]).filter(Boolean);
}

function questionMentionsLeague(normalized: string, league: string): boolean {
  return leagueMentionTerms(league).some((term) => normalized.includes(term));
}

function latestLeagueMentionPosition(normalized: string, league: string): number {
  return leagueMentionTerms(league).reduce((latest, term) => Math.max(latest, normalized.lastIndexOf(term)), -1);
}

function detectHalfRequest(normalizedQuestion: string): 'first' | 'second' | null {
  if (
    normalizedQuestion.includes('primeiro tempo') ||
    normalizedQuestion.includes('1o tempo') ||
    normalizedQuestion.includes('1 tempo') ||
    normalizedQuestion.includes('1t') ||
    normalizedQuestion.includes('so no primeiro')
  ) {
    return 'first';
  }
  if (
    normalizedQuestion.includes('segundo tempo') ||
    normalizedQuestion.includes('2o tempo') ||
    normalizedQuestion.includes('2 tempo') ||
    normalizedQuestion.includes('2t') ||
    normalizedQuestion.includes('so no segundo')
  ) {
    return 'second';
  }
  return null;
}

function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function firstHalfAverage(team: SimpleTeamStats): number {
  return team.avgCornersFirstHalf ?? oneDecimal(team.avgCornersFor * 0.46);
}

function secondHalfAverage(team: SimpleTeamStats): number {
  return team.avgCornersSecondHalf ?? oneDecimal(team.avgCornersFor * 0.54);
}

function formatTeamStats(team: SimpleTeamStats, league: string, halfOnly: 'first' | 'second' | null): string {
  const firstHalf = firstHalfAverage(team);
  const secondHalf = secondHalfAverage(team);

  if (halfOnly === 'first') {
    return `${team.team} na ${league}, somente no 1o tempo:\n\n- Media a favor no 1o tempo: ${firstHalf} escanteios.\n- Media total do jogo: ${team.avgTotalCorners} escanteios.\n- Media a favor no jogo: ${team.avgCornersFor}.\n- Media contra no jogo: ${team.avgCornersAgainst}.\n- Amostra: ${team.gamesPlayed} jogos analisados.`;
  }

  if (halfOnly === 'second') {
    return `${team.team} na ${league}, somente no 2o tempo:\n\n- Media a favor no 2o tempo: ${secondHalf} escanteios.\n- Media total do jogo: ${team.avgTotalCorners} escanteios.\n- Media a favor no jogo: ${team.avgCornersFor}.\n- Media contra no jogo: ${team.avgCornersAgainst}.\n- Amostra: ${team.gamesPlayed} jogos analisados.`;
  }

  const byHalf = `\n- Por tempo: ${firstHalf} no 1o tempo e ${secondHalf} no 2o tempo.`;
  const homeAway =
    team.avgCornersHome !== undefined && team.avgCornersAway !== undefined
      ? `\n- Casa/fora: ${team.avgCornersHome} em casa e ${team.avgCornersAway} fora.`
      : '';
  const last5 =
    team.avgLast5 !== undefined && team.last5Games
      ? `\n- Ultimos 5 jogos: media ${team.avgLast5} (${team.last5Games.join(', ')}).`
      : '';

  return `${team.team} na ${league}:\n\n- Media a favor: ${team.avgCornersFor} escanteios por jogo.\n- Media contra: ${team.avgCornersAgainst} escanteios cedidos por jogo.\n- Total medio nos jogos: ${team.avgTotalCorners} escanteios.${byHalf}${homeAway}${last5}\n- Over 8.5: ${team.over85Pct}% | Over 9.5: ${team.over95Pct}% | Over 10.5: ${team.over105Pct}%.\n- Amostra: ${team.gamesPlayed} jogos analisados.`;
}

function buildDetailedTeamStatsAnswer(question: string, context: string): string | null {
  const normalizedQuestion = normalizeQuestion(question);
  const combined = normalizeQuestion(`${context} ${question}`);
  const halfOnly = detectHalfRequest(normalizedQuestion);

  const asksStats =
    combined.includes('escanteio') ||
    combined.includes('canto') ||
    combined.includes('corner') ||
    combined.includes('media') ||
    halfOnly !== null;

  if (!asksStats) return null;

  const candidates = LOCAL_STATS_SETS.flatMap((set) =>
    set.stats
      .filter((team) => combined.includes(normalizeQuestion(team.team)))
      .map((team) => ({ team, setLabel: set.label }))
  );
  if (candidates.length === 0) return null;

  const latestMentionPosition = Math.max(
    ...candidates.map((candidate) => {
      const league = candidate.team.league ?? candidate.setLabel;
      return Math.max(
        latestLeagueMentionPosition(combined, league),
        latestLeagueMentionPosition(combined, candidate.setLabel)
      );
    })
  );

  const scoreCandidate = (candidate: { team: SimpleTeamStats; setLabel: string }) => {
    const teamName = normalizeQuestion(candidate.team.team);
    const league = candidate.team.league ?? candidate.setLabel;
    const latestLeaguePosition = Math.max(
      latestLeagueMentionPosition(combined, league),
      latestLeagueMentionPosition(combined, candidate.setLabel)
    );
    let score = 0;
    if (normalizedQuestion.includes(teamName)) score += 500;
    if (combined.includes(teamName)) score += 50;
    if (questionMentionsLeague(normalizedQuestion, league)) score += 1000;
    if (questionMentionsLeague(normalizedQuestion, candidate.setLabel)) score += 900;
    if (questionMentionsLeague(combined, league)) score += 100;
    if (questionMentionsLeague(combined, candidate.setLabel)) score += 80;
    if (latestLeaguePosition >= 0 && latestLeaguePosition === latestMentionPosition) score += 650;
    else if (latestLeaguePosition >= 0) score += 100;
    return score;
  };

  const selected = candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  const league = selected.team.league ?? selected.setLabel;
  return formatTeamStats(selected.team, league, halfOnly);
}

function questionMentionsAnyDetailedTeam(normalized: string): boolean {
  return LOCAL_STATS_SETS.some((set) =>
    set.stats.some((team) => normalized.includes(normalizeQuestion(team.team)))
  );
}

function asksCompetitionAggregate(question: string): boolean {
  const normalized = normalizeQuestion(question);
  const aggregateIntent =
    normalized.includes('media do campeonato') ||
    normalized.includes('media da competicao') ||
    normalized.includes('media da liga') ||
    normalized.includes('campeonato inteiro') ||
    normalized.includes('todos os times') ||
    normalized.includes('todos os clubes') ||
    normalized.includes('media geral') ||
    (normalized.includes('campeonato') && !questionMentionsAnyDetailedTeam(normalized));

  return aggregateIntent && (normalized.includes('media') || normalized.includes('escanteio'));
}

function average(values: Array<number | undefined>): number {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function rounded(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function pickStatsGroupForAggregate(question: string, context: string): { label: string; teams: SimpleTeamStats[] } | null {
  const normalizedQuestion = normalizeQuestion(question);
  const normalizedContext = normalizeQuestion(`${question} ${context}`);
  const allTeams = LOCAL_STATS_SETS.flatMap((set) => set.stats);
  const leagues = uniqueSorted(allTeams.map((team) => team.league ?? ''));

  const explicitLeague =
    leagues.find((league) => questionMentionsLeague(normalizedQuestion, league)) ??
    (normalizedQuestion.includes('brasileiro') || normalizedQuestion.includes('brasileirao')
      ? leagues.find((league) => normalizeQuestion(league).includes('brasileirao serie a'))
      : undefined);

  if (explicitLeague) {
    const teams = allTeams.filter((team) => team.league === explicitLeague);
    if (teams.length > 0) return { label: explicitLeague, teams };
  }

  const explicitSet = LOCAL_STATS_SETS.find((set) => questionMentionsLeague(normalizedQuestion, set.label));
  if (explicitSet) return { label: explicitSet.label, teams: explicitSet.stats };

  const contextualLeague = leagues
    .map((league) => ({ league, position: latestLeagueMentionPosition(normalizedContext, league) }))
    .filter((item) => item.position >= 0)
    .sort((a, b) => b.position - a.position)[0]?.league;
  if (contextualLeague) {
    const teams = allTeams.filter((team) => team.league === contextualLeague);
    if (teams.length > 0) return { label: contextualLeague, teams };
  }

  const contextualSet = LOCAL_STATS_SETS.map((set) => ({
    set,
    position: latestLeagueMentionPosition(normalizedContext, set.label),
  }))
    .filter((item) => item.position >= 0)
    .sort((a, b) => b.position - a.position)[0]?.set;
  if (contextualSet) return { label: contextualSet.label, teams: contextualSet.stats };

  const fallbackSet = LOCAL_STATS_SETS[0];
  return fallbackSet ? { label: fallbackSet.label, teams: fallbackSet.stats } : null;
}

function buildCompetitionAverageAnswer(question: string, context: string): string | null {
  if (!asksCompetitionAggregate(question)) return null;

  const group = pickStatsGroupForAggregate(question, context);
  if (!group || group.teams.length === 0) return null;

  const halfOnly = detectHalfRequest(normalizeQuestion(question));

  if (halfOnly === 'first') {
    return `${group.label}, media local dos times no 1o tempo:\n\n- Media a favor no 1o tempo: ${rounded(average(group.teams.map(firstHalfAverage)))} escanteios por time/jogo.\n- Media total a favor no jogo: ${rounded(average(group.teams.map((team) => team.avgCornersFor)))} escanteios por time/jogo.\n- Amostra: ${group.teams.length} times cadastrados na base local.`;
  }

  if (halfOnly === 'second') {
    return `${group.label}, media local dos times no 2o tempo:\n\n- Media a favor no 2o tempo: ${rounded(average(group.teams.map(secondHalfAverage)))} escanteios por time/jogo.\n- Media total a favor no jogo: ${rounded(average(group.teams.map((team) => team.avgCornersFor)))} escanteios por time/jogo.\n- Amostra: ${group.teams.length} times cadastrados na base local.`;
  }

  return `${group.label}, media local geral:\n\n- Media a favor por time: ${rounded(average(group.teams.map((team) => team.avgCornersFor)))} escanteios por jogo.\n- Media contra por time: ${rounded(average(group.teams.map((team) => team.avgCornersAgainst)))} escanteios cedidos por jogo.\n- Media total nos jogos: ${rounded(average(group.teams.map((team) => team.avgTotalCorners)))} escanteios.\n- Por tempo: ${rounded(average(group.teams.map(firstHalfAverage)))} no 1o tempo e ${rounded(average(group.teams.map(secondHalfAverage)))} no 2o tempo.\n- Amostra: ${group.teams.length} times cadastrados na base local.`;
}

function expectedCardsForMatch(match: { homeTeam: string; awayTeam: string; referee?: string | null }) {
  const homeCards = findTeamCardStats(match.homeTeam);
  const awayCards = findTeamCardStats(match.awayTeam);
  const refereeStats = match.referee ? findReferee(match.referee) : null;
  const teamCardsTotal =
    homeCards || awayCards
      ? (homeCards?.avgCardsPerMatch ?? 2.1) + (awayCards?.avgCardsPerMatch ?? 2.1)
      : null;
  const expectedTotal = refereeStats
    ? teamCardsTotal
      ? refereeStats.avgCardsPerMatch * 0.6 + teamCardsTotal * 0.4
      : refereeStats.avgCardsPerMatch
    : teamCardsTotal ?? 4.2;
  const firstHalfPct = refereeStats?.halfDistribution.firstHalf ?? 40;

  return {
    refereeStats,
    refereeSummary: refereeStats ? getRefereeStatsSummary(refereeStats) : null,
    expectedTotal: oneDecimal(expectedTotal),
    firstHalf: oneDecimal(expectedTotal * (firstHalfPct / 100)),
    secondHalf: oneDecimal(expectedTotal * (1 - firstHalfPct / 100)),
  };
}

function buildLocalCardsAnswer(question: string, context: string): string | null {
  const normalizedQuestion = normalizeQuestion(question);
  const combined = normalizeQuestion(`${context} ${question}`);
  const asksCards =
    normalizedQuestion.includes('cartao') ||
    normalizedQuestion.includes('cartoes') ||
    normalizedQuestion.includes('arbitro') ||
    normalizedQuestion.includes('juiz');

  if (!asksCards) return null;

  const allMatches = [...currentUpcomingMatches, ...upcomingMatches];
  const directMatches = allMatches.filter((match) => {
    const home = normalizeQuestion(match.homeTeam);
    const away = normalizeQuestion(match.awayTeam);
    return (
      normalizedQuestion.includes(home) ||
      normalizedQuestion.includes(away) ||
      (combined.includes(home) && combined.includes(away))
    );
  });

  const selectedMatches = directMatches.length > 0 ? directMatches.slice(0, 3) : currentUpcomingMatches.slice(0, 8);

  if (selectedMatches.length === 0) {
    return 'Ainda nao encontrei jogos locais suficientes para estimar juiz e cartoes.';
  }

  const lines = selectedMatches.map((match) => {
    const referee = 'referee' in match && typeof match.referee === 'string' ? match.referee : null;
    const cards = expectedCardsForMatch({ ...match, referee });
    const refereeLabel = referee
      ? cards.refereeStats
        ? `${cards.refereeStats.name} (${cards.refereeStats.avgCardsPerMatch.toFixed(1)} cartoes/jogo, perfil ${cards.refereeStats.tendency})`
        : `${referee} (sem historico detalhado local)`
      : 'arbitro ainda nao informado';

    return `- ${match.homeTeam} x ${match.awayTeam} (${match.date}, ${match.competition}): juiz ${refereeLabel}; previsao ${cards.expectedTotal} cartoes no jogo, ${cards.firstHalf} no 1o tempo e ${cards.secondHalf} no 2o tempo.`;
  });

  return `Previsao local de cartoes e arbitragem:\n\n${lines.join('\n')}`;
}

function buildLocalStatsAnswer(question: string, context: string): string | null {
  const combined = normalizeQuestion(`${context} ${question}`);
  if (
    !combined.includes('escanteio') &&
    !combined.includes('canto') &&
    !combined.includes('corner') &&
    !combined.includes('media')
  ) {
    return null;
  }

  const aggregateAnswer = buildCompetitionAverageAnswer(question, context);
  if (aggregateAnswer) return aggregateAnswer;

  const detailedAnswer = buildDetailedTeamStatsAnswer(question, context);
  if (detailedAnswer) return detailedAnswer;

  for (const set of LOCAL_STATS_SETS) {
    const team = set.stats.find((item) => combined.includes(normalizeQuestion(item.team)));
    if (!team) continue;
    return formatTeamStats(team, team.league ?? set.label, null);
  }

  return null;
}

function buildLocalInventoryAnswer(question: string): string | null {
  const normalized = normalizeQuestion(question);
  const asksLocalData =
    (normalized.includes('dados') && (normalized.includes('local') || normalized.includes('temos'))) ||
    normalized.includes('base local') ||
    normalized.includes('temos local') ||
    normalized.includes('quais dados');

  if (!asksLocalData) return null;

  return `Hoje eu consigo responder primeiro pela base local, sem gastar Gemini, sobre:\n\n${buildLocalStatsCoverage()}\n\nTambem tenho o catalogo de ligas do app:\n${buildSupportedLeagueCatalog()}\n\nQuando a pergunta bate nesses dados locais, eu respondo direto por eles. So uso o Gemini para interpretacoes abertas ou para dados que nao encontrei localmente.`;
}

function buildLocalLeagueAnswer(question: string): string | null {
  const normalized = normalizeQuestion(question);
  if (!normalized.includes('liga') && !normalized.includes('competicao') && !normalized.includes('campeonato')) return null;

  return `Ligas e competicoes disponiveis no app:\n\n${buildSupportedLeagueCatalog()}\n\nNas estatisticas locais de escanteios, a cobertura mais completa hoje esta em:\n${buildLocalStatsCoverage()}\n\nPara medias de escanteios por time e por tempo, eu tento responder primeiro pela base local.`;
}

function buildLocalFirstReply(question: string, context: string): string | null {
  return (
    buildLocalCardsAnswer(question, context) ??
    buildLocalStatsAnswer(question, context) ??
    buildLocalInventoryAnswer(question) ??
    buildLocalLeagueAnswer(question)
  );
}

function buildLocalAssistantReply(question: string, context: string): string {
  const statsAnswer = buildLocalFirstReply(question, context);
  if (statsAnswer) return statsAnswer;

  const normalized = normalizeQuestion(question);
  if (normalized.includes('over') || normalized.includes('escanteio')) {
    return `Quando o Gemini nao estiver disponivel, ainda consigo explicar a leitura basica com os dados locais:\n\n- Over 8.5 significa precisar de 9 ou mais escanteios no jogo.\n- Over 9.5 significa 10 ou mais escanteios.\n- Para analisar uma partida, compare media total dos dois times, media a favor, media contra, casa/fora, recorte por tempo e ultimos jogos.\n- Se voce citar o time e a competicao, eu tento responder direto pela base local antes de usar Gemini.`;
  }

  return `O Gemini nao foi necessario ou nao esta disponivel agora. Posso responder com dados locais sobre ligas, competicoes, medias de escanteios por time, 1o tempo, 2o tempo, casa/fora e linhas de over quando esses dados estao cadastrados no app.`;
}

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

async function buildLive365ScoresSection(): Promise<string> {
  const keyLeagues: Array<{ key: string; label: string }> = [
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
    Promise.allSettled(keyLeagues.map((l) => fetch365Results(l.key))),
    Promise.allSettled(keyLeagues.map((l) => fetch365Upcoming(l.key))),
  ]);

  const sections: string[] = [];
  for (let i = 0; i < keyLeagues.length; i++) {
    const label = keyLeagues[i].label;
    const resultSettled = resSettled[i];
    const upcomingSettled = upSettled[i];
    const results = resultSettled.status === 'fulfilled' ? resultSettled.value : [];
    const upcoming = upcomingSettled.status === 'fulfilled' ? upcomingSettled.value : [];
    if (results.length === 0 && upcoming.length === 0) continue;
    sections.push(`  -- ${label} --`);
    if (results.length > 0) sections.push(`  Resultados:\n${format365Matches(results, true)}`);
    if (upcoming.length > 0) sections.push(`  Proximos:\n${format365Matches(upcoming, false)}`);
  }
  return sections.length > 0 ? sections.join('\n') : '  (dados ao vivo indisponiveis agora)';
}

function buildStaticBrazilianStats(): string {
  if (!teamStats || teamStats.length === 0) return '  (nenhum time no arquivo de estatisticas)';
  return teamStats
    .map(
      (t) =>
        `  - ${t.team} (${t.league}): med.total ${t.avgTotalCorners} | a favor ${t.avgCornersFor} | contra ${t.avgCornersAgainst} | casa ${t.avgCornersHome} | fora ${t.avgCornersAway} | 1oT a fav ${t.avgCornersFirstHalf} | 2oT a fav ${t.avgCornersSecondHalf} | Over 8.5: ${t.over85Pct}% | Over 9.5: ${t.over95Pct}% | Over 10.5: ${t.over105Pct}% | ult.5: [${t.last5Games.join(',')}] med=${t.avgLast5}`
    )
    .join('\n');
}

function buildStaticH2H(): string {
  if (!headToHeadData || headToHeadData.length === 0) return '  (sem dados de H2H no arquivo)';
  return headToHeadData
    .map(
      (h) =>
        `  - ${h.homeTeam} x ${h.awayTeam}: med. ${h.avgTotalCorners} escanteios | ${h.matches.length} confrontos | casa med ${h.avgHomeCorners} | fora med ${h.avgAwayCorners} | ultimo: ${h.matches[0]?.date ?? 'N/A'}`
    )
    .join('\n');
}

function buildStaticUpcomingMatches(today: string): string {
  const allMatches = [...upcomingMatches, ...currentUpcomingMatches];
  if (allMatches.length === 0) return '  (sem jogos agendados no arquivo)';
  const futureMatches = allMatches.filter((m) => m.date >= today);
  if (futureMatches.length === 0) return '  (sem jogos futuros no arquivo)';
  return futureMatches
    .map(
      (m) =>
        `  - ${m.homeTeam} x ${m.awayTeam} | ${m.date} | ${m.competition} | previsao: ${m.predictedCorners} escanteios${'referee' in m && m.referee ? ` | arbitro: ${m.referee}` : ''}`
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
  return `COPA LIBERTADORES 2026:\n${libLines.join('\n')}\n\nCOPA SUL-AMERICANA 2026:\n${sulLines.join('\n')}`;
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
  return `CHAMPIONS LEAGUE:\n${clLines.join('\n')}\n\nEUROPA LEAGUE:\n${elLines.join('\n')}\n\nCONFERENCE LEAGUE:\n${confLines.join('\n')}`;
}

async function buildSystemPrompt(): Promise<string> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(Date.now());

  const [live365ScoresResult, leaguesResult, teamsResult, matchesResult, statsResult, h2hResult, completedResult] =
    await Promise.allSettled([
      buildLive365ScoresSection(),
      sql`SELECT DISTINCT league FROM teams ORDER BY league`,
      sql`SELECT name, league FROM teams ORDER BY league, name`,
      sql`
        SELECT home_team, away_team, match_date, match_time, league, round
        FROM upcoming_matches
        WHERE match_date >= ${today} AND (is_completed = 0 OR is_completed IS NULL)
        ORDER BY match_date, match_time
        LIMIT 200
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
        LIMIT 50
      `,
    ]);

  const live365Section =
    live365ScoresResult.status === 'fulfilled'
      ? live365ScoresResult.value
      : '  (dados ao vivo indisponiveis agora)';

  const leagues = leaguesResult.status === 'fulfilled' ? (leaguesResult.value as Array<{ league: string }>) : [];
  const teamsData =
    teamsResult.status === 'fulfilled' ? (teamsResult.value as Array<{ name: string; league: string }>) : [];
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

  const leaguesText =
    leagues.length > 0
      ? leagues.map((l) => `  - ${leagueDisplay(l.league)}`).join('\n')
      : buildSupportedLeagueCatalog();

  const teamsByLeague = teamsData.length
    ? Object.entries(
        teamsData.reduce<Record<string, string[]>>((acc, t) => {
          (acc[t.league] ??= []).push(t.name);
          return acc;
        }, {})
      )
        .map(([league, teams]) => `  ${league}:\n${teams.map((t) => `    - ${t}`).join('\n')}`)
        .join('\n')
    : 'Nenhum time cadastrado no banco.';

  const matchesText = matchesData.length
    ? matchesData
        .map(
          (m) =>
            `  - ${m.home_team} x ${m.away_team} | ${m.match_date}${m.match_time ? ' ' + m.match_time : ''} | ${leagueDisplay(m.league)}${m.round ? ' - ' + m.round : ''}`
        )
        .join('\n')
    : 'Nenhum jogo futuro no banco.';

  const statsText = statsData.length
    ? statsData
        .map(
          (s) =>
            `  - ${s.name} (${s.league}): med.total ${s.avg_corners ?? 'N/A'} | casa ${s.home_avg ?? 'N/A'} | fora ${s.away_avg ?? 'N/A'} | Over8.5 ${s.over_85_pct ?? 'N/A'}% | Over9.5 ${s.over_95_pct ?? 'N/A'}% | Over10.5 ${s.over_105_pct ?? 'N/A'}%`
        )
        .join('\n')
    : 'Estatisticas do banco indisponiveis.';

  const h2hText = h2hData.length
    ? h2hData
        .map(
          (h) =>
            `  - ${h.team1} x ${h.team2}: med. ${h.avg_corners ?? 'N/A'} cant. | ${h.total_matches ?? 0} jogos | ultimo: ${h.last_match_date ?? 'N/A'} (${h.last_match_corners ?? 'N/A'})`
        )
        .join('\n')
    : 'H2H nao disponivel.';

  const completedText = completedData.length
    ? completedData
        .map((m) => {
          const corners =
            m.home_corners !== null && m.away_corners !== null
              ? ` | Cant: ${m.home_corners}-${m.away_corners} (total ${m.home_corners + m.away_corners})`
              : '';
          return `  - ${m.home_team} x ${m.away_team} | ${m.match_date} | ${leagueDisplay(m.league)}${m.round ? ' - ' + m.round : ''}${corners}`;
        })
        .join('\n')
    : 'Sem resultados no banco.';

  return `Voce e a IA da Cantos, especialista em estatisticas de escanteios de futebol.
Hoje: ${today}. Responda sempre em portugues brasileiro. Nao invente dados.
Prioridade: use primeiro os dados locais abaixo. Use o Gemini apenas para organizar, explicar ou inferir quando os dados locais nao tiverem a resposta direta.

=== COBERTURA LOCAL DE ESTATISTICAS ===
${buildLocalStatsCoverage()}

=== CATALOGO DE LIGAS DO APP ===
${buildSupportedLeagueCatalog()}

=== DADOS AO VIVO 365SCORES ===
${live365Section}

=== RESULTADOS DO BANCO ===
${completedText}

=== PROXIMOS JOGOS DO BANCO ===
${matchesText}

=== LIGAS / TIMES CADASTRADOS NO BANCO ===
${leaguesText}
${teamsByLeague}

=== ESTATISTICAS DO BANCO ===
${statsText}

=== CONFRONTOS DIRETOS DO BANCO ===
${h2hText}

=== ESTATISTICAS LOCAIS DETALHADAS ===
${buildStaticBrazilianStats()}

=== H2H LOCAL ===
${buildStaticH2H()}

=== CONMEBOL ===
${buildConmebolStats()}

=== UEFA ===
${buildUefaStats()}

=== PROXIMOS JOGOS LOCAIS ===
${buildStaticUpcomingMatches(today)}

Instrucoes:
- Para media por tempo, cite 1o tempo e 2o tempo quando existirem.
- Para pergunta de um time especifico, responda com numeros locais antes de qualquer analise aberta.
- Para jogos futuros, combine media dos dois times, casa/fora, por tempo e H2H quando houver.
- Se nao encontrar o dado, diga exatamente que ele nao esta na base local.
`;
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = (await request.json()) as { messages: ChatMessage[] };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Mensagens obrigatorias' }, { status: 400 });
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const localContext = buildConversationContext(messages);

    if (lastUserMessage) {
      trackQuestion(lastUserMessage.content).catch(() => {});
    }

    const localFirstReply = lastUserMessage ? buildLocalFirstReply(lastUserMessage.content, localContext) : null;
    if (localFirstReply) {
      return NextResponse.json({ reply: localFirstReply, provider: 'local-first' });
    }

    let systemPrompt = '';
    try {
      systemPrompt = await buildSystemPrompt();
    } catch (promptErr) {
      console.error('buildSystemPrompt error:', promptErr);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(Date.now());
      systemPrompt = `Voce e a IA da Cantos. Responda em portugues brasileiro e nao invente dados. Hoje: ${today}.\n${buildLocalStatsCoverage()}\n${buildStaticBrazilianStats()}\n${buildConmebolStats()}`;
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({
        reply: buildLocalAssistantReply(lastUserMessage?.content ?? '', localContext),
        provider: 'local-fallback',
      });
    }

    const validMessages = messages.filter((m, i) => {
      if (i === 0) return m.role === 'user';
      return true;
    });
    const firstUserIdx = validMessages.findIndex((m) => m.role === 'user');
    const trimmedMessages = firstUserIdx >= 0 ? validMessages.slice(firstUserIdx) : validMessages;

    if (trimmedMessages.length === 0) {
      return NextResponse.json({ error: 'Nenhuma mensagem valida encontrada' }, { status: 400 });
    }

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
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiContents,
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Gemini API error [HTTP ${res.status}]:`, errText);
      const localReply = buildLocalAssistantReply(lastUserMessage?.content ?? '', localContext);
      const prefix =
        res.status === 429
          ? 'O Gemini gratuito atingiu o limite de uso agora, entao respondi com os dados locais do app.'
          : `O Gemini retornou erro ${res.status}, entao respondi com os dados locais do app.`;

      return NextResponse.json({ reply: `${prefix}\n\n${localReply}`, provider: 'local-fallback' });
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      error?: { message: string; code?: number };
    };

    if (data.error) {
      console.error('Gemini API returned error body:', data.error);
      return NextResponse.json({
        reply: buildLocalAssistantReply(lastUserMessage?.content ?? '', localContext),
        provider: 'local-fallback',
      });
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      buildLocalAssistantReply(lastUserMessage?.content ?? '', localContext);

    return NextResponse.json({ reply, provider: 'gemini' });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }
}
