import { Swords, Calendar, CornerUpRight } from "lucide-react";
import { Card } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { type HeadToHead } from "@/react-app/data/teamCornerStats";

interface HeadToHeadCardProps {
  h2h: HeadToHead;
}

export function HeadToHeadCard({ h2h }: HeadToHeadCardProps) {
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
            {h2h.homeTeam} vs {h2h.awayTeam}
          </p>
        </div>
        <Badge variant="secondary">{h2h.matches.length} jogos</Badge>
      </div>

      {/* Average Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
          <p className="text-xs text-muted-foreground mb-1">Média Total</p>
          <p className="text-2xl font-bold text-primary">{h2h.avgTotalCorners}</p>
          <p className="text-xs text-muted-foreground">escanteios</p>
        </div>
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-xs text-muted-foreground mb-1">{h2h.homeTeam.split(" ")[0]}</p>
          <p className="text-2xl font-bold text-emerald-400">{h2h.avgHomeCorners}</p>
          <p className="text-xs text-muted-foreground">média</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-xs text-muted-foreground mb-1">{h2h.awayTeam.split(" ")[0]}</p>
          <p className="text-2xl font-bold text-amber-400">{h2h.avgAwayCorners}</p>
          <p className="text-xs text-muted-foreground">média</p>
        </div>
      </div>

      {/* Match History */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Histórico de jogos</h4>
        <div className="space-y-2">
          {h2h.matches.map((match, i) => (
            <div 
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30"
            >
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {new Date(match.date).toLocaleDateString("pt-BR", { 
                  day: "2-digit", 
                  month: "short",
                  year: "2-digit"
                })}
              </div>
              <div className="flex-1 flex items-center justify-center gap-2 text-sm">
                <span className="font-medium">{h2h.homeTeam.split(" ")[0]}</span>
                <Badge variant="outline" className="font-mono">
                  {match.homeScore} - {match.awayScore}
                </Badge>
                <span className="font-medium">{h2h.awayTeam.split(" ")[0]}</span>
              </div>
              <div className="flex items-center gap-1">
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
          {h2h.avgTotalCorners >= 11 ? (
            <span className="text-emerald-400">
              Confronto com alto número de escanteios. Over 10.5 frequente.
            </span>
          ) : h2h.avgTotalCorners >= 9.5 ? (
            <span className="text-amber-400">
              Confronto equilibrado. Over 9.5 costuma sair.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Confronto com poucos escanteios historicamente.
            </span>
          )}
        </p>
      </div>
    </Card>
  );
}
