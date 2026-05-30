'use client';

import { useState, useEffect } from 'react';
import {
  Trophy,
  Calendar,
  Globe,
  BarChart3,
  Radio,
  Info,
  RefreshCw,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Scores365Standings,
  Scores365UpcomingMatches,
  Scores365Results,
} from '@/components/Scores365Components';
import { FutureMatchPrediction } from '@/components/FutureMatchPrediction';
import { SofascoreCornerStats } from '@/components/SofascoreCornerStats';
import type { Scores365League, UpcomingMatch, MatchResult } from '@/hooks/use365Scores';
import { use365Upcoming, use365Results } from '@/hooks/use365Scores';
import type { SofascoreLeague, SofascoreMatch } from '@/hooks/useSofascore';
import {
  useSofascoreFixtures,
  useSofascoreResults,
  LEAGUE_CONFIG,
  formatRelativeDate,
} from '@/hooks/useSofascore';
import type { SofascoreTournament } from '@/hooks/useSofascoreDirect';

interface Competition {
  key: Scores365League;
  name: string;
  flag: string;
  confederation: string;
  /** Used for the Escanteios tab (SofaScore stats) */
  sofascoreKey?: SofascoreTournament;
  /** Used for Próximos / Resultados via SofaScore. If absent, goes straight to 365Scores */
  sofascoreFixturesKey?: SofascoreLeague;
  description: string;
  accentClass: string;
}

const COMPETITIONS: Competition[] = [
  // UEFA
  {
    key: 'champions_league',
    name: 'Champions League',
    flag: '🏆',
    confederation: 'UEFA',
    sofascoreKey: 'champions_league',
    sofascoreFixturesKey: 'champions_league',
    description: 'A maior competição de clubes do mundo',
    accentClass: 'from-blue-900/30 to-indigo-900/30 border-blue-500/30',
  },
  {
    key: 'europa_league',
    name: 'Europa League',
    flag: '🏅',
    confederation: 'UEFA',
    sofascoreKey: 'europa_league',
    sofascoreFixturesKey: 'europa_league',
    description: 'Segunda competição europeia de clubes',
    accentClass: 'from-orange-900/20 to-amber-900/20 border-orange-500/30',
  },
  {
    key: 'conference_league',
    name: 'Conference League',
    flag: '🥉',
    confederation: 'UEFA',
    sofascoreKey: 'conference_league',
    sofascoreFixturesKey: 'conference_league',
    description: 'Terceira competição europeia de clubes',
    accentClass: 'from-green-900/20 to-emerald-900/20 border-green-500/30',
  },
  {
    key: 'nations_league',
    name: 'Nations League',
    flag: '🏳️',
    confederation: 'UEFA',
    description: 'Competição entre seleções europeias',
    accentClass: 'from-sky-900/20 to-blue-900/20 border-sky-500/30',
  },
  // CONMEBOL — use 365Scores directly for fixtures/results (SofaScore blocks CONMEBOL)
  {
    key: 'libertadores',
    name: 'Copa Libertadores',
    flag: '🏆',
    confederation: 'CONMEBOL',
    sofascoreKey: 'libertadores', // escanteios tab only
    // sofascoreFixturesKey intentionally absent → 365Scores for upcoming/results
    description: 'A maior competição de clubes da América do Sul',
    accentClass: 'from-amber-900/30 to-yellow-900/30 border-amber-500/30',
  },
  {
    key: 'sudamericana',
    name: 'Copa Sul-Americana',
    flag: '🏅',
    confederation: 'CONMEBOL',
    sofascoreKey: 'sul_americana', // escanteios tab only
    // sofascoreFixturesKey intentionally absent → 365Scores for upcoming/results
    description: 'Segunda competição da América do Sul',
    accentClass: 'from-cyan-900/20 to-teal-900/20 border-cyan-500/30',
  },
  {
    key: 'copa_america',
    name: 'Copa América',
    flag: '🌎',
    confederation: 'CONMEBOL',
    description: 'Competição entre seleções das Américas',
    accentClass: 'from-green-900/20 to-lime-900/20 border-green-500/30',
  },
  // FIFA
  {
    key: 'copa_do_mundo',
    name: 'Copa do Mundo 2026',
    flag: '🌍',
    confederation: 'FIFA',
    description: 'O maior torneio de futebol do mundo',
    accentClass: 'from-emerald-900/30 to-green-900/30 border-emerald-500/30',
  },
  // CAF
  {
    key: 'caf_champions',
    name: 'CAF Champions League',
    flag: '🌍',
    confederation: 'CAF',
    description: 'A maior competição de clubes da África',
    accentClass: 'from-red-900/20 to-rose-900/20 border-red-500/30',
  },
  {
    key: 'africa_cup',
    name: 'Copa África das Nações',
    flag: '🌍',
    confederation: 'CAF',
    description: 'Competição entre seleções africanas',
    accentClass: 'from-orange-900/20 to-red-900/20 border-orange-500/30',
  },
  // AFC
  {
    key: 'afc_champions',
    name: 'AFC Champions League',
    flag: '🌏',
    confederation: 'AFC',
    description: 'A maior competição de clubes da Ásia',
    accentClass: 'from-purple-900/20 to-indigo-900/20 border-purple-500/30',
  },
];

const CONFEDERATIONS = ['UEFA', 'CONMEBOL', 'FIFA', 'CAF', 'AFC'];

const CONFEDERATION_INFO: Record<
  string,
  { flag: string; name: string; members: string; color: string }
> = {
  UEFA: { flag: '🇪🇺', name: 'Europa', members: '55 federações', color: 'blue' },
  CONMEBOL: { flag: '🌎', name: 'América do Sul', members: '10 federações', color: 'amber' },
  FIFA: { flag: '🌍', name: 'Mundial', members: '211 federações', color: 'emerald' },
  CAF: { flag: '🌍', name: 'África', members: '54 federações', color: 'red' },
  AFC: { flag: '🌏', name: 'Ásia', members: '47 federações', color: 'purple' },
};

// ── Helper: convert ISO string → unix seconds without new Date() in render ────
function isoToTimestamp(isoString: string): number {
  return Date.parse(isoString) / 1000;
}

// ── Sofascore Match Card (shared by Proximos and Resultados) ──────────────────

function SofascoreMatchCard({
  match,
  isResult,
  onClick,
}: {
  match: SofascoreMatch;
  isResult?: boolean;
  onClick?: () => void;
}) {
  const dateInfo = formatRelativeDate(match.startTimestamp);
  const isLive = match.status.type === 'inprogress';
  const isFinished = match.status.type === 'finished' || isResult;
  const canOpenPrediction = !isLive && !isFinished && !!onClick;

  return (
    <div
      onClick={canOpenPrediction ? onClick : undefined}
      className={`rounded-xl border bg-card p-3 transition-all
        ${isLive ? 'border-red-500/40 bg-red-500/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'}
        ${canOpenPrediction ? 'cursor-pointer' : ''}
      `}
    >
      {isLive && (
        <div className="flex justify-end mb-1">
          <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            AO VIVO
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-right">
          <p className="font-medium text-sm leading-tight truncate">{match.homeTeam.name}</p>
        </div>

        <div className="flex-shrink-0 text-center min-w-[90px]">
          {isFinished || isLive ? (
            <div className="flex items-center justify-center gap-2">
              <span className={`text-xl font-bold ${isLive ? 'text-red-400' : 'text-primary'}`}>
                {match.homeScore?.current ?? 0}
              </span>
              <span className="text-muted-foreground text-sm">–</span>
              <span className={`text-xl font-bold ${isLive ? 'text-red-400' : 'text-primary'}`}>
                {match.awayScore?.current ?? 0}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" />
                <span className="font-bold text-primary">{dateInfo.time}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {dateInfo.isToday ? 'Hoje' : dateInfo.isTomorrow ? 'Amanhã' : dateInfo.date}
              </p>
            </div>
          )}
          {(isFinished || isLive) && (
            <p className="text-xs text-muted-foreground mt-0.5">{dateInfo.date}</p>
          )}
        </div>

        <div className="flex-1 text-left">
          <p className="font-medium text-sm leading-tight truncate">{match.awayTeam.name}</p>
        </div>
      </div>

      {match.roundInfo?.name && (
        <p className="text-center text-xs text-muted-foreground mt-1.5 font-medium">
          {match.roundInfo.name}
        </p>
      )}
    </div>
  );
}

// ── 365Scores match cards (extracted so new Date is not inline in JSX) ────────

function Upcoming365MatchCard({ match, onClick }: { match: UpcomingMatch; onClick?: () => void }) {
  const ts = isoToTimestamp(match.startTime);
  const dateInfo = formatRelativeDate(ts);
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-card p-3 transition-colors ${dateInfo.isToday ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border'} ${onClick ? 'cursor-pointer hover:border-primary/30 hover:bg-muted/30' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-right">
          <p className="font-medium text-sm truncate">{match.homeTeam.name}</p>
        </div>
        <div className="flex-shrink-0 text-center min-w-[90px]">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-primary" />
              <span className="font-bold text-primary" suppressHydrationWarning>
                {dateInfo.time}
              </span>
            </div>
            <p className="text-xs text-muted-foreground" suppressHydrationWarning>
              {dateInfo.isToday ? 'Hoje' : dateInfo.isTomorrow ? 'Amanhã' : dateInfo.date}
            </p>
          </div>
        </div>
        <div className="flex-1 text-left">
          <p className="font-medium text-sm truncate">{match.awayTeam.name}</p>
        </div>
      </div>
    </div>
  );
}

function Result365MatchCard({ match }: { match: MatchResult }) {
  const ts = isoToTimestamp(match.startTime);
  const dateInfo = formatRelativeDate(ts);
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-right">
          <p
            className={`font-medium text-sm truncate ${match.homeTeam.score > match.awayTeam.score ? 'text-primary' : ''}`}
          >
            {match.homeTeam.name}
          </p>
        </div>
        <div className="flex-shrink-0 text-center min-w-[90px]">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl font-bold text-primary">{match.homeTeam.score}</span>
            <span className="text-muted-foreground text-sm">–</span>
            <span className="text-xl font-bold text-primary">{match.awayTeam.score}</span>
          </div>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {dateInfo.date}
          </p>
        </div>
        <div className="flex-1 text-left">
          <p
            className={`font-medium text-sm truncate ${match.awayTeam.score > match.homeTeam.score ? 'text-primary' : ''}`}
          >
            {match.awayTeam.name}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 365Scores upcoming panel ──────────────────────────────────────────────────

function Upcoming365Panel({
  matches,
  config,
}: {
  matches: UpcomingMatch[];
  config: { flag: string; name: string };
}) {
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const grouped = new Map<string, UpcomingMatch[]>();
  for (const m of matches) {
    const key = String(m.roundName || m.round || 'Fase');
    const existing = grouped.get(key) || [];
    existing.push(m);
    grouped.set(key, existing);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-primary">
        <Info className="w-4 h-4" />
        <span>
          {config.flag} {config.name} — {matches.length} jogos
        </span>
        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
          365Scores
        </span>
      </div>
      {Array.from(grouped.entries()).map(([round, roundMatches]) => (
        <div key={round} className="space-y-2">
          {round !== '0' && (
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground px-2 bg-background rounded-full border border-border py-0.5">
                {round}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          {roundMatches.map((m) => (
            <div key={m.id} className="space-y-2">
              <Upcoming365MatchCard
                match={m}
                onClick={() => setSelectedMatchId((current) => (current === m.id ? null : m.id))}
              />
              {selectedMatchId === m.id && (
                <FutureMatchPrediction
                  homeTeam={m.homeTeam.name}
                  awayTeam={m.awayTeam.name}
                  league={config.name}
                  kickoff={m.startTime}
                  onClose={() => setSelectedMatchId(null)}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── 365Scores results panel ───────────────────────────────────────────────────

function Results365Panel({
  matches,
  config,
}: {
  matches: MatchResult[];
  config: { flag: string; name: string };
}) {
  const grouped = new Map<string, MatchResult[]>();
  for (const m of matches) {
    const key = String(m.roundName || m.round || 'Resultados');
    const existing = grouped.get(key) || [];
    existing.push(m);
    grouped.set(key, existing);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-primary">
        <CheckCircle2 className="w-4 h-4" />
        <span>
          {config.flag} {config.name} — {matches.length} resultados
        </span>
        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
          365Scores
        </span>
      </div>
      {Array.from(grouped.entries()).map(([round, roundMatches]) => (
        <div key={round} className="space-y-2">
          {round !== '0' && (
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground px-2 bg-background rounded-full border border-border py-0.5">
                {round}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          {roundMatches.map((m) => (
            <Result365MatchCard key={m.id} match={m} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Sofascore Fixtures Panel (Proximos) with 365Scores fallback ───────────────

function SofascoreProximosPanel({
  league,
  fallback365League,
}: {
  league: SofascoreLeague;
  fallback365League?: Scores365League;
}) {
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const { fixtures, loading, error, refetch } = useSofascoreFixtures(league);
  const config = LEAGUE_CONFIG[league];

  const useFallback = !loading && fixtures.length === 0 && !!fallback365League;
  const {
    matches: matches365,
    loading: loading365,
    error: error365,
  } = use365Upcoming(useFallback ? (fallback365League as Scores365League) : null);

  if (loading || (useFallback && loading365)) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin" />
        Carregando jogos...
      </div>
    );
  }

  if (useFallback && matches365.length > 0) {
    return <Upcoming365Panel matches={matches365} config={config} />;
  }

  if (fixtures.length > 0) {
    const grouped = new Map<string, SofascoreMatch[]>();
    for (const m of fixtures) {
      const key = String(m.roundInfo?.name || m.roundInfo?.round || 'Fase');
      const existing = grouped.get(key) || [];
      existing.push(m);
      grouped.set(key, existing);
    }
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-primary">
            <Info className="w-4 h-4" />
            <span>
              {config.flag} {config.name} — {fixtures.length} jogos
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={refetch}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        {Array.from(grouped.entries()).map(([round, matches]) => (
          <div key={round} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground px-2 bg-background rounded-full border border-border py-0.5">
                {round}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {matches.map((m) => (
              <div key={m.id} className="space-y-2">
                <SofascoreMatchCard
                  match={m}
                  onClick={() => setSelectedMatchId((current) => (current === m.id ? null : m.id))}
                />
                {selectedMatchId === m.id && (
                  <FutureMatchPrediction
                    homeTeam={m.homeTeam.name}
                    awayTeam={m.awayTeam.name}
                    league={config.name}
                    kickoff={String(m.startTimestamp * 1000)}
                    onClose={() => setSelectedMatchId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // No data from either source
  const errorMsg = error || error365;
  return (
    <div className="text-center py-10 text-muted-foreground space-y-3">
      <Calendar className="w-10 h-10 mx-auto opacity-30" />
      <div>
        <p className="font-medium">Nenhum jogo agendado encontrado</p>
        <p className="text-xs mt-1 opacity-70">
          {errorMsg
            ? 'Erro ao carregar dados. Tente novamente.'
            : 'A competição pode estar em pausa, entre fases ou a temporada encerrou.'}
        </p>
        <p className="text-xs mt-1 opacity-50">Fontes consultadas: SofaScore + 365Scores</p>
      </div>
      <Button variant="outline" size="sm" onClick={refetch}>
        <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
      </Button>
    </div>
  );
}

// ── Sofascore Results Panel (Resultados) with 365Scores fallback ──────────────

function SofascoreResultadosPanel({
  league,
  fallback365League,
}: {
  league: SofascoreLeague;
  fallback365League?: Scores365League;
}) {
  const { results, loading, error, refetch } = useSofascoreResults(league);
  const config = LEAGUE_CONFIG[league];

  const useFallback = !loading && results.length === 0 && !!fallback365League;
  const {
    matches: matches365,
    loading: loading365,
    error: error365,
  } = use365Results(useFallback ? (fallback365League as Scores365League) : null);

  if (loading || (useFallback && loading365)) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin" />
        Carregando resultados...
      </div>
    );
  }

  if (useFallback && matches365.length > 0) {
    return <Results365Panel matches={matches365} config={config} />;
  }

  if (results.length > 0) {
    const grouped = new Map<string, SofascoreMatch[]>();
    for (const m of results) {
      const key = String(m.roundInfo?.name || m.roundInfo?.round || 'Resultados');
      const existing = grouped.get(key) || [];
      existing.push(m);
      grouped.set(key, existing);
    }
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {config.flag} {config.name} — {results.length} resultados
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={refetch}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        {Array.from(grouped.entries()).map(([round, matches]) => (
          <div key={round} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground px-2 bg-background rounded-full border border-border py-0.5">
                {round}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {matches.map((m) => (
              <SofascoreMatchCard key={m.id} match={m} isResult />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // No data from either source
  const errorMsg = error || error365;
  return (
    <div className="text-center py-10 text-muted-foreground space-y-3">
      <BarChart3 className="w-10 h-10 mx-auto opacity-30" />
      <div>
        <p className="font-medium">Nenhum resultado disponível</p>
        <p className="text-xs mt-1 opacity-70">
          {errorMsg
            ? 'Erro ao carregar dados. Tente novamente.'
            : 'A temporada pode ter encerrado ou os dados ainda não foram publicados.'}
        </p>
        <p className="text-xs mt-1 opacity-50">Fontes consultadas: SofaScore + 365Scores</p>
      </div>
      <Button variant="outline" size="sm" onClick={refetch}>
        <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
      </Button>
    </div>
  );
}

// ── Standings with fallback to upcoming matches (for knockout) ──────────────

function StandingsWithFallback({ comp }: { comp: Competition }) {
  const [showFallback, setShowFallback] = useState(false);

  return (
    <div>
      {!showFallback ? (
        <Scores365StandingsFallbackWrapper
          league={comp.key}
          onEmpty={() => setShowFallback(true)}
          onHasData={() => {}}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-400 font-medium">Fase Eliminatória</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A competição está em fase de eliminatórias — não há tabela de classificação.
                Mostrando os próximos jogos abaixo.
              </p>
            </div>
          </div>
          {/* Use 365Scores directly for CONMEBOL, SofaScore for others */}
          {comp.sofascoreFixturesKey ? (
            <SofascoreProximosPanel
              league={comp.sofascoreFixturesKey}
              fallback365League={comp.key}
            />
          ) : (
            <Scores365UpcomingMatches league={comp.key} />
          )}
        </div>
      )}
    </div>
  );
}

// Wrapper that detects if 365Scores returns empty standings
function Scores365StandingsFallbackWrapper({
  league,
  onEmpty,
  onHasData,
}: {
  league: Scores365League;
  onEmpty: () => void;
  onHasData: () => void;
}) {
  const [called, setCalled] = useState(false);

  useEffect(() => {
    if (called) return;
    setCalled(true);
    fetch(`/api/365scores/standings/${league}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { standings?: unknown[]; groups?: unknown[] }) => {
        const hasData =
          (data.standings && data.standings.length > 0) || (data.groups && data.groups.length > 0);
        if (hasData) {
          onHasData();
        } else {
          onEmpty();
        }
      })
      .catch(() => onEmpty());
  }, [league, onEmpty, onHasData, called]);

  return <Scores365Standings league={league} />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ContinentalPage() {
  const [selectedComp, setSelectedComp] = useState<Competition>(COMPETITIONS[0]);
  const [activeConfederation, setActiveConfederation] = useState<string>('UEFA');

  const filteredComps = COMPETITIONS.filter((c) => c.confederation === activeConfederation);

  const defaultTab = selectedComp.sofascoreKey ? 'escanteios' : 'tabela';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-6 border border-blue-500/20">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Competições Continentais</h2>
              <p className="text-blue-300 text-sm">Champions, Libertadores, Copa do Mundo e mais</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CONFEDERATIONS.map((conf) => {
              const info = CONFEDERATION_INFO[conf];
              return (
                <Badge
                  key={conf}
                  variant="outline"
                  className="border-white/20 text-white/80 bg-white/5"
                >
                  {info.flag} {conf}
                </Badge>
              );
            })}
          </div>
        </div>
        <div className="absolute inset-0 opacity-5 text-[200px] flex items-center justify-end pr-8 pointer-events-none">
          🌍
        </div>
      </div>

      {/* Confederation Filter */}
      <div className="flex flex-wrap gap-2">
        {CONFEDERATIONS.map((conf) => {
          const info = CONFEDERATION_INFO[conf];
          return (
            <Button
              key={conf}
              size="sm"
              variant={activeConfederation === conf ? 'default' : 'outline'}
              onClick={() => {
                setActiveConfederation(conf);
                const firstComp = COMPETITIONS.find((c) => c.confederation === conf);
                if (firstComp) setSelectedComp(firstComp);
              }}
            >
              {info.flag} {conf}
            </Button>
          );
        })}
      </div>

      {/* Competition Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredComps.map((comp) => (
          <Card
            key={comp.key}
            className={`p-4 cursor-pointer transition-all hover:scale-[1.01] bg-gradient-to-br ${comp.accentClass} ${selectedComp.key === comp.key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedComp(comp)}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{comp.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{comp.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{comp.confederation}</div>
                <div className="text-xs text-muted-foreground mt-1">{comp.description}</div>
                {(comp.sofascoreKey || comp.sofascoreFixturesKey) && (
                  <Badge
                    variant="outline"
                    className="mt-2 text-xs border-emerald-500/40 text-emerald-400"
                  >
                    ✓ Dados ao vivo
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Selected Competition Content */}
      {selectedComp && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <span className="text-3xl">{selectedComp.flag}</span>
            <div>
              <h3 className="text-xl font-bold">{selectedComp.name}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedComp.confederation} • {selectedComp.description}
              </p>
            </div>
          </div>

          <Tabs defaultValue={defaultTab} key={selectedComp.key} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="tabela" className="gap-1.5">
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Tabela</span>
              </TabsTrigger>
              <TabsTrigger value="proximos" className="gap-1.5">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Próximos</span>
              </TabsTrigger>
              <TabsTrigger value="resultados" className="gap-1.5">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Resultados</span>
              </TabsTrigger>
              <TabsTrigger value="escanteios" className="gap-1.5">
                <Radio className="w-4 h-4" />
                <span className="hidden sm:inline">Escanteios</span>
              </TabsTrigger>
            </TabsList>

            {/* ── TABELA ── */}
            <TabsContent value="tabela">
              <Card className="p-4">
                {selectedComp.confederation === 'CONMEBOL' && selectedComp.sofascoreKey ? (
                  <StandingsWithFallback comp={selectedComp} />
                ) : (
                  <Scores365Standings league={selectedComp.key} />
                )}
              </Card>
            </TabsContent>

            {/* ── PRÓXIMOS ── */}
            <TabsContent value="proximos">
              <Card className="p-4">
                {selectedComp.sofascoreFixturesKey ? (
                  <SofascoreProximosPanel
                    league={selectedComp.sofascoreFixturesKey}
                    fallback365League={selectedComp.key}
                  />
                ) : (
                  <Scores365UpcomingMatches league={selectedComp.key} />
                )}
              </Card>
            </TabsContent>

            {/* ── RESULTADOS ── */}
            <TabsContent value="resultados">
              <Card className="p-4">
                {selectedComp.sofascoreFixturesKey ? (
                  <SofascoreResultadosPanel
                    league={selectedComp.sofascoreFixturesKey}
                    fallback365League={selectedComp.key}
                  />
                ) : (
                  <Scores365Results league={selectedComp.key} />
                )}
              </Card>
            </TabsContent>

            {/* ── ESCANTEIOS ── */}
            <TabsContent value="escanteios">
              {selectedComp.sofascoreKey ? (
                <Card className="p-4">
                  <SofascoreCornerStats tournament={selectedComp.sofascoreKey} />
                </Card>
              ) : (
                <Card className="p-8 text-center">
                  <Radio className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <p className="text-muted-foreground font-medium">Estatísticas não disponíveis</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esta competição ainda não tem dados de escanteios integrados.
                  </p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
