"use client";

import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, CornerUpRight, Info, Filter, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TeamCornerStats } from "@/shared/footballDataTypes";
import type { SofascoreHalftimeTeamStats } from "@/hooks/useSofascoreDirect";

interface FootballDataCornerStatsProps {
  teams: TeamCornerStats[];
  halftimeStats?: SofascoreHalftimeTeamStats[];
  leagueName?: string;
  flag?: string;
  matchesAnalyzed?: number;
  onTeamSelect?: (team: TeamCornerStats) => void;
  halftimeLoading?: boolean;
  onLoadHalftime?: () => void;
}

// Filter interface for international leagues
interface IntlFilters {
  minCornersFor: number;
  minCornersAgainst: number;
  min1stHalf: number;
  min2ndHalf: number;
}

const DEFAULT_FILTERS: IntlFilters = {
  minCornersFor: 0,
  minCornersAgainst: 0,
  min1stHalf: 0,
  min2ndHalf: 0,
};

export function FootballDataCornerStats({ 
  teams, 
  halftimeStats,
  leagueName, 
  flag, 
  matchesAnalyzed,
  onTeamSelect,
  halftimeLoading,
  onLoadHalftime,
}: FootballDataCornerStatsProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<IntlFilters>(DEFAULT_FILTERS);
  const [showHalftime, setShowHalftime] = useState(false);

  // Merge half-time stats with teams
  const teamsWithHalftime = useMemo(() => {
    if (!halftimeStats || halftimeStats.length === 0) return teams;
    
    return teams.map(team => {
      const htStats = halftimeStats.find(ht => 
        ht.team.toLowerCase() === team.team.toLowerCase() ||
        team.team.toLowerCase().includes(ht.team.toLowerCase()) ||
        ht.team.toLowerCase().includes(team.team.toLowerCase())
      );
      
      if (htStats) {
        return {
          ...team,
          avgCorners1stHalf: htStats.avgTotal1stHalf,
          avgCorners2ndHalf: htStats.avgTotal2ndHalf,
          avgCornersFor1stHalf: htStats.avgCorners1stHalf,
          avgCornersFor2ndHalf: htStats.avgCorners2ndHalf,
          avgCornersAgainst1stHalf: htStats.avgCornersAgainst1stHalf,
          avgCornersAgainst2ndHalf: htStats.avgCornersAgainst2ndHalf,
        };
      }
      return team;
    });
  }, [teams, halftimeStats]);

  // Apply filters
  const filteredTeams = useMemo(() => {
    return teamsWithHalftime.filter(team => {
      if (team.avgCornersFor < filters.minCornersFor) return false;
      if (team.avgCornersAgainst < filters.minCornersAgainst) return false;
      
      // Half-time filters only if halftime data is available
      if (filters.min1stHalf > 0 && team.avgCorners1stHalf !== undefined) {
        if (team.avgCorners1stHalf < filters.min1stHalf) return false;
      }
      if (filters.min2ndHalf > 0 && team.avgCorners2ndHalf !== undefined) {
        if (team.avgCorners2ndHalf < filters.min2ndHalf) return false;
      }
      
      return true;
    });
  }, [teamsWithHalftime, filters]);

  // Sort teams by avgCornersFor descending
  const sortedTeams = useMemo(() => {
    return [...filteredTeams].sort((a, b) => b.avgCornersFor - a.avgCornersFor);
  }, [filteredTeams]);

  // Calculate league averages
  const avgCorners = useMemo(() => {
    if (teams.length === 0) return 0;
    return teams.reduce((sum, t) => sum + t.avgCornersFor, 0) / teams.length;
  }, [teams]);

  const avgCornersAgainst = useMemo(() => {
    if (teams.length === 0) return 0;
    return teams.reduce((sum, t) => sum + t.avgCornersAgainst, 0) / teams.length;
  }, [teams]);

  const avgTotal = useMemo(() => {
    if (teams.length === 0) return 0;
    return teams.reduce((sum, t) => sum + t.avgTotalCorners, 0) / teams.length;
  }, [teams]);

  const hasHalftimeData = halftimeStats && halftimeStats.length > 0;
  const hasActiveFilters = Object.values(filters).some(v => v > 0);

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CornerUpRight className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">Nenhuma estatística disponível</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {(leagueName || flag) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {flag && <span className="text-xl">{flag}</span>}
            <div>
              {leagueName && <h3 className="font-semibold">{leagueName}</h3>}
              <p className="text-xs text-muted-foreground">
                Estatísticas de escanteios
                {matchesAnalyzed && ` • ${matchesAnalyzed} jogos`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Half-time toggle */}
            {hasHalftimeData && (
              <Button
                variant={showHalftime ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHalftime(!showHalftime)}
                className="text-xs gap-1"
              >
                <Clock className="w-3 h-3" />
                1º/2º Tempo
              </Button>
            )}
            {!hasHalftimeData && onLoadHalftime && (
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadHalftime}
                disabled={halftimeLoading}
                className="text-xs gap-1"
              >
                <Clock className="w-3 h-3" />
                {halftimeLoading ? "Carregando..." : "Carregar por tempo"}
              </Button>
            )}
            {/* Filters toggle */}
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs gap-1"
            >
              <Filter className="w-3 h-3" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 text-xs px-1">
                  {Object.values(filters).filter(v => v > 0).length}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-4 border border-border">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros Avançados
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Mín. escanteios a favor</label>
              <input
                type="number"
                min="0"
                max="15"
                step="0.5"
                value={filters.minCornersFor}
                onChange={(e) => setFilters({...filters, minCornersFor: parseFloat(e.target.value) || 0})}
                className="w-full mt-1 px-2 py-1 bg-background border border-border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Mín. escanteios contra</label>
              <input
                type="number"
                min="0"
                max="15"
                step="0.5"
                value={filters.minCornersAgainst}
                onChange={(e) => setFilters({...filters, minCornersAgainst: parseFloat(e.target.value) || 0})}
                className="w-full mt-1 px-2 py-1 bg-background border border-border rounded text-sm"
              />
            </div>
            {hasHalftimeData && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Mín. 1º tempo (total)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={filters.min1stHalf}
                    onChange={(e) => setFilters({...filters, min1stHalf: parseFloat(e.target.value) || 0})}
                    className="w-full mt-1 px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Mín. 2º tempo (total)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={filters.min2ndHalf}
                    onChange={(e) => setFilters({...filters, min2ndHalf: parseFloat(e.target.value) || 0})}
                    className="w-full mt-1 px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {sortedTeams.length} de {teams.length} times
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs"
            >
              Limpar filtros
            </Button>
          </div>
        </div>
      )}

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
                  <TrendingUp className="w-3 h-3 text-primary" />
                  A favor
                </span>
              </th>
              <th className="text-center py-2 px-2">
                <span className="flex items-center justify-center gap-1">
                  <TrendingDown className="w-3 h-3 text-destructive" />
                  Contra
                </span>
              </th>
              <th className="text-center py-2 px-2">Total</th>
              {showHalftime && hasHalftimeData && (
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
            {sortedTeams.map((team, idx) => {
              const isAboveAvg = team.avgCornersFor > avgCorners;

              return (
                <tr 
                  key={team.team}
                  className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onTeamSelect?.(team)}
                >
                  <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{team.team}</span>
                      {isAboveAvg && (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          +
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center text-muted-foreground">{team.gamesPlayed}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`font-semibold ${isAboveAvg ? "text-emerald-400" : ""}`}>
                      {team.avgCornersFor.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({team.totalCornersFor})
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="font-semibold text-destructive/80">
                      {team.avgCornersAgainst.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({team.totalCornersAgainst})
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Badge 
                      variant={team.avgTotalCorners > avgTotal ? "default" : "secondary"}
                      className="font-mono"
                    >
                      {team.avgTotalCorners.toFixed(1)}
                    </Badge>
                  </td>
                  {showHalftime && hasHalftimeData && (
                    <>
                      <td className="py-2 px-2 text-center bg-primary/5">
                        <span className="font-semibold text-primary">
                          {team.avgCorners1stHalf?.toFixed(1) ?? "-"}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center bg-accent/10">
                        <span className="font-semibold text-accent-foreground">
                          {team.avgCorners2ndHalf?.toFixed(1) ?? "-"}
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

      {/* Data source info */}
      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
        <Info className="w-3 h-3" />
        Dados atualizados semanalmente
        {hasHalftimeData && " • Estatísticas por tempo via Sofascore"}
      </p>
    </div>
  );
}
