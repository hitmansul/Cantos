"use client";

import { useState } from 'react';
import { Calendar, RefreshCw, AlertCircle, User, Info, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheSportsDBNextFixtures, type TheSportsDBFixture, formatMatchDate } from '@/hooks/useTheSportsDB';
import { findReferee, getRefereeStatsSummary, type RefereeCardStats } from '@/data/brazilianReferees';
import { FutureMatchPrediction } from '@/components/FutureMatchPrediction';
import { currentUpcomingMatches } from '@/data/currentFixtures';

interface TheSportsDBFixturesProps {
  league: 'brasileirao_a' | 'brasileirao_b' | 'copa_do_brasil';
  onSelectMatch?: (homeTeam: string, awayTeam: string) => void;
}

const LEAGUE_INFO = {
  brasileirao_a: { name: 'Série A', flag: '🇧🇷' },
  brasileirao_b: { name: 'Série B', flag: '🇧🇷' },
  brasileirao_c: { name: 'Série C', flag: '🇧🇷' },
  brasileirao_d: { name: 'Série D', flag: '🇧🇷' },
  copa_do_brasil: { name: 'Copa do Brasil', flag: '🇧🇷' },
};

function toTimestamp(date: string): string {
  return date.includes(' ') ? date.replace(' ', 'T') + ':00' : `${date}T12:00:00`;
}

function localFixturesForLeague(league: TheSportsDBFixturesProps['league']): TheSportsDBFixture[] {
  return currentUpcomingMatches
    .filter((match) => match.leagueKey === league)
    .map((match, index) => ({
      id: `local-${league}-${index}-${match.homeTeam}-${match.awayTeam}`,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeTeamId: '',
      awayTeamId: '',
      homeTeamBadge: null,
      awayTeamBadge: null,
      date: match.date.slice(0, 10),
      time: match.date.includes(' ') ? match.date.slice(11, 16) : '',
      timestamp: toTimestamp(match.date),
      round: match.round || 'Proximos jogos',
      referee: null,
      venue: null,
      status: null,
      homeScore: null,
      awayScore: null,
    }));
}

export function TheSportsDBFixtures({ league, onSelectMatch }: TheSportsDBFixturesProps) {
  const { fixtures, loading, error, refetch } = useTheSportsDBNextFixtures(league);
  const [selectedReferee, setSelectedReferee] = useState<RefereeCardStats | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const leagueInfo = LEAGUE_INFO[league];
  const localFixtures = localFixturesForLeague(league);
  const visibleFixtures = localFixtures.length > 0 ? localFixtures : fixtures;

  if (loading && visibleFixtures.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-muted-foreground">Carregando jogos...</p>
        </div>
      </div>
    );
  }

  if (error && visibleFixtures.length === 0) {
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

  if (visibleFixtures.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum jogo encontrado</p>
      </div>
    );
  }

  // Agrupar por rodada
  const groupedMatches = new Map<string, TheSportsDBFixture[]>();
  for (const match of visibleFixtures) {
    const round = match.round || 'Rodada';
    if (!groupedMatches.has(round)) {
      groupedMatches.set(round, []);
    }
    groupedMatches.get(round)!.push(match);
  }
  const sortedRounds = Array.from(groupedMatches.keys());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{leagueInfo.flag}</span>
          <h3 className="font-semibold">{leagueInfo.name}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {visibleFixtures.length} jogos
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
                {round}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-2">
              {matches.map((match) => (
                <div key={match.id} className="space-y-2">
                  <MatchCardWithReferee
                    match={match}
                    onClick={() => {
                      onSelectMatch?.(match.homeTeam, match.awayTeam);
                      setSelectedMatchId((current) => (current === match.id ? null : match.id));
                    }}
                    onRefereeClick={(referee) => setSelectedReferee(referee)}
                  />
                  {selectedMatchId === match.id && (
                    <FutureMatchPrediction
                      homeTeam={match.homeTeam}
                      awayTeam={match.awayTeam}
                      league={leagueInfo.name}
                      kickoff={match.timestamp}
                      referee={match.referee}
                      onClose={() => setSelectedMatchId(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Referee Stats Modal */}
      {selectedReferee && (
        <RefereeStatsModal 
          referee={selectedReferee} 
          onClose={() => setSelectedReferee(null)} 
        />
      )}
    </div>
  );
}

// Card de partida com informações do árbitro
interface MatchCardWithRefereeProps {
  match: TheSportsDBFixture;
  onClick?: () => void;
  onRefereeClick?: (referee: RefereeCardStats) => void;
}

function MatchCardWithReferee({ match, onClick, onRefereeClick }: MatchCardWithRefereeProps) {
  const formattedDate = formatMatchDate(match.timestamp);
  const referee = match.referee ? findReferee(match.referee) : null;

  return (
    <div 
      className="group relative rounded-xl border border-border bg-card p-4 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5"
    >
      <div 
        onClick={onClick}
        className="flex items-center justify-between gap-4 cursor-pointer"
      >
        {/* Home team */}
        <div className="flex-1 text-right">
          <p className="font-medium truncate">{match.homeTeam}</p>
        </div>

        {/* Time */}
        <div className="flex-shrink-0 text-center min-w-[100px]">
          <p className="text-sm font-medium text-emerald-500">VS</p>
          <p className="text-xs text-muted-foreground">{formattedDate}</p>
        </div>

        {/* Away team */}
        <div className="flex-1 text-left">
          <p className="font-medium truncate">{match.awayTeam}</p>
        </div>
      </div>

      {/* Referee info */}
      {match.referee && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Árbitro:</span>
              <span className="text-sm font-medium">{match.referee}</span>
            </div>
            
            {referee && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefereeClick?.(referee);
                }}
                className="h-7 text-xs gap-1"
              >
                <Info className="w-3 h-3" />
                Ver estatísticas
              </Button>
            )}
          </div>

          {referee && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  referee.tendency === 'strict' ? 'border-red-500/50 text-red-400' :
                  referee.tendency === 'lenient' ? 'border-green-500/50 text-green-400' :
                  'border-yellow-500/50 text-yellow-400'
                }`}
              >
                {referee.tendency === 'strict' ? '🟨 Rigoroso' :
                 referee.tendency === 'lenient' ? '✓ Tolerante' : 
                 '⚖️ Moderado'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {referee.avgCardsPerMatch.toFixed(1)} cartões/jogo
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Modal de estatísticas do árbitro
interface RefereeStatsModalProps {
  referee: RefereeCardStats;
  onClose: () => void;
}

function RefereeStatsModal({ referee, onClose }: RefereeStatsModalProps) {
  const stats = getRefereeStatsSummary(referee);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{referee.name}</h2>
              <p className="text-sm text-muted-foreground">
                {referee.matches} jogos na temporada
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Tendency Badge */}
          <div className="flex items-center gap-3">
            <Badge 
              className={`text-sm px-3 py-1 ${
                referee.tendency === 'strict' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                referee.tendency === 'lenient' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
              }`}
            >
              {referee.tendency === 'strict' ? '🟨 Árbitro Rigoroso' :
               referee.tendency === 'lenient' ? '✓ Árbitro Tolerante' : 
               '⚖️ Árbitro Moderado'}
            </Badge>
          </div>

          {/* Main Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-muted/50">
              <p className="text-2xl font-bold text-yellow-500">{referee.avgYellowPerMatch.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mt-1">Amarelos/jogo</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/50">
              <p className="text-2xl font-bold text-red-500">{referee.avgRedPerMatch.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Vermelhos/jogo</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/50">
              <p className="text-2xl font-bold">{stats.avgCardsPerMatch.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total/jogo</p>
            </div>
          </div>

          {/* Cards by Match State */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              📊 Cartões por Situação do Jogo
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">⬆️</span>
                  <span>Time da casa ganhando</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                    🟨 {(referee.cardsByState.winning.yellow / referee.cardsByState.winning.matches).toFixed(1)}
                  </Badge>
                  <Badge variant="outline" className="text-red-500 border-red-500/30">
                    🟥 {(referee.cardsByState.winning.red / referee.cardsByState.winning.matches).toFixed(2)}
                  </Badge>
                  <span className="text-sm font-medium">{stats.avgCardsWinning}/jogo</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400">➡️</span>
                  <span>Jogo empatado</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                    🟨 {(referee.cardsByState.drawing.yellow / referee.cardsByState.drawing.matches).toFixed(1)}
                  </Badge>
                  <Badge variant="outline" className="text-red-500 border-red-500/30">
                    🟥 {(referee.cardsByState.drawing.red / referee.cardsByState.drawing.matches).toFixed(2)}
                  </Badge>
                  <span className="text-sm font-medium">{stats.avgCardsDrawing}/jogo</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2">
                  <span className="text-red-400">⬇️</span>
                  <span>Time da casa perdendo</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                    🟨 {(referee.cardsByState.losing.yellow / referee.cardsByState.losing.matches).toFixed(1)}
                  </Badge>
                  <Badge variant="outline" className="text-red-500 border-red-500/30">
                    🟥 {(referee.cardsByState.losing.red / referee.cardsByState.losing.matches).toFixed(2)}
                  </Badge>
                  <span className="text-sm font-medium">{stats.avgCardsLosing}/jogo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Half Distribution */}
          <div className="p-4 rounded-xl bg-muted/30">
            <h4 className="text-sm font-medium mb-3">Distribuição por Tempo</h4>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span>1º Tempo</span>
                  <span>{100 - stats.secondHalfPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${100 - stats.secondHalfPct}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span>2º Tempo</span>
                  <span>{stats.secondHalfPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 rounded-full"
                    style={{ width: `${stats.secondHalfPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Matches */}
          <div className="space-y-3">
            <h3 className="font-semibold">Últimos Jogos</h3>
            <div className="space-y-2">
              {referee.recentMatches.slice(0, 5).map((match, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(match.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span>{match.homeTeam} x {match.awayTeam}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      🟨 {match.yellowCards}
                    </Badge>
                    {match.redCards > 0 && (
                      <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">
                        🟥 {match.redCards}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Close Button */}
          <Button onClick={onClose} className="w-full">
            Fechar
          </Button>
        </div>
      </Card>
    </div>
  );
}
