'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Radio, CornerUpRight, Clock, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FutureMatchPrediction } from '@/components/FutureMatchPrediction';

interface LiveMatch {
  id: number;
  minute: number | string;
  statusText: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  competition?: string;
  competitionId: number;
  corners?: { home: number; away: number; total: number };
  source?: string;
}

// Competition ID to emoji/flag mapping (365Scores IDs + API-Football IDs)
const COMPETITION_ICONS: Record<number, string> = {
  // 365Scores
  113: '🇧🇷',
  116: '🇧🇷',
  117: '🇧🇷',
  7: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  17: '🇮🇹',
  25: '🇩🇪',
  35: '🇫🇷',
  572: '🏆',
  573: '🏆',
  // API-Football
  71: '🇧🇷',
  72: '🇧🇷',
  73: '🇧🇷',
  2: '🏆',
  3: '🏆',
  848: '🏆',
  39: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  40: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  140: '🇪🇸',
  135: '🇮🇹',
  78: '🇩🇪',
  61: '🇫🇷',
  88: '🇳🇱',
  94: '🇵🇹',
  65: '🇧🇪',
  203: '🇹🇷',
  197: '🇬🇷',
  179: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  128: '🇦🇷',
  13: '🏆',
};

function getOfficialAddedTimePrediction(_match: LiveMatch): { label: string } | null {
  return null;
}

function LiveMatchCard({
  match,
  selected,
  onClick,
}: {
  match: LiveMatch;
  selected?: boolean;
  onClick?: () => void;
}) {
  const icon = COMPETITION_ICONS[match.competitionId] || '⚽';
  const minuteDisplay =
    typeof match.minute === 'number' ? `${match.minute}'` : match.minute || match.statusText;
  const addedTime = getOfficialAddedTimePrediction(match);
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={`p-4 cursor-pointer border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-green-500/5 hover:border-emerald-400/50 transition-all ${
        selected ? 'ring-2 ring-emerald-500/60 border-emerald-400' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
            {match.competition || 'Competição'}
          </span>
        </div>
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1">
          <Radio className="w-3 h-3" style={{ animation: 'livepulse 2s ease-in-out infinite' }} />
          AO VIVO
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-right">
          <p className="font-semibold truncate" title={match.homeTeam.name}>
            {match.homeTeam.name}
          </p>
        </div>
        <div className="flex flex-col items-center px-4">
          <div className="flex items-center gap-2 text-2xl font-bold tabular-nums">
            <span className={match.homeTeam.score > match.awayTeam.score ? 'text-emerald-400' : ''}>
              {match.homeTeam.score}
            </span>
            <span className="text-muted-foreground">-</span>
            <span className={match.awayTeam.score > match.homeTeam.score ? 'text-emerald-400' : ''}>
              {match.awayTeam.score}
            </span>
          </div>
          <Badge
            variant="outline"
            className="mt-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          >
            <Clock className="w-3 h-3 mr-1" />
            {minuteDisplay}
          </Badge>
          {addedTime && (
            <Badge
              variant="outline"
              className="mt-1 bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
              title="Estimativa local baseada em minuto, placar e eventos disponíveis."
            >
              Acréscimo {addedTime.label}
            </Badge>
          )}
        </div>
        <div className="flex-1 text-left">
          <p className="font-semibold truncate" title={match.awayTeam.name}>
            {match.awayTeam.name}
          </p>
        </div>
      </div>

      {match.corners && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-amber-400">
              <CornerUpRight className="w-4 h-4" />
              <span className="font-medium">{match.corners.home}</span>
            </div>
            <span className="text-muted-foreground">Escanteios</span>
            <div className="flex items-center gap-1 text-amber-400">
              <span className="font-medium">{match.corners.away}</span>
              <CornerUpRight className="w-4 h-4 scale-x-[-1]" />
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-1">
            Total: {match.corners.total}
          </p>
        </div>
      )}
    </Card>
  );
}

export function LiveMatches() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedDisplay, setLastUpdatedDisplay] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedCompetition, setSelectedCompetition] = useState('all');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  // fetchTick increments each time a fetch completes — triggers the time update effect
  const [fetchTick, setFetchTick] = useState(0);

  // Update display time client-side only, triggered by fetchTick
  useEffect(() => {
    if (fetchTick === 0) return;
    setLastUpdatedDisplay(
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(Date.now())
    );
  }, [fetchTick]);

  const fetchLiveMatches = useCallback(async () => {
    try {
      setError(null);
      const [scores365Res, sofascoreRes] = await Promise.allSettled([
        fetch('/api/365scores/live'),
        fetch('/api/sofascore-direct/live'),
      ]);

      const allMatches: LiveMatch[] = [];
      const seenKeys = new Set<string>();

      if (scores365Res.status === 'fulfilled' && scores365Res.value.ok) {
        const data = (await scores365Res.value.json()) as { matches?: LiveMatch[] };
        for (const match of data.matches ?? []) {
          const key = `${match.homeTeam.name}-${match.awayTeam.name}`.toLowerCase();
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allMatches.push({ ...match, source: '365scores' });
          }
        }
      }

      if (sofascoreRes.status === 'fulfilled' && sofascoreRes.value.ok) {
        const data = (await sofascoreRes.value.json()) as { matches?: LiveMatch[] };
        for (const match of data.matches ?? []) {
          const key = `${match.homeTeam.name}-${match.awayTeam.name}`.toLowerCase();
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allMatches.push({ ...match, source: 'sofascore' });
          }
        }
      }

      setMatches(allMatches);
      setFetchTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveMatches();
  }, [fetchLiveMatches]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLiveMatches, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLiveMatches]);

  const matchesByCompetition = matches.reduce(
    (acc, match) => {
      const key = match.competition || 'Outras Competições';
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    },
    {} as Record<string, LiveMatch[]>
  );

  const competitionOptions = Object.entries(matchesByCompetition)
    .map(([competition, compMatches]) => ({
      competition,
      count: compMatches.length,
    }))
    .sort((a, b) => b.count - a.count || a.competition.localeCompare(b.competition));

  useEffect(() => {
    if (selectedCompetition !== 'all' && !matchesByCompetition[selectedCompetition]) {
      setSelectedCompetition('all');
    }
  }, [matchesByCompetition, selectedCompetition]);

  useEffect(() => {
    if (selectedMatchId !== null && !matches.some((match) => match.id === selectedMatchId)) {
      setSelectedMatchId(null);
    }
  }, [matches, selectedMatchId]);

  const visibleMatches =
    selectedCompetition === 'all'
      ? matches
      : matches.filter(
          (match) => (match.competition || 'Outras Competições') === selectedCompetition
        );

  const visibleMatchesByCompetition = visibleMatches.reduce(
    (acc, match) => {
      const key = match.competition || 'Outras Competições';
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    },
    {} as Record<string, LiveMatch[]>
  );

  if (loading && matches.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw
            className="w-8 h-8 text-emerald-500"
            style={{ animation: 'livespin 1s linear infinite' }}
          />
          <p className="text-muted-foreground">Buscando jogos ao vivo...</p>
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
            <Button
              onClick={() => {
                setLoading(true);
                fetchLiveMatches();
              }}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio
              className="w-5 h-5 text-red-500"
              style={{ animation: 'livepulse 2s ease-in-out infinite' }}
            />
            <h3 className="text-lg font-semibold">Jogos Ao Vivo</h3>
          </div>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400">
            {visibleMatches.length} {visibleMatches.length === 1 ? 'jogo' : 'jogos'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-emerald-600 hover:bg-emerald-500' : ''}
          >
            {autoRefresh ? 'Auto ✓' : 'Auto'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchLiveMatches();
            }}
            disabled={loading}
          >
            <RefreshCw
              className="w-4 h-4 mr-2"
              style={loading ? { animation: 'livespin 1s linear infinite' } : undefined}
            />
            Atualizar
          </Button>
        </div>
      </div>

      {lastUpdatedDisplay && (
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
          Última atualização: {lastUpdatedDisplay}
          {autoRefresh && ' (atualiza a cada 30s)'}
        </p>
      )}

      {matches.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Filtrar por liga
          </label>
          <select
            value={selectedCompetition}
            onChange={(event) => setSelectedCompetition(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-emerald-500"
          >
            <option value="all">Todas as ligas ({matches.length})</option>
            {competitionOptions.map((option) => (
              <option key={option.competition} value={option.competition}>
                {option.competition} ({option.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {matches.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h4 className="font-medium text-lg mb-2">Nenhum jogo ao vivo no momento</h4>
          <p className="text-sm text-muted-foreground">
            Não há partidas em andamento nas ligas monitoradas.
            <br />
            Os jogos aparecerão aqui automaticamente quando começarem.
          </p>
        </Card>
      ) : visibleMatches.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h4 className="font-medium text-lg mb-2">Nenhum jogo nesta liga agora</h4>
          <p className="text-sm text-muted-foreground">
            Escolha outra liga no filtro ou volte para todas as ligas.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(visibleMatchesByCompetition).map(([competition, compMatches]) => (
            <div key={competition} className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                {competition}
                <Badge variant="outline" className="ml-auto">
                  {compMatches.length}
                </Badge>
              </h4>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {compMatches.map((match) => {
                  const selected = selectedMatchId === match.id;
                  return (
                    <div key={match.id} className="space-y-3">
                      <LiveMatchCard
                        match={match}
                        selected={selected}
                        onClick={() => setSelectedMatchId((current) => (current === match.id ? null : match.id))}
                      />
                      {selected && (
                        <FutureMatchPrediction
                          homeTeam={match.homeTeam.name}
                          awayTeam={match.awayTeam.name}
                          league={match.competition || competition}
                          kickoff="Ao vivo"
                          onClose={() => setSelectedMatchId(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        @keyframes livepulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
        @keyframes livespin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default LiveMatches;
