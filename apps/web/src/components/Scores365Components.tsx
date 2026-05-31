'use client';

import { useState } from 'react';
import {
  use365Standings,
  use365Upcoming,
  use365Results,
  Scores365League,
  LEAGUE_CONFIG,
  type TeamStanding,
  type UpcomingMatch,
} from '@/hooks/use365Scores';
import { Loader2, Calendar, Trophy, TrendingUp } from 'lucide-react';
import { FutureMatchPrediction } from '@/components/FutureMatchPrediction';
import { currentUpcomingMatches, type CurrentFixture } from '@/data/currentFixtures';

interface Props {
  league: Scores365League;
  onMatchClick?: (homeTeam: string, awayTeam: string) => void;
}

function formatDate(dateStr: string): string {
  // Parse ISO string safely without new Date() to avoid hydration issues
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(dateStr);
  if (!match) return dateStr;
  const [, , month, day, utcH, min] = match;
  const brtH = (parseInt(utcH, 10) - 3 + 24) % 24;
  return `${day}/${month} ${String(brtH).padStart(2, '0')}:${min}`;
}

function formatShortDate(dateStr: string): string {
  // Parse ISO string safely without new Date() to avoid hydration issues
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return dateStr;
  const [, , month, day] = match;
  return `${day}/${month}`;
}

type UpcomingDisplayMatch = UpcomingMatch & {
  referee?: string | null;
  source?: string;
  dateLabel?: string;
  returnLeg?: CurrentFixture['returnLeg'];
  bracketNote?: string;
};

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

function FormBadge({ result }: { result: number }) {
  const colors = {
    1: 'bg-green-500', // Win
    2: 'bg-yellow-500', // Draw
    0: 'bg-red-500', // Loss
  };
  const labels = { 1: 'V', 2: 'E', 0: 'D' };
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white rounded ${colors[result as keyof typeof colors] || 'bg-gray-500'}`}
    >
      {labels[result as keyof typeof labels] || '?'}
    </span>
  );
}

function StandingsTable({ rows, totalTeams }: { rows: TeamStanding[]; totalTeams: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-700/30 text-gray-400 text-xs uppercase">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Time</th>
            <th className="px-3 py-2 text-center">J</th>
            <th className="px-3 py-2 text-center">V</th>
            <th className="px-3 py-2 text-center">E</th>
            <th className="px-3 py-2 text-center">D</th>
            <th className="px-3 py-2 text-center">GP</th>
            <th className="px-3 py-2 text-center">GC</th>
            <th className="px-3 py-2 text-center">SG</th>
            <th className="px-3 py-2 text-center font-bold">Pts</th>
            <th className="px-3 py-2 text-center hidden md:table-cell">Forma</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {rows.map((team) => (
            <tr
              key={team.team.id}
              className={`hover:bg-gray-700/30 transition-colors ${
                team.position <= 2
                  ? 'border-l-2 border-l-green-500'
                  : team.position <= 4
                    ? 'border-l-2 border-l-blue-500'
                    : team.position > totalTeams - 3
                      ? 'border-l-2 border-l-red-500'
                      : ''
              }`}
            >
              <td className="px-3 py-2 text-gray-400 font-mono">{team.position}</td>
              <td className="px-3 py-2 text-white font-medium">
                <span className="hidden sm:inline">{team.team.name}</span>
                <span className="sm:hidden">
                  {team.team.shortName || team.team.name.slice(0, 3).toUpperCase()}
                </span>
              </td>
              <td className="px-3 py-2 text-center text-gray-300">{team.played}</td>
              <td className="px-3 py-2 text-center text-green-400">{team.won}</td>
              <td className="px-3 py-2 text-center text-yellow-400">{team.drawn}</td>
              <td className="px-3 py-2 text-center text-red-400">{team.lost}</td>
              <td className="px-3 py-2 text-center text-gray-300">{team.goalsFor}</td>
              <td className="px-3 py-2 text-center text-gray-300">{team.goalsAgainst}</td>
              <td className="px-3 py-2 text-center text-gray-300">
                {team.goalDiff > 0 ? '+' : ''}
                {team.goalDiff}
              </td>
              <td className="px-3 py-2 text-center font-bold text-emerald-400">{team.points}</td>
              <td className="px-3 py-2 hidden md:table-cell">
                <div className="flex gap-1 justify-center">
                  {team.form.slice(0, 5).map((result, i) => (
                    <FormBadge key={i} result={result} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function splitRowsByPositionReset(groups: Array<{ name: string; rows: TeamStanding[] }>) {
  if (groups.length !== 1) return groups;

  const rows = groups[0]?.rows ?? [];
  const resetIndexes = rows.reduce<number[]>((acc, row, index) => {
    if (index > 0 && row.position === 1) acc.push(index);
    return acc;
  }, []);

  if (resetIndexes.length === 0) return groups;

  const rebuilt: Array<{ name: string; rows: TeamStanding[] }> = [];
  let start = 0;
  for (let i = 0; i <= resetIndexes.length; i++) {
    const end = resetIndexes[i] ?? rows.length;
    rebuilt.push({
      name: `Grupo ${groupLetter(i)}`,
      rows: rows.slice(start, end),
    });
    start = end;
  }

  return rebuilt;
}

function GroupSummaryCard({
  group,
  active,
  onClick,
}: {
  group: { name: string; rows: TeamStanding[] };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-colors hover:border-emerald-500/50 ${
        active ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-muted-foreground uppercase">{group.name}</span>
        <span className="text-xs text-emerald-400">{group.rows.length} times</span>
      </div>
      <div className="space-y-1">
        {group.rows.slice(0, 4).map((team) => (
          <div key={team.team.id} className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-mono w-4">{team.position}</span>
            <span className="truncate">{team.team.name}</span>
            <span className="ml-auto text-emerald-400 font-semibold">{team.points}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

export function Scores365Standings({ league }: Props) {
  const { standings, groups, idMismatch, mismatchMessage, loading, error } =
    use365Standings(league);
  const config = LEAGUE_CONFIG[league];
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
  const displayGroups = splitRowsByPositionReset(groups);
  const selectedGroup =
    displayGroups.find((group) => group.name === activeGroupName) ?? displayGroups[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        <span className="ml-2 text-gray-400">Carregando classificação...</span>
      </div>
    );
  }

  // ID mismatch: show a clear warning instead of wrong data
  if (idMismatch) {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-center">
        <Trophy className="w-10 h-10 text-yellow-500/60 mx-auto mb-3" />
        <p className="text-yellow-400 font-medium">ID da temporada desatualizado</p>
        <p className="text-sm text-yellow-300/70 mt-2 max-w-md mx-auto">
          O ID desta liga pode ter mudado na nova temporada do 365Scores. Aguarde a atualização dos
          IDs ou consulte diretamente o site da liga.
        </p>
        {mismatchMessage && (
          <p className="text-xs text-yellow-500/60 mt-2 italic">{mismatchMessage}</p>
        )}
      </div>
    );
  }

  if (error || (standings.length === 0 && groups.length === 0)) {
    return (
      <div className="text-center py-8 text-gray-400">
        {error || 'Classificação não disponível para esta competição'}
      </div>
    );
  }

  // Multiple groups (Copa Libertadores, Sul-Americana, etc.)
  if (displayGroups.length > 1 && selectedGroup) {
    return (
      <div className="space-y-6">
        <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-white">
            {config.flag} {config.name}
          </h3>
          <span className="text-xs text-gray-400 ml-auto">{displayGroups.length} grupos</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {displayGroups.map((group) => (
            <button
              key={group.name}
              type="button"
              onClick={() => setActiveGroupName(group.name)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedGroup.name === group.name
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-border bg-muted/40 text-muted-foreground hover:border-emerald-500/50'
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>

        <div className="bg-gray-800/50 rounded-xl overflow-hidden border border-emerald-500/20">
          <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
            <span className="text-sm font-semibold text-emerald-400">{selectedGroup.name}</span>
          </div>
          <StandingsTable rows={selectedGroup.rows} totalTeams={selectedGroup.rows.length} />
          <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
            <span className="inline-flex w-3 h-3 bg-emerald-500 rounded-sm"></span>
            <span>Os primeiros colocados avanÃ§am conforme o regulamento da competiÃ§Ã£o.</span>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Todos os Grupos</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {displayGroups.map((group) => (
              <GroupSummaryCard
                key={group.name}
                group={group}
                active={selectedGroup.name === group.name}
                onClick={() => setActiveGroupName(group.name)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Single table (league format)
  return (
    <div className="bg-gray-800/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-500" />
        <h3 className="font-semibold text-white">
          {config.flag} {config.name}
        </h3>
      </div>
      <StandingsTable rows={standings} totalTeams={standings.length} />
      <div className="px-4 py-2 bg-gray-700/30 text-xs text-gray-500 flex gap-4">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-sm"></span> Classificação
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-sm"></span> Próxima fase
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-sm"></span> Rebaixamento
        </span>
      </div>
    </div>
  );
}

export function Scores365UpcomingMatches({ league, onMatchClick }: Props) {
  const { matches, loading, error } = use365Upcoming(league);
  const config = LEAGUE_CONFIG[league];
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const localMatches: UpcomingDisplayMatch[] = currentUpcomingMatches
    .filter((match) => match.leagueKey === league)
    .filter((match) => localFixtureMs(match.date) >= Date.now() - 6 * 60 * 60 * 1000)
    .sort((a, b) => localFixtureMs(a.date) - localFixtureMs(b.date))
    .map(localFixtureToUpcoming);
  const visibleMatches: UpcomingDisplayMatch[] =
    matches.length > 0 ? (matches as UpcomingDisplayMatch[]) : localMatches;
  const sourceLabel = matches.length > 0 ? '365Scores' : 'Base local';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        <span className="ml-2 text-gray-400">Carregando jogos...</span>
      </div>
    );
  }

  if ((error || matches.length === 0) && visibleMatches.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        {error || 'Nenhum jogo agendado'}
      </div>
    );
  }

  // Group by roundName (cups) or round number (leagues)
  const byRound = visibleMatches.reduce(
    (acc, match) => {
      const key = match.roundName || (match.round ? `Rodada ${match.round}` : 'Jogos');
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    },
    {} as Record<string, typeof visibleMatches>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gray-300">
        <Calendar className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-medium">
          Próximos Jogos — {config.flag} {config.name}
        </span>
        <span className="text-xs text-emerald-500/60 ml-auto">{sourceLabel}</span>
      </div>
      {Object.entries(byRound).map(([roundLabel, roundMatches]) => (
        <div key={roundLabel} className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
            {roundLabel}
          </div>
          <div className="grid gap-2">
            {roundMatches.map((match) => (
              <div key={match.id} className="space-y-2">
                <div
                  className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between transition-colors cursor-pointer hover:bg-emerald-500/20 hover:border-emerald-500/30 border border-transparent"
                  onClick={() => {
                    onMatchClick?.(match.homeTeam.name, match.awayTeam.name);
                    setSelectedMatchId((current) => (current === match.id ? null : match.id));
                  }}
                >
                  <div className="flex-1 text-right">
                    <span className="text-white font-medium text-sm">{match.homeTeam.name}</span>
                  </div>
                  <div className="px-4 flex flex-col items-center">
                    <span className="text-gray-500 text-xs">
                      {match.dateLabel ?? formatDate(match.startTime)}
                    </span>
                    <span className="text-emerald-500 font-bold">vs</span>
                  </div>
                  <div className="flex-1 text-left">
                    <span className="text-white font-medium text-sm">{match.awayTeam.name}</span>
                  </div>
                </div>
                {(match.returnLeg || match.bracketNote) && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100/80">
                    {match.returnLeg && (
                      <p>
                        Volta: {match.returnLeg.homeTeam} x {match.returnLeg.awayTeam} (
                        {match.returnLeg.dateLabel})
                      </p>
                    )}
                    {match.bracketNote && <p>{match.bracketNote}</p>}
                  </div>
                )}
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
        </div>
      ))}
    </div>
  );
}

export function Scores365Results({ league }: Props) {
  const { matches, loading, error } = use365Results(league);
  const config = LEAGUE_CONFIG[league];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        <span className="ml-2 text-gray-400">Carregando resultados...</span>
      </div>
    );
  }

  if (error || matches.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        {error || 'Nenhum resultado disponível'}
      </div>
    );
  }

  // Group by roundName (cups) or round number (leagues)
  const byRound = matches.reduce(
    (acc, match) => {
      const key = match.roundName || (match.round ? `Rodada ${match.round}` : 'Resultados');
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    },
    {} as Record<string, typeof matches>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gray-300">
        <TrendingUp className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-medium">
          Resultados Recentes — {config.flag} {config.name}
        </span>
      </div>
      {Object.entries(byRound)
        .slice(0, 5)
        .map(([roundLabel, roundMatches]) => (
          <div key={roundLabel} className="space-y-2">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
              {roundLabel}
            </div>
            <div className="grid gap-2">
              {roundMatches.map((match) => (
                <div
                  key={match.id}
                  className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex-1 text-right">
                    <span
                      className={`font-medium text-sm ${match.homeTeam.score > match.awayTeam.score ? 'text-emerald-400' : 'text-gray-300'}`}
                    >
                      {match.homeTeam.name}
                    </span>
                  </div>
                  <div className="px-4 flex flex-col items-center">
                    <span className="text-gray-500 text-xs">
                      {formatShortDate(match.startTime)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold text-lg ${match.homeTeam.score > match.awayTeam.score ? 'text-emerald-400' : 'text-white'}`}
                      >
                        {match.homeTeam.score}
                      </span>
                      <span className="text-gray-500">-</span>
                      <span
                        className={`font-bold text-lg ${match.awayTeam.score > match.homeTeam.score ? 'text-emerald-400' : 'text-white'}`}
                      >
                        {match.awayTeam.score}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <span
                      className={`font-medium text-sm ${match.awayTeam.score > match.homeTeam.score ? 'text-emerald-400' : 'text-gray-300'}`}
                    >
                      {match.awayTeam.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
