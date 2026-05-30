"use client";

import { Home, Plane, TrendingUp, TrendingDown, Minus, Clock, CreditCard, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { type TeamCardStats, calculateAvgCardsLastN } from "@/data/teamCardStats";

interface TeamCardStatsCardProps {
  team: TeamCardStats;
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

function StatBar({ label, value, maxValue = 5, color = "primary" }: {
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
            "bg-yellow-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function TeamCardStatsCard({ team, lastNGames = 5 }: TeamCardStatsCardProps) {
  const avgLastN = calculateAvgCardsLastN(team, lastNGames);
  
  // Determine team "discipline" badge
  const getDisciplineBadge = () => {
    if (team.avgCardsPerMatch <= 2.0) return { text: "Disciplinado", color: "bg-emerald-500/20 text-emerald-400" };
    if (team.avgCardsPerMatch <= 2.8) return { text: "Moderado", color: "bg-amber-500/20 text-amber-400" };
    return { text: "Indisciplinado", color: "bg-red-500/20 text-red-400" };
  };
  
  const discipline = getDisciplineBadge();
  
  return (
    <Card className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500 to-red-500 flex items-center justify-center text-2xl font-bold text-white">
          {team.team.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{team.team}</h2>
          <p className="text-sm text-muted-foreground">Estatísticas de Cartões</p>
        </div>
        <Badge className={discipline.color}>
          {discipline.text}
        </Badge>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatItem 
          label="Média amarelos" 
          value={team.avgYellowPerMatch}
          icon={CreditCard}
          color="text-yellow-400"
          subtext="por jogo"
        />
        <StatItem 
          label="Em casa" 
          value={team.avgYellowHome}
          icon={Home}
          color="text-emerald-400"
          subtext={`${team.homeGames} jogos`}
        />
        <StatItem 
          label="Fora" 
          value={team.avgYellowAway}
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

      {/* Red Cards Summary */}
      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-sm text-muted-foreground">Cartões vermelhos</p>
            <p className="font-bold text-red-400">{team.totalRedCards} em {team.gamesPlayed} jogos</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-red-400">{team.avgRedPerMatch}/jogo</p>
      </div>

      {/* By Situation */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Por situação no jogo
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Ganhando</p>
            <p className="text-xl font-bold text-emerald-400">{team.avgCardsWinning}</p>
            <p className="text-[10px] text-muted-foreground">{team.cardsWinning.matches} jogos</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <Minus className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Empatando</p>
            <p className="text-xl font-bold text-amber-400">{team.avgCardsDrawing}</p>
            <p className="text-[10px] text-muted-foreground">{team.cardsDrawing.matches} jogos</p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <TrendingDown className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Perdendo</p>
            <p className="text-xl font-bold text-red-400">{team.avgCardsLosing}</p>
            <p className="text-[10px] text-muted-foreground">{team.cardsLosing.matches} jogos</p>
          </div>
        </div>
      </div>

      {/* By Half */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Por tempo</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatBar label="1º Tempo" value={team.firstHalfCards / team.gamesPlayed} color="primary" />
          <StatBar label="2º Tempo" value={team.secondHalfCards / team.gamesPlayed} color="red" />
        </div>
      </div>

      {/* Last 5 Games */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Últimos 5 jogos</h3>
        <div className="flex gap-2">
          {team.last5Games.map((game, i) => {
            const total = game.yellow + game.red;
            return (
              <div 
                key={i}
                className={`flex-1 p-2 rounded-lg text-center border ${
                  total <= 2 
                    ? "bg-emerald-500/10 border-emerald-500/30" 
                    : total <= 3 
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-red-500/10 border-red-500/30"
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-yellow-400 font-bold">{game.yellow}</span>
                  {game.red > 0 && (
                    <>
                      <span className="text-muted-foreground">+</span>
                      <span className="text-red-400 font-bold">{game.red}</span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">J{i + 1}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Over Percentages */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Probabilidade de Over (cartões totais)</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Over 2.5</span>
            <div className="flex items-center gap-2">
              <Progress value={team.over25CardsPct} className="w-24 h-2" />
              <span className="text-sm font-bold w-12 text-right">{team.over25CardsPct}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Over 3.5</span>
            <div className="flex items-center gap-2">
              <Progress value={team.over35CardsPct} className="w-24 h-2" />
              <span className="text-sm font-bold w-12 text-right">{team.over35CardsPct}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Over 4.5</span>
            <div className="flex items-center gap-2">
              <Progress value={team.over45CardsPct} className="w-24 h-2" />
              <span className="text-sm font-bold w-12 text-right">{team.over45CardsPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Total Cards Summary */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-red-500/10 border border-yellow-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total em {team.gamesPlayed} jogos</p>
            <p className="text-lg font-bold">
              <span className="text-yellow-400">{team.totalYellowCards} amarelos</span>
              {team.totalRedCards > 0 && (
                <span className="text-red-400"> + {team.totalRedCards} vermelhos</span>
              )}
            </p>
          </div>
          <div className="text-3xl font-bold text-yellow-400">{team.avgCardsPerMatch}/jogo</div>
        </div>
      </div>
    </Card>
  );
}
