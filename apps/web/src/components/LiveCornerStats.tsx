'use client';

import { useState } from 'react';
import { RefreshCw, Clock, AlertCircle, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useScrapedLeagueStats, type ScrapedTeamStats } from '@/hooks/useCornerStatsScraper';

const SCRAPING_LEAGUES = [
  { id: 'brasileiraoA', name: 'Brasileirão Série A' },
  { id: 'brasileiraoB', name: 'Brasileirão Série B' },
  { id: 'copaBrasil', name: 'Copa do Brasil' },
  { id: 'paulistao', name: 'Campeonato Paulista' },
];

interface LiveCornerStatsProps {
  onTeamSelect?: (team: ScrapedTeamStats) => void;
}

export function LiveCornerStats({ onTeamSelect }: LiveCornerStatsProps) {
  const [selectedLeague, setSelectedLeague] = useState('brasileiraoA');
  const [sortField, setSortField] = useState<keyof ScrapedTeamStats>('avgTotalCorners');
  const [sortAsc, setSortAsc] = useState(false);

  const { data, loading, error, scrapeLeague } = useScrapedLeagueStats();

  const handleRefresh = () => {
    scrapeLeague(selectedLeague);
  };

  const handleSort = (field: keyof ScrapedTeamStats) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedTeams = data?.teams
    ? [...data.teams].sort((a, b) => {
        const aVal = a[sortField] ?? 0;
        const bVal = b[sortField] ?? 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      })
    : [];

  const avgCornersPerMatch =
    data?.teams && data.teams.length > 0
      ? data.teams.reduce((s, t) => s + t.avgTotalCorners, 0) / data.teams.length
      : 0;

  const SortButton = ({ field, label }: { field: keyof ScrapedTeamStats; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-primary transition-colors"
    >
      {label}
      {sortField === field &&
        (sortAsc ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <CardTitle className="text-lg">Dados em Tempo Real</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Corner-Stats.com
          </Badge>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <Select value={selectedLeague} onValueChange={setSelectedLeague}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione a liga" />
            </SelectTrigger>
            <SelectContent>
              {SCRAPING_LEAGUES.map((league) => (
                <SelectItem key={league.id} value={league.id}>
                  {league.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleRefresh} disabled={loading} size="sm" className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {loading ? 'Buscando...' : 'Buscar Dados'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive mb-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Erro ao buscar dados</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!data && !loading && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Clique em &quot;Buscar Dados&quot; para carregar estatísticas em tempo real</p>
            <p className="text-sm mt-1 opacity-70">Os dados serão extraídos do Corner-Stats.com</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Extraindo dados do Corner-Stats.com...</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Isso pode levar alguns segundos</p>
          </div>
        )}

        {data && !loading && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">{data.league}</h3>
                <p className="text-sm text-muted-foreground">
                  {data.teams.length} times • Média: {avgCornersPerMatch.toFixed(1)} escanteios/jogo
                </p>
              </div>
              <Badge variant="secondary" className="text-xs" suppressHydrationWarning>
                {data.lastUpdated ? `Atualizado: ${data.lastUpdated.slice(11, 16)}` : 'Atualizado'}
              </Badge>
            </div>

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>
                      <SortButton field="team" label="Time" />
                    </TableHead>
                    <TableHead className="text-center">
                      <SortButton field="gamesPlayed" label="J" />
                    </TableHead>
                    <TableHead className="text-center">
                      <SortButton field="avgCornersFor" label="Média F" />
                    </TableHead>
                    <TableHead className="text-center">
                      <SortButton field="avgCornersAgainst" label="Média C" />
                    </TableHead>
                    <TableHead className="text-center">
                      <SortButton field="avgTotalCorners" label="Total" />
                    </TableHead>
                    <TableHead className="text-center">
                      <SortButton field="over85Pct" label=">8.5" />
                    </TableHead>
                    <TableHead className="text-center">
                      <SortButton field="over95Pct" label=">9.5" />
                    </TableHead>
                    <TableHead className="text-center">
                      <SortButton field="over105Pct" label=">10.5" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTeams.map((team, index) => {
                    const over85 = team.over85Pct ?? 0;
                    const over95 = team.over95Pct ?? 0;
                    const over105 = team.over105Pct ?? 0;
                    return (
                      <TableRow
                        key={team.team}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onTeamSelect?.(team)}
                      >
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xs font-bold">
                              {team.team.charAt(0)}
                            </div>
                            {team.team}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{team.gamesPlayed}</TableCell>
                        <TableCell className="text-center font-medium text-green-500">
                          {team.avgCornersFor.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center font-medium text-red-400">
                          {team.avgCornersAgainst.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-mono">
                            {team.avgTotalCorners.toFixed(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={
                              over85 >= 60 ? 'text-green-500' : over85 <= 40 ? 'text-red-400' : ''
                            }
                          >
                            {over85}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={
                              over95 >= 50 ? 'text-green-500' : over95 <= 30 ? 'text-red-400' : ''
                            }
                          >
                            {over95}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={
                              over105 >= 40 ? 'text-green-500' : over105 <= 20 ? 'text-red-400' : ''
                            }
                          >
                            {over105}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
