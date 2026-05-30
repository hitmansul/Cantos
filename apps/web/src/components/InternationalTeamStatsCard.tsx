"use client";

import { useState } from "react";
import { CornerUpRight, Home, Plane, TrendingUp, TrendingDown, Target, Percent, Calendar, Trophy, CircleDot, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TeamCornerStats } from "@/shared/footballDataTypes";

type TimePeriod = "full" | "1st" | "2nd";

interface InternationalTeamStatsCardProps {
  team: TeamCornerStats;
}

export function InternationalTeamStatsCard({ team }: InternationalTeamStatsCardProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("full");
  
  // Calculate recent form average
  const recentAvg = team.recentMatches.length > 0
    ? team.recentMatches.reduce((sum, m) => sum + m.cornersFor, 0) / team.recentMatches.length
    : 0;
  
  const trend = recentAvg - team.avgCornersFor;
  
  // Get stats based on time period
  const getStats = () => {
    const avg1st = team.avgCornersFor1stHalf || team.avgCornersFor * 0.45;
    const avg2nd = team.avgCornersFor2ndHalf || team.avgCornersFor * 0.55;
    const total1stHalf = avg1st + (team.avgCornersAgainst1stHalf || team.avgCornersAgainst * 0.45);
    const total2ndHalf = avg2nd + (team.avgCornersAgainst2ndHalf || team.avgCornersAgainst * 0.55);
    
    if (timePeriod === "1st") {
      const ratio = avg1st / team.avgCornersFor;
      return {
        avgFor: +avg1st.toFixed(1),
        avgAgainst: +(team.avgCornersAgainst1stHalf || team.avgCornersAgainst * 0.45).toFixed(1),
        avgTotal: +total1stHalf.toFixed(1),
        avgHome: +(team.avgCornersHome * ratio).toFixed(1),
        avgAway: +(team.avgCornersAway * ratio).toFixed(1),
        avgWinning: team.avgCornersWinning ? +(team.avgCornersWinning * ratio).toFixed(1) : null,
        avgDrawing: team.avgCornersDrawing ? +(team.avgCornersDrawing * ratio).toFixed(1) : null,
        avgLosing: team.avgCornersLosing ? +(team.avgCornersLosing * ratio).toFixed(1) : null,
      };
    } else if (timePeriod === "2nd") {
      const ratio = avg2nd / team.avgCornersFor;
      return {
        avgFor: +avg2nd.toFixed(1),
        avgAgainst: +(team.avgCornersAgainst2ndHalf || team.avgCornersAgainst * 0.55).toFixed(1),
        avgTotal: +total2ndHalf.toFixed(1),
        avgHome: +(team.avgCornersHome * ratio).toFixed(1),
        avgAway: +(team.avgCornersAway * ratio).toFixed(1),
        avgWinning: team.avgCornersWinning ? +(team.avgCornersWinning * ratio).toFixed(1) : null,
        avgDrawing: team.avgCornersDrawing ? +(team.avgCornersDrawing * ratio).toFixed(1) : null,
        avgLosing: team.avgCornersLosing ? +(team.avgCornersLosing * ratio).toFixed(1) : null,
      };
    }
    return {
      avgFor: team.avgCornersFor,
      avgAgainst: team.avgCornersAgainst,
      avgTotal: team.avgTotalCorners,
      avgHome: team.avgCornersHome,
      avgAway: team.avgCornersAway,
      avgWinning: team.avgCornersWinning,
      avgDrawing: team.avgCornersDrawing,
      avgLosing: team.avgCornersLosing,
    };
  };
  
  const stats = getStats();

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">{team.team}</h3>
            <p className="text-sm text-muted-foreground">{team.league} • {team.country}</p>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            <CornerUpRight className="w-4 h-4 mr-1" />
            {team.avgCornersFor.toFixed(1)}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Time Period Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setTimePeriod("full")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              timePeriod === "full"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            Jogo Completo
          </button>
          <button
            onClick={() => setTimePeriod("1st")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              timePeriod === "1st"
                ? "bg-emerald-500 text-white"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            1º Tempo
          </button>
          <button
            onClick={() => setTimePeriod("2nd")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              timePeriod === "2nd"
                ? "bg-blue-500 text-white"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            2º Tempo
          </button>
        </div>
        
        {/* Main Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-emerald-400">{stats.avgFor.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">
              Escanteios Pró {timePeriod !== "full" && `(${timePeriod === "1st" ? "1º" : "2º"})`}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-red-400">{stats.avgAgainst.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">
              Escanteios Contra {timePeriod !== "full" && `(${timePeriod === "1st" ? "1º" : "2º"})`}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{stats.avgTotal.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">
              Total Médio {timePeriod !== "full" && `(${timePeriod === "1st" ? "1º" : "2º"})`}
            </p>
          </div>
        </div>

        {/* Home vs Away */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="w-4 h-4" />
            Casa vs Fora {timePeriod !== "full" && <Badge variant="outline" className="text-xs">{timePeriod === "1st" ? "1º Tempo" : "2º Tempo"}</Badge>}
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Home className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-lg font-bold text-emerald-400">{stats.avgHome.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Em casa ({team.homeGames}j)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Plane className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-lg font-bold text-blue-400">{stats.avgAway.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Fora ({team.awayGames}j)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats by Match State */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Por Resultado do Jogo {timePeriod !== "full" && <Badge variant="outline" className="text-xs">{timePeriod === "1st" ? "1º Tempo" : "2º Tempo"}</Badge>}
          </h4>
          
          {/* Overall by result */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-lg font-bold text-emerald-400">
                {stats.avgWinning?.toFixed(1) || '-'}
              </p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Trophy className="w-3 h-3" /> Ganhando ({team.gamesWinning || 0})
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-lg font-bold text-yellow-400">
                {stats.avgDrawing?.toFixed(1) || '-'}
              </p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <CircleDot className="w-3 h-3" /> Empate ({team.gamesDrawing || 0})
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-lg font-bold text-red-400">
                {stats.avgLosing?.toFixed(1) || '-'}
              </p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <X className="w-3 h-3" /> Perdendo ({team.gamesLosing || 0})
              </p>
            </div>
          </div>

          {/* Home by result */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Home className="w-3 h-3" /> Em Casa
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-sm font-bold text-emerald-400">
                  {team.avgCornersHomeWinning?.toFixed(1) || '-'}
                </p>
                <p className="text-xs text-muted-foreground">V ({team.homeGamesWinning || 0})</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-sm font-bold text-yellow-400">
                  {team.avgCornersHomeDrawing?.toFixed(1) || '-'}
                </p>
                <p className="text-xs text-muted-foreground">E ({team.homeGamesDrawing || 0})</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-sm font-bold text-red-400">
                  {team.avgCornersHomeLosing?.toFixed(1) || '-'}
                </p>
                <p className="text-xs text-muted-foreground">D ({team.homeGamesLosing || 0})</p>
              </div>
            </div>
          </div>

          {/* Away by result */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Plane className="w-3 h-3" /> Fora
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-sm font-bold text-emerald-400">
                  {team.avgCornersAwayWinning?.toFixed(1) || '-'}
                </p>
                <p className="text-xs text-muted-foreground">V ({team.awayGamesWinning || 0})</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-sm font-bold text-yellow-400">
                  {team.avgCornersAwayDrawing?.toFixed(1) || '-'}
                </p>
                <p className="text-xs text-muted-foreground">E ({team.awayGamesDrawing || 0})</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-sm font-bold text-red-400">
                  {team.avgCornersAwayLosing?.toFixed(1) || '-'}
                </p>
                <p className="text-xs text-muted-foreground">D ({team.awayGamesLosing || 0})</p>
              </div>
            </div>
          </div>
        </div>

        {/* Over/Under Stats */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Percent className="w-4 h-4" />
            Probabilidades Over
          </h4>
          <div className="space-y-2">
            <OverUnderBar label="Over 8.5" value={team.over85Pct} />
            <OverUnderBar label="Over 9.5" value={team.over95Pct} />
            <OverUnderBar label="Over 10.5" value={team.over105Pct} />
            <OverUnderBar label="Over 11.5" value={team.over115Pct} />
          </div>
        </div>

        {/* Trend */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            {trend > 0.3 ? (
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            ) : trend < -0.3 ? (
              <TrendingDown className="w-5 h-5 text-red-400" />
            ) : (
              <span className="w-5 h-5 text-muted-foreground">→</span>
            )}
            <span className="text-sm">Tendência últimos jogos</span>
          </div>
          <Badge variant={trend > 0 ? "default" : trend < 0 ? "destructive" : "secondary"}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}
          </Badge>
        </div>

        {/* Recent Matches */}
        {team.recentMatches.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Últimos jogos
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {team.recentMatches.slice(0, 5).map((match, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`w-6 h-6 p-0 flex items-center justify-center text-xs ${
                        match.result === 'W' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                        match.result === 'L' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }`}
                    >
                      {match.result}
                    </Badge>
                    <span className={match.isHome ? "text-emerald-400" : "text-blue-400"}>
                      {match.isHome ? "C" : "F"}
                    </span>
                    <span className="truncate max-w-[120px]">{match.opponent}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-medium">{match.cornersFor}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-red-400">{match.cornersAgainst}</span>
                    <Badge variant="outline" className="ml-2">
                      {match.totalCorners}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer - Games Played */}
        <div className="pt-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
          <span>{team.gamesPlayed} jogos analisados</span>
          <span>Temporada 2025/26</span>
        </div>
      </div>
    </Card>
  );
}

function OverUnderBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : 
                value >= 50 ? "bg-amber-500" : 
                value >= 30 ? "bg-orange-500" : "bg-red-500";
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-10 text-right ${
        value >= 50 ? "text-emerald-400" : "text-muted-foreground"
      }`}>
        {value}%
      </span>
    </div>
  );
}
