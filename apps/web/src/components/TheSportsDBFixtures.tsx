"use client";

import { useState } from 'react';
import { Calendar, RefreshCw, AlertCircle, User, Info, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useTheSportsDBNextFixtures,
  type TheSportsDBFixture,
  formatMatchDate,
} from '@/hooks/useTheSportsDB';
import {
  findReferee,
  getRefereeStatsSummary,
  type RefereeCardStats,
} from '@/data/brazilianReferees';
import { FutureMatchPrediction } from '@/components/FutureMatchPrediction';

interface TheSportsDBFixturesProps {
  league: 'brasileirao_a' | 'brasileirao_b' | 'copa_do_brasil';
  onSelectMatch?: (homeTeam: string, awayTeam: string) => void | boolean;
  onSelectLiveMatch?: (homeTeam: string, awayTeam: string) => void;
}

const LEAGUE_INFO = {
  brasileirao_a: { name: 'Brasileirão Série A', flag: '🇧🇷' },
  brasileirao_b: { name: 'Brasileirão Série B', flag: '🇧🇷' },
  copa_do_brasil: { name: 'Copa do Brasil', flag: '🇧🇷' },
};

function isLiveFixture(match: TheSportsDBFixture): boolean {
  const status = String(match.status ?? '').toLowerCase();
  if (['live', 'ao vivo', 'in play', '1h', '2h', 'ht', 'intervalo'].some((word) => status.includes(word))) {
    return true;
  }

  const hasScore = match.homeScore !== null || match.awayScore !== null;
  const kickoffMs = Date.parse(`${match.timestamp}${match.timestamp.includes('Z') ? '' : '-03:00'}`);
  return hasScore && Number.isFinite(kickoffMs) && Date.now() >= kickoffMs && Date.now() <= kickoffMs + 150 * 60_000;
}

export function TheSportsDBFixtures({
  league,
  onSelectMatch,
  onSelectLiveMatch,
}: TheSportsDBFixturesProps) {
  const { fixtures, loading, error, refetch } = useTheSportsDBNextFixtures(league);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedReferee, setSelectedReferee] = useState<RefereeCardStats | null>(null);
  const leagueInfo = LEAGUE_INFO[league];

  if (loading && fixtures.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-muted-foreground">Carregando jogos...</p>
        </div>
      </div>
    );
  }

  if (error && fixtures.length === 0) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-500">Erro ao carregar jogos</h4>
            <p className="text-sm text-red-400/80 mt-1">{error}</p>
            <button onClick={refetch} className="mt-3 text-sm text-red-400 underline">
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

  const grouped = fixtures.reduce<Record<string, TheSportsDBFixture[]>>((acc, match) => {
    const round = match.round || 'Próximos jogos';
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{leagueInfo.flag}</span>
          <h3 className="font-semibold">{leagueInfo.name}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {fixtures.length} jogos
          </span>
        </div>
        <button onClick={refetch} className="p-2 hover:bg-muted rounded-lg" title="Atualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {Object.entries(grouped).map(([round, matches]) => (
        <div key={round} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-full">
              {round}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-2">
            {matches.map((match) => {
              const live = isLiveFixture(match);
              const referee = match.referee ? findReferee(match.referee) : null;
              return (
                <div key={match.id} className="space-y-2">
                  <div className="rounded-xl border border-border bg-card p-4 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all">
                    {live && (
                      <div className="mb-3 flex justify-center">
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1">
                          <Radio className="w-3 h-3 animate-pulse" /> AO VIVO
                        </Badge>
                      </div>
                    )}

                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-4"
                      onClick={() => {
                        if (live && onSelectLiveMatch) {
                          onSelectLiveMatch(match.homeTeam, match.awayTeam);
                          return;
                        }
                        onSelectMatch?.(match.homeTeam, match.awayTeam);
                        setSelectedMatchId((current) => (current === match.id ? null : match.id));
                      }}
                    >
                      <div className="flex-1 text-right font-medium truncate">{match.homeTeam}</div>
                      <div className="shrink-0 text-center min-w-[110px]">
                        <div className={live ? 'text-red-400 font-semibold' : 'text-emerald-500 font-semibold'}>
                          {live ? 'AO VIVO' : 'VS'}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatMatchDate(match.timestamp)}</div>
                      </div>
                      <div className="flex-1 text-left font-medium truncate">{match.awayTeam}</div>
                    </button>

                    {match.referee && (
                      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Árbitro:</span>
                          <span>{match.referee}</span>
                        </div>
                        {referee && (
                          <Button variant="ghost" size="sm" onClick={() => setSelectedReferee(referee)}>
                            <Info className="w-3 h-3 mr-1" /> Estatísticas
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

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
              );
            })}
          </div>
        </div>
      ))}

      {selectedReferee && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold">{selectedReferee.name}</h4>
              <p className="text-sm text-muted-foreground mt-1">{getRefereeStatsSummary(selectedReferee)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedReferee(null)}>Fechar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
