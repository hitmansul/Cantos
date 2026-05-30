"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { DetailedTeamStats } from "@/data/teamCornerStats";

interface CornerTrendsChartProps {
  team: DetailedTeamStats;
  compareTeam?: DetailedTeamStats;
}

export function CornerTrendsChart({ team, compareTeam }: CornerTrendsChartProps) {
  // Prepare data for last games trend
  const gamesTrendData = useMemo(() => {
    const maxGames = Math.max(team.last5Games.length, compareTeam?.last5Games.length || 0);
    return Array.from({ length: maxGames }, (_, i) => ({
      game: `Jogo ${i + 1}`,
      [team.team]: team.last5Games[i] || null,
      ...(compareTeam ? { [compareTeam.team]: compareTeam.last5Games[i] || null } : {}),
    }));
  }, [team, compareTeam]);

  // Home vs Away comparison
  const homeAwayData = useMemo(() => {
    const data = [
      {
        local: "Casa",
        [team.team]: team.avgCornersHome,
        ...(compareTeam ? { [compareTeam.team]: compareTeam.avgCornersHome } : {}),
      },
      {
        local: "Fora",
        [team.team]: team.avgCornersAway,
        ...(compareTeam ? { [compareTeam.team]: compareTeam.avgCornersAway } : {}),
      },
    ];
    return data;
  }, [team, compareTeam]);

  // Half comparison
  const halfData = useMemo(() => {
    return [
      {
        tempo: "1º Tempo",
        [team.team]: team.avgCornersFirstHalf,
        ...(compareTeam ? { [compareTeam.team]: compareTeam.avgCornersFirstHalf } : {}),
      },
      {
        tempo: "2º Tempo",
        [team.team]: team.avgCornersSecondHalf,
        ...(compareTeam ? { [compareTeam.team]: compareTeam.avgCornersSecondHalf } : {}),
      },
    ];
  }, [team, compareTeam]);

  // Radar data for team profile
  const radarData = useMemo(() => {
    const normalize = (value: number, max: number) => (value / max) * 100;
    return [
      { stat: "Escanteios/Jogo", [team.team]: normalize(team.avgCornersFor, 8), fullMark: 100 },
      { stat: "Em Casa", [team.team]: normalize(team.avgCornersHome, 8), fullMark: 100 },
      { stat: "Fora", [team.team]: normalize(team.avgCornersAway, 8), fullMark: 100 },
      { stat: "1º Tempo", [team.team]: normalize(team.avgCornersFirstHalf, 4), fullMark: 100 },
      { stat: "2º Tempo", [team.team]: normalize(team.avgCornersSecondHalf, 4), fullMark: 100 },
      { stat: "Over 9.5%", [team.team]: team.over95Pct, fullMark: 100 },
    ];
  }, [team]);

  // Calculate trend
  const calculateTrend = (games: number[]) => {
    if (games.length < 2) return 0;
    const recent = games.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const older = games.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, games.length);
    return recent - older;
  };

  const trend = calculateTrend(team.last5Games);

  return (
    <div className="space-y-4">
      {/* Trend Summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Tendência de Escanteios</h3>
          </div>
          <Badge 
            variant={trend > 0.5 ? "default" : trend < -0.5 ? "destructive" : "secondary"}
            className="flex items-center gap-1"
          >
            {trend > 0.5 ? (
              <><TrendingUp className="w-3 h-3" /> Em alta</>
            ) : trend < -0.5 ? (
              <><TrendingDown className="w-3 h-3" /> Em baixa</>
            ) : (
              <><Minus className="w-3 h-3" /> Estável</>
            )}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{team.avgCornersFor.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Média por jogo</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{team.avgLast5.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Últimos 5 jogos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-500">{team.over95Pct}%</p>
            <p className="text-xs text-muted-foreground">Over 9.5</p>
          </div>
        </div>
      </Card>

      {/* Last Games Trend Chart */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Evolução nos Últimos Jogos</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={gamesTrendData}>
              <defs>
                <linearGradient id="colorTeam1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTeam2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="game" 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                domain={[0, 12]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 12
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey={team.team}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorTeam1)"
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
              />
              {compareTeam && (
                <Area
                  type="monotone"
                  dataKey={compareTeam.team}
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  fill="url(#colorTeam2)"
                  dot={{ fill: "hsl(var(--chart-2))", r: 4 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Home vs Away Bar Chart */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3">Casa vs Fora</h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={homeAwayData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="local" 
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  domain={[0, 8]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12
                  }}
                />
                <Bar 
                  dataKey={team.team} 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
                {compareTeam && (
                  <Bar 
                    dataKey={compareTeam.team} 
                    fill="hsl(var(--chart-2))" 
                    radius={[4, 4, 0, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3">1º Tempo vs 2º Tempo</h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={halfData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="tempo" 
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  domain={[0, 4]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12
                  }}
                />
                <Bar 
                  dataKey={team.team} 
                  fill="hsl(var(--chart-3))" 
                  radius={[4, 4, 0, 0]}
                />
                {compareTeam && (
                  <Bar 
                    dataKey={compareTeam.team} 
                    fill="hsl(var(--chart-4))" 
                    radius={[4, 4, 0, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Team Profile Radar (only for single team view) */}
      {!compareTeam && (
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3">Perfil de Escanteios</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis 
                  dataKey="stat" 
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <PolarRadiusAxis 
                  angle={30} 
                  domain={[0, 100]} 
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                />
                <Radar
                  name={team.team}
                  dataKey={team.team}
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

// Compact version for use in tabs
export function CornerTrendsMini({ team }: { team: DetailedTeamStats }) {
  const sparklineData = team.last5Games.map((corners, i) => ({
    game: i + 1,
    corners,
  }));

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparklineData}>
            <Line
              type="monotone"
              dataKey="corners"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-muted-foreground">
        Últimos 5: {team.last5Games.join(", ")}
      </div>
    </div>
  );
}
