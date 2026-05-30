"use client";

import { Home, Plane, Target, Shield, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type BrazilianShotStats, calculateAvgShotsLastN } from "@/data/teamShotStats";

interface TeamShotStatsCardProps {
  team: BrazilianShotStats;
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

function StatBar({ label, value, maxValue = 20, color = "primary" }: {
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
        <span className="font-bold">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            color === "emerald" ? "bg-emerald-500" :
            color === "cyan" ? "bg-cyan-500" :
            color === "orange" ? "bg-orange-500" :
            "bg-blue-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function TeamShotStatsCard({ team, lastNGames = 5 }: TeamShotStatsCardProps) {
  const avgLastN = calculateAvgShotsLastN(team, lastNGames);
  
  // Determine team "offensive" badge
  const getOffensiveBadge = () => {
    if (team.avgShots >= 13) return { text: "Ofensivo", color: "bg-emerald-500/20 text-emerald-400" };
    if (team.avgShots >= 11) return { text: "Equilibrado", color: "bg-cyan-500/20 text-cyan-400" };
    return { text: "Conservador", color: "bg-orange-500/20 text-orange-400" };
  };
  
  // Determine accuracy badge
  const getAccuracyBadge = () => {
    if (team.shotAccuracy >= 38) return { text: "Alta Precisão", color: "bg-emerald-500/20 text-emerald-400" };
    if (team.shotAccuracy >= 34) return { text: "Boa Precisão", color: "bg-cyan-500/20 text-cyan-400" };
    return { text: "Baixa Precisão", color: "bg-orange-500/20 text-orange-400" };
  };
  
  const offensive = getOffensiveBadge();
  const accuracy = getAccuracyBadge();
  
  return (
    <Card className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">{team.team}</h3>
          <p className="text-sm text-muted-foreground">{team.league}</p>
        </div>
        <div className="flex gap-2">
          <Badge className={offensive.color}>{offensive.text}</Badge>
          <Badge className={accuracy.color}>{accuracy.text}</Badge>
        </div>
      </div>
      
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatItem 
          label="Média Finalizações" 
          value={team.avgShots.toFixed(1)} 
          icon={Target}
          color="text-cyan-400"
          subtext={`${team.totalShots} total em ${team.gamesPlayed}j`}
        />
        <StatItem 
          label="Chutes no Gol" 
          value={team.avgShotsOnTarget.toFixed(1)} 
          icon={Target}
          color="text-emerald-400"
          subtext={`${team.totalShotsOnTarget} total`}
        />
        <StatItem 
          label="Precisão" 
          value={`${team.shotAccuracy.toFixed(0)}%`} 
          icon={TrendingUp}
          color="text-blue-400"
          subtext="Chutes no gol / Total"
        />
        <StatItem 
          label="Finalizações Sofridas" 
          value={team.avgShotsAgainst.toFixed(1)} 
          icon={Shield}
          color="text-orange-400"
          subtext={`${team.avgShotsOnTargetAgainst.toFixed(1)} no gol`}
        />
      </div>
      
      {/* Casa vs Fora */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Home className="w-4 h-4" /> Casa vs <Plane className="w-4 h-4" /> Fora
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">Em Casa ({team.homeGames}j)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Finalizações:</span>
                <span className="text-cyan-400 font-bold ml-2">{team.avgShotsHome.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">No Gol:</span>
                <span className="text-emerald-400 font-bold ml-2">{team.avgShotsOnTargetHome.toFixed(1)}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">Fora ({team.awayGames}j)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Finalizações:</span>
                <span className="text-cyan-400 font-bold ml-2">{team.avgShotsAway.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">No Gol:</span>
                <span className="text-emerald-400 font-bold ml-2">{team.avgShotsOnTargetAway.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Finalizações totais no jogo */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Target className="w-4 h-4" /> Total no Jogo (Time + Adversário)
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <StatBar label="Finalizações Totais" value={team.avgTotalShots} maxValue={30} color="cyan" />
          <StatBar label="No Gol Total" value={team.avgTotalShotsOnTarget} maxValue={12} color="emerald" />
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
            <span className="text-muted-foreground">Over 20: <strong className="text-foreground">{team.over20ShotsPct.toFixed(0)}%</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-muted-foreground">Over 25: <strong className="text-foreground">{team.over25ShotsPct.toFixed(0)}%</strong></span>
          </div>
        </div>
      </div>
      
      {/* Últimos jogos */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground">
          Últimos {lastNGames} Jogos (Média: {avgLastN.shots.toFixed(1)} fin. / {avgLastN.onTarget.toFixed(1)} no gol)
        </h4>
        <div className="flex gap-2">
          {team.last5Games.slice(0, lastNGames).map((game, idx) => {
            const trend = game.shots >= team.avgShots;
            return (
              <div 
                key={idx}
                className={`flex-1 p-2 rounded-lg text-center ${
                  trend ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-orange-500/10 border border-orange-500/30"
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  {trend ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-orange-400" />
                  )}
                </div>
                <div className="text-lg font-bold text-cyan-400">{game.shots}</div>
                <div className="text-xs text-emerald-400">{game.onTarget} gol</div>
                <div className="text-xs text-muted-foreground mt-1">vs {game.against}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// Compact version for comparison view
interface TeamShotStatsCompactProps {
  team: BrazilianShotStats;
  variant?: 'home' | 'away';
}

export function TeamShotStatsCompact({ team, variant }: TeamShotStatsCompactProps) {
  const bgColor = variant === 'home' ? 'bg-blue-900/20 border-blue-700/30' : 
                  variant === 'away' ? 'bg-purple-900/20 border-purple-700/30' : 
                  'bg-slate-800/50 border-slate-700';

  return (
    <div className={`rounded-lg p-4 border ${bgColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-cyan-400" />
        <span className="font-semibold text-white">{team.team}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-slate-400 text-xs">Média Finalizações</div>
          <div className="text-xl font-bold text-cyan-400">{team.avgShots.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">No Gol / Precisão</div>
          <div className="text-lg font-medium">
            <span className="text-emerald-400">{team.avgShotsOnTarget.toFixed(1)}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="text-white">{team.shotAccuracy.toFixed(0)}%</span>
          </div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Em Casa</div>
          <div className="text-blue-400 font-medium">{team.avgShotsHome.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Fora</div>
          <div className="text-purple-400 font-medium">{team.avgShotsAway.toFixed(1)}</div>
        </div>
      </div>

      {/* Defensive indicator */}
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="text-xs text-slate-400 mb-2">Finalizações Sofridas</div>
        <div className="flex gap-2 text-xs">
          <span className="bg-orange-900/30 text-orange-400 px-2 py-1 rounded">
            {team.avgShotsAgainst.toFixed(1)}/jogo
          </span>
          <span className="bg-red-900/30 text-red-400 px-2 py-1 rounded">
            {team.avgShotsOnTargetAgainst.toFixed(1)} no gol
          </span>
        </div>
      </div>
    </div>
  );
}
