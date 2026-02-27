import { Home, Plane, TrendingUp, TrendingDown, Minus, Clock, Target, CornerUpRight } from "lucide-react";
import { Card } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { Progress } from "@/react-app/components/ui/progress";
import { type DetailedTeamStats, calculateAvgLastNGames } from "@/react-app/data/teamCornerStats";

interface TeamStatsCardProps {
  team: DetailedTeamStats;
  lastNGames?: number;
}

function StatItem({ 
  label, 
  value, 
  icon: Icon, 
  color = "text-foreground",
  subtext
}: { 
  label: string; 
  value: string | number; 
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
  subtext?: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className={`w-4 h-4 ${color}`} />}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
    </div>
  );
}

function StatBar({ label, value, maxValue = 8, color = "primary" }: {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
}) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            color === "emerald" ? "bg-emerald-500" :
            color === "amber" ? "bg-amber-500" :
            color === "red" ? "bg-red-500" :
            "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function TeamStatsCard({ team, lastNGames = 5 }: TeamStatsCardProps) {
  const avgLastN = calculateAvgLastNGames(team, lastNGames);
  
  return (
    <Card className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-primary-foreground">
          {team.team.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{team.team}</h2>
          <p className="text-sm text-muted-foreground">{team.league}</p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {team.gamesPlayed} jogos
        </Badge>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatItem 
          label="Média geral" 
          value={team.avgCornersFor}
          icon={CornerUpRight}
          color="text-primary"
          subtext="escanteios/jogo"
        />
        <StatItem 
          label="Em casa" 
          value={team.avgCornersHome}
          icon={Home}
          color="text-emerald-400"
          subtext={`${team.homeGames} jogos`}
        />
        <StatItem 
          label="Fora" 
          value={team.avgCornersAway}
          icon={Plane}
          color="text-amber-400"
          subtext={`${team.awayGames} jogos`}
        />
        <StatItem 
          label={`Últimos ${lastNGames}`}
          value={avgLastN}
          icon={Clock}
          color="text-blue-400"
          subtext="jogos recentes"
        />
      </div>

      {/* By Situation */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Target className="w-4 h-4" />
          Por situação no jogo
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Ganhando</p>
            <p className="text-xl font-bold text-emerald-400">{team.avgCornersWinning}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <Minus className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Empatando</p>
            <p className="text-xl font-bold text-amber-400">{team.avgCornersDrawing}</p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <TrendingDown className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Perdendo</p>
            <p className="text-xl font-bold text-red-400">{team.avgCornersLosing}</p>
          </div>
        </div>
      </div>

      {/* By Half */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Por tempo</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatBar label="1º Tempo" value={team.avgCornersFirstHalf} color="primary" />
          <StatBar label="2º Tempo" value={team.avgCornersSecondHalf} color="emerald" />
        </div>
      </div>

      {/* Last 5 Games */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Últimos 5 jogos</h3>
        <div className="flex gap-2">
          {team.last5Games.map((corners, i) => (
            <div 
              key={i}
              className={`flex-1 p-2 rounded-lg text-center border ${
                corners >= 6 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                  : corners >= 4 
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              <p className="text-lg font-bold">{corners}</p>
              <p className="text-[10px] text-muted-foreground">J{i + 1}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Over Percentages */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Probabilidade de Over</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Over 8.5</span>
            <div className="flex items-center gap-2">
              <Progress value={team.over85Pct} className="w-24 h-2" />
              <span className="text-sm font-bold w-12 text-right">{team.over85Pct}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Over 9.5</span>
            <div className="flex items-center gap-2">
              <Progress value={team.over95Pct} className="w-24 h-2" />
              <span className="text-sm font-bold w-12 text-right">{team.over95Pct}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Over 10.5</span>
            <div className="flex items-center gap-2">
              <Progress value={team.over105Pct} className="w-24 h-2" />
              <span className="text-sm font-bold w-12 text-right">{team.over105Pct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* First Corner */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Primeiro escanteio do jogo</p>
            <p className="text-lg font-bold">{team.team} bate primeiro</p>
          </div>
          <div className="text-3xl font-bold text-primary">{team.firstCornerPct}%</div>
        </div>
      </div>
    </Card>
  );
}
