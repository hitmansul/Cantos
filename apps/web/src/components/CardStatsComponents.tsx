"use client";

import { useState } from 'react';
import { TeamCardStats, CardStatsResponse } from '@/shared/footballDataTypes';
import { CreditCard, TrendingUp, TrendingDown, Home, Plane, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface CardStatsTableProps {
  data: CardStatsResponse;
  onTeamSelect?: (team: TeamCardStats) => void;
}

export function CardStatsTable({ data, onTeamSelect }: CardStatsTableProps) {
  const [sortBy, setSortBy] = useState<'total' | 'yellow' | 'red' | 'home' | 'away'>('total');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const sortedTeams = [...data.teams].sort((a, b) => {
    let valueA: number, valueB: number;
    
    switch (sortBy) {
      case 'yellow':
        valueA = a.avgYellowPerMatch;
        valueB = b.avgYellowPerMatch;
        break;
      case 'red':
        valueA = a.avgRedPerMatch;
        valueB = b.avgRedPerMatch;
        break;
      case 'home':
        valueA = a.avgYellowHome;
        valueB = b.avgYellowHome;
        break;
      case 'away':
        valueA = a.avgYellowAway;
        valueB = b.avgYellowAway;
        break;
      default:
        valueA = a.avgCardsPerMatch;
        valueB = b.avgCardsPerMatch;
    }
    
    return sortAsc ? valueA - valueB : valueB - valueA;
  });

  const handleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: typeof sortBy }) => (
    <button 
      onClick={() => handleSort(sortKey)}
      className="flex items-center gap-1 hover:text-amber-400 transition-colors"
    >
      {label}
      {sortBy === sortKey && (
        sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
    </button>
  );

  const getCardLevel = (avg: number): string => {
    if (avg >= 3.5) return 'text-red-400';
    if (avg >= 2.5) return 'text-amber-400';
    if (avg >= 1.5) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-amber-400" />
          Estatísticas de Cartões - {data.league.name}
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          {data.matchesAnalyzed} jogos analisados
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-3 py-3 text-center">J</th>
              <th className="px-3 py-3 text-center">
                <SortHeader label="Média" sortKey="total" />
              </th>
              <th className="px-3 py-3 text-center">
                <SortHeader label="🟨" sortKey="yellow" />
              </th>
              <th className="px-3 py-3 text-center">
                <SortHeader label="🟥" sortKey="red" />
              </th>
              <th className="px-3 py-3 text-center hidden md:table-cell">
                <SortHeader label="Casa" sortKey="home" />
              </th>
              <th className="px-3 py-3 text-center hidden md:table-cell">
                <SortHeader label="Fora" sortKey="away" />
              </th>
              <th className="px-3 py-3 text-center hidden lg:table-cell">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sortedTeams.map((team, idx) => (
              <>
                <tr 
                  key={team.team}
                  className={`hover:bg-slate-700/30 cursor-pointer transition-colors ${
                    idx % 2 === 0 ? 'bg-slate-800/20' : ''
                  }`}
                  onClick={() => {
                    setExpandedTeam(expandedTeam === team.team ? null : team.team);
                    onTeamSelect?.(team);
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs w-5">{idx + 1}</span>
                      <span className="text-white font-medium">{team.team}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400">{team.gamesPlayed}</td>
                  <td className={`px-3 py-3 text-center font-bold ${getCardLevel(team.avgCardsPerMatch)}`}>
                    {team.avgCardsPerMatch.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-center text-yellow-400">
                    {team.avgYellowPerMatch.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-center text-red-400">
                    {team.avgRedPerMatch.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <span className="text-blue-400">{team.avgYellowHome.toFixed(1)}</span>
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <span className="text-purple-400">{team.avgYellowAway.toFixed(1)}</span>
                  </td>
                  <td className="px-3 py-3 text-center hidden lg:table-cell">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <span className="text-green-400" title="Vencendo">
                        V:{team.avgCardsWinning.toFixed(1)}
                      </span>
                      <span className="text-yellow-400" title="Empatando">
                        E:{team.avgCardsDrawing.toFixed(1)}
                      </span>
                      <span className="text-red-400" title="Perdendo">
                        P:{team.avgCardsLosing.toFixed(1)}
                      </span>
                    </div>
                  </td>
                </tr>
                {expandedTeam === team.team && (
                  <tr className="bg-slate-900/50">
                    <td colSpan={8} className="px-4 py-4">
                      <TeamCardDetails team={team} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TeamCardDetailsProps {
  team: TeamCardStats;
}

function TeamCardDetails({ team }: TeamCardDetailsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Summary Stats */}
      <div className="bg-slate-800/70 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Resumo
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-400">Total 🟨:</span>
            <span className="text-yellow-400 ml-2 font-medium">{team.totalYellowCards}</span>
          </div>
          <div>
            <span className="text-slate-400">Total 🟥:</span>
            <span className="text-red-400 ml-2 font-medium">{team.totalRedCards}</span>
          </div>
          <div>
            <span className="text-slate-400">Média/jogo:</span>
            <span className="text-white ml-2 font-medium">{team.avgCardsPerMatch.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400">Jogos:</span>
            <span className="text-white ml-2 font-medium">{team.gamesPlayed}</span>
          </div>
        </div>
      </div>

      {/* Home vs Away */}
      <div className="bg-slate-800/70 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Home className="w-4 h-4" /> Casa vs Fora
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" /> Casa ({team.homeGames}j)
            </span>
            <div>
              <span className="text-yellow-400">{team.homeYellowCards}🟨</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-red-400">{team.homeRedCards}🟥</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-purple-400 flex items-center gap-1">
              <Plane className="w-3 h-3" /> Fora ({team.awayGames}j)
            </span>
            <div>
              <span className="text-yellow-400">{team.awayYellowCards}🟨</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-red-400">{team.awayRedCards}🟥</span>
            </div>
          </div>
        </div>
      </div>

      {/* By Match State */}
      <div className="bg-slate-800/70 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Por Estado do Jogo
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-green-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Vencendo
            </span>
            <span className="text-white">{team.avgCardsWinning.toFixed(1)} média</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-yellow-400 flex items-center gap-1">
              = Empatando
            </span>
            <span className="text-white">{team.avgCardsDrawing.toFixed(1)} média</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-red-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Perdendo
            </span>
            <span className="text-white">{team.avgCardsLosing.toFixed(1)} média</span>
          </div>
        </div>
      </div>

      {/* Recent Matches */}
      {team.recentMatches.length > 0 && (
        <div className="md:col-span-3 bg-slate-800/70 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Últimos Jogos</h4>
          <div className="flex flex-wrap gap-2">
            {team.recentMatches.slice(0, 8).map((match, idx) => (
              <div 
                key={idx}
                className="bg-slate-900/50 rounded px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-white font-bold ${
                    match.result === 'W' ? 'bg-green-600' :
                    match.result === 'D' ? 'bg-yellow-600' : 'bg-red-600'
                  }`}>
                    {match.result}
                  </span>
                  <span className="text-slate-400">{match.isHome ? '🏠' : '✈️'}</span>
                </div>
                <div className="text-slate-300 truncate max-w-[100px]" title={match.opponent}>
                  vs {match.opponent}
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="text-yellow-400">{match.yellowCards}🟨</span>
                  {match.redCards > 0 && <span className="text-red-400">{match.redCards}🟥</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact card stats display for comparison view
interface CompactCardStatsProps {
  team: TeamCardStats;
  variant?: 'home' | 'away';
}

export function CompactCardStats({ team, variant }: CompactCardStatsProps) {
  const bgColor = variant === 'home' ? 'bg-blue-900/20 border-blue-700/30' : 
                  variant === 'away' ? 'bg-purple-900/20 border-purple-700/30' : 
                  'bg-slate-800/50 border-slate-700';

  return (
    <div className={`rounded-lg p-4 border ${bgColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="w-4 h-4 text-amber-400" />
        <span className="font-semibold text-white">{team.team}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-slate-400 text-xs">Média Cartões</div>
          <div className="text-xl font-bold text-amber-400">{team.avgCardsPerMatch.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">🟨 / 🟥 por jogo</div>
          <div className="text-lg font-medium">
            <span className="text-yellow-400">{team.avgYellowPerMatch.toFixed(1)}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="text-red-400">{team.avgRedPerMatch.toFixed(2)}</span>
          </div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Em Casa</div>
          <div className="text-blue-400 font-medium">{team.avgYellowHome.toFixed(1)} 🟨</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Fora</div>
          <div className="text-purple-400 font-medium">{team.avgYellowAway.toFixed(1)} 🟨</div>
        </div>
      </div>

      {/* Match state indicator */}
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="text-xs text-slate-400 mb-2">Cartões por Estado</div>
        <div className="flex gap-2 text-xs">
          <span className="bg-green-900/30 text-green-400 px-2 py-1 rounded">
            V: {team.avgCardsWinning.toFixed(1)}
          </span>
          <span className="bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded">
            E: {team.avgCardsDrawing.toFixed(1)}
          </span>
          <span className="bg-red-900/30 text-red-400 px-2 py-1 rounded">
            P: {team.avgCardsLosing.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
