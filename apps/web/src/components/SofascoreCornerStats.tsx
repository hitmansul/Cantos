'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Loader2,
  CornerUpRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  Database,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useSofascoreCorners,
  SOFASCORE_TOURNAMENTS,
  type SofascoreTournament,
  type SofascoreTeamCorners,
  type SofascoreTournamentCorners,
} from '@/hooks/useSofascoreDirect';
import {
  brazilianTeamStats,
  serieBTeamStats,
  copaDoBrasilTeamStats,
  libertadoresTeamStats,
  sulAmericanaTeamStats,
  championsLeagueTeamStats,
  europaLeagueTeamStats,
  conferenceLeagueTeamStats,
  type TeamCornerStats,
} from '@/data/cornerStats';
import { teamStats as detailedTeamStats } from '@/data/teamCornerStats';
import type { DetailedTeamStats } from '@/data/teamCornerStats';
import { useDatabaseTeamStats } from '@/hooks/useDatabaseStats';

interface SofascoreCornerStatsProps {
  tournament: SofascoreTournament;
  onTeamSelect?: (team: SofascoreTeamCorners) => void;
  filteredTeams?: DetailedTeamStats[];
}

// Convert local corner stats to Sofascore format
function convertToSofascoreFormat(
  localStats: TeamCornerStats[],
  tournamentId: number,
  seasonId: number,
  updatedAt: string
): SofascoreTournamentCorners {
  const teams: SofascoreTeamCorners[] = localStats.map((team, idx) => ({
    team: team.team,
    teamId: idx + 1,
    matches: team.gamesPlayed,
    corners: Math.round(team.avgCornersFor * team.gamesPlayed),
    cornersAgainst: Math.round(team.avgCornersAgainst * team.gamesPlayed),
    avgCorners: team.avgCornersFor,
    avgCornersAgainst: team.avgCornersAgainst,
    avgTotalCorners: team.avgTotalCorners,
  }));

  // Sort by avgCorners descending
  teams.sort((a, b) => b.avgCorners - a.avgCorners);

  return {
    tournamentId,
    seasonId,
    teams,
    lastUpdated: updatedAt,
  };
}

// Map tournament to local data
const BRAZILIAN_LOCAL_DATA: Record<string, TeamCornerStats[]> = {
  brasileirao_a: brazilianTeamStats,
  brasileirao_b: serieBTeamStats,
  copa_do_brasil: copaDoBrasilTeamStats,
  libertadores: libertadoresTeamStats,
  sul_americana: sulAmericanaTeamStats,
  // UEFA — dados estáticos da temporada 2024/25
  champions_league: championsLeagueTeamStats,
  europa_league: europaLeagueTeamStats,
  conference_league: conferenceLeagueTeamStats,
};

// Map tournament to database league name
const TOURNAMENT_TO_DB_LEAGUE: Record<string, string> = {
  brasileirao_a: 'serie_a',
  brasileirao_b: 'serie_b',
  copa_do_brasil: 'copa_do_brasil',
  libertadores: 'libertadores',
  sul_americana: 'sul_americana',
  champions_league: 'champions_league',
  europa_league: 'europa_league',
  conference_league: 'conference_league',
};

// Tournaments that show half-time breakdown button
const HALFTIME_TOURNAMENTS = new Set(['brasileirao_a', 'libertadores']);

export function SofascoreCornerStats({
  tournament,
  onTeamSelect,
  filteredTeams,
}: SofascoreCornerStatsProps) {
  const { stats: apiStats, loading: apiLoading, error, fetchCorners } = useSofascoreCorners();
  const {
    stats: dbStats,
    loading: dbLoading,
    source: dataSource,
    fetchStats: fetchDbStats,
  } = useDatabaseTeamStats();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showHalftime, setShowHalftime] = useState(false);
  // stable timestamp so it doesn't change between server and client
  const [updatedAt] = useState('2026-05-27T00:00:00.000Z');
  const config = SOFASCORE_TOURNAMENTS[tournament];

  // Check if this is a local-data league
  const localData = BRAZILIAN_LOCAL_DATA[tournament];
  const isBrazilianLeague = !!localData;

  // Check if detailed stats are available (for half-time data)
  const hasDetailedStats = HALFTIME_TOURNAMENTS.has(tournament);

  const dbLeague = TOURNAMENT_TO_DB_LEAGUE[tournament] || tournament;

  const loadStats = useCallback(() => {
    if (isBrazilianLeague && localData) {
      fetchDbStats(dbLeague, localData);
    } else {
      fetchCorners(tournament);
    }
  }, [isBrazilianLeague, localData, fetchDbStats, dbLeague, fetchCorners, tournament]);

  // Compute effective stats synchronously — static data shows immediately,
  // DB data overwrites when it arrives. No blank state.
  const effectiveStats = useMemo<SofascoreTournamentCorners | null>(() => {
    if (!isBrazilianLeague) return apiStats;
    // Prefer DB stats if they have data
    if (dbStats && dbStats.length > 0) {
      return convertToSofascoreFormat(dbStats, config.id, config.seasonId, updatedAt);
    }
    // Fall back to static file data (always available synchronously)
    if (localData && localData.length > 0) {
      return convertToSofascoreFormat(localData, config.id, config.seasonId, updatedAt);
    }
    return null;
  }, [isBrazilianLeague, dbStats, apiStats, localData, config.id, config.seasonId, updatedAt]);

  // Use local stats for Brazilian leagues, API stats for others
  const stats = effectiveStats;
  const loading = isBrazilianLeague ? dbLoading : apiLoading;

  // Apply team filters if provided (only for Série A with DetailedTeamStats)
  const filteredStats = useMemo(() => {
    if (!stats) return null;
    if (!filteredTeams || tournament !== 'brasileirao_a') return stats;

    const filteredTeamNames = new Set(filteredTeams.map((t) => t.team));
    const filteredTeamsList = stats.teams.filter((t) => filteredTeamNames.has(t.team));

    return {
      ...stats,
      teams: filteredTeamsList,
    };
  }, [stats, filteredTeams, tournament]);

  const displayStats = filteredStats || stats;

  // Helper to get detailed stats for half-time data
  const getDetailedStats = useCallback(
    (teamName: string): DetailedTeamStats | undefined => {
      if (!hasDetailedStats) return undefined;
      return detailedTeamStats.find(
        (t) =>
          t.league ===
            (tournament === 'libertadores' ? 'Copa Libertadores' : 'Brasileirão Série A') &&
          (t.team.toLowerCase() === teamName.toLowerCase() ||
            teamName.toLowerCase().includes(t.team.toLowerCase()) ||
            t.team.toLowerCase().includes(teamName.toLowerCase()))
      );
    },
    [hasDetailedStats, tournament]
  );

  const handleTeamClick = (team: SofascoreTeamCorners) => {
    setSelectedTeam(selectedTeam === team.team ? null : team.team);
    onTeamSelect?.(team);
  };

  if (loading && !isBrazilianLeague) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Carregando estatísticas...</p>
      </div>
    );
  }

  if (error && !isBrazilianLeague) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-8 h-8 text-destructive mb-3" />
        <p className="text-sm text-destructive font-medium">Erro ao carregar dados</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => fetchCorners(tournament)}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!displayStats || displayStats.teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CornerUpRight className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">
          {filteredTeams && filteredTeams.length === 0
            ? 'Nenhum time corresponde aos filtros'
            : 'Nenhuma estatística disponível'}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={loadStats}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Recarregar
        </Button>
      </div>
    );
  }

  // Calculate league averages
  const avgCorners =
    displayStats.teams.reduce((sum, t) => sum + t.avgCorners, 0) / displayStats.teams.length;
  const avgCornersAgainst =
    displayStats.teams.reduce((sum, t) => sum + t.avgCornersAgainst, 0) / displayStats.teams.length;
  const avgTotal =
    displayStats.teams.reduce((sum, t) => sum + t.avgTotalCorners, 0) / displayStats.teams.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.flag}</span>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              {config.name}
              <Badge variant="outline" className="text-xs font-normal">
                Temporada {config.season}
              </Badge>
              {isBrazilianLeague && dataSource && (
                <Badge
                  variant="outline"
                  className={`text-xs font-normal gap-1 ${
                    dataSource === 'database'
                      ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                      : 'border-amber-500/50 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {dataSource === 'database' ? (
                    <>
                      <Database className="w-3 h-3" />
                      Banco
                    </>
                  ) : (
                    <>
                      <FileText className="w-3 h-3" />
                      Estático
                    </>
                  )}
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">Estatísticas de escanteios</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasDetailedStats && (
            <Button
              variant={showHalftime ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowHalftime(!showHalftime)}
              className="text-xs gap-1"
            >
              <Clock className="w-3 h-3" />
              1º/2º Tempo
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={loadStats} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* League Averages */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-primary/10 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Média a favor</p>
          <p className="text-lg font-bold text-primary">{avgCorners.toFixed(1)}</p>
        </div>
        <div className="bg-destructive/10 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Média contra</p>
          <p className="text-lg font-bold text-destructive">{avgCornersAgainst.toFixed(1)}</p>
        </div>
        <div className="bg-accent/20 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Total médio</p>
          <p className="text-lg font-bold">{avgTotal.toFixed(1)}</p>
        </div>
      </div>

      {/* Teams Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2">#</th>
              <th className="text-left py-2 px-2">Time</th>
              <th className="text-center py-2 px-2">J</th>
              <th className="text-center py-2 px-2">
                <span className="flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3 text-primary" />A favor
                </span>
              </th>
              <th className="text-center py-2 px-2">
                <span className="flex items-center justify-center gap-1">
                  <TrendingDown className="w-3 h-3 text-destructive" />
                  Contra
                </span>
              </th>
              <th className="text-center py-2 px-2">Total</th>
              {showHalftime && hasDetailedStats && (
                <>
                  <th className="text-center py-2 px-2 bg-primary/5">
                    <span className="text-xs whitespace-nowrap">1º T</span>
                  </th>
                  <th className="text-center py-2 px-2 bg-accent/10">
                    <span className="text-xs whitespace-nowrap">2º T</span>
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {displayStats.teams.map((team, idx) => {
              const isAboveAvg = team.avgCorners > avgCorners;
              const isSelected = selectedTeam === team.team;
              const detailedStats = getDetailedStats(team.team);

              return (
                <tr
                  key={team.teamId}
                  className={`
                    border-b border-border/50 cursor-pointer transition-colors
                    ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}
                  `}
                  onClick={() => handleTeamClick(team)}
                >
                  <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{team.team}</span>
                      {isAboveAvg && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        >
                          +
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center text-muted-foreground">{team.matches}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`font-semibold ${isAboveAvg ? 'text-emerald-400' : ''}`}>
                      {team.avgCorners.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">({team.corners})</span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="font-semibold text-destructive/80">
                      {team.avgCornersAgainst.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({team.cornersAgainst})
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Badge
                      variant={team.avgTotalCorners > avgTotal ? 'default' : 'secondary'}
                      className="font-mono"
                    >
                      {team.avgTotalCorners.toFixed(1)}
                    </Badge>
                  </td>
                  {showHalftime && hasDetailedStats && (
                    <>
                      <td className="py-2 px-2 text-center bg-primary/5">
                        <span className="font-semibold text-primary">
                          {detailedStats?.avgCornersFirstHalf?.toFixed(1) ?? '-'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center bg-accent/10">
                        <span className="font-semibold text-accent-foreground">
                          {detailedStats?.avgCornersSecondHalf?.toFixed(1) ?? '-'}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Last Updated */}
      <p className="text-xs text-muted-foreground text-center">
        Dados da temporada 2026
        {filteredTeams && stats && displayStats.teams.length < stats.teams.length && (
          <span className="ml-2">
            (Mostrando {displayStats.teams.length} de {stats.teams.length} times)
          </span>
        )}
      </p>
    </div>
  );
}
