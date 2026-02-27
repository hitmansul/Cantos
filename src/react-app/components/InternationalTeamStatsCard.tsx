import { CornerUpRight, Home, Plane, TrendingUp, TrendingDown, Target, Percent, Calendar } from "lucide-react";
import { Card } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import type { TeamCornerStats } from "@/shared/footballDataTypes";

interface InternationalTeamStatsCardProps {
  team: TeamCornerStats;
}

export function InternationalTeamStatsCard({ team }: InternationalTeamStatsCardProps) {
  // Calculate recent form average
  const recentAvg = team.recentMatches.length > 0
    ? team.recentMatches.reduce((sum, m) => sum + m.cornersFor, 0) / team.recentMatches.length
    : 0;
  
  const trend = recentAvg - team.avgCornersFor;

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
        {/* Main Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-emerald-400">{team.avgCornersFor.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Escanteios Pró</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-red-400">{team.avgCornersAgainst.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Escanteios Contra</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{team.avgTotalCorners.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Total Médio</p>
          </div>
        </div>

        {/* Home vs Away */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="w-4 h-4" />
            Casa vs Fora
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Home className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-lg font-bold text-emerald-400">{team.avgCornersHome.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Em casa ({team.homeGames}j)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Plane className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-lg font-bold text-blue-400">{team.avgCornersAway.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Fora ({team.awayGames}j)</p>
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
          <span>Temporada 2024/25</span>
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
