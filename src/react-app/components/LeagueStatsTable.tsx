import { useMemo, useState } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, Minus, Home, Plane } from "lucide-react";
import { Card } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/react-app/components/ui/table";
import type { TeamCornerStats } from "@/shared/footballDataTypes";

interface LeagueStatsTableProps {
  teams: TeamCornerStats[];
  onSelectTeam?: (team: TeamCornerStats) => void;
  selectedTeam?: string;
  compareTeam?: string;
}

type SortKey = 'team' | 'avgCornersFor' | 'avgCornersAgainst' | 'avgTotalCorners' | 'avgCornersHome' | 'avgCornersAway' | 'over95Pct';
type SortDir = 'asc' | 'desc';

export function LeagueStatsTable({ teams, onSelectTeam, selectedTeam, compareTeam }: LeagueStatsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('avgCornersFor');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      const numA = typeof aVal === 'number' ? aVal : 0;
      const numB = typeof bVal === 'number' ? bVal : 0;
      
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });
  }, [teams, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium hover:bg-transparent"
      onClick={() => handleSort(sortKeyName)}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  const getTrendIcon = (value: number, avg: number) => {
    const diff = value - avg;
    if (diff > 0.5) return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    if (diff < -0.5) return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  // Calculate league averages
  const avgFor = teams.reduce((sum, t) => sum + t.avgCornersFor, 0) / teams.length;

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8">#</TableHead>
              <TableHead>
                <SortHeader label="Time" sortKeyName="team" />
              </TableHead>
              <TableHead className="text-center">
                <SortHeader label="J" sortKeyName="avgCornersFor" />
              </TableHead>
              <TableHead className="text-center">
                <SortHeader label="Esc. Pró" sortKeyName="avgCornersFor" />
              </TableHead>
              <TableHead className="text-center">
                <SortHeader label="Esc. Contra" sortKeyName="avgCornersAgainst" />
              </TableHead>
              <TableHead className="text-center">
                <SortHeader label="Total" sortKeyName="avgTotalCorners" />
              </TableHead>
              <TableHead className="text-center hidden md:table-cell">
                <div className="flex items-center justify-center gap-1">
                  <Home className="w-3 h-3" />
                  <SortHeader label="Casa" sortKeyName="avgCornersHome" />
                </div>
              </TableHead>
              <TableHead className="text-center hidden md:table-cell">
                <div className="flex items-center justify-center gap-1">
                  <Plane className="w-3 h-3" />
                  <SortHeader label="Fora" sortKeyName="avgCornersAway" />
                </div>
              </TableHead>
              <TableHead className="text-center hidden lg:table-cell">
                <SortHeader label="O9.5%" sortKeyName="over95Pct" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTeams.map((team, idx) => {
              const isSelected = team.team === selectedTeam;
              const isCompare = team.team === compareTeam;
              
              return (
              <TableRow 
                key={team.team}
                className={`
                  ${onSelectTeam ? "cursor-pointer" : ""}
                  ${isSelected ? "bg-primary/10 hover:bg-primary/15 border-l-2 border-l-primary" : ""}
                  ${isCompare ? "bg-secondary/20 hover:bg-secondary/25 border-l-2 border-l-secondary" : ""}
                `}
                onClick={() => onSelectTeam?.(team)}
              >
                <TableCell className="font-medium text-muted-foreground">
                  {idx + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{team.team}</span>
                    {getTrendIcon(team.avgCornersFor, avgFor)}
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {team.gamesPlayed}
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant={team.avgCornersFor >= avgFor ? "default" : "secondary"}
                    className={team.avgCornersFor >= avgFor + 0.5 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                      : ""
                    }
                  >
                    {team.avgCornersFor.toFixed(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">
                    {team.avgCornersAgainst.toFixed(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-medium">
                  {team.avgTotalCorners.toFixed(1)}
                </TableCell>
                <TableCell className="text-center hidden md:table-cell">
                  <span className="text-emerald-400">{team.avgCornersHome.toFixed(1)}</span>
                </TableCell>
                <TableCell className="text-center hidden md:table-cell">
                  <span className="text-blue-400">{team.avgCornersAway.toFixed(1)}</span>
                </TableCell>
                <TableCell className="text-center hidden lg:table-cell">
                  <Badge 
                    variant="outline"
                    className={team.over95Pct >= 50 
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30" 
                      : ""
                    }
                  >
                    {team.over95Pct}%
                  </Badge>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
