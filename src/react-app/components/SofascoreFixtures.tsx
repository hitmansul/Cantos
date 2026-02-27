import { useSofascoreFixtures, formatSofascoreDate, groupMatchesByRound, SofascoreMatch } from "../hooks/useSofascore";
import { Calendar, RefreshCw, AlertCircle, Trophy } from "lucide-react";

interface SofascoreFixturesProps {
  league?: "brasileirao_a" | "brasileirao_b";
  onSelectMatch?: (match: SofascoreMatch) => void;
}

export function SofascoreFixtures({ league = "brasileirao_a", onSelectMatch }: SofascoreFixturesProps) {
  const { fixtures, loading, error, refetch } = useSofascoreFixtures(league);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-muted-foreground">Carregando jogos do Sofascore...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-500">Erro ao carregar jogos</h4>
            <p className="text-sm text-red-400/80 mt-1">{error}</p>
            <button 
              onClick={refetch}
              className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (fixtures.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum jogo encontrado</p>
      </div>
    );
  }

  const groupedMatches = groupMatchesByRound(fixtures);
  const sortedRounds = Array.from(groupedMatches.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold">
            {league === "brasileirao_a" ? "Brasileirão Série A" : "Brasileirão Série B"}
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {fixtures.length} jogos
          </span>
        </div>
        <button
          onClick={refetch}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Matches grouped by round */}
      {sortedRounds.map((round) => {
        const matches = groupedMatches.get(round) || [];
        
        return (
          <div key={round} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-full">
                Rodada {round}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-2">
              {matches.map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  onClick={() => onSelectMatch?.(match)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface MatchCardProps {
  match: SofascoreMatch;
  onClick?: () => void;
}

function MatchCard({ match, onClick }: MatchCardProps) {
  const isLive = match.status.type === "inprogress";
  const isFinished = match.status.type === "finished";
  const formattedDate = formatSofascoreDate(match.startTimestamp);

  return (
    <div 
      onClick={onClick}
      className={`
        group relative rounded-xl border bg-card p-4 transition-all
        ${onClick ? "cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5" : ""}
        ${isLive ? "border-red-500/30 bg-red-500/5" : "border-border"}
      `}
    >
      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-xs font-medium text-red-500">AO VIVO</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Home team */}
        <div className="flex-1 text-right">
          <p className="font-medium truncate">{match.homeTeam.name}</p>
          <p className="text-xs text-muted-foreground">{match.homeTeam.shortName}</p>
        </div>

        {/* Score or time */}
        <div className="flex-shrink-0 text-center min-w-[80px]">
          {isFinished || isLive ? (
            <div className="flex items-center justify-center gap-2">
              <span className={`text-xl font-bold ${isLive ? "text-red-500" : ""}`}>
                {match.homeScore?.current ?? 0}
              </span>
              <span className="text-muted-foreground">-</span>
              <span className={`text-xl font-bold ${isLive ? "text-red-500" : ""}`}>
                {match.awayScore?.current ?? 0}
              </span>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-emerald-500">VS</p>
              <p className="text-xs text-muted-foreground">{formattedDate}</p>
            </div>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 text-left">
          <p className="font-medium truncate">{match.awayTeam.name}</p>
          <p className="text-xs text-muted-foreground">{match.awayTeam.shortName}</p>
        </div>
      </div>

      {/* Status indicator for finished matches */}
      {isFinished && (
        <div className="mt-2 pt-2 border-t border-border/50 text-center">
          <span className="text-xs text-muted-foreground">Encerrado</span>
        </div>
      )}
    </div>
  );
}
