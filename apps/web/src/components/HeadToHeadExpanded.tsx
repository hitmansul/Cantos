"use client";

import { Swords, Calendar, CornerUpRight, TrendingUp, TrendingDown, Minus, Trophy, Target, BarChart3, Zap, Percent, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type HeadToHead } from "@/data/teamCornerStats";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from "recharts";
import { useMemo } from "react";

interface HeadToHeadExpandedProps {
  h2h: HeadToHead;
}

export function HeadToHeadExpanded({ h2h }: HeadToHeadExpandedProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    const matches = h2h.matches;
    const team1Wins = matches.filter(m => m.homeScore > m.awayScore).length;
    const team2Wins = matches.filter(m => m.awayScore > m.homeScore).length;
    const draws = matches.filter(m => m.homeScore === m.awayScore).length;
    
    const over85 = matches.filter(m => m.totalCorners > 8.5).length;
    const over95 = matches.filter(m => m.totalCorners > 9.5).length;
    const over105 = matches.filter(m => m.totalCorners > 10.5).length;
    const over115 = matches.filter(m => m.totalCorners > 11.5).length;
    
    const corners = matches.map(m => m.totalCorners);
    const maxCorners = Math.max(...corners);
    const minCorners = Math.min(...corners);
    
    // Trend: compare last 3 with previous
    const last3Avg = matches.slice(0, 3).reduce((sum, m) => sum + m.totalCorners, 0) / Math.min(3, matches.length);
    const prev3Avg = matches.length > 3 
      ? matches.slice(3, 6).reduce((sum, m) => sum + m.totalCorners, 0) / Math.min(3, matches.length - 3)
      : last3Avg;
    const trend = last3Avg - prev3Avg;
    
    return {
      team1Wins, team2Wins, draws,
      over85, over95, over105, over115,
      maxCorners, minCorners,
      trend,
      total: matches.length
    };
  }, [h2h.matches]);

  // Chart data - reversed to show oldest first
  const chartData = useMemo(() => {
    return [...h2h.matches].reverse().map((match, i) => ({
      name: new Date(match.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      total: match.totalCorners,
      home: match.homeCorners,
      away: match.awayCorners,
      date: match.date,
      index: i + 1
    }));
  }, [h2h.matches]);

  // Bar chart data for corner distribution
  const distributionData = useMemo(() => {
    const ranges = [
      { range: "0-7", min: 0, max: 7, count: 0 },
      { range: "8-9", min: 8, max: 9, count: 0 },
      { range: "10-11", min: 10, max: 11, count: 0 },
      { range: "12-13", min: 12, max: 13, count: 0 },
      { range: "14+", min: 14, max: 99, count: 0 },
    ];
    h2h.matches.forEach(m => {
      const r = ranges.find(r => m.totalCorners >= r.min && m.totalCorners <= r.max);
      if (r) r.count++;
    });
    return ranges;
  }, [h2h.matches]);

  // PREDICTION calculation
  const prediction = useMemo(() => {
    const matches = h2h.matches;
    const total = matches.length;
    
    // Base: H2H historical average
    const baseTotal = h2h.avgTotalCorners;
    const baseHome = h2h.avgHomeCorners;
    const baseAway = h2h.avgAwayCorners;
    
    // Recent form: last 3 matches weighted more
    const recentMatches = matches.slice(0, Math.min(3, total));
    const recentAvg = recentMatches.reduce((sum, m) => sum + m.totalCorners, 0) / recentMatches.length;
    const recentHome = recentMatches.reduce((sum, m) => sum + m.homeCorners, 0) / recentMatches.length;
    const recentAway = recentMatches.reduce((sum, m) => sum + m.awayCorners, 0) / recentMatches.length;
    
    // Weighted prediction: 40% historical, 60% recent (jogos recentes têm mais peso)
    const predictedTotal = baseTotal * 0.4 + recentAvg * 0.6;
    const predictedHome = baseHome * 0.4 + recentHome * 0.6;
    const predictedAway = baseAway * 0.4 + recentAway * 0.6;
    
    // Range prediction (standard deviation approximation)
    const variance = matches.reduce((sum, m) => sum + Math.pow(m.totalCorners - baseTotal, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    const minExpected = Math.max(0, Math.round(predictedTotal - stdDev));
    const maxExpected = Math.round(predictedTotal + stdDev);
    
    // Over probabilities based on historical data + trend adjustment
    const trendAdjustment = stats.trend > 0.5 ? 0.05 : stats.trend < -0.5 ? -0.05 : 0;
    const over85Prob = Math.min(95, Math.max(5, (stats.over85 / total * 100) + (trendAdjustment * 100)));
    const over95Prob = Math.min(95, Math.max(5, (stats.over95 / total * 100) + (trendAdjustment * 100)));
    const over105Prob = Math.min(95, Math.max(5, (stats.over105 / total * 100) + (trendAdjustment * 100)));
    const over115Prob = Math.min(95, Math.max(5, (stats.over115 / total * 100) + (trendAdjustment * 100)));
    
    // Confidence: higher with more matches and lower variance
    const matchesConfidence = Math.min(1, total / 8); // max at 8 matches
    const varianceConfidence = Math.max(0.3, 1 - (stdDev / 5)); // lower variance = higher confidence
    const confidence = Math.round((matchesConfidence * 0.6 + varianceConfidence * 0.4) * 100);
    
    // Best bet recommendation
    let bestBet = { line: "", prob: 0, recommendation: "" };
    if (over95Prob >= 65) {
      bestBet = { line: "Over 9.5", prob: over95Prob, recommendation: "Forte" };
    } else if (over85Prob >= 70) {
      bestBet = { line: "Over 8.5", prob: over85Prob, recommendation: "Boa" };
    } else if (over105Prob >= 55) {
      bestBet = { line: "Over 10.5", prob: over105Prob, recommendation: "Arriscada" };
    } else if (100 - over95Prob >= 65) {
      bestBet = { line: "Under 9.5", prob: 100 - over95Prob, recommendation: "Forte" };
    } else {
      bestBet = { line: "Over 8.5", prob: over85Prob, recommendation: "Moderada" };
    }
    
    return {
      total: predictedTotal,
      home: predictedHome,
      away: predictedAway,
      minExpected,
      maxExpected,
      over85Prob,
      over95Prob,
      over105Prob,
      over115Prob,
      confidence,
      bestBet
    };
  }, [h2h, stats]);

  const getTrendIcon = () => {
    if (stats.trend > 0.5) return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (stats.trend < -0.5) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-amber-400" />;
  };

  const getTrendText = () => {
    if (stats.trend > 0.5) return "Tendência de alta";
    if (stats.trend < -0.5) return "Tendência de queda";
    return "Estável";
  };

  return (
    <Card className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
          <Swords className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold">Confronto Direto Expandido</h3>
          <p className="text-sm text-muted-foreground">
            {h2h.homeTeam} vs {h2h.awayTeam}
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">{stats.total} jogos</Badge>
      </div>

      {/* PREDICTION SECTION - Prominent */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-fuchsia-500/20 border-2 border-violet-500/30 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-violet-300">Previsão para o Próximo Jogo</h4>
            <p className="text-xs text-muted-foreground">Baseado no histórico de {stats.total} confrontos</p>
          </div>
          <Badge className={`ml-auto ${prediction.confidence >= 70 ? 'bg-emerald-500' : prediction.confidence >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}>
            {prediction.confidence}% confiança
          </Badge>
        </div>

        {/* Main Prediction */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-center">
            <p className="text-xs text-emerald-400/80 mb-1">{h2h.homeTeam.split(" ")[0]}</p>
            <p className="text-2xl font-bold text-emerald-400">{prediction.home.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">escanteios</p>
          </div>
          <div className="p-3 rounded-lg bg-violet-500/20 border border-violet-500/30 text-center relative">
            <p className="text-xs text-violet-400/80 mb-1">Total Esperado</p>
            <p className="text-3xl font-bold text-violet-300">{prediction.total.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">{prediction.minExpected} - {prediction.maxExpected}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/30 text-center">
            <p className="text-xs text-amber-400/80 mb-1">{h2h.awayTeam.split(" ")[0]}</p>
            <p className="text-2xl font-bold text-amber-400">{prediction.away.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">escanteios</p>
          </div>
        </div>

        {/* Over/Under Probabilities */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Percent className="w-4 h-4" />
            <span>Probabilidades Over/Under</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { line: "Over 8.5", prob: prediction.over85Prob },
              { line: "Over 9.5", prob: prediction.over95Prob },
              { line: "Over 10.5", prob: prediction.over105Prob },
              { line: "Over 11.5", prob: prediction.over115Prob },
            ].map(item => (
              <div key={item.line} className="relative">
                <div className="p-2 rounded-lg bg-background/50 border border-border/50 text-center overflow-hidden">
                  <div 
                    className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 to-transparent"
                    style={{ height: `${item.prob}%`, bottom: 0, top: 'auto' }}
                  />
                  <p className="text-xs text-muted-foreground relative z-10">{item.line}</p>
                  <p className={`text-lg font-bold relative z-10 ${
                    item.prob >= 65 ? 'text-emerald-400' : 
                    item.prob >= 45 ? 'text-amber-400' : 
                    'text-red-400'
                  }`}>
                    {item.prob.toFixed(0)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best Bet Recommendation */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-background/30 border border-border/50">
          <ArrowRight className="w-5 h-5 text-violet-400" />
          <div className="flex-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Recomendação:</span>{" "}
              <span className="font-bold text-violet-300">{prediction.bestBet.line}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {prediction.bestBet.prob.toFixed(0)}% de probabilidade • Aposta {prediction.bestBet.recommendation}
            </p>
          </div>
          <Badge variant="outline" className={`${
            prediction.bestBet.recommendation === 'Forte' ? 'border-emerald-500 text-emerald-400' :
            prediction.bestBet.recommendation === 'Boa' ? 'border-amber-500 text-amber-400' :
            'border-muted-foreground'
          }`}>
            {prediction.bestBet.recommendation}
          </Badge>
        </div>
      </div>

      {/* Win/Draw/Loss Record */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <Trophy className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-emerald-400">{stats.team1Wins}</p>
          <p className="text-xs text-muted-foreground">{h2h.homeTeam.split(" ")[0]}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
          <Minus className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-bold">{stats.draws}</p>
          <p className="text-xs text-muted-foreground">Empates</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <Trophy className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-amber-400">{stats.team2Wins}</p>
          <p className="text-xs text-muted-foreground">{h2h.awayTeam.split(" ")[0]}</p>
        </div>
      </div>

      {/* Corner Averages */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
          <p className="text-xs text-muted-foreground mb-1">Média Total</p>
          <p className="text-2xl font-bold text-primary">{h2h.avgTotalCorners.toFixed(1)}</p>
        </div>
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-xs text-muted-foreground mb-1">{h2h.homeTeam.split(" ")[0]}</p>
          <p className="text-2xl font-bold text-emerald-400">{h2h.avgHomeCorners.toFixed(1)}</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-xs text-muted-foreground mb-1">{h2h.awayTeam.split(" ")[0]}</p>
          <p className="text-2xl font-bold text-amber-400">{h2h.avgAwayCorners.toFixed(1)}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
          <p className="text-xs text-muted-foreground mb-1">Tendência</p>
          <div className="flex items-center justify-center gap-1">
            {getTrendIcon()}
            <span className="text-sm font-medium">{getTrendText()}</span>
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      {chartData.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Evolução de Escanteios</h4>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 10 }} stroke="#666" width={25} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value, name) => [
                    value ?? 0, 
                    name === 'total' ? 'Total' : name === 'home' ? h2h.homeTeam.split(" ")[0] : h2h.awayTeam.split(" ")[0]
                  ]}
                />
                <ReferenceLine y={9.5} stroke="#f59e0b" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                <Line type="monotone" dataKey="home" stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                <Line type="monotone" dataKey="away" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center">Linha pontilhada: Over 9.5</p>
        </div>
      )}

      {/* Over/Under Stats */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Estatísticas Over/Under</h4>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Over 8.5", count: stats.over85, pct: (stats.over85 / stats.total * 100).toFixed(0) },
            { label: "Over 9.5", count: stats.over95, pct: (stats.over95 / stats.total * 100).toFixed(0) },
            { label: "Over 10.5", count: stats.over105, pct: (stats.over105 / stats.total * 100).toFixed(0) },
            { label: "Over 11.5", count: stats.over115, pct: (stats.over115 / stats.total * 100).toFixed(0) },
          ].map(stat => (
            <div key={stat.label} className="p-2 rounded-lg bg-muted/20 border border-border/30 text-center">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-lg font-bold ${Number(stat.pct) >= 60 ? 'text-emerald-400' : Number(stat.pct) >= 40 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                {stat.pct}%
              </p>
              <p className="text-xs text-muted-foreground">{stat.count}/{stats.total}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Corner Distribution */}
      {chartData.length > 2 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Distribuição de Escanteios</h4>
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="#666" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value) => [value ?? 0, 'Jogos']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.count > 0 ? (
                        index >= 2 ? '#10b981' : index === 1 ? '#f59e0b' : '#6b7280'
                      ) : '#374151'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Match History */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Histórico de Jogos</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {h2h.matches.map((match, i) => (
            <div 
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30"
            >
              <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[70px]">
                <Calendar className="w-3 h-3" />
                {new Date(match.date).toLocaleDateString("pt-BR", { 
                  day: "2-digit", 
                  month: "short",
                  year: "2-digit"
                })}
              </div>
              <div className="flex-1 flex items-center justify-center gap-2 text-sm">
                <span className={`font-medium ${match.homeScore > match.awayScore ? 'text-emerald-400' : ''}`}>
                  {h2h.homeTeam.split(" ")[0]}
                </span>
                <Badge variant="outline" className="font-mono">
                  {match.homeScore} - {match.awayScore}
                </Badge>
                <span className={`font-medium ${match.awayScore > match.homeScore ? 'text-amber-400' : ''}`}>
                  {h2h.awayTeam.split(" ")[0]}
                </span>
              </div>
              <div className="flex items-center gap-1 min-w-[70px] justify-end">
                <CornerUpRight className="w-3 h-3 text-primary" />
                <span className={`font-bold ${
                  match.totalCorners >= 11 
                    ? "text-emerald-400" 
                    : match.totalCorners >= 9 
                      ? "text-amber-400"
                      : "text-muted-foreground"
                }`}>
                  {match.totalCorners}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({match.homeCorners}-{match.awayCorners})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <Target className="w-4 h-4" />
          Análise Detalhada
        </h4>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Média histórica:</span>{" "}
            <span className="font-medium">{h2h.avgTotalCorners.toFixed(1)} escanteios</span>
            {" "}(mín: {stats.minCorners}, máx: {stats.maxCorners})
          </p>
          <p>
            <span className="text-muted-foreground">Melhor aposta:</span>{" "}
            {Number((stats.over95 / stats.total * 100).toFixed(0)) >= 60 ? (
              <span className="text-emerald-400 font-medium">Over 9.5 ({(stats.over95 / stats.total * 100).toFixed(0)}% histórico)</span>
            ) : Number((stats.over85 / stats.total * 100).toFixed(0)) >= 70 ? (
              <span className="text-emerald-400 font-medium">Over 8.5 ({(stats.over85 / stats.total * 100).toFixed(0)}% histórico)</span>
            ) : (
              <span className="text-amber-400 font-medium">Confronto imprevisível - cautela</span>
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Domínio:</span>{" "}
            {h2h.avgHomeCorners > h2h.avgAwayCorners + 1 ? (
              <span className="text-emerald-400">{h2h.homeTeam} força mais em casa</span>
            ) : h2h.avgAwayCorners > h2h.avgHomeCorners + 1 ? (
              <span className="text-amber-400">{h2h.awayTeam} surpreende fora</span>
            ) : (
              <span>Equilíbrio nos escanteios</span>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}
