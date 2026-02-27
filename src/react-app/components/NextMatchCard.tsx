import { Calendar, MapPin, ChevronRight } from "lucide-react";
import { Card } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { type NextMatch, findTeamByName } from "@/react-app/data/teamCornerStats";
import { CompactMatchPrediction } from "@/react-app/components/MatchPrediction";

interface NextMatchCardProps {
  match: NextMatch;
  onSelectMatch?: (homeTeam: string, awayTeam: string) => void;
}

export function NextMatchCard({ match, onSelectMatch }: NextMatchCardProps) {
  const homeTeam = findTeamByName(match.homeTeam);
  const awayTeam = findTeamByName(match.awayTeam);
  
  const matchDate = new Date(match.date);
  const isToday = new Date().toDateString() === matchDate.toDateString();
  const isTomorrow = new Date(Date.now() + 86400000).toDateString() === matchDate.toDateString();
  
  return (
    <Card 
      className="p-4 hover:border-primary/50 transition-colors cursor-pointer group"
      onClick={() => onSelectMatch?.(match.homeTeam, match.awayTeam)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {match.competition}
          </Badge>
          {isToday && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
              Hoje
            </Badge>
          )}
          {isTomorrow && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
              Amanhã
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {matchDate.toLocaleDateString("pt-BR", { 
            day: "2-digit", 
            month: "short"
          })}
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm font-bold">
              {match.homeTeam.charAt(0)}
            </div>
            <div>
              <p className="font-medium">{match.homeTeam}</p>
              {homeTeam && (
                <p className="text-xs text-muted-foreground">
                  {homeTeam.avgCornersHome} escanteios em casa
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="text-center px-3">
          <p className="text-xs text-muted-foreground mb-1">VS</p>
          <MapPin className="w-4 h-4 text-muted-foreground mx-auto" />
        </div>
        
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2 justify-end">
            <div>
              <p className="font-medium">{match.awayTeam}</p>
              {awayTeam && (
                <p className="text-xs text-muted-foreground">
                  {awayTeam.avgCornersAway} escanteios fora
                </p>
              )}
            </div>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm font-bold">
              {match.awayTeam.charAt(0)}
            </div>
          </div>
        </div>
      </div>

      {/* Prediction */}
      <CompactMatchPrediction match={match} />

      {/* Action hint */}
      <div className="flex items-center justify-center gap-1 mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
        <span>Ver estatísticas completas</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </Card>
  );
}
