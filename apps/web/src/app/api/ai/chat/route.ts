import { NextRequest, NextResponse } from 'next/server';
import { getHeadToHead, headToHeadData, teamStats, type HeadToHead } from '@/data/teamCornerStats';
import { currentUpcomingMatches, type CurrentFixture } from '@/data/currentFixtures';
import { findReferee, getRefereeStatsSummary } from '@/data/brazilianReferees';
import { findTeamCardStats } from '@/data/teamCardStats';
import {
  championsLeagueTeamStats,
  conferenceLeagueTeamStats,
  europaLeagueTeamStats,
  libertadoresTeamStats,
  sulAmericanaTeamStats,
} from '@/data/cornerStats';
import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';
import { findFifaSquad, getFifaWorldCupSquads, type FifaSquad, type FifaSquadPlayer } from '@/lib/fifaWorldCup';

export const maxDuration = 60;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type LocalTeamStats = {
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

type Scores365RawUpcomingGame = {
  id: number;
  startTime: string;
  statusId?: number;
  roundNum?: number;
  roundName?: string;
  homeCompetitor?: { id?: number; name?: string; symbolicName?: string };
  awayCompetitor?: { id?: number; name?: string; symbolicName?: string };
};

type Scores365UpcomingMatch = {
  id: number;
  startTime: string;
  round?: number;
  roundName?: string;
  homeTeam: string;
  awayTeam: string;
  competitionName: string;
  country: string;
};

type AiOddsSide = 'home' | 'draw' | 'away';

type AiOddsBookmaker = {
  name: string;
  home: number | null;
  draw: number | null;
  away: number | null;
};

type AiOddsEvent = {
  id: string;
  startTime: string;
  roundName?: string;
  homeTeam: string;
  awayTeam: string;
  bookmakers: AiOddsBookmaker[];
  bestPick?: {
    side: AiOddsSide;
    label: string;
    bookmaker: string;
    odd: number;
    edgePct: number;
  } | null;
};

type AiOddsResponse = {
  configured: boolean;
  source: 'api-football' | 'the-odds-api' | 'not-configured';
  note?: string;
  events?: AiOddsEvent[];
};

type AiOddsAlert = {
  id: string;
  startTime: string;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  marketType: 'corners' | 'other';
  marketName: string;
  lineLabel: string;
  bestBookmaker: string;
  bestOdd: number;
  medianOdd: number;
  secondBestOdd: number | null;
  edgePct: number;
  bookmakersCompared: number;
  bookmakers: Array<{ bookmaker: string; odd: number }>;
};

type AiOddsAlertsResponse = {
  configured: boolean;
  source: 'api-football' | 'not-configured';
  note?: string;
  summary?: {
    leaguesChecked: number;
    eventsChecked: number;
    cornerAlerts: number;
    otherValueAlerts: number;
    bookmakersCompared: number;
  };
  alerts?: AiOddsAlert[];
};

type AiLiveMatch = {
  id: number;
  minute: number | string;
  statusText: string;
  competition?: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  corners?: { home: number; away: number; total: number };
  liveStats?: Array<{ key: string; label: string; home: string; away: string }>;
  stoppage?: {
    totalStoppedMs: number;
    totalStoppedMinutes: number;
    predictedAddedMinutes: number;
    kind?: 'calculated-stoppage' | 'announced-added-time';
    source:
      | '365scores-actual-play-time'
      | '365scores-sportradar'
      | '365scores-announced-added-time'
      | 'sofascore-announced-added-time'
      | 'api-football-announced-added-time';
  };
};

type AiLiveResponse = {
  matches?: AiLiveMatch[];
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00ba\u00b0]/g, 'o')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const brazilianStats = teamStats as LocalTeamStats[];
const brasileiraoSerieAStats = brazilianStats.filter((stats) =>
  normalize(stats.league ?? '').includes('brasileirao serie a')
);
const brasileiraoSerieBStats = brazilianStats.filter((stats) =>
  normalize(stats.league ?? '').includes('brasileirao serie b')
);

const STATS_SETS = [
  { label: 'Brasileirao Serie A', stats: brasileiraoSerieAStats },
  { label: 'Brasileirao Serie B', stats: brasileiraoSerieBStats },
  { label: 'Copa Libertadores', stats: libertadoresTeamStats as LocalTeamStats[] },
  { label: 'Copa Sul-Americana', stats: sulAmericanaTeamStats as LocalTeamStats[] },
  { label: 'Champions League', stats: championsLeagueTeamStats as LocalTeamStats[] },
  { label: 'Europa League', stats: europaLeagueTeamStats as LocalTeamStats[] },
  { label: 'Conference League', stats: conferenceLeagueTeamStats as LocalTeamStats[] },
].filter((set) => set.stats.length > 0);

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function context(messages: ChatMessage[]): string {
  const userMessages = messages.filter((message) => message.role === 'user');
  const previous = userMessages.slice(0, -1).slice(-8);
  const focused: string[] = [];

  for (let index = previous.length - 1; index >= 0; index -= 1) {
    const content = previous[index]?.content ?? '';
    focused.unshift(content);
    if (isContextAnchor(content)) break;
  }

  return focused.join(' ');
}

function isContextAnchor(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized || isFollowUpQuestion(text)) return false;
  if (hasExplicitStatsScope(text)) return true;
  if (askedBestCornerConfrontation(text) || askedBestCornerLeague(text) || askedBestCornerTeam(text)) return true;
  return askedUpcoming(text) || askedCards(text) || askedAddedTime(text) || askedWorldCupSquad(text);
}

function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function weightedAverage(stats: LocalTeamStats[], selector: (stats: LocalTeamStats) => number): number {
  const totalGames = stats.reduce((sum, item) => sum + Math.max(1, item.gamesPlayed), 0);
  if (totalGames === 0) return 0;
  return oneDecimal(
    stats.reduce((sum, item) => sum + selector(item) * Math.max(1, item.gamesPlayed), 0) / totalGames
  );
}

function firstHalf(stats: LocalTeamStats): number {
  return stats.avgCornersFirstHalf ?? oneDecimal(stats.avgCornersFor * 0.46);
}

function secondHalf(stats: LocalTeamStats): number {
  return stats.avgCornersSecondHalf ?? oneDecimal(stats.avgCornersFor * 0.54);
}

function leagueAliases(label: string): string[] {
  const key = normalize(label);
  const aliases: Record<string, string[]> = {
    'brasileirao serie a': ['brasileirao', 'brasileiro', 'serie a'],
    'brasileirao serie b': ['serie b'],
    'copa libertadores': ['libertadores'],
    'copa sul-americana': ['sul americana', 'sudamericana'],
    'champions league': ['champions'],
    'europa league': ['europa league'],
    'conference league': ['conference'],
  };
  return unique([key, ...(aliases[key] ?? [])]);
}

function mentionsLeague(text: string, league: string): boolean {
  const normalized = normalize(text);
  return leagueAliases(league).some((alias) => normalized.includes(alias));
}

function catalogLeagueAliases(key: string, competition: (typeof SCORES365_COMPETITIONS)[string]): string[] {
  const normalizedKey = normalize(key.replace(/_/g, ' '));
  const base = [
    normalizedKey,
    normalize(competition.name),
    normalize(competition.name.replace(/\([^)]*\)/g, '')),
  ];
  const aliases: Record<string, string[]> = {
    brasileirao_a: ['brasileirao', 'brasileiro', 'brasileirao serie a', 'serie a brasileira'],
    brasileirao_b: ['brasileirao serie b', 'brasileiro serie b', 'serie b brasileira'],
    copa_do_brasil: ['copa do brasil'],
    libertadores: ['libertadores', 'copa libertadores'],
    sudamericana: ['sul americana', 'sul-americana', 'sudamericana', 'copa sul americana'],
    copa_america: ['copa america'],
    copa_do_mundo: ['copa do mundo', 'mundial', 'world cup', 'fifa world cup'],
    amistoso_internacional: ['amistoso', 'amistosos', 'amistoso internacional', 'amistosos internacionais'],
    champions_league: ['champions', 'champions league', 'liga dos campeoes'],
    europa_league: ['europa league'],
    conference_league: ['conference', 'conference league'],
    premier_league: ['premier league', 'ingles', 'inglaterra'],
    la_liga: ['la liga', 'liga espanhola', 'espanhol', 'espanha'],
    serie_a: ['serie a italiana', 'italiano', 'italia'],
    bundesliga: ['bundesliga', 'alemao', 'alemanha'],
    ligue_1: ['ligue 1', 'liga francesa', 'frances', 'franca'],
    primeira_liga: ['liga portuguesa', 'portuguesa', 'primeira liga', 'liga portugal', 'portugal'],
    liga_portugal_2: ['liga portugal 2', 'segunda portuguesa'],
  };
  return unique([...base, ...(aliases[key] ?? [])])
    .map(normalize)
    .filter((alias) => alias.length >= 3)
    .sort((a, b) => b.length - a.length);
}

function findCatalogLeague(text: string): { key: string; competition: (typeof SCORES365_COMPETITIONS)[string] } | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  const candidates = Object.entries(SCORES365_COMPETITIONS)
    .flatMap(([key, competition]) =>
      catalogLeagueAliases(key, competition)
        .filter((alias) => normalized.includes(alias))
        .map((alias) => ({
          key,
          competition,
          score: alias.length + (normalized === alias ? 100 : 0),
        }))
    )
    .sort((a, b) => b.score - a.score);

  return candidates[0] ? { key: candidates[0].key, competition: candidates[0].competition } : null;
}

function mentionsCatalogLeague(text: string): boolean {
  return findCatalogLeague(text) !== null;
}

function hasExplicitStatsScope(text: string): boolean {
  return STATS_SETS.some((set) => mentionsLeague(text, set.label)) || mentionsCatalogLeague(text) || mentionedTeams(text).length > 0;
}

function bestStatsSetForLeague(
  question: string,
  combined: string
): { label: string; stats: LocalTeamStats[] } | null {
  const candidates = STATS_SETS.map((set) => {
    const direct = mentionsLeague(question, set.label);
    const contextual = mentionsLeague(combined, set.label);
    const leaguePos = Math.max(latestMention(combined, set.label), ...leagueAliases(set.label).map((alias) => latestMention(combined, alias)));
    return { ...set, score: (direct ? 1000 : 0) + (contextual ? 100 : 0) + Math.max(leaguePos, 0) };
  })
    .filter((set) => set.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
}

function latestMention(text: string, term: string): number {
  return normalize(text).lastIndexOf(normalize(term));
}

function allTeams(): string[] {
  return unique([
    ...STATS_SETS.flatMap((set) => set.stats.map((stats) => stats.team)),
    ...currentUpcomingMatches.flatMap((match) => [match.homeTeam, match.awayTeam]),
  ]);
}

function mentionedTeams(text: string): string[] {
  const normalized = normalize(text);
  return allTeams().filter((team) => normalized.includes(normalize(team)));
}

function latestTeams(text: string, limit = 2): string[] {
  return mentionedTeams(text)
    .map((name) => ({ name, pos: latestMention(text, name) }))
    .filter((team) => team.pos >= 0)
    .sort((a, b) => b.pos - a.pos)
    .slice(0, limit)
    .map((team) => team.name);
}

function askedCoverage(text: string): boolean {
  const normalized = normalize(text);
  return [
    'quais ligas',
    'ligas disponiveis',
    'dados locais',
    'base local',
    'dados temos local',
    'dados que temos local',
    'quais dados temos',
    'o que temos local',
  ].some((term) => normalized.includes(term));
}

function askedDataUpdate(text: string): boolean {
  const normalized = normalize(text);
  if (
    normalized.includes('dados') &&
    ['atualiz', 'sincron', 'fonte', 'origem', 'vem'].some((term) => normalized.includes(term))
  ) {
    return true;
  }
  if (normalized.includes('como') && normalized.includes('atualiz')) return true;

  const updateTerms = [
    'como os dados sao atualizados',
    'como atualiza',
    'quando atualiza',
    'de onde vem os dados',
    'de onde vem esses dados',
    'fonte dos dados',
    'origem dos dados',
    'dados atualizados',
    'atualizacao dos dados',
    'atualizar dados',
    'sincronizacao',
    'sync',
    'cron',
    '365scores',
    'sofascore',
  ];
  return updateTerms.some((term) => normalized.includes(term));
}

function askedOdds(text: string): boolean {
  const normalized = normalize(text);
  return [
    'odd',
    'odds',
    'cotacao',
    'cotacoes',
    'casa de aposta',
    'casas de aposta',
    'aposta',
    'bookmaker',
    'mercado',
    'linha de escanteio',
    'linha de escanteios',
    'linhas de escanteio',
    'linhas de escanteios',
    'over ',
    'under ',
    'bet365',
    'pinnacle',
    'betano',
    'william hill',
    'marathonbet',
  ].some((term) => normalized.includes(term));
}

function askedWorldCupSquad(text: string): boolean {
  const normalized = normalize(text);
  const squadTerms = [
    'convocacao',
    'convocacoes',
    'convocados',
    'convocado',
    'elenco',
    'elencos',
    'lista de jogadores',
    'jogadores convocados',
    'quem foi chamado',
    'selecionados',
    'squad',
    'goleiros',
    'defensores',
    'zagueiros',
    'laterais',
    'meias',
    'atacantes',
  ];
  const worldCupTerms = ['copa do mundo', 'mundial', 'fifa', 'selecao', 'selecoes'];
  const teamHintTerms = [
    'brasil',
    'argentina',
    'franca',
    'inglaterra',
    'alemanha',
    'espanha',
    'portugal',
    'marrocos',
    'haiti',
    'escocia',
    'eua',
  ];
  return (
    squadTerms.some((term) => normalized.includes(term)) &&
    (worldCupTerms.some((term) => normalized.includes(term)) ||
      teamHintTerms.some((term) => normalized.includes(term)))
  );
}

function requestedSquadPosition(text: string): FifaSquadPlayer['position'] | null {
  const normalized = normalize(text);
  if (['goleiro', 'goleiros', 'goalkeeper', 'gk'].some((term) => normalized.includes(term))) return 'GK';
  if (['defensor', 'defensores', 'zagueiro', 'zagueiros', 'lateral', 'laterais', 'df'].some((term) => normalized.includes(term))) return 'DF';
  if (['meia', 'meias', 'meio campo', 'meio-campo', 'mf'].some((term) => normalized.includes(term))) return 'MF';
  if (['atacante', 'atacantes', 'forward', 'fw'].some((term) => normalized.includes(term))) return 'FW';
  return null;
}

function askedUpcoming(text: string): boolean {
  const normalized = normalize(text);
  return [
    'proximo jogo',
    'proximos jogos',
    'proxima partida',
    'proximas partidas',
    'agenda',
    'jogos futuros',
    'proxima rodada',
    'proximas rodadas',
    'jogos da rodada',
    'rodada do',
    'rodada da',
    'oitavas',
    'chaveamento',
  ].some((term) => normalized.includes(term));
}

function askedStats(text: string): boolean {
  const normalized = normalize(text);
  if (askedAddedTime(text)) return false;
  if (normalized.includes('escanteio') || normalized.includes('corner')) return true;
  return normalized.includes('media') || normalized.includes('medias');
}

function askedBestCornerConfrontation(text: string): boolean {
  const normalized = normalize(text);
  const asksCornerAverage =
    normalized.includes('escanteio') ||
    normalized.includes('corner') ||
    normalized.includes('media') ||
    normalized.includes('medias');
  if (!asksCornerAverage) return false;

  const asksConfrontation = [
    'confronto',
    'confrontos',
    'duelo',
    'duelos',
    'h2h',
    'frente a frente',
    'jogo entre',
    'partida entre',
  ].some((term) => normalized.includes(term));
  if (!asksConfrontation) return false;

  return [
    'maior media',
    'melhor media',
    'mais escanteios',
    'melhor',
    'maior',
    'mais',
    'ranking',
    'top ',
    'lider',
    'lidera',
    'teve a maior',
    'tem a maior',
  ].some((term) => normalized.includes(term));
}

function askedBestCornerTeam(text: string): boolean {
  const normalized = normalize(text);
  if (askedBestCornerLeague(text)) return false;

  const asksCornerAverage =
    normalized.includes('escanteio') ||
    normalized.includes('corner') ||
    normalized.includes('media') ||
    normalized.includes('medias');
  if (!asksCornerAverage) return false;

  return [
    'qual time',
    'que time',
    'qual equipe',
    'que equipe',
    'qual clube',
    'que clube',
    'quem tem',
    'time tem',
    'time que tem',
    'equipe tem',
    'clube tem',
    'times com',
    'equipes com',
    'clubes com',
    'ranking',
    'top ',
    'lider',
    'lidera',
  ].some((term) => normalized.includes(term));
}

function asksExplicitTeamRanking(text: string): boolean {
  const normalized = normalize(text);
  return [
    'qual time',
    'que time',
    'qual equipe',
    'que equipe',
    'qual clube',
    'que clube',
    'times',
    'equipes',
    'clubes',
    'quem tem',
    'time tem',
    'equipe tem',
    'clube tem',
  ].some((term) => normalized.includes(term));
}

function askedBestCornerLeague(text: string): boolean {
  const normalized = normalize(text);
  if (askedBestCornerConfrontation(text)) return false;
  const asksCornerAverage =
    normalized.includes('escanteio') ||
    normalized.includes('corner') ||
    normalized.includes('media') ||
    normalized.includes('medias');
  if (!asksCornerAverage) return false;

  const asksCompetition =
    normalized.includes('campeonato') ||
    normalized.includes('liga') ||
    normalized.includes('competicao') ||
    normalized.includes('competi') ||
    normalized.includes('torneio');

  const asksBestMetric = [
    'maior media',
    'melhor media',
    'maior numero',
    'mais escanteios',
    'melhor',
    'maior',
    'mais',
    'ranking',
    'top ',
    'lider',
    'lidera',
    'tem a maior',
    'tem melhor',
  ].some((term) => normalized.includes(term));
  if (!asksBestMetric) return false;

  const explicitTeamRanking = asksExplicitTeamRanking(text);
  if (!asksCompetition && explicitTeamRanking) return false;
  if (!asksCompetition && !normalized.startsWith('qual') && !normalized.includes('ranking') && !normalized.includes('top ')) {
    return false;
  }

  return [
    'maior media',
    'melhor media',
    'maior numero',
    'melhor',
    'maior',
    'mais',
    'qual campeonato',
    'qual liga',
    'qual competicao',
    'qual torneio',
    'ranking',
    'top ',
    'lider',
    'lidera',
    'tem a maior',
    'tem melhor',
  ].some((term) => normalized.includes(term));
}

function askedCards(text: string): boolean {
  const normalized = normalize(text);
  return ['cartao', 'cartoes', 'juiz', 'arbitro'].some((term) => normalized.includes(term));
}

function askedAddedTime(text: string): boolean {
  const normalized = normalize(text);
  const compact = normalized.replace(/\s+/g, '');
  return [
    'acrescimo',
    'acrescimos',
    'acrecimo',
    'acrecimos',
    'acrecismo',
    'acrecismos',
    'tempo adicional',
    'tempo de acrescimo',
    'bola parada',
    'jogo parado',
    'tempo parado',
    'interrupcao',
    'interrupcoes',
    'stoppage',
    'injury time',
  ].some((term) => normalized.includes(term)) || /acr[a-z]*scim/.test(compact);
}

function askedCornerMethod(text: string): boolean {
  const normalized = normalize(text);
  const methodTerms = ['como', 'logica', 'criterio', 'calcula', 'calculo', 'funciona', 'faz', 'formula', 'metodo'];
  const cornerTerms = ['escanteio', 'corner', 'previsao'];
  return methodTerms.some((term) => normalized.includes(term)) && cornerTerms.some((term) => normalized.includes(term));
}

function askedMatchPrediction(text: string): boolean {
  const normalized = normalize(text);
  if (askedAddedTime(text) || askedCards(text)) return false;
  return [
    'previsao do jogo',
    'previsao de escanteios',
    'previsao de corners',
    'previsao para o jogo',
    'previsao para o confronto',
    'previsao do confronto',
    'confronto entre os dois',
    'analise do jogo',
    'analise do confronto',
  ].some((term) => normalized.includes(term));
}

function isFollowUpQuestion(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  if (normalized.length > 90) return false;
  return [
    'e ',
    'e no ',
    'e na ',
    'e do ',
    'e da ',
    'no ',
    'na ',
    'do ',
    'da ',
    'so no ',
    'somente no ',
    'tambem ',
  ].some((prefix) => normalized.startsWith(prefix));
}

function requestedHalf(text: string): 'first' | 'second' | null {
  const normalized = normalize(text);
  const latestFirst = Math.max(
    ...['primeiro tempo', '1o tempo', '1 tempo', '1t', 'so no primeiro', 'no primeiro', 'primeiro'].map((term) =>
      normalized.lastIndexOf(term)
    )
  );
  const latestSecond = Math.max(
    ...['segundo tempo', '2o tempo', '2 tempo', '2t', 'so no segundo', 'no segundo', 'segundo'].map((term) =>
      normalized.lastIndexOf(term)
    )
  );

  if (latestFirst < 0 && latestSecond < 0) return null;
  return latestSecond > latestFirst ? 'second' : 'first';
}

function shouldUseContextForQuestion(question: string): boolean {
  if (isFollowUpQuestion(question)) return true;
  if (hasExplicitStatsScope(question)) return false;
  return askedStats(question) && (requestedHalf(question) !== null || normalize(question).includes('media'));
}

function scopeForQuestion(question: string, ctx: string): string {
  return shouldUseContextForQuestion(question) && ctx ? `${ctx} ${question}` : question;
}

function formatCatalog(): string {
  const grouped = Object.values(SCORES365_COMPETITIONS).reduce<Record<string, string[]>>((acc, competition) => {
    (acc[competition.country] ??= []).push(competition.name);
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([country, leagues]) => `- ${country}: ${unique(leagues).sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', ')}.`)
    .join('\n');
}

function coverageReply(): string {
  const statsLines = STATS_SETS.map((set) => {
    const teams = unique(set.stats.map((stats) => stats.team));
    return `- ${set.label}: ${teams.length} times com media geral e por tempo.`;
  }).join('\n');

  return `Ligas integradas no app:\n\n${formatCatalog()}\n\nBases estatisticas carregadas:\n${statsLines}\n\nCopa do Mundo:\n- Elencos oficiais da FIFA com cache diario pela rota de elencos da Copa.\n\nOdds e alertas:\n- Odds reais para as ligas integradas quando a fonte retorna casas e mercados para os jogos.\n- Linhas de escanteios sao prioridade. Outros mercados so aparecem quando uma casa paga bem acima das demais.\n\nTempo Real:\n- Placar, tempo, estatisticas e acrescimos tentam usar fontes ao vivo em camadas. Se uma fonte nao trouxer um numero, eu tento a outra; se nenhuma trouxer, aviso que nao tenho.\n\nA IA tenta responder primeiro por esses dados locais e pelas rotas internas. O Gemini so entra quando a pergunta pede interpretacao aberta ou quando o dado nao existe na base.`;
}

const SQUAD_POSITION_LABELS: Record<FifaSquadPlayer['position'], string> = {
  GK: 'Goleiros',
  DF: 'Defensores',
  MF: 'Meias',
  FW: 'Atacantes',
};

function squadPlayerLine(player: FifaSquadPlayer): string {
  const height = player.heightCm ? `, ${player.heightCm} cm` : '';
  return `${player.number}. ${player.playerName} (${player.club}${height})`;
}

function formatSquad(squad: FifaSquad, position: FifaSquadPlayer['position'] | null, sourceDate: string | null): string {
  const sourceLine = sourceDate ? `\nFonte FIFA atualizada em: ${sourceDate}.` : '';
  const coachLine = squad.coach?.name ? `\nTecnico: ${squad.coach.name} (${squad.coach.nationality}).` : '';

  if (position) {
    const players = squad.players.filter((player) => player.position === position);
    if (players.length === 0) return `Nao encontrei ${SQUAD_POSITION_LABELS[position].toLowerCase()} para ${squad.team} na lista oficial.`;

    return `${SQUAD_POSITION_LABELS[position]} de ${squad.team} na Copa do Mundo 2026:\n\n${players
      .map((player) => `- ${squadPlayerLine(player)}`)
      .join('\n')}${coachLine}${sourceLine}`;
  }

  const sections = (['GK', 'DF', 'MF', 'FW'] as FifaSquadPlayer['position'][])
    .map((pos) => {
      const players = squad.players.filter((player) => player.position === pos);
      if (players.length === 0) return '';
      return `${SQUAD_POSITION_LABELS[pos]}:\n${players.map((player) => `- ${squadPlayerLine(player)}`).join('\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return `Convocacao oficial de ${squad.team} para a Copa do Mundo 2026:\n\n${sections}${coachLine}${sourceLine}`;
}

async function worldCupSquadReply(question: string, ctx: string): Promise<string | null> {
  if (!askedWorldCupSquad(question)) return null;

  const combined = scopeForQuestion(question, ctx);
  const data = await getFifaWorldCupSquads();
  const squad = findFifaSquad(data, combined);
  const sourceDate = data.source.footerUpdatedAt ?? data.source.lastModified;

  if (!squad) {
    const sampleTeams = data.teams
      .slice(0, 12)
      .map((team) => team.team)
      .join(', ');
    return `Sim. Tenho a lista oficial da FIFA com ${data.totalTeams} selecoes e ${data.totalPlayers} jogadores, atualizada diariamente pela rota da aplicacao.\n\nExemplos de selecoes carregadas: ${sampleTeams}.\n\nPergunte assim: "convocados do Brasil na Copa" ou "goleiros da Argentina na Copa".`;
  }

  return formatSquad(squad, requestedSquadPosition(question), sourceDate);
}


function mentionsWorldCup(text: string): boolean {
  const normalized = normalize(text);
  return ['copa do mundo', 'mundial', 'world cup', 'fifa 2026', 'copa 2026'].some((term) => normalized.includes(term));
}

type AiWorldCupSimpleMatch = {
  id: number;
  startTime?: string;
  roundName?: string;
  statusText?: string;
  homeTeam: { name: string; score?: number };
  awayTeam: { name: string; score?: number };
  referee?: string | null;
};

type AiWorldCupScheduleResponse = { matches?: AiWorldCupSimpleMatch[] };

type AiWorldCupCornerEvent = {
  id: string;
  startTime: string;
  roundName?: string;
  homeTeam: string;
  awayTeam: string;
  cornerLines?: Array<{ bookmaker: string; market: string; line: string; label: string; odd: number }>;
  featuredLines?: Array<{ market: string; line: string; label: string; odds: Array<{ bookmaker: string; odd: number }> }>;
  alerts?: Array<{
    market: string;
    line: string;
    label: string;
    bookmaker: string;
    odd: number;
    nextBestBookmaker?: string;
    nextBestOdd?: number;
    edgePct: number;
  }>;
};

type AiWorldCupOddsResponse = {
  configured: boolean;
  summary?: { eventsChecked: number; cornerLines: number; alerts: number; bookmakersCompared: number };
  events?: AiWorldCupCornerEvent[];
  note?: string;
};

function isWorldCupLiveMatch(match: AiLiveMatch): boolean {
  return normalize(match.competition ?? '').includes('world cup') || normalize(match.competition ?? '').includes('copa do mundo');
}

function teamPairScore(text: string, home: string, away: string): number {
  const normalized = normalize(text);
  let score = 0;
  for (const team of [home, away]) {
    const t = normalize(team);
    if (t && normalized.includes(t)) score += 10;
    for (const part of t.split(' ').filter((value) => value.length >= 4)) {
      if (normalized.includes(part)) score += 2;
    }
  }
  return score;
}

function liveCornersFromRows(match: AiLiveMatch): { home: number; away: number; total: number } | undefined {
  if (match.corners) return match.corners;
  const row = match.liveStats?.find((item) => {
    const key = normalize(`${item.key} ${item.label}`);
    return key.includes('corner') || key.includes('escanteio');
  });
  if (!row) return undefined;
  const home = Number(String(row.home).replace(',', '.'));
  const away = Number(String(row.away).replace(',', '.'));
  if (!Number.isFinite(home) || !Number.isFinite(away)) return undefined;
  return { home, away, total: home + away };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function worldCupCoverageIntent(text: string): boolean {
  const normalized = normalize(text);
  return mentionsWorldCup(text) && (
    normalized.includes('quais dados') ||
    normalized.includes('que dados') ||
    normalized.includes('dados temos') ||
    normalized.includes('o que temos') ||
    normalized.includes('como funciona') ||
    normalized.includes('base da copa')
  );
}

function worldCupStatsIntent(text: string): boolean {
  const normalized = normalize(text);
  return mentionsWorldCup(text) && (
    normalized.includes('media') ||
    normalized.includes('medias') ||
    normalized.includes('escanteio') ||
    normalized.includes('corner') ||
    normalized.includes('ranking') ||
    normalized.includes('top') ||
    normalized.includes('qual selecao')
  );
}

function formatWorldCupMatchTime(value?: string): string {
  if (!value) return 'data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

async function worldCupDataReply(question: string, origin: string): Promise<string | null> {
  if (!worldCupCoverageIntent(question)) return null;

  const [upcoming, results, live, odds, squads] = await Promise.all([
    fetchJson<AiWorldCupScheduleResponse>(`${origin}/api/365scores/upcoming/copa_do_mundo`),
    fetchJson<AiWorldCupScheduleResponse>(`${origin}/api/365scores/results/copa_do_mundo`),
    fetchJson<AiLiveResponse>(`${origin}/api/365scores/live`),
    fetchJson<AiWorldCupOddsResponse>(`${origin}/api/odds/world-cup`),
    getFifaWorldCupSquads().catch(() => null),
  ]);

  const liveWorldCup = (live?.matches ?? []).filter(isWorldCupLiveMatch);
  const completed = results?.matches?.length ?? 0;
  const upcomingCount = upcoming?.matches?.length ?? 0;
  const oddsSummary = odds?.summary;
  const squadLine = squads
    ? `- Elencos FIFA: ${squads.totalTeams} seleções e ${squads.totalPlayers} jogadores carregados.`
    : '- Elencos FIFA: fonte indisponível agora.';

  return `Dados disponíveis da Copa do Mundo 2026 no app:\n\n- Agenda da Copa: ${upcomingCount} jogos carregados.\n- Resultados da Copa: ${completed} jogos carregados.\n- Jogos ao vivo da Copa agora: ${liveWorldCup.length}.\n${squadLine}\n- Odds reais de escanteios: ${oddsSummary?.cornerLines ?? 0} linhas, ${oddsSummary?.alerts ?? 0} alertas e ${oddsSummary?.bookmakersCompared ?? 0} casas comparadas.\n\nImportante: médias de escanteios da aba Copa do Mundo devem usar somente jogos da própria Copa. Eu não misturo amistosos, eliminatórias ou histórico geral das seleções. Se ainda não houver jogos suficientes da Copa com estatísticas de escanteios, eu vou avisar que a amostra é insuficiente.`;
}

async function worldCupStatsReply(question: string, origin: string): Promise<string | null> {
  if (!worldCupStatsIntent(question)) return null;

  const [live, results, odds] = await Promise.all([
    fetchJson<AiLiveResponse>(`${origin}/api/365scores/live`),
    fetchJson<AiWorldCupScheduleResponse>(`${origin}/api/365scores/results/copa_do_mundo`),
    fetchJson<AiWorldCupOddsResponse>(`${origin}/api/odds/world-cup`),
  ]);

  const scopedText = normalize(question);
  const liveWorldCup = (live?.matches ?? []).filter(isWorldCupLiveMatch);
  const specificLive = liveWorldCup
    .map((match) => ({ match, score: teamPairScore(question, match.homeTeam.name, match.awayTeam.name) }))
    .sort((a, b) => b.score - a.score)[0];

  if (specificLive && specificLive.score > 0) {
    const match = specificLive.match;
    const corners = liveCornersFromRows(match);
    const minute = typeof match.minute === 'number' ? `${match.minute}'` : match.minute;
    const stoppage = match.stoppage?.kind === 'announced-added-time'
      ? `\n- Acréscimo anunciado: +${formatAiMinute(match.stoppage.predictedAddedMinutes)}.`
      : match.stoppage
        ? `\n- Bola parada confiável: ${formatAiMinute(match.stoppage.totalStoppedMinutes)}; previsão: +${formatAiMinute(match.stoppage.predictedAddedMinutes)}.`
        : '';

    return `${match.homeTeam.name} ${match.homeTeam.score} x ${match.awayTeam.score} ${match.awayTeam.name} — Copa do Mundo, ${minute}.\n\n- Escanteios ao vivo: ${corners ? `${corners.home} x ${corners.away} (total ${corners.total})` : 'a fonte ainda não enviou esse número para este evento.'}.${stoppage}\n\nEsses dados são apenas do jogo da Copa em andamento.`;
  }

  const completedWithScore = (results?.matches ?? []).filter((match) => typeof match.homeTeam.score === 'number' && typeof match.awayTeam.score === 'number');
  const oddsEvents = odds?.events ?? [];

  if (scopedText.includes('odd') || scopedText.includes('odds') || scopedText.includes('linha')) {
    if (oddsEvents.length === 0) return 'Consultei as odds da Copa, mas nenhuma linha real de escanteios foi retornada agora.';
    const selected = oddsEvents.slice(0, 5).map((event) => {
      const featured = event.featuredLines?.[0];
      const best = featured?.odds?.[0];
      const alert = event.alerts?.[0];
      const line = featured && best ? `${featured.market} ${featured.label}: ${best.bookmaker} ${best.odd.toFixed(2)}` : 'sem linha principal';
      const alertText = alert ? ` | Alerta: ${alert.bookmaker} ${alert.odd.toFixed(2)} acima de ${alert.nextBestBookmaker ?? 'outra casa'} ${alert.nextBestOdd?.toFixed(2) ?? ''}` : '';
      return `- ${event.homeTeam} x ${event.awayTeam}: ${line}${alertText}`;
    }).join('\n');
    return `Linhas reais de escanteios da Copa encontradas:\n\n${selected}`;
  }

  if (completedWithScore.length === 0) {
    const liveLines = liveWorldCup.map((match) => {
      const corners = liveCornersFromRows(match);
      return `- ${match.homeTeam.name} ${match.homeTeam.score} x ${match.awayTeam.score} ${match.awayTeam.name}: ${corners ? `${corners.home} x ${corners.away} escanteios` : 'sem escanteios enviados pela fonte'}`;
    });

    return `Ainda não tenho amostra suficiente de jogos finalizados da Copa do Mundo para calcular médias confiáveis de escanteios.\n\n${liveLines.length ? `Jogos da Copa ao vivo agora:\n${liveLines.join('\n')}\n\n` : ''}Vou usar somente estatísticas da própria Copa. Não vou misturar amistosos, eliminatórias, Nations League ou histórico geral das seleções.`;
  }

  return `Tenho ${completedWithScore.length} resultado(s) da Copa carregado(s), mas ainda não encontrei estatísticas completas de escanteios finalizadas suficientes para ranking/médias da competição. Assim que a fonte enviar escanteios dos jogos da Copa, calculo média total, média por seleção, over 8.5/9.5/10.5 e ranking usando somente a Copa.`;
}

function dataUpdateReply(): string {
  return `Os dados do app entram por camadas, sempre priorizando fonte local e fonte ao vivo antes de IA externa.\n\n- FIFA oficial: os elencos/convocacoes da Copa do Mundo vem do PDF oficial do FIFA Football Data Platform. A rota de elencos faz cache por 24h e a atualizacao diaria tambem tenta aquecer essa fonte.\n- Tempo Real: busca jogos ao vivo na hora em fontes de placar e estatisticas. A tela atualiza automaticamente a cada 30 segundos.\n- Estatisticas ao vivo do jogo: quando uma fonte nao entrega algum detalhe, o app tenta completar com outra. Se nenhuma fonte enviar escanteios, finalizacoes, posse, cartoes ou outro numero do evento, eu aviso que nao tenho em vez de inventar.\n- Previsao de Acrescimo: primeiro tento usar tempo real de bola rolando ou play-by-play com parada e retomada. Quando isso nao existe, uso acrescimo anunciado pela fonte ao vivo, como 45+X, 90+X ou campo extra. Nesse caso eu mostro o acrescimo, mas aviso que o tempo total de bola parada nao foi enviado.\n- Odds e alertas: odds reais entram quando a fonte retorna casas de aposta e mercados para o jogo. A tela prioriza linhas de escanteios e so mostra outros mercados se uma casa pagar bem acima das demais. Eu nao crio odd estimada.\n- Proximos jogos, resultados e tabelas: vem das fontes ao vivo e tambem da base local onde ja temos agenda, chaveamentos e estatisticas historicas.\n- Base local: medias de escanteios por time, por competicao e por tempo ficam nos arquivos de dados do app e no banco quando o admin sincroniza/importa jogos.\n- Admin/sincronizacao: o painel admin usa DATABASE_URL para gravar dados; a rota de cron chama a sincronizacao geral quando CRON_SECRET esta configurado.\n- Gemini: so deve entrar quando a pergunta precisa de interpretacao aberta ou quando a base local/API nao tem a resposta direta. Para medias, proximos jogos, cartoes, convocacoes, odds e acrescimos, eu tento resolver localmente primeiro.`;
}

function cornerMethodReply(): string {
  return `A previsao de escanteios e calculada primeiro com a base local do app.\n\n- Eu combino media a favor, media contra do adversario, casa/fora quando existe, ultimos 5 jogos e historico direto quando temos.\n- Para 1o e 2o tempo, eu uso as medias separadas por tempo da base local; quando falta alguma divisao, aplico a proporcao historica do time.\n- Depois transformo o total esperado em linhas como Over 8.5, 9.5 e 10.5.\n- Se faltar dado local para um time ou competicao, eu aviso em vez de inventar.\n\nExemplo que eu entendo: "previsao de escanteios para Flamengo x Palmeiras" ou "media do Fluminense na Libertadores no 1o tempo".`;
}

function formatStats(stats: LocalTeamStats, league: string, half: 'first' | 'second' | null): string {
  if (half === 'first') {
    return `${stats.team} na ${league}, somente no 1o tempo:\n\n- Media a favor no 1o tempo: ${firstHalf(stats)} escanteios.\n- Media total do jogo: ${stats.avgTotalCorners} escanteios.\n- Media a favor no jogo: ${stats.avgCornersFor}.\n- Media contra no jogo: ${stats.avgCornersAgainst}.\n- Amostra: ${stats.gamesPlayed} jogos analisados.`;
  }
  if (half === 'second') {
    return `${stats.team} na ${league}, somente no 2o tempo:\n\n- Media a favor no 2o tempo: ${secondHalf(stats)} escanteios.\n- Media total do jogo: ${stats.avgTotalCorners} escanteios.\n- Media a favor no jogo: ${stats.avgCornersFor}.\n- Media contra no jogo: ${stats.avgCornersAgainst}.\n- Amostra: ${stats.gamesPlayed} jogos analisados.`;
  }

  const homeAway =
    stats.avgCornersHome !== undefined && stats.avgCornersAway !== undefined
      ? `\n- Casa/fora: ${stats.avgCornersHome} em casa e ${stats.avgCornersAway} fora.`
      : '';
  const last5 =
    stats.avgLast5 !== undefined && stats.last5Games
      ? `\n- Ultimos 5 jogos: media ${stats.avgLast5} (${stats.last5Games.join(', ')}).`
      : '';

  return `${stats.team} na ${league}:\n\n- Media a favor: ${stats.avgCornersFor} escanteios por jogo.\n- Media contra: ${stats.avgCornersAgainst} escanteios cedidos por jogo.\n- Total medio nos jogos: ${stats.avgTotalCorners} escanteios.\n- Por tempo: ${firstHalf(stats)} no 1o tempo e ${secondHalf(stats)} no 2o tempo.${homeAway}${last5}\n- Over 8.5: ${stats.over85Pct}% | Over 9.5: ${stats.over95Pct}% | Over 10.5: ${stats.over105Pct}%.\n- Amostra: ${stats.gamesPlayed} jogos analisados.`;
}

function formatLeagueStats(label: string, stats: LocalTeamStats[], half: 'first' | 'second' | null): string {
  const avgFor = weightedAverage(stats, (item) => item.avgCornersFor);
  const avgAgainst = weightedAverage(stats, (item) => item.avgCornersAgainst);
  const avgTotal = weightedAverage(stats, (item) => item.avgTotalCorners);
  const avgFirstFor = weightedAverage(stats, firstHalf);
  const avgSecondFor = weightedAverage(stats, secondHalf);
  const avgFirstTotal = oneDecimal(avgFirstFor * 2);
  const avgSecondTotal = oneDecimal(avgSecondFor * 2);
  const over85 = weightedAverage(stats, (item) => item.over85Pct);
  const over95 = weightedAverage(stats, (item) => item.over95Pct);
  const over105 = weightedAverage(stats, (item) => item.over105Pct);
  const sample = stats.reduce((sum, item) => sum + Math.max(0, item.gamesPlayed), 0);

  if (half === 'first') {
    return `${label}, somente no 1o tempo:\n\n- Media a favor por time: ${avgFirstFor} escanteios.\n- Total medio estimado no 1o tempo: ${avgFirstTotal} escanteios.\n- Base: ${stats.length} times e ${sample} registros de jogos analisados.`;
  }

  if (half === 'second') {
    return `${label}, somente no 2o tempo:\n\n- Media a favor por time: ${avgSecondFor} escanteios.\n- Total medio estimado no 2o tempo: ${avgSecondTotal} escanteios.\n- Base: ${stats.length} times e ${sample} registros de jogos analisados.`;
  }

  return `${label}:\n\n- Media total dos jogos: ${avgTotal} escanteios.\n- Media a favor por time: ${avgFor} escanteios.\n- Media contra por time: ${avgAgainst} escanteios.\n- Por tempo estimado: ${avgFirstTotal} no 1o tempo e ${avgSecondTotal} no 2o tempo.\n- Over 8.5: ${over85}% | Over 9.5: ${over95}% | Over 10.5: ${over105}%.\n- Base: ${stats.length} times e ${sample} registros de jogos analisados.`;
}

function wantsTotalCornerAverage(text: string): boolean {
  const normalized = normalize(text);
  return [
    'media total',
    'total medio',
    'total de escanteios',
    'escanteios no jogo',
    'jogo inteiro',
  ].some((term) => normalized.includes(term));
}

function formatBestCornerTeams(
  label: string,
  stats: LocalTeamStats[],
  half: 'first' | 'second' | null,
  question: string,
  overall = false
): string {
  const totalMetric = wantsTotalCornerAverage(question);
  const valueFor = (item: LocalTeamStats): number => {
    if (half === 'first') return firstHalf(item);
    if (half === 'second') return secondHalf(item);
    if (totalMetric) return item.avgTotalCorners;
    return item.avgCornersFor;
  };
  const metricLabel =
    half === 'first'
      ? 'media a favor no 1o tempo'
      : half === 'second'
        ? 'media a favor no 2o tempo'
        : totalMetric
          ? 'media total de escanteios nos jogos'
          : 'media de escanteios a favor';

  const ranked = stats
    .filter((item) => Number.isFinite(valueFor(item)))
    .sort((a, b) => valueFor(b) - valueFor(a));

  if (ranked.length === 0) {
    return `Nao encontrei ranking local de escanteios para ${label}.`;
  }

  const leader = ranked[0];
  const rows = ranked
    .slice(0, 5)
    .map((item, index) => {
      const source = overall ? ` (${item.league ?? label})` : '';
      return `${index + 1}. ${item.team}${source}: ${oneDecimal(valueFor(item))} escanteios`;
    })
    .join('\n');

  return `${overall ? 'Na base local inteira' : `No ${label}`}, o time com melhor ${metricLabel} e ${leader.team}, com ${oneDecimal(valueFor(leader))} escanteios.\n\nTop 5:\n${rows}`;
}

function bestCornerTeamReply(question: string, ctx: string): string | null {
  if (!askedBestCornerTeam(question)) return null;

  const half = requestedHalf(question);
  const directSet = bestStatsSetForLeague(question, question);
  const contextualSet = !directSet && ctx ? bestStatsSetForLeague(ctx, ctx) : null;
  const set = directSet ?? contextualSet;

  if (set) {
    return formatBestCornerTeams(set.label, set.stats, half, question);
  }

  const allStats = STATS_SETS.flatMap((statsSet) =>
    statsSet.stats.map((item) => ({
      ...item,
      league: item.league ?? statsSet.label,
    }))
  );

  return formatBestCornerTeams('base local', allStats, half, question, true);
}

function formatBestCornerLeagues(half: 'first' | 'second' | null, question: string): string {
  const totalMetric = wantsTotalCornerAverage(question) || !normalize(question).includes('a favor');
  const valueFor = (stats: LocalTeamStats[]): number => {
    if (half === 'first') return oneDecimal(weightedAverage(stats, firstHalf) * 2);
    if (half === 'second') return oneDecimal(weightedAverage(stats, secondHalf) * 2);
    if (totalMetric) return weightedAverage(stats, (item) => item.avgTotalCorners);
    return weightedAverage(stats, (item) => item.avgCornersFor);
  };

  const metricLabel =
    half === 'first'
      ? 'media total estimada no 1o tempo'
      : half === 'second'
        ? 'media total estimada no 2o tempo'
        : totalMetric
          ? 'media total de escanteios por jogo'
          : 'media de escanteios a favor por time';

  const ranked = STATS_SETS.map((set) => ({
    label: set.label,
    value: valueFor(set.stats),
    teams: set.stats.length,
    sample: set.stats.reduce((sum, item) => sum + Math.max(0, item.gamesPlayed), 0),
  })).sort((a, b) => b.value - a.value);

  if (ranked.length === 0) {
    return 'Nao encontrei ranking local de medias por campeonato.';
  }

  const leader = ranked[0];
  const rows = ranked
    .slice(0, 5)
    .map(
      (item, index) =>
        `${index + 1}. ${item.label}: ${item.value} escanteios (${item.teams} times, ${item.sample} registros)`
    )
    .join('\n');

  return `O campeonato com maior ${metricLabel} na base local e ${leader.label}, com ${leader.value} escanteios.\n\nTop 5 campeonatos:\n${rows}`;
}

function bestCornerLeagueReply(question: string): string | null {
  if (!askedBestCornerLeague(question)) return null;
  return formatBestCornerLeagues(requestedHalf(question), question);
}

function teamStatsCandidates(team: string): { stats: LocalTeamStats; league: string; setLabel: string }[] {
  const teamKey = normalize(team);
  return STATS_SETS.flatMap((set) =>
    set.stats
      .filter((stats) => {
        const statsKey = normalize(stats.team);
        return statsKey === teamKey || statsKey.includes(teamKey) || teamKey.includes(statsKey);
      })
      .map((stats) => ({ stats, setLabel: set.label, league: stats.league ?? set.label }))
  );
}

function headToHeadLeague(h2h: HeadToHead): string {
  const homeCandidates = teamStatsCandidates(h2h.homeTeam);
  const awayCandidates = teamStatsCandidates(h2h.awayTeam);

  for (const home of homeCandidates) {
    const sameSet = awayCandidates.find((away) => away.setLabel === home.setLabel);
    if (sameSet) return home.setLabel;
  }

  const home = homeCandidates[0];
  const away = awayCandidates[0];
  if (home && away && normalize(home.league) === normalize(away.league)) return home.league;
  return home?.setLabel ?? away?.setLabel ?? 'base local';
}

function sameLeagueScope(value: string, label: string): boolean {
  const normalizedValue = normalize(value);
  const normalizedLabel = normalize(label);
  return normalizedValue === normalizedLabel || normalizedValue.includes(normalizedLabel);
}

function bestCornerConfrontationReply(question: string, ctx: string): string | null {
  if (!askedBestCornerConfrontation(question)) return null;

  const combined = scopeForQuestion(question, ctx);
  const set = bestStatsSetForLeague(question, combined);
  const ranked = headToHeadData
    .map((h2h) => ({ h2h, league: headToHeadLeague(h2h) }))
    .filter((row) => !set || sameLeagueScope(row.league, set.label))
    .sort((a, b) => b.h2h.avgTotalCorners - a.h2h.avgTotalCorners);

  if (ranked.length === 0) {
    const scope = set ? ` para ${set.label}` : '';
    return `Nao encontrei confrontos com historico local de escanteios${scope}.`;
  }

  const leader = ranked[0];
  const scope = set ? ` no ${set.label}` : ' na base local';
  const rows = ranked
    .slice(0, 5)
    .map(
      ({ h2h, league }, index) =>
        `${index + 1}. ${h2h.homeTeam} x ${h2h.awayTeam}: ${oneDecimal(h2h.avgTotalCorners)} escanteios (${h2h.matches.length} jogos, ${league})`
    )
    .join('\n');

  return `O confronto com maior media total de escanteios${scope} e ${leader.h2h.homeTeam} x ${leader.h2h.awayTeam}, com ${oneDecimal(leader.h2h.avgTotalCorners)} escanteios por jogo.\n\nTop 5 confrontos:\n${rows}`;
}

function bestStatsForTeam(
  team: string,
  question: string,
  combined: string
): { stats: LocalTeamStats; league: string; setLabel: string } | null {
  const candidates = STATS_SETS.flatMap((set) =>
    set.stats
      .filter((stats) => normalize(stats.team) === normalize(team))
      .map((stats) => ({ stats, setLabel: set.label, league: stats.league ?? set.label }))
  );
  if (candidates.length === 0) return null;

  return candidates
    .map((candidate) => {
      const direct = mentionsLeague(question, candidate.league) || mentionsLeague(question, candidate.setLabel);
      const leaguePos = Math.max(latestMention(combined, candidate.league), latestMention(combined, candidate.setLabel));
      return { ...candidate, score: (direct ? 1000 : 0) + Math.max(leaguePos, 0) };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function overProbability(mean: number, threshold: number): number {
  const variance = 2.4;
  const zScore = (threshold - mean) / variance;
  const probability = 100 * (1 - 0.5 * (1 + Math.tanh(zScore * 0.8)));
  return Math.min(95, Math.max(5, Math.round(probability)));
}

function matchPredictionReply(question: string, ctx: string): string | null {
  if (!askedMatchPrediction(question)) return null;
  const combined = scopeForQuestion(question, ctx);
  const teams = latestTeams(combined, 2).reverse();
  if (teams.length < 2) return 'Para montar a previsao do confronto, me diga os dois times do jogo.';

  const home = bestStatsForTeam(teams[0], question, combined);
  const away = bestStatsForTeam(teams[1], question, combined);
  if (!home || !away) {
    const missing = [!home ? teams[0] : null, !away ? teams[1] : null].filter(Boolean).join(' e ');
    return `Nao encontrei dados locais suficientes para montar a previsao do confronto. Faltou base estatistica para: ${missing}.`;
  }

  let homeExpected =
    ((home.stats.avgCornersHome ?? home.stats.avgCornersFor * 1.08) * 0.35) +
    ((home.stats.avgLast5 ?? home.stats.avgCornersFor) * 0.25) +
    (((home.stats.avgCornersFor * 1.08 + away.stats.avgCornersAgainst) / 2) * 0.4);
  let awayExpected =
    ((away.stats.avgCornersAway ?? away.stats.avgCornersFor * 0.92) * 0.35) +
    ((away.stats.avgLast5 ?? away.stats.avgCornersFor) * 0.25) +
    (((away.stats.avgCornersFor * 0.94 + home.stats.avgCornersAgainst) / 2) * 0.4);

  const h2h = getHeadToHead(home.stats.team, away.stats.team);
  if (h2h) {
    const adjustment = (h2h.avgTotalCorners - (homeExpected + awayExpected)) * 0.18;
    homeExpected += adjustment / 2;
    awayExpected += adjustment / 2;
  }

  const total = homeExpected + awayExpected;
  const homeFirstShare = home.stats.avgCornersFor > 0 ? firstHalf(home.stats) / home.stats.avgCornersFor : 0.46;
  const awayFirstShare = away.stats.avgCornersFor > 0 ? firstHalf(away.stats) / away.stats.avgCornersFor : 0.46;
  const first = homeExpected * homeFirstShare + awayExpected * awayFirstShare;
  const second = Math.max(0, total - first);
  const confidence = home.stats.gamesPlayed > 0 && away.stats.gamesPlayed > 0 ? 'alta' : 'media';
  const h2hLine = h2h ? `\n- H2H local: ${oneDecimal(h2h.avgTotalCorners)} escanteios de media.` : '';

  return `Previsao local para ${home.stats.team} x ${away.stats.team}:\n\n- Total previsto: ${oneDecimal(total)} escanteios.\n- 1o tempo: ${oneDecimal(first)} escanteios.\n- 2o tempo: ${oneDecimal(second)} escanteios.\n- Times: ${home.stats.team} ${oneDecimal(homeExpected)} x ${oneDecimal(awayExpected)} ${away.stats.team}.\n- Linhas: Over 8.5 ${overProbability(total, 8.5)}% | Over 9.5 ${overProbability(total, 9.5)}% | Over 10.5 ${overProbability(total, 10.5)}%.\n- Base: ${home.league} e ${away.league}; confianca ${confidence}.${h2hLine}`;
}

function addedTimeReply(question: string, ctx: string): string | null {
  if (!askedAddedTime(question)) return null;
  const teams = latestTeams(scopeForQuestion(question, ctx), 2).reverse();
  const matchText = teams.length >= 2 ? ` para ${teams[0]} x ${teams[1]}` : '';

  return `A Previsao de Acrescimo${matchText} usa a melhor fonte ao vivo disponivel.\n\nA regra local e:\n- se a fonte envia tempo de bola rolando ou play-by-play com parada e retomada, eu calculo o tempo total parado e uso 80% como previsao de acrescimo;\n- se a fonte envia apenas acrescimo anunciado, como 45+X, 90+X ou campo extra, eu mostro esse acrescimo e aviso que o tempo total de bola parada nao foi informado;\n- se nenhuma fonte envia esses dados, eu nao invento numero.\n\nNa tela Tempo Real, esse campo aparece nos jogos que chegam com uma dessas informacoes.`;
}

function statsReply(question: string, ctx: string): string | null {
  if (!askedStats(question)) return null;
  const bestConfrontation = bestCornerConfrontationReply(question, ctx);
  if (bestConfrontation) return bestConfrontation;

  const bestLeague = bestCornerLeagueReply(question);
  if (bestLeague) return bestLeague;

  const bestTeam = bestCornerTeamReply(question, ctx);
  if (bestTeam) return bestTeam;

  const directCatalogLeague = findCatalogLeague(question);
  const directStatsSet = bestStatsSetForLeague(question, question);
  if (directCatalogLeague && !directStatsSet) {
    return `Tenho ${directCatalogLeague.competition.name} integrada no app para jogos, tabelas e dados via API, mas ainda nao tenho medias locais de escanteios carregadas para essa liga.\n\nPara medias de escanteios, hoje a base local cobre: ${STATS_SETS.map((set) => set.label).join(', ')}.`;
  }

  const combined = scopeForQuestion(question, ctx);
  const team = mentionedTeams(combined)
    .map((name) => ({ name, pos: latestMention(combined, name) }))
    .sort((a, b) => b.pos - a.pos)[0]?.name;
  if (!team) {
    const set = bestStatsSetForLeague(question, combined);
    if (set) return formatLeagueStats(set.label, set.stats, requestedHalf(question));
    return 'Para calcular media de escanteios, me diga a competicao ou o time. Exemplo: "media de escanteios no Brasileirao" ou "media do Fluminense na Libertadores".';
  }

  const best = bestStatsForTeam(team, question, combined);
  if (!best) return null;

  return formatStats(best.stats, best.league, requestedHalf(question));
}

function fixtureTime(match: CurrentFixture): number {
  const iso = match.date.includes(' ') ? `${match.date.replace(' ', 'T')}:00-03:00` : `${match.date}T12:00:00-03:00`;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : 0;
}

function matchLine(match: CurrentFixture): string {
  const date = match.dateLabel ?? match.date;
  const corners = match.predictedCorners ? ` | previsao: ${match.predictedCorners} escanteios` : '';
  const referee = match.referee ? ` | arbitro: ${match.referee}` : '';
  const returnLeg = match.returnLeg
    ? `\n  Volta: ${match.returnLeg.homeTeam} x ${match.returnLeg.awayTeam} (${match.returnLeg.dateLabel})`
    : '';
  const note = match.bracketNote ? `\n  ${match.bracketNote}` : '';
  return `- ${match.homeTeam} x ${match.awayTeam} (${date})${corners}${referee}${returnLeg}${note}`;
}

function format365Date(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function scores365MatchLine(match: Scores365UpcomingMatch): string {
  const round = match.roundName ? ` | ${match.roundName}` : match.round ? ` | rodada ${match.round}` : '';
  return `- ${match.homeTeam} x ${match.awayTeam} (${format365Date(match.startTime)}${round})`;
}

function isFutureOrLive365(match: Scores365RawUpcomingGame): boolean {
  if (match.statusId === 2) return true;
  const timestamp = Date.parse(match.startTime);
  return Number.isFinite(timestamp) && timestamp >= Date.now() - 12 * 60 * 60 * 1000;
}

async function scores365UpcomingMatches(question: string, ctx: string): Promise<Scores365UpcomingMatch[] | null> {
  const combined = scopeForQuestion(question, ctx);
  const catalog = findCatalogLeague(combined);
  if (!catalog) return null;

  try {
    const normalizeRawMatches = (games: Scores365RawUpcomingGame[]): Scores365UpcomingMatch[] =>
      games
        .filter(isFutureOrLive365)
        .filter((game) => game.homeCompetitor?.name && game.awayCompetitor?.name)
        .map<Scores365UpcomingMatch>((game) => ({
          id: game.id,
          startTime: game.startTime,
          round: game.roundNum,
          roundName: game.roundName,
          homeTeam: game.homeCompetitor?.name ?? 'Mandante',
          awayTeam: game.awayCompetitor?.name ?? 'Visitante',
          competitionName: catalog.competition.name,
          country: catalog.competition.country,
        }))
        .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

    const data = (await scores365Get('/web/games/', {
      competitions: catalog.competition.id.toString(),
      statuses: '1,2',
    })) as { games?: Scores365RawUpcomingGame[] };

    let matches = normalizeRawMatches(data.games ?? []);

    if (matches.length === 0) {
      const standingsData = (await scores365Get('/web/standings/', {
        competitions: catalog.competition.id.toString(),
      })) as {
        standings?: Array<{
          rows?: Array<{
            nextMatch?: Scores365RawUpcomingGame;
          }>;
        }>;
      };

      const nextMatches = new Map<number, Scores365RawUpcomingGame>();
      for (const standing of standingsData.standings ?? []) {
        for (const row of standing.rows ?? []) {
          if (row.nextMatch && !nextMatches.has(row.nextMatch.id)) {
            nextMatches.set(row.nextMatch.id, row.nextMatch);
          }
        }
      }

      matches = normalizeRawMatches(Array.from(nextMatches.values()));
    }

    if (matches.length === 0) return [];

    const normalized = normalize(question);
    if (normalized.includes('rodada')) {
      const firstRound = matches.find((match) => match.round !== undefined)?.round;
      if (firstRound !== undefined) {
        const sameRound = matches.filter((match) => match.round === firstRound);
        if (sameRound.length > 0) return sameRound;
      }
    }

    return matches;
  } catch (error) {
    console.error('AI 365Scores upcoming error:', error);
    return null;
  }
}

function upcomingMatches(question: string, ctx: string): CurrentFixture[] {
  const combined = scopeForQuestion(question, ctx);
  const team = mentionedTeams(combined)
    .map((name) => ({ name, pos: latestMention(combined, name) }))
    .sort((a, b) => b.pos - a.pos)[0]?.name;

  return currentUpcomingMatches
    .filter((match) => fixtureTime(match) >= Date.now() - 12 * 60 * 60 * 1000)
    .filter((match) => {
      if (team && normalize(match.homeTeam) !== normalize(team) && normalize(match.awayTeam) !== normalize(team)) {
        return false;
      }
      if (mentionsLeague(combined, 'Copa Libertadores')) return normalize(match.competition).includes('libertadores');
      if (mentionsLeague(combined, 'Brasileirao Serie A')) return match.leagueKey === 'brasileirao_a';
      if (mentionsLeague(combined, 'Brasileirao Serie B')) return match.leagueKey === 'brasileirao_b';
      if (mentionsLeague(combined, 'Champions League')) return normalize(match.competition).includes('champions');
      return true;
    })
    .sort((a, b) => fixtureTime(a) - fixtureTime(b));
}

function libertadoresBracketReply(): string {
  const matches = currentUpcomingMatches.filter(
    (match) => normalize(match.competition).includes('libertadores') && normalize(match.round ?? '').includes('oitavas')
  );
  if (matches.length === 0) return 'Ainda nao tenho o chaveamento das oitavas da Libertadores na base local.';
  return `Oitavas de final da Copa Libertadores na base local:\n\n${matches.map(matchLine).join('\n')}`;
}

async function upcomingReply(question: string, ctx: string): Promise<string | null> {
  if (!askedUpcoming(question)) return null;
  const normalized = normalize(question);
  if (normalized.includes('oitavas') || normalized.includes('chaveamento')) return libertadoresBracketReply();

  const liveMatches = await scores365UpcomingMatches(question, ctx);
  if (liveMatches && liveMatches.length > 0) {
    const scope = findCatalogLeague(scopeForQuestion(question, ctx));
    const limit = mentionedTeams(scopeForQuestion(question, ctx)).length > 0 ? 3 : 15;
    return `Proximos jogos encontrados na 365Scores${scope ? ` para ${scope.competition.name}` : ''}:\n\n${liveMatches
      .slice(0, limit)
      .map(scores365MatchLine)
      .join('\n')}`;
  }

  const matches = upcomingMatches(question, ctx);
  if (matches.length === 0) return 'Nao encontrei proximos jogos para esse filtro na base local.';

  const limit = mentionedTeams(scopeForQuestion(question, ctx)).length > 0 ? 3 : 12;
  return `Proximos jogos encontrados na base local:\n\n${matches.slice(0, limit).map(matchLine).join('\n')}`;
}

function cardsReply(question: string, ctx: string): string | null {
  if (!askedCards(question)) return null;
  const combined = scopeForQuestion(question, ctx);
  const teams = mentionedTeams(combined);
  const hasSpecificFilter =
    teams.length > 0 || STATS_SETS.some((set) => mentionsLeague(combined, set.label));
  const match = hasSpecificFilter ? upcomingMatches(question, ctx)[0] : undefined;

  if (match?.referee) {
    const referee = findReferee(match.referee);
    const summary = referee ? getRefereeStatsSummary(referee) : null;
    const refereeLine = summary
      ? `${referee?.name}: ${summary.avgCardsPerMatch.toFixed(1)} cartoes/jogo; ${summary.secondHalfPct}% dos cartoes no 2o tempo; media ${summary.avgCardsWinning} vencendo, ${summary.avgCardsDrawing} empatando e ${summary.avgCardsLosing} perdendo.`
      : `${match.referee}: sem historico detalhado local.`;

    return `Previsao de cartoes para ${match.homeTeam} x ${match.awayTeam}:\n\n- Arbitro: ${refereeLine}\n- Jogo: ${match.dateLabel ?? match.date}.\n- Usei o juiz informado na agenda local e as medias locais dos times quando disponiveis.`;
  }

  if (teams.length === 0) {
    return `A previsao de cartoes usa primeiro a base local.\n\n- Se o jogo tem arbitro cadastrado, eu uso o historico dele: media de cartoes por jogo, peso de 1o/2o tempo e comportamento por placar.\n- Se nao ha arbitro, eu uso as medias locais de cartoes dos times.\n- Quando voce cita um confronto, eu tento localizar o jogo na agenda local para trazer o juiz e a previsao desse jogo.\n\nSe o dado nao existir na base local, eu digo isso em vez de inventar.`;
  }
  const lines = teams.slice(-2).map((team) => {
    const cards = findTeamCardStats(team);
    return cards ? `- ${team}: ${cards.avgCardsPerMatch} cartoes por jogo.` : `- ${team}: sem media local de cartoes.`;
  });
  return `Dados locais de cartoes:\n\n${lines.join('\n')}`;
}

function formatAiMinute(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 min';
  return `${oneDecimal(value).toString().replace('.', ',')} min`;
}

function oddValue(bookmaker: AiOddsBookmaker, side: AiOddsSide): number | null {
  return bookmaker[side];
}

function bestOdd(event: AiOddsEvent, side: AiOddsSide): { bookmaker: string; odd: number } | null {
  const candidates = event.bookmakers
    .map((bookmaker) => {
      const odd = oddValue(bookmaker, side);
      return odd ? { bookmaker: bookmaker.name, odd } : null;
    })
    .filter((item): item is { bookmaker: string; odd: number } => Boolean(item))
    .sort((a, b) => b.odd - a.odd);

  return candidates[0] ?? null;
}

function bestAnyOdd(bookmaker: AiOddsBookmaker): number {
  return Math.max(bookmaker.home ?? 0, bookmaker.draw ?? 0, bookmaker.away ?? 0);
}

function oddsEventScore(question: string, event: AiOddsEvent): number {
  const normalized = normalize(question);
  const names = [event.homeTeam, event.awayTeam];
  let score = 0;

  for (const name of names) {
    const team = normalize(name);
    if (team && normalized.includes(team)) score += 8;
    for (const part of team.split(' ').filter((value) => value.length >= 4)) {
      if (normalized.includes(part)) score += 2;
    }
  }

  if (event.roundName && normalized.includes(normalize(event.roundName))) score += 2;
  return score;
}

function formatBookmakerLine(event: AiOddsEvent, bookmaker: AiOddsBookmaker): string {
  const home = bookmaker.home?.toFixed(2) ?? '-';
  const draw = bookmaker.draw?.toFixed(2) ?? '-';
  const away = bookmaker.away?.toFixed(2) ?? '-';
  return `${bookmaker.name}: ${event.homeTeam} ${home} | empate ${draw} | ${event.awayTeam} ${away}`;
}

function oddsAlertScore(question: string, alert: AiOddsAlert): number {
  const normalized = normalize(question);
  const names = [alert.homeTeam, alert.awayTeam, alert.leagueName, alert.country, alert.marketName, alert.lineLabel];
  let score = 0;

  for (const name of names) {
    const value = normalize(name);
    if (value && normalized.includes(value)) score += 8;
    for (const part of value.split(' ').filter((item) => item.length >= 4)) {
      if (normalized.includes(part)) score += 2;
    }
  }

  if (alert.marketType === 'corners' && (normalized.includes('escanteio') || normalized.includes('corner'))) {
    score += 8;
  }

  if (normalized.includes('bet365') && alert.bookmakers.some((bookmaker) => normalize(bookmaker.bookmaker).includes('bet365'))) {
    score += 5;
  }

  if (normalized.includes('over') && normalize(alert.lineLabel).includes('over')) score += 4;
  if (normalized.includes('under') && normalize(alert.lineLabel).includes('under')) score += 4;

  return score;
}

function formatOddsAlertLine(alert: AiOddsAlert): string {
  const marketLabel = alert.marketType === 'corners' ? 'escanteios' : alert.marketName;
  const comparison = alert.bookmakers
    .slice(0, 5)
    .map((bookmaker) => `${bookmaker.bookmaker} ${bookmaker.odd.toFixed(2)}`)
    .join(' | ');
  const edge = alert.edgePct > 0 ? `, ${alert.edgePct}% acima da mediana` : '';

  return `- ${alert.homeTeam} x ${alert.awayTeam} (${alert.leagueName}, ${format365Date(alert.startTime)}): ${marketLabel} ${alert.lineLabel}. Melhor odd: ${alert.bestOdd.toFixed(2)} na ${alert.bestBookmaker}${edge}. Comparacao: ${comparison}.`;
}

async function oddsAlertsReply(question: string, origin: string): Promise<string | null> {
  if (!askedOdds(question)) return null;

  try {
    const response = await fetch(`${origin}/api/odds/alerts`, { cache: 'no-store' });
    if (!response.ok) return null;

    const data = (await response.json()) as AiOddsAlertsResponse;
    const alerts = data.alerts ?? [];
    if (!data.configured) {
      return 'As odds reais ainda nao estao configuradas. Quando a fonte estiver ligada, eu comparo as casas e nao crio cotacoes estimadas.';
    }
    if (alerts.length === 0) {
      return data.note ?? 'A fonte de odds esta conectada, mas nao retornou cotacoes com comparacao suficiente agora.';
    }

    const normalized = normalize(question);
    const wantsCorners = normalized.includes('escanteio') || normalized.includes('corner');
    const scored = alerts
      .filter((alert) => (wantsCorners ? alert.marketType === 'corners' : true))
      .map((alert) => ({ alert, score: oddsAlertScore(question, alert) }))
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.alert.marketType !== b.alert.marketType) return a.alert.marketType === 'corners' ? -1 : 1;
        if (a.alert.edgePct !== b.alert.edgePct) return b.alert.edgePct - a.alert.edgePct;
        return Date.parse(a.alert.startTime) - Date.parse(b.alert.startTime);
      });

    if (scored.length === 0) {
      return data.note ?? 'Nao encontrei odds reais de escanteios nessa consulta agora.';
    }

    const hasSpecificMatch = scored.some((item) => item.score > 0);
    const selected = (hasSpecificMatch ? scored.filter((item) => item.score > 0) : scored)
      .slice(0, hasSpecificMatch ? 3 : 5)
      .map((item) => item.alert);

    const lines = selected.map(formatOddsAlertLine).join('\n');

    return `Odds reais encontradas:\n\n${lines}\n\nEu priorizo linhas de escanteios. Outros mercados so entram quando uma casa esta pagando bem acima das demais. Nao crio odds estimadas.`;
  } catch (error) {
    console.error('AI odds reply error:', error);
    return null;
  }
}

function liveMatchQuestionScore(question: string, match: AiLiveMatch): number {
  const normalized = normalize(question);
  const names = [match.homeTeam.name, match.awayTeam.name];
  let score = 0;

  for (const name of names) {
    const team = normalize(name);
    if (team && normalized.includes(team)) score += 8;
    for (const part of team.split(' ').filter((value) => value.length >= 4)) {
      if (normalized.includes(part)) score += 2;
    }
  }

  if (match.competition && normalized.includes(normalize(match.competition))) score += 2;
  return score;
}

function liveAddedTimeText(match: AiLiveMatch): string {
  const minute = typeof match.minute === 'number' ? `${match.minute}'` : match.minute || match.statusText;
  const title = `${match.homeTeam.name} ${match.homeTeam.score} x ${match.awayTeam.score} ${match.awayTeam.name} (${match.competition ?? 'ao vivo'}, ${minute})`;

  if (!match.stoppage) {
    return `${title}:\n\n- A fonte trouxe placar e tempo, mas nao enviou tempo de bola parada, paradas/retomadas ou acrescimo anunciado para esse evento agora.\n- Por isso eu nao mostro Previsao de Acrescimo para esse jogo em vez de inventar um numero.`;
  }

  if (match.stoppage.kind === 'announced-added-time') {
    return `${title}:\n\n- Previsao de Acrescimo: +${formatAiMinute(match.stoppage.predictedAddedMinutes)}.\n- Fonte: acrescimo anunciado pela fonte ao vivo.\n- Tempo total de bola parada: nao informado pela API.`;
  }

  return `${title}:\n\n- Tempo total de bola parada: ${formatAiMinute(match.stoppage.totalStoppedMinutes)}.\n- Previsao de Acrescimo: +${formatAiMinute(match.stoppage.predictedAddedMinutes)}.\n- Regra: 80% do tempo total parado identificado pela fonte ao vivo.`;
}

async function liveAddedTimeReply(question: string, ctx: string, origin: string): Promise<string | null> {
  if (!askedAddedTime(question)) return null;

  try {
    const response = await fetch(`${origin}/api/365scores/live`, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = (await response.json()) as AiLiveResponse;
    const matches = data.matches ?? [];
    if (matches.length === 0) return null;

    const scoped = scopeForQuestion(question, ctx);
    const scored = matches
      .map((match) => ({ match, score: liveMatchQuestionScore(scoped, match) }))
      .sort((a, b) => b.score - a.score || Number(Boolean(b.match.stoppage)) - Number(Boolean(a.match.stoppage)));

    const hasSpecificMatch = scored.some((item) => item.score > 0);
    const selected = hasSpecificMatch
      ? scored.find((item) => item.score > 0)?.match
      : scored.find((item) => item.match.stoppage)?.match;

    if (!selected) {
      return 'Consultei os jogos ao vivo agora. Nenhum deles veio com tempo de bola parada, paradas/retomadas ou acrescimo anunciado suficiente para calcular Previsao de Acrescimo. Quando a fonte enviar esse dado, ele aparece na aba Tempo Real.';
    }

    return liveAddedTimeText(selected);
  } catch (error) {
    console.error('AI live added time error:', error);
    return null;
  }
}

async function localReply(question: string, ctx: string, origin: string): Promise<string | null> {
  const worldCupData = await worldCupDataReply(question, origin);
  if (worldCupData) return worldCupData;
  const worldCupStats = await worldCupStatsReply(question, origin);
  if (worldCupStats) return worldCupStats;
  const squad = await worldCupSquadReply(question, ctx);
  if (squad) return squad;
  if (askedDataUpdate(question)) return dataUpdateReply();
  if (askedCoverage(question)) return coverageReply();
  const odds = await oddsAlertsReply(question, origin);
  if (odds) return odds;
  const liveAdded = await liveAddedTimeReply(question, ctx, origin);
  if (liveAdded) return liveAdded;
  if (askedAddedTime(question)) return addedTimeReply(question, ctx);
  if (askedCards(question)) return cardsReply(question, ctx);
  if (askedUpcoming(question)) return upcomingReply(question, ctx);
  if (askedCornerMethod(question)) return cornerMethodReply();
  if (askedMatchPrediction(question)) return matchPredictionReply(question, ctx);
  if (askedStats(question)) return statsReply(question, ctx);

  if (isFollowUpQuestion(question) && ctx) {
    const contextualQuestion = `${ctx} ${question}`;
    if (askedDataUpdate(ctx)) return dataUpdateReply();
    const contextualSquad = await worldCupSquadReply(contextualQuestion, '');
    if (contextualSquad) return contextualSquad;
    if (askedOdds(ctx)) {
      const contextualOdds = await oddsAlertsReply(contextualQuestion, origin);
      if (contextualOdds) return contextualOdds;
    }
    if (askedAddedTime(ctx)) {
      const contextualLiveAdded = await liveAddedTimeReply(contextualQuestion, '', origin);
      if (contextualLiveAdded) return contextualLiveAdded;
    }
    if (askedAddedTime(ctx)) return addedTimeReply(contextualQuestion, '');
    if (askedCards(ctx)) return cardsReply(contextualQuestion, '');
    if (askedUpcoming(ctx)) return upcomingReply(contextualQuestion, '');
    if (askedCornerMethod(ctx)) return cornerMethodReply();
    if (askedMatchPrediction(ctx)) return matchPredictionReply(contextualQuestion, '');
    if (askedStats(ctx)) return statsReply(contextualQuestion, '');
  }

  return null;
}

async function fallbackReply(question: string, ctx: string, origin: string): Promise<string> {
  return (
    (await localReply(question, ctx, origin)) ??
    `Nao encontrei uma resposta direta na base local para essa pergunta.\n\nPara eu acertar melhor, cite time, competicao e periodo quando fizer sentido. Exemplos:\n- "media do Fluminense na Libertadores no 1o tempo"\n- "proximo jogo do Fluminense na Libertadores"\n- "previsao de cartoes para Sao Paulo x Palmeiras"`
  );
}

function geminiPrompt(question: string, ctx: string): string {
  return `Voce e a IA da Cantos Estatisticas. Responda em portugues brasileiro.
Responda sempre a PERGUNTA ATUAL. Use o historico apenas quando a pergunta atual for um complemento curto, como "e no primeiro tempo?".
Nunca responda com catalogo de ligas a menos que a PERGUNTA ATUAL peca ligas disponiveis, dados locais ou base local.
Use primeiro os dados locais abaixo. Se o dado nao existir na base local, diga claramente e nao invente numeros.

PERGUNTA ATUAL:
${question}

HISTORICO ANTERIOR:
${ctx || 'sem historico relevante'}

${coverageReply()}

Agenda local:
${currentUpcomingMatches.map(matchLine).join('\n')}`;
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = (await request.json()) as { messages: ChatMessage[] };
    const lastUser = messages?.slice().reverse().find((message) => message.role === 'user');
    if (!lastUser) {
      return NextResponse.json({ error: 'Nenhuma mensagem de usuario encontrada' }, { status: 400 });
    }

    const ctx = context(messages);
    const origin = new URL(request.url).origin;
    const local = await localReply(lastUser.content, ctx, origin);
    if (local) return NextResponse.json({ reply: local, provider: 'local-first' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ reply: await fallbackReply(lastUser.content, ctx, origin), provider: 'local-fallback' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: geminiPrompt(lastUser.content, ctx) }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Historico anterior:\n${ctx || 'sem historico relevante'}\n\nPergunta atual:\n${lastUser.content}`,
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.35 },
        }),
      }
    );

    if (!response.ok) {
      const prefix =
        response.status === 429
          ? 'O Gemini gratuito atingiu o limite agora. Respondi com os dados locais do app.'
          : `O Gemini retornou erro ${response.status}. Respondi com os dados locais do app.`;
      return NextResponse.json({
        reply: `${prefix}\n\n${await fallbackReply(lastUser.content, ctx, origin)}`,
        provider: 'local-fallback',
      });
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return NextResponse.json({
      reply:
        data.candidates?.[0]?.content?.parts?.[0]?.text ??
        (await fallbackReply(lastUser.content, ctx, origin)),
      provider: 'gemini',
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }
}
