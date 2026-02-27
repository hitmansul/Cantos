import { useMemo } from "react";
import { CornerUpRight, TrendingUp, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { Card } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { Progress } from "@/react-app/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/react-app/components/ui/tooltip";
import {
  calculateMatchPrediction,
  generatePlaceholderOdds,
  findTeamStats,
  type PlaceholderOdds,
} from "@/react-app/data/cornerStats";

interface CornerStatsPanelProps {
  homeTeam: string;
  awayTeam: string;
  league: string;
}

function StatBar({ label, value, maxValue = 100 }: {
  label: string;
  value: number;
  maxValue?: number;
}) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}

function TeamStatsCard({ teamName, isHome }: { teamName: string; isHome: boolean }) {
  const stats = findTeamStats(teamName);
  
  if (!stats) {
    return (
      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            {isHome ? "Casa" : "Fora"}
          </Badge>
          <span className="font-medium truncate">{teamName}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Estatísticas não disponíveis
        </p>
      </div>
    );
  }
  
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className="text-xs">
          {isHome ? "Casa" : "Fora"}
        </Badge>
        <span className="font-medium truncate">{stats.team}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Escanteios/jogo</span>
          <p className="font-bold text-lg text-emerald-400">{stats.avgCornersFor}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Sofridos/jogo</span>
          <p className="font-bold text-lg text-amber-400">{stats.avgCornersAgainst}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Total médio</span>
          <p className="font-bold text-lg">{stats.avgTotalCorners}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">1º escanteio</span>
          <p className="font-bold text-lg">{stats.firstCornerPct}%</p>
        </div>
      </div>
    </div>
  );
}

function PlaceholderOddsTable({ odds }: { 
  odds: PlaceholderOdds[]; 
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Odds Estimadas (Corners)
        </h4>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary" className="text-xs gap-1">
                <AlertTriangle className="w-3 h-3" />
                Placeholder
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Estas são estimativas baseadas em estatísticas históricas, NÃO são odds reais de casas de apostas.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Linha</th>
              <th className="px-3 py-2 text-center font-medium">Mais</th>
              <th className="px-3 py-2 text-center font-medium">Menos</th>
              <th className="px-3 py-2 text-center font-medium">Prob. Over</th>
            </tr>
          </thead>
          <tbody>
            {odds.map((row) => (
              <tr key={row.line} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 font-medium">{row.line}</td>
                <td className="px-3 py-2 text-center">
                  <span className={row.overProb > 50 ? "text-emerald-400 font-bold" : ""}>
                    {row.overOdds.toFixed(2)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={row.underProb > 50 ? "text-emerald-400 font-bold" : ""}>
                    {row.underOdds.toFixed(2)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      row.overProb >= 60 
                        ? "border-emerald-500/50 text-emerald-400" 
                        : row.overProb >= 45 
                          ? "border-amber-500/50 text-amber-400"
                          : "border-red-500/50 text-red-400"
                    }`}
                  >
                    {row.overProb}%
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <p className="text-amber-400 font-medium mb-1">Aviso Importante</p>
          <p>
            Para odds reais de escanteios das casas brasileiras (Bet365, Betano, KTO, Estrela Bet), 
            é necessário uma API paga como OddsPapi (~$245/mês).
          </p>
        </div>
      </div>
    </div>
  );
}

export function CornerStatsPanel({ homeTeam, awayTeam, league }: CornerStatsPanelProps) {
  const prediction = useMemo(() => {
    return calculateMatchPrediction(homeTeam, awayTeam, league);
  }, [homeTeam, awayTeam, league]);
  
  const placeholderOdds = useMemo(() => {
    return prediction ? generatePlaceholderOdds(prediction) : [];
  }, [prediction]);
  
  if (!prediction) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <CornerUpRight className="w-5 h-5 text-primary" />
          Estatísticas de Escanteios
        </h3>
        <Badge 
          variant="outline"
          className={`text-xs ${
            prediction.confidence === "Alta" 
              ? "border-emerald-500/50 text-emerald-400"
              : prediction.confidence === "Média"
                ? "border-amber-500/50 text-amber-400"
                : "border-red-500/50 text-red-400"
          }`}
        >
          Confiança: {prediction.confidence}
        </Badge>
      </div>
      
      {/* Team Stats */}
      <div className="grid grid-cols-2 gap-3">
        <TeamStatsCard teamName={homeTeam} isHome={true} />
        <TeamStatsCard teamName={awayTeam} isHome={false} />
      </div>
      
      {/* Prediction Summary */}
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Previsto</p>
            <p className="text-2xl font-bold text-primary">{prediction.predictedTotal}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Over 9.5</p>
            <p className="text-2xl font-bold">{prediction.over95Prob}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Over 10.5</p>
            <p className="text-2xl font-bold">{prediction.over105Prob}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{homeTeam.split(" ")[0]} 1º</p>
            <p className="text-2xl font-bold">{prediction.homeFirstPct}%</p>
          </div>
        </div>
      </Card>
      
      {/* Probability Bars */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Probabilidades de Over</h4>
        <StatBar label="Over 8.5" value={prediction.over85Prob} />
        <StatBar label="Over 9.5" value={prediction.over95Prob} />
        <StatBar label="Over 10.5" value={prediction.over105Prob} />
      </div>
      
      {/* Placeholder Odds Table */}
      <PlaceholderOddsTable odds={placeholderOdds} />
      
      {/* Data Sources */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" />
          Dados baseados em estatísticas históricas do Brasileirão 2024
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <a 
            href="https://corner-stats.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Corner-Stats.com <ExternalLink className="w-3 h-3" />
          </a>
          <a 
            href="https://www.sofascore.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            SofaScore <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
