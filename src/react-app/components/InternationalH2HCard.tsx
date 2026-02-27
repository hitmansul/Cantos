import { Swords, Calendar, CornerUpRight, Trophy, TrendingUp } from "lucide-react";
import { Card } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import type { H2HResponse } from "@/shared/footballDataTypes";

interface InternationalH2HCardProps {
  h2h: H2HResponse;
}

export function InternationalH2HCard({ h2h }: InternationalH2HCardProps) {
  const { stats, matches, team1, team2, league } = h2h;
  
  if (stats.totalMatches === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Swords className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold">Confronto Direto</h3>
            <p className="text-sm text-muted-foreground">
              {team1} vs {team2}
            </p>
          </div>
        </div>
        <p className="text-muted-foreground text-center py-8">
          Não há confrontos diretos registrados entre {team1} e {team2} nesta temporada.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
          <Swords className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold">Confronto Direto</h3>
          <p className="text-sm text-muted-foreground">
            {team1} vs {team2}
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          {league.flag} {stats.totalMatches} jogos
        </Badge>
      </div>

      {/* Average Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
          <p className="text-xs text-muted-foreground mb-1">Média Total</p>
          <p className="text-2xl font-bold text-primary">{stats.avgTotalCorners}</p>
          <p className="text-xs text-muted-foreground">escanteios</p>
        </div>
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-xs text-muted-foreground mb-1 truncate">{team1.split(" ")[0]}</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.avgTeam1Corners}</p>
          <p className="text-xs text-muted-foreground">média</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-xs text-muted-foreground mb-1 truncate">{team2.split(" ")[0]}</p>
          <p className="text-2xl font-bold text-amber-400">{stats.avgTeam2Corners}</p>
          <p className="text-xs text-muted-foreground">média</p>
        </div>
      </div>

      {/* Win/Draw/Loss Record */}
      <div className="flex items-center justify-center gap-4 p-3 rounded-lg bg-muted/20 border border-border/30">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-emerald-400" />
          <span className="text-sm">
            <span className="font-bold text-emerald-400">{stats.team1Wins}</span>
            <span className="text-muted-foreground ml-1">{team1.split(" ")[0]}</span>
          </span>
        </div>
        <div className="text-sm">
          <span className="font-bold text-muted-foreground">{stats.draws}</span>
          <span className="text-muted-foreground ml-1">empates</span>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-sm">
            <span className="font-bold text-amber-400">{stats.team2Wins}</span>
            <span className="text-muted-foreground ml-1">{team2.split(" ")[0]}</span>
          </span>
        </div>
      </div>

      {/* Over/Under Percentages */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-muted/20 text-center">
          <p className="text-xs text-muted-foreground">Over 8.5</p>
          <p className={`font-bold ${stats.over85Pct >= 70 ? 'text-emerald-400' : stats.over85Pct >= 50 ? 'text-amber-400' : 'text-muted-foreground'}`}>
            {stats.over85Pct}%
          </p>
        </div>
        <div className="p-2 rounded-lg bg-muted/20 text-center">
          <p className="text-xs text-muted-foreground">Over 9.5</p>
          <p className={`font-bold ${stats.over95Pct >= 60 ? 'text-emerald-400' : stats.over95Pct >= 40 ? 'text-amber-400' : 'text-muted-foreground'}`}>
            {stats.over95Pct}%
          </p>
        </div>
        <div className="p-2 rounded-lg bg-muted/20 text-center">
          <p className="text-xs text-muted-foreground">Over 10.5</p>
          <p className={`font-bold ${stats.over105Pct >= 50 ? 'text-emerald-400' : stats.over105Pct >= 30 ? 'text-amber-400' : 'text-muted-foreground'}`}>
            {stats.over105Pct}%
          </p>
        </div>
      </div>

      {/* Match History */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Histórico de jogos
        </h4>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {matches.map((match, i) => (
            <div 
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[70px]">
                <Calendar className="w-3 h-3" />
                {formatDate(match.date)}
              </div>
              <div className="flex-1 flex items-center justify-center gap-2 text-sm">
                <span className={`font-medium ${match.result === 'H' ? 'text-emerald-400' : ''}`}>
                  {match.homeTeam.length > 12 ? match.homeTeam.substring(0, 12) + '...' : match.homeTeam}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {match.homeGoals} - {match.awayGoals}
                </Badge>
                <span className={`font-medium ${match.result === 'A' ? 'text-emerald-400' : ''}`}>
                  {match.awayTeam.length > 12 ? match.awayTeam.substring(0, 12) + '...' : match.awayTeam}
                </span>
              </div>
              <div className="flex items-center gap-1 min-w-[60px] justify-end">
                <CornerUpRight className="w-3 h-3 text-primary" />
                <span className={`font-bold ${
                  match.totalCorners >= 11 
                    ? "text-emerald-400" 
                    : match.totalCorners >= 9 
                      ? "text-amber-400"
                      : "text-muted-foreground"
                }`}>
                  {match.totalCorners}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({match.homeCorners}-{match.awayCorners})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
        <p className="text-sm">
          <span className="font-medium">Análise: </span>
          {stats.avgTotalCorners >= 11 ? (
            <span className="text-emerald-400">
              Confronto com alto número de escanteios. Over 10.5 frequente ({stats.over105Pct}%).
            </span>
          ) : stats.avgTotalCorners >= 9.5 ? (
            <span className="text-amber-400">
              Confronto equilibrado. Over 9.5 sai em {stats.over95Pct}% dos jogos.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Confronto com poucos escanteios. Média de {stats.avgTotalCorners} por jogo.
            </span>
          )}
        </p>
      </div>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0];
    const month = parts[1];
    const year = parts[2].length === 2 ? parts[2] : parts[2].slice(-2);
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}
