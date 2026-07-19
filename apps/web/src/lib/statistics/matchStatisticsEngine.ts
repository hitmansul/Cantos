import { apiFootballGet, isApiFootballConfigured } from '@/app/api/utils/apiFootball';

export type StatisticValue = number | string | null;

export interface TeamStatisticSet {
  teamId: string;
  teamName: string;
  teamLogo?: string | null;
  values: Record<string, StatisticValue>;
}

export interface MatchEvent {
  teamId?: string;
  teamName?: string;
  player?: string;
  assist?: string;
  type: string;
  detail?: string;
  minute?: number;
  extraMinute?: number | null;
  comments?: string | null;
}

export interface MatchLineup {
  teamId: string;
  teamName: string;
  formation?: string | null;
  coach?: string | null;
  starters: Array<{ id?: string; name: string; number?: number | null; position?: string | null }>;
  substitutes: Array<{ id?: string; name: string; number?: number | null; position?: string | null }>;
}

export interface UnifiedMatchStatistics {
  fixtureId: string;
  source: 'api-football' | 'none';
  fetchedAt: string;
  teams: TeamStatisticSet[];
  events: MatchEvent[];
  lineups: MatchLineup[];
  coverage: {
    statistics: boolean;
    events: boolean;
    lineups: boolean;
  };
}

type ApiStatistic = { type?: string; value?: number | string | null };
type ApiStatisticsResponse = Array<{
  team?: { id?: number; name?: string; logo?: string };
  statistics?: ApiStatistic[];
}>;

type ApiEventResponse = Array<{
  time?: { elapsed?: number; extra?: number | null };
  team?: { id?: number; name?: string };
  player?: { name?: string };
  assist?: { name?: string };
  type?: string;
  detail?: string;
  comments?: string | null;
}>;

type ApiLineupResponse = Array<{
  team?: { id?: number; name?: string };
  formation?: string;
  coach?: { name?: string };
  startXI?: Array<{ player?: { id?: number; name?: string; number?: number | null; pos?: string | null } }>;
  substitutes?: Array<{ player?: { id?: number; name?: string; number?: number | null; pos?: string | null } }>;
}>;

function normalizeStatisticKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/%/g, ' percentage ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeValue(value: StatisticValue): StatisticValue {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/^-?\d+(?:[.,]\d+)?%$/.test(trimmed)) return Number(trimmed.replace('%', '').replace(',', '.'));
  if (/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) return Number(trimmed.replace(',', '.'));
  return trimmed || null;
}

export async function getMatchStatistics(fixtureId: string): Promise<UnifiedMatchStatistics> {
  const empty: UnifiedMatchStatistics = {
    fixtureId,
    source: 'none',
    fetchedAt: new Date().toISOString(),
    teams: [],
    events: [],
    lineups: [],
    coverage: { statistics: false, events: false, lineups: false },
  };

  if (!fixtureId || !isApiFootballConfigured()) return empty;

  const [statisticsPayload, eventsPayload, lineupsPayload] = await Promise.all([
    apiFootballGet<ApiStatisticsResponse>('/fixtures/statistics', {
      params: { fixture: fixtureId },
      revalidate: 300,
    }),
    apiFootballGet<ApiEventResponse>('/fixtures/events', {
      params: { fixture: fixtureId },
      revalidate: 120,
    }),
    apiFootballGet<ApiLineupResponse>('/fixtures/lineups', {
      params: { fixture: fixtureId },
      revalidate: 900,
    }),
  ]);

  const teams = (statisticsPayload?.response ?? []).map((entry) => ({
    teamId: entry.team?.id ? String(entry.team.id) : '',
    teamName: entry.team?.name ?? '',
    teamLogo: entry.team?.logo ?? null,
    values: Object.fromEntries(
      (entry.statistics ?? [])
        .filter((stat) => stat.type)
        .map((stat) => [normalizeStatisticKey(stat.type!), normalizeValue(stat.value ?? null)]),
    ),
  }));

  const events = (eventsPayload?.response ?? []).map((event) => ({
    teamId: event.team?.id ? String(event.team.id) : undefined,
    teamName: event.team?.name,
    player: event.player?.name,
    assist: event.assist?.name,
    type: event.type ?? 'Unknown',
    detail: event.detail,
    minute: event.time?.elapsed,
    extraMinute: event.time?.extra ?? null,
    comments: event.comments ?? null,
  }));

  const mapPlayers = (items: ApiLineupResponse[number]['startXI']) =>
    (items ?? []).map((item) => ({
      id: item.player?.id ? String(item.player.id) : undefined,
      name: item.player?.name ?? '',
      number: item.player?.number ?? null,
      position: item.player?.pos ?? null,
    }));

  const lineups = (lineupsPayload?.response ?? []).map((lineup) => ({
    teamId: lineup.team?.id ? String(lineup.team.id) : '',
    teamName: lineup.team?.name ?? '',
    formation: lineup.formation ?? null,
    coach: lineup.coach?.name ?? null,
    starters: mapPlayers(lineup.startXI),
    substitutes: mapPlayers(lineup.substitutes),
  }));

  const hasData = teams.length > 0 || events.length > 0 || lineups.length > 0;
  return {
    fixtureId,
    source: hasData ? 'api-football' : 'none',
    fetchedAt: new Date().toISOString(),
    teams,
    events,
    lineups,
    coverage: {
      statistics: teams.length > 0,
      events: events.length > 0,
      lineups: lineups.length > 0,
    },
  };
}
