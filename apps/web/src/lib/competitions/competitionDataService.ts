import { apiFootballGet, isApiFootballConfigured } from '@/app/api/utils/apiFootball';
import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';
import { currentUpcomingMatches } from '@/data/currentFixtures';
import { getCompetitionDefinition, type CompetitionDefinition } from './competitionRegistry';

export interface UnifiedFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamBadge?: string | null;
  awayTeamBadge?: string | null;
  date: string;
  time: string;
  timestamp: string;
  round: string;
  referee?: string | null;
  venue?: string | null;
  status?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  source: string;
}

type ApiFixture = {
  fixture?: {
    id?: number;
    date?: string;
    referee?: string | null;
    status?: { short?: string; long?: string };
    venue?: { name?: string | null };
  };
  league?: { round?: string };
  teams?: {
    home?: { id?: number; name?: string; logo?: string };
    away?: { id?: number; name?: string; logo?: string };
  };
  goals?: { home?: number | null; away?: number | null };
};

function parts(dateValue: string) {
  const date = new Date(dateValue);
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date),
    time: new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(date),
  };
}

function seasonFor(definition: CompetitionDefinition) {
  return definition.season ?? new Date().getUTCFullYear();
}

async function fromApiFootball(definition: CompetitionDefinition): Promise<UnifiedFixture[]> {
  if (!definition.apiFootballLeagueId || !isApiFootballConfigured()) return [];
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 120);
  const iso = (value: Date) => value.toISOString().slice(0, 10);

  const payload = await apiFootballGet<ApiFixture[]>('/fixtures', {
    params: {
      league: definition.apiFootballLeagueId,
      season: seasonFor(definition),
      from: iso(from),
      to: iso(to),
      timezone: 'America/Sao_Paulo',
    },
    revalidate: 900,
  });

  return (payload?.response ?? [])
    .filter((item) => item.fixture?.date && item.teams?.home?.name && item.teams?.away?.name)
    .filter((item) => !['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(item.fixture?.status?.short ?? ''))
    .map((item) => {
      const kickoff = item.fixture!.date!;
      const local = parts(kickoff);
      return {
        id: String(item.fixture?.id ?? kickoff),
        homeTeam: item.teams?.home?.name ?? '',
        awayTeam: item.teams?.away?.name ?? '',
        homeTeamId: item.teams?.home?.id ? String(item.teams.home.id) : '',
        awayTeamId: item.teams?.away?.id ? String(item.teams.away.id) : '',
        homeTeamBadge: item.teams?.home?.logo ?? null,
        awayTeamBadge: item.teams?.away?.logo ?? null,
        date: local.date,
        time: local.time,
        timestamp: kickoff,
        round: item.league?.round ?? 'Próximos jogos',
        referee: item.fixture?.referee ?? null,
        venue: item.fixture?.venue?.name ?? null,
        status: item.fixture?.status?.long ?? null,
        homeScore: item.goals?.home ?? null,
        awayScore: item.goals?.away ?? null,
        source: 'api-football',
      };
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

async function from365Scores(leagueKey: string): Promise<UnifiedFixture[]> {
  const competition = SCORES365_COMPETITIONS[leagueKey];
  if (!competition) return [];
  const data = await scores365Get('/web/games/', {
    competitions: String(competition.id),
    statuses: '1,2',
  }) as {
    games?: Array<{
      id: number; startTime: string; statusGroup?: number; roundNum?: number; roundName?: string;
      homeCompetitor: { id: number; name: string };
      awayCompetitor: { id: number; name: string };
    }>;
  };
  const now = Date.now() - 6 * 60 * 60 * 1000;
  return (data.games ?? [])
    .filter((game) => game.statusGroup !== 3 && Date.parse(game.startTime) >= now)
    .map((game) => {
      const local = parts(game.startTime);
      return {
        id: String(game.id), homeTeam: game.homeCompetitor.name, awayTeam: game.awayCompetitor.name,
        homeTeamId: String(game.homeCompetitor.id), awayTeamId: String(game.awayCompetitor.id),
        homeTeamBadge: null, awayTeamBadge: null, date: local.date, time: local.time,
        timestamp: game.startTime, round: game.roundNum ? `Rodada ${game.roundNum}` : game.roundName ?? 'Próximos jogos',
        referee: null, venue: null, status: null, homeScore: null, awayScore: null, source: '365scores',
      };
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function fromLocal(leagueKey: string): UnifiedFixture[] {
  const now = Date.now() - 6 * 60 * 60 * 1000;
  return currentUpcomingMatches
    .filter((match) => match.leagueKey === leagueKey)
    .filter((match) => Date.parse(`${match.date.replace(' ', 'T')}:00-03:00`) >= now)
    .map((match, index) => ({
      id: `local-${index}-${match.homeTeam}-${match.awayTeam}`,
      homeTeam: match.homeTeam, awayTeam: match.awayTeam, homeTeamId: '', awayTeamId: '',
      homeTeamBadge: null, awayTeamBadge: null, date: match.date.slice(0, 10), time: match.date.slice(11, 16),
      timestamp: `${match.date.replace(' ', 'T')}:00-03:00`, round: match.round ?? 'Próximos jogos',
      referee: match.referee ?? null, venue: match.venue ?? null, status: null,
      homeScore: null, awayScore: null, source: 'local',
    }));
}

export async function getUpcomingFixtures(leagueKey: string) {
  const definition = getCompetitionDefinition(leagueKey);
  if (!definition) return { definition: null, fixtures: [], source: 'none', attempts: [] as string[] };

  const attempts: string[] = [];
  for (const provider of definition.providers.fixtures ?? []) {
    try {
      attempts.push(provider);
      const fixtures = provider === 'api-football'
        ? await fromApiFootball(definition)
        : provider === '365scores'
          ? await from365Scores(leagueKey)
          : provider === 'local'
            ? fromLocal(leagueKey)
            : [];
      if (fixtures.length > 0) return { definition, fixtures, source: provider, attempts };
    } catch (error) {
      console.warn(`[competitions] ${provider} failed for ${leagueKey}`, error);
    }
  }
  return { definition, fixtures: [], source: 'none', attempts };
}
