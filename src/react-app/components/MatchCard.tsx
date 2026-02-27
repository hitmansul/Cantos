import { Card } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { Clock, Calendar } from "lucide-react";
import { EventWithOdds } from "@/react-app/hooks/useOddsApi";

interface MatchCardProps {
  event: EventWithOdds;
  isSelected: boolean;
  isLive: boolean;
  onClick: () => void;
}

export function MatchCard({ event, isSelected, isLive, onClick }: MatchCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getBookmakerCount = () => {
    return event.bookmakers?.length || 0;
  };

  return (
    <Card
      className={`p-4 cursor-pointer transition-all duration-200 hover:bg-accent/50 ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-primary/30"
      }`}
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* League / Sport */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
            {event.sport_title}
          </span>
          {isLive && (
            <Badge
              variant="secondary"
              className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 animate-pulse"
            >
              <span className="w-1 h-1 bg-red-500 rounded-full mr-1" />
              LIVE
            </Badge>
          )}
        </div>

        {/* Teams */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm truncate max-w-[200px]">
              {event.home_team}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm truncate max-w-[200px]">
              {event.away_team}
            </span>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            {isLive ? (
              <Clock className="w-3 h-3" />
            ) : (
              <Calendar className="w-3 h-3" />
            )}
            <span>{formatDate(event.commence_time)}</span>
          </div>
          <span className="text-emerald-400">
            {getBookmakerCount()} casas
          </span>
        </div>
      </div>
    </Card>
  );
}
