"use client";

import { useState } from 'react';
import { TeamShotStats, ShotStatsResponse } from '@/shared/footballDataTypes';
import { Target, Home, Plane, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

interface ShotStatsTableProps {
  data: ShotStatsResponse;
  onTeamSelect?: (team: TeamShotStats) => void;
}

export function ShotStatsTable({ data, onTeamSelect }: ShotStatsTableProps) {
  const [sortBy, setSortBy] = useState<'total' | 'onTarget' | 'accuracy' | 'home' | 'away'>('total');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const sortedTeams = [...data.teams].sort((a, b) => {
    let valueA: number, valueB: number;
    
    switch (sortBy) {
      case 'onTarget':
        valueA = a.avgShotsOnTarget;
        valueB = b.avgShotsOnTarget;
        break;
      case 'accuracy':
        valueA = a.shotAccuracy;
        valueB = b.shotAccuracy;
        break;
      case 'home':
        valueA = a.avgShotsHome;
        valueB = b.avgShotsHome;
        break;
      case 'away':
        valueA = a.avgShotsAway;
        valueB = b.avgShotsAway;
        break;
      default:
        valueA = a.avgShots;
        valueB = b.avgShots;
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
      className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
    >
      {label}
      {sortBy === sortKey && (
        sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
    </button>
  );

  const getShotLevel = (avg: number): string => {
    if (avg >= 15) return 'text-green-400';
    if (avg >= 12) return 'text-cyan-400';
    if (avg >= 9) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAccuracyLevel = (pct: number): string => {
    if (pct >= 40) return 'text-green-400';
    if (pct >= 32) return 'text-cyan-400';
    if (pct >= 25) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-cyan-400" />
          Estatísticas de Finalizações - {data.league.name}
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
                <SortHeader label="Fin." sortKey="total" />
              </th>
              <th className="px-3 py-3 text-center">
                <SortHeader label="No Gol" sortKey="onTarget" />
              </th>
              <th className="px-3 py-3 text-center">
                <SortHeader label="%" sortKey="accuracy" />
              </th>
              <th className="px-3 py-3 text-center hidden md:table-cell">
                <SortHeader label="Casa" sortKey="home" />
              </th>
              <th className="px-3 py-3 text-center hidden md:table-cell">
                <SortHeader label="Fora" sortKey="away" />
              </th>
              <th className="px-3 py-3 text-center hidden lg:table-cell">Sofridas</th>
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
                  <td className={`px-3 py-3 text-center font-bold ${getShotLevel(team.avgShots)}`}>
                    {team.avgShots.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-center text-cyan-400 font-medium">
                    {team.avgShotsOnTarget.toFixed(1)}
                  </td>
                  <td className={`px-3 py-3 text-center ${getAccuracyLevel(team.shotAccuracy)}`}>
                    {team.shotAccuracy.toFixed(0)}%
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <span className="text-blue-400">{team.avgShotsHome.toFixed(1)}</span>
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <span className="text-purple-400">{team.avgShotsAway.toFixed(1)}</span>
                  </td>
                  <td className="px-3 py-3 text-center hidden lg:table-cell">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <span className="text-orange-400" title="Finalizações sofridas">
                        {team.avgShotsAgainst.toFixed(1)}
                      </span>
                      <span className="text-slate-500">/</span>
                      <span className="text-red-400" title="No gol sofridas">
                        {team.avgShotsOnTargetAgainst.toFixed(1)}
                      </span>
                    </div>
                  </td>
                </tr>
                {expandedTeam === team.team && (
                  <tr className="bg-slate-900/50">
                    <td colSpan={8} className="px-4 py-4">
                      <TeamShotDetails team={team} />
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

interface TeamShotDetailsProps {
  team: TeamShotStats;
}

function TeamShotDetails({ team }: TeamShotDetailsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Summary Stats */}
      <div className="bg-slate-800/70 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" /> Resumo
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-400">Total Finalizações:</span>
            <span className="text-cyan-400 ml-2 font-medium">{team.totalShots}</span>
          </div>
          <div>
            <span className="text-slate-400">No Gol:</span>
            <span className="text-green-400 ml-2 font-medium">{team.totalShotsOnTarget}</span>
          </div>
          <div>
            <span className="text-slate-400">Média/jogo:</span>
            <span className="text-white ml-2 font-medium">{team.avgShots.toFixed(1)}</span>
          </div>
          <div>
            <span className="text-slate-400">Precisão:</span>
            <span className="text-white ml-2 font-medium">{team.shotAccuracy.toFixed(0)}%</span>
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
              <span className="text-cyan-400">{team.avgShotsHome.toFixed(1)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-green-400">{team.avgShotsOnTargetHome.toFixed(1)} gol</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-purple-400 flex items-center gap-1">
              <Plane className="w-3 h-3" /> Fora ({team.awayGames}j)
            </span>
            <div>
              <span className="text-cyan-400">{team.avgShotsAway.toFixed(1)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-green-400">{team.avgShotsOnTargetAway.toFixed(1)} gol</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700/50">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Precisão Casa</span>
              <span className="text-blue-400">{team.shotAccuracyHome.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-1">
              <span className="text-slate-400">Precisão Fora</span>
              <span className="text-purple-400">{team.shotAccuracyAway.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Defensive Stats */}
      <div className="bg-slate-800/70 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Estatísticas Defensivas
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Finalizações sofridas</span>
            <span className="text-orange-400 font-medium">{team.avgShotsAgainst.toFixed(1)}/jogo</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">No gol sofridas</span>
            <span className="text-red-400 font-medium">{team.avgShotsOnTargetAgainst.toFixed(1)}/jogo</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Total no jogo</span>
            <span className="text-white font-medium">{team.avgTotalShots.toFixed(1)}/jogo</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">No gol (total)</span>
            <span className="text-white font-medium">{team.avgTotalShotsOnTarget.toFixed(1)}/jogo</span>
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
                <div className="flex gap-2 mt-1 text-xs">
                  <span className="text-cyan-400" title="Finalizações">🎯 {match.shots}</span>
                  <span className="text-green-400" title="No gol">⚽ {match.shotsOnTarget}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact shot stats display for comparison view
interface CompactShotStatsProps {
  team: TeamShotStats;
  variant?: 'home' | 'away';
}

export function CompactShotStats({ team, variant }: CompactShotStatsProps) {
  const bgColor = variant === 'home' ? 'bg-blue-900/20 border-blue-700/30' : 
                  variant === 'away' ? 'bg-purple-900/20 border-purple-700/30' : 
                  'bg-slate-800/50 border-slate-700';

  return (
    <div className={`rounded-lg p-4 border ${bgColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-cyan-400" />
        <span className="font-semibold text-white">{team.team}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-slate-400 text-xs">Média Finalizações</div>
          <div className="text-xl font-bold text-cyan-400">{team.avgShots.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">No Gol / Precisão</div>
          <div className="text-lg font-medium">
            <span className="text-green-400">{team.avgShotsOnTarget.toFixed(1)}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="text-white">{team.shotAccuracy.toFixed(0)}%</span>
          </div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Em Casa</div>
          <div className="text-blue-400 font-medium">{team.avgShotsHome.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Fora</div>
          <div className="text-purple-400 font-medium">{team.avgShotsAway.toFixed(1)}</div>
        </div>
      </div>

      {/* Defensive indicator */}
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="text-xs text-slate-400 mb-2">Finalizações Sofridas</div>
        <div className="flex gap-2 text-xs">
          <span className="bg-orange-900/30 text-orange-400 px-2 py-1 rounded">
            {team.avgShotsAgainst.toFixed(1)}/jogo
          </span>
          <span className="bg-red-900/30 text-red-400 px-2 py-1 rounded">
            {team.avgShotsOnTargetAgainst.toFixed(1)} no gol
          </span>
        </div>
      </div>
    </div>
  );
}
