"use client";

import { useState } from "react";
import { useSofascoreFixtures, formatRelativeDate, SofascoreMatch, SofascoreLeague, LEAGUE_CONFIG } from "../hooks/useSofascore";
import { use365Upcoming, UpcomingMatch, Scores365League } from "../hooks/use365Scores";
import { Calendar, RefreshCw, AlertCircle, Clock } from "lucide-react";
import { getRoundName } from "@/data/internationalFixtures";
import { DateFilterCompact, DateFilterOption, getDateRange } from "./DateFilter";
import { FutureMatchPrediction } from "@/components/FutureMatchPrediction";

// Map Sofascore league keys to 365Scores league keys
const SOFASCORE_TO_365SCORES: Partial<Record<SofascoreLeague, Scores365League>> = {
  // Brasil
  "brasileirao_a": "brasileirao_a",
  "brasileirao_b": "brasileirao_b",
  "copa_do_brasil": "copa_do_brasil",
  // UEFA
  "champions_league": "champions_league",
  "europa_league": "europa_league",
  // Inglaterra
  "premier_league": "premier_league",
  "championship": "championship",
  // Espanha
  "la_liga": "la_liga",
  "segunda_division": "segunda_division",
  // Itália
  "serie_a": "serie_a",
  "serie_b_italy": "serie_b_italy",
  // Alemanha
  "bundesliga": "bundesliga",
  "bundesliga_2": "bundesliga_2",
  // França
  "ligue_1": "ligue_1",
  "ligue_2": "ligue_2",
  // Outros
  "eredivisie": "eredivisie",
  "primeira_liga": "primeira_liga",
  "belgian_pro": "belgian_pro",
  "turkish_super": "turkish_super",
  "greek_super": "greek_super",
  "scottish_prem": "scottish_prem",
  // Sul-América
  "libertadores": "libertadores",
  "sul_americana": "sudamericana",
};

interface SofascoreFixturesProps {
  league?: SofascoreLeague;
  onSelectMatch?: (match: SofascoreMatch) => void;
  dateFilter?: DateFilterOption;
  onDateFilterChange?: (filter: DateFilterOption) => void;
  showDateFilter?: boolean;
}

// Helper to check if a match falls within a date range
function matchInDateRange(match: SofascoreMatch, range: { start: string; end: string } | null): boolean {
  if (!range) return true;
  const matchDate = new Intl.DateTimeFormat('sv-SE', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(match.startTimestamp * 1000));
  return matchDate >= range.start && matchDate <= range.end;
}

export function SofascoreFixtures({ 
  league = "brasileirao_a", 
  onSelectMatch,
  dateFilter = "all",
  onDateFilterChange,
  showDateFilter = false
}: SofascoreFixturesProps) {
  const { fixtures, loading, error, refetch } = useSofascoreFixtures(league);
  const leagueInfo = LEAGUE_CONFIG[league];
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  
  // Fallback para 365Scores API se Sofascore não retornar partidas
  const league365 = SOFASCORE_TO_365SCORES[league] || null;
  const { matches: matches365, loading: loading365 } = use365Upcoming(
    fixtures.length === 0 ? league365 : null
  );
  const useFallback = fixtures.length === 0 && matches365.length > 0;

  if (loading || loading365) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-muted-foreground">Carregando jogos...</p>
        </div>
      </div>
    );
  }

  if (error && !useFallback) {
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

  // Se usamos o fallback, renderizar com dados do 365Scores
  if (useFallback) {
    // Adapter: convert 365Scores match to SofascoreMatch-like object for onSelectMatch
    const handleFallbackSelect = onSelectMatch 
      ? (match: UpcomingMatch) => {
          const fakeMatch = {
            id: match.id,
            homeTeam: { name: match.homeTeam.name, id: match.homeTeam.id, shortName: match.homeTeam.shortName || match.homeTeam.name, slug: match.homeTeam.name.toLowerCase().replace(/\s+/g, '-') },
            awayTeam: { name: match.awayTeam.name, id: match.awayTeam.id, shortName: match.awayTeam.shortName || match.awayTeam.name, slug: match.awayTeam.name.toLowerCase().replace(/\s+/g, '-') },
            startTimestamp: new Date(match.startTime).getTime() / 1000,
            status: { code: 0, description: "Not started", type: "notstarted" },
            tournament: { name: league, slug: league, id: 0, uniqueTournament: { id: 0, name: league, slug: league } },
            season: { name: "2026", year: "2026", id: 0 },
            roundInfo: { round: match.round || 0 }
          } as SofascoreMatch;
          onSelectMatch(fakeMatch);
        }
      : undefined;
    return <Live365Fixtures matches={matches365} league={league} leagueInfo={leagueInfo} onSelectMatch={handleFallbackSelect} />;
  }

  if (fixtures.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum jogo encontrado</p>
      </div>
    );
  }

  // Filter fixtures by date
  const dateRange = getDateRange(dateFilter);
  const filteredFixtures = fixtures.filter(m => matchInDateRange(m, dateRange));

  // Agrupar por rodada
  const groupedMatches = new Map<number, SofascoreMatch[]>();
  for (const match of filteredFixtures) {
    const round = match.roundInfo?.round || 0;
    if (!groupedMatches.has(round)) {
      groupedMatches.set(round, []);
    }
    groupedMatches.get(round)!.push(match);
  }
  const sortedRounds = Array.from(groupedMatches.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{leagueInfo.flag}</span>
          <h3 className="font-semibold">{leagueInfo.name}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {filteredFixtures.length === fixtures.length 
              ? `${fixtures.length} jogos` 
              : `${filteredFixtures.length} de ${fixtures.length} jogos`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showDateFilter && onDateFilterChange && (
            <DateFilterCompact value={dateFilter} onChange={onDateFilterChange} />
          )}
          <button
            onClick={refetch}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* No matches after filter */}
      {filteredFixtures.length === 0 && fixtures.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Nenhum jogo no período selecionado</p>
          {onDateFilterChange && (
            <button 
              onClick={() => onDateFilterChange("all")}
              className="mt-2 text-sm text-emerald-500 hover:text-emerald-400"
            >
              Ver todos os jogos
            </button>
          )}
        </div>
      )}

      {/* Matches grouped by round */}
      {sortedRounds.map((round) => {
        const matches = groupedMatches.get(round) || [];
        
        return (
          <div key={round} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-full">
                {getRoundName(league, round)}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-2">
              {matches.map((match) => (
                <div key={match.id} className="space-y-2">
                  <MatchCard
                    match={match}
                    onClick={() => {
                      onSelectMatch?.(match);
                      setSelectedMatchId((current) => (current === match.id ? null : match.id));
                    }}
                  />
                  {selectedMatchId === match.id && (
                    <FutureMatchPrediction
                      homeTeam={match.homeTeam.name}
                      awayTeam={match.awayTeam.name}
                      league={leagueInfo.name}
                      kickoff={String(match.startTimestamp * 1000)}
                      onClose={() => setSelectedMatchId(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Componente para exibir partidas do 365Scores (dados da API)
interface Live365FixturesProps {
  matches: UpcomingMatch[];
  league: SofascoreLeague;
  leagueInfo: { name: string; flag: string };
  onSelectMatch?: (match: UpcomingMatch) => void;
}

function Live365Fixtures({ matches, league, leagueInfo, onSelectMatch }: Live365FixturesProps) {
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  // Agrupar por rodada
  const groupedMatches = new Map<number, UpcomingMatch[]>();
  for (const match of matches) {
    const round = match.round || 0;
    if (!groupedMatches.has(round)) {
      groupedMatches.set(round, []);
    }
    groupedMatches.get(round)!.push(match);
  }
  const sortedRounds = Array.from(groupedMatches.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{leagueInfo.flag}</span>
          <h3 className="font-semibold">{leagueInfo.name}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {matches.length} jogos
          </span>
          <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            Ao vivo
          </span>
        </div>
      </div>

      {/* Matches grouped by round */}
      {sortedRounds.map((round) => {
        const roundMatches = groupedMatches.get(round) || [];
        
        return (
          <div key={round} className="space-y-3">
            {round > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-full">
                  {getRoundName(league, round)}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            <div className="grid gap-2">
              {roundMatches.map((match) => (
                <div key={match.id} className="space-y-2">
                  <Live365MatchCard
                    match={match}
                    onSelectMatch={(selectedMatch) => {
                      onSelectMatch?.(selectedMatch);
                      setSelectedMatchId((current) =>
                        current === selectedMatch.id ? null : selectedMatch.id
                      );
                    }}
                  />
                  {selectedMatchId === match.id && (
                    <FutureMatchPrediction
                      homeTeam={match.homeTeam.name}
                      awayTeam={match.awayTeam.name}
                      league={leagueInfo.name}
                      kickoff={match.startTime}
                      onClose={() => setSelectedMatchId(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Card de partida para dados do 365Scores
function Live365MatchCard({ match, onSelectMatch }: { 
  match: UpcomingMatch; 
  onSelectMatch?: (match: UpcomingMatch) => void;
}) {
  const matchDate = new Date(match.startTime);
  const timestamp = matchDate.getTime() / 1000;
  const dateInfo = formatRelativeDate(timestamp);

  return (
    <div 
      onClick={() => onSelectMatch?.(match)}
      className={`
        group relative rounded-xl border bg-card p-4 transition-all hover:border-emerald-500/30
        ${onSelectMatch ? "cursor-pointer hover:bg-emerald-500/5" : ""}
        ${dateInfo.isToday ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}
      `}
    >
      {/* Today indicator */}
      {dateInfo.isToday && (
        <div className="absolute top-2 right-2">
          <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">HOJE</span>
        </div>
      )}
      
      {/* Tomorrow indicator */}
      {dateInfo.isTomorrow && (
        <div className="absolute top-2 right-2">
          <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">AMANHÃ</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Home team */}
        <div className="flex-1 text-right">
          <p className="font-medium truncate">{match.homeTeam.name}</p>
          {match.homeTeam.shortName && match.homeTeam.shortName !== match.homeTeam.name && (
            <p className="text-xs text-muted-foreground">{match.homeTeam.shortName}</p>
          )}
        </div>

        {/* Time */}
        <div className="flex-shrink-0 text-center min-w-[100px]">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-lg font-bold text-emerald-500">{dateInfo.time}</span>
            </div>
            <p className={`text-xs ${dateInfo.isToday ? "text-emerald-500 font-medium" : dateInfo.isTomorrow ? "text-amber-500" : "text-muted-foreground"}`}>
              {!dateInfo.isToday && !dateInfo.isTomorrow && `${dateInfo.relative} • `}{dateInfo.date}
            </p>
          </div>
        </div>

        {/* Away team */}
        <div className="flex-1 text-left">
          <p className="font-medium truncate">{match.awayTeam.name}</p>
          {match.awayTeam.shortName && match.awayTeam.shortName !== match.awayTeam.name && (
            <p className="text-xs text-muted-foreground">{match.awayTeam.shortName}</p>
          )}
        </div>
      </div>
    </div>
  );
}



// Card de partida para dados da API
interface MatchCardProps {
  match: SofascoreMatch;
  onClick?: () => void;
}

function MatchCard({ match, onClick }: MatchCardProps) {
  const isLive = match.status.type === "inprogress";
  const isFinished = match.status.type === "finished";
  const dateInfo = formatRelativeDate(match.startTimestamp);

  return (
    <div 
      onClick={onClick}
      className={`
        group relative rounded-xl border bg-card p-4 transition-all
        ${onClick ? "cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5" : ""}
        ${isLive ? "border-red-500/30 bg-red-500/5" : "border-border"}
        ${dateInfo.isToday && !isLive && !isFinished ? "border-emerald-500/30 bg-emerald-500/5" : ""}
        ${dateInfo.isTomorrow && !isLive && !isFinished ? "border-amber-500/30 bg-amber-500/5" : ""}
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
      
      {/* Today indicator */}
      {dateInfo.isToday && !isLive && !isFinished && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">HOJE</span>
        </div>
      )}
      
      {/* Tomorrow indicator */}
      {dateInfo.isTomorrow && !isLive && !isFinished && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">AMANHÃ</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Home team */}
        <div className="flex-1 text-right">
          <p className="font-medium truncate">{match.homeTeam.name}</p>
          <p className="text-xs text-muted-foreground">{match.homeTeam.shortName}</p>
        </div>

        {/* Score or time */}
        <div className="flex-shrink-0 text-center min-w-[120px]">
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
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-lg font-bold text-emerald-500">{dateInfo.time}</span>
              </div>
              <p className={`text-xs ${dateInfo.isToday ? "text-emerald-500 font-medium" : dateInfo.isTomorrow ? "text-amber-500 font-medium" : "text-muted-foreground"}`}>
                {dateInfo.isToday ? dateInfo.dayOfWeek : dateInfo.isTomorrow ? dateInfo.dayOfWeek : `${dateInfo.dayOfWeek} • ${dateInfo.date}`}
              </p>
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
