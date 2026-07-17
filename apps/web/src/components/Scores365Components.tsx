'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  use365Standings,
  use365Upcoming,
  use365Results,
  Scores365League,
  LEAGUE_CONFIG,
  type TeamStanding,
  type UpcomingMatch,
  type MatchResult,
} from '@/hooks/use365Scores';
import { Loader2, Calendar, Trophy, TrendingUp, BarChart3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FutureMatchPrediction } from '@/components/FutureMatchPrediction';
import { currentUpcomingMatches, type CurrentFixture } from '@/data/currentFixtures';

interface Props {
  league: Scores365League;
  onMatchClick?: (homeTeam: string, awayTeam: string) => void;
}

type UpcomingDisplayMatch = UpcomingMatch & {
  referee?: string | null;
  source?: string;
  dateLabel?: string;
  returnLeg?: CurrentFixture['returnLeg'];
  bracketNote?: string;
};

type GameStat = {
  key: string;
  name: string;
  competitorId?: number;
  categoryName?: string;
  isMajor?: boolean;
  value: string;
  order?: number;
  categoryOrder?: number;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function localFixtureMs(date: string): number {
  const iso = date.includes(' ') ? `${date.replace(' ', 'T')}:00-03:00` : `${date}T12:00:00-03:00`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function localFixtureToUpcoming(match: CurrentFixture, index: number): UpcomingDisplayMatch {
  const ms = localFixtureMs(match.date);
  return {
    id: 900000 + index,
    startTime: ms ? new Date(ms).toISOString() : match.date,
    roundName: match.round,
    homeTeam: { id: 0, name: match.homeTeam },
    awayTeam: { id: 0, name: match.awayTeam },
    referee: match.referee ?? null,
    source: match.source,
    dateLabel: match.dateLabel,
    returnLeg: match.returnLeg,
    bracketNote: match.bracketNote,
  };
}

function StandingsTable({ rows }: { rows: TeamStanding[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-700/30 text-xs uppercase text-gray-400">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Time</th>
            <th className="px-3 py-2 text-center">J</th>
            <th className="px-3 py-2 text-center">V</th>
            <th className="px-3 py-2 text-center">E</th>
            <th className="px-3 py-2 text-center">D</th>
            <th className="px-3 py-2 text-center">SG</th>
            <th className="px-3 py-2 text-center">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {rows.map((team) => (
            <tr key={team.team.id} className="hover:bg-gray-700/30">
              <td className="px-3 py-2 text-gray-400">{team.position}</td>
              <td className="px-3 py-2 font-medium text-white">{team.team.name}</td>
              <td className="px-3 py-2 text-center">{team.played}</td>
              <td className="px-3 py-2 text-center text-green-400">{team.won}</td>
              <td className="px-3 py-2 text-center text-yellow-400">{team.drawn}</td>
              <td className="px-3 py-2 text-center text-red-400">{team.lost}</td>
              <td className="px-3 py-2 text-center">{team.goalDiff > 0 ? '+' : ''}{team.goalDiff}</td>
              <td className="px-3 py-2 text-center font-bold text-emerald-400">{team.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Scores365Standings({ league }: Props) {
  const { standings, groups, loading, error } = use365Standings(league);
  const config = LEAGUE_CONFIG[league];

  if (loading) return <Loading text="Carregando classificação..." />;
  if (error || (standings.length === 0 && groups.length === 0)) {
    return <Empty text={error || 'Classificação não disponível para esta competição'} />;
  }

  if (groups.length > 1) {
    return (
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.name} className="overflow-hidden rounded-xl border border-emerald-500/20 bg-gray-800/50">
            <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-300">
              {group.name}
            </div>
            <StandingsTable rows={group.rows} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-gray-800/50">
      <div className="flex items-center gap-2 border-b border-gray-700 bg-gray-700/50 px-4 py-3">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h3 className="font-semibold text-white">{config.flag} {config.name}</h3>
      </div>
      <StandingsTable rows={standings} />
    </div>
  );
}

export function Scores365UpcomingMatches({ league }: Props) {
  const { matches, loading, error } = use365Upcoming(league);
  const config = LEAGUE_CONFIG[league];
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  const localMatches: UpcomingDisplayMatch[] = currentUpcomingMatches
    .filter((match) => match.leagueKey === league)
    .filter((match) => localFixtureMs(match.date) >= Date.now() - 6 * 60 * 60 * 1000)
    .sort((a, b) => localFixtureMs(a.date) - localFixtureMs(b.date))
    .map(localFixtureToUpcoming);

  const visibleMatches: UpcomingDisplayMatch[] = matches.length > 0 ? matches as UpcomingDisplayMatch[] : localMatches;

  if (loading) return <Loading text="Carregando jogos..." />;
  if ((error || matches.length === 0) && visibleMatches.length === 0) {
    return <Empty text={error || 'Nenhum jogo agendado'} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-gray-300">
        <Calendar className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium">Próximos Jogos — {config.flag} {config.name}</span>
      </div>
      {visibleMatches.map((match) => (
        <div key={match.id} className="space-y-2">
          <button
            type="button"
            onClick={() => setSelectedMatchId((current) => current === match.id ? null : match.id)}
            className="grid w-full grid-cols-[1fr_auto_1fr] items-center rounded-lg border border-transparent bg-gray-800/50 p-3 hover:border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <span className="text-right text-sm font-medium text-white">{match.homeTeam.name}</span>
            <span className="px-4 text-center text-xs text-gray-500">{match.dateLabel ?? formatDate(match.startTime)}<b className="block text-emerald-500">vs</b></span>
            <span className="text-left text-sm font-medium text-white">{match.awayTeam.name}</span>
          </button>
          {selectedMatchId === match.id && (
            <FutureMatchPrediction
              homeTeam={match.homeTeam.name}
              awayTeam={match.awayTeam.name}
              league={config.name}
              kickoff={match.startTime}
              kickoffLabel={match.dateLabel}
              referee={match.referee}
              onClose={() => setSelectedMatchId(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FinishedMatchStats({ match, onClose }: { match: MatchResult; onClose: () => void }) {
  const [statistics, setStatistics] = useState<GameStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/365scores/game-stats?gameId=${match.id}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Falha ao buscar estatísticas');
        if (active) setStatistics(Array.isArray(payload.statistics) ? payload.statistics : []);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Falha ao buscar estatísticas'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [match.id]);

  const rows = useMemo(() => {
    const grouped = new Map<string, { name: string; home: string; away: string; category: string; major: boolean }>();
    for (const stat of statistics) {
      const key = `${stat.name}__${stat.categoryName ?? 'Geral'}`;
      const row = grouped.get(key) ?? {
        name: stat.name,
        home: '-',
        away: '-',
        category: stat.categoryName ?? 'Geral',
        major: Boolean(stat.isMajor),
      };
      if (stat.competitorId === match.homeTeam.id) row.home = stat.value;
      if (stat.competitorId === match.awayTeam.id) row.away = stat.value;
      grouped.set(key, row);
    }
    return [...grouped.values()].sort((a, b) => Number(b.major) - Number(a.major) || a.name.localeCompare(b.name, 'pt-BR'));
  }, [statistics, match]);

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-card/80 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><BarChart3 className="h-4 w-4" /> Estatísticas da partida</p>
          <h4 className="mt-1 font-bold">{match.homeTeam.name} {match.homeTeam.score} x {match.awayTeam.score} {match.awayTeam.name}</h4>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      {loading ? <Loading text="Carregando estatísticas..." /> : error ? <Empty text={error} /> : rows.length === 0 ? (
        <Empty text="A fonte ainda não disponibilizou estatísticas detalhadas para este jogo." />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={`${row.category}-${row.name}`} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border p-3 ${row.major ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-border bg-background/40'}`}>
              <b className="text-right">{row.home}</b>
              <div className="text-center"><div className="text-sm text-muted-foreground">{row.name}</div><div className="text-[10px] text-muted-foreground/70">{row.category}</div></div>
              <b>{row.away}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Scores365Results({ league }: Props) {
  const { matches, loading, error } = use365Results(league);
  const config = LEAGUE_CONFIG[league];
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (loading) return <Loading text="Carregando resultados..." />;
  if (error || matches.length === 0) return <Empty text={error || 'Nenhum resultado disponível'} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-gray-300">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium">Resultados Recentes — {config.flag} {config.name}</span>
      </div>
      {matches.map((match) => (
        <div key={match.id} className="space-y-2">
          <button
            type="button"
            onClick={() => setSelectedId((current) => current === match.id ? null : match.id)}
            className="grid w-full grid-cols-[1fr_auto_1fr] items-center rounded-lg border border-transparent bg-gray-800/50 p-3 hover:border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <span className={`text-right text-sm font-medium ${match.homeTeam.score > match.awayTeam.score ? 'text-emerald-400' : 'text-gray-300'}`}>{match.homeTeam.name}</span>
            <span className="px-4 text-center"><span className="block text-xs text-gray-500">{formatShortDate(match.startTime)}</span><b className="text-lg">{match.homeTeam.score} - {match.awayTeam.score}</b></span>
            <span className={`text-left text-sm font-medium ${match.awayTeam.score > match.homeTeam.score ? 'text-emerald-400' : 'text-gray-300'}`}>{match.awayTeam.name}</span>
          </button>
          {selectedId === match.id && <FinishedMatchStats match={match} onClose={() => setSelectedId(null)} />}
        </div>
      ))}
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /><span className="ml-2 text-gray-400">{text}</span></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-gray-400">{text}</div>;
}
