"use client";

import { useMemo, useState } from "react";
import { Target, TrendingUp, Calendar, ChevronDown, ChevronUp, BarChart3, AlertCircle, Check, Filter, X, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type DetailedTeamStats,
  type NextMatch,
  findTeamByName,
  getHeadToHead,
  upcomingMatches,
} from "@/data/teamCornerStats";
import { DateFilterCompact, DateFilterOption, getDateRange } from "./DateFilter";

interface PredictionFilters {
  dateFilter: DateFilterOption;
  minExpectedTotal: number | null;
  maxExpectedTotal: number | null;
  minExpected1stHalf: number | null;
  maxExpected1stHalf: number | null;
  minExpected2ndHalf: number | null;
  onlyStrongPicks: boolean;
  searchTeam: string;
}

const defaultFilters: PredictionFilters = {
  dateFilter: "all",
  minExpectedTotal: null,
  maxExpectedTotal: null,
  minExpected1stHalf: null,
  maxExpected1stHalf: null,
  minExpected2ndHalf: null,
  onlyStrongPicks: false,
  searchTeam: "",
};

interface PredictionData {
  match: NextMatch;
  homeTeam: DetailedTeamStats | null;
  awayTeam: DetailedTeamStats | null;
  expectedTotal: number;
  homeCorners: number;
  awayCorners: number;
  expected1stHalf: number;
  expected2ndHalf: number;
  home1stHalf: number;
  away1stHalf: number;
  home2ndHalf: number;
  away2ndHalf: number;
  confidence: "alta" | "média" | "baixa";
  over75: number;
  over85: number;
  over95: number;
  over105: number;
  over115: number;
  over35_1stHalf: number;
  over45_1stHalf: number;
  over55_1stHalf: number;
  recommendation: {
    market: string;
    probability: number;
    edge: "forte" | "moderada" | "fraca";
  };
}

function calculatePrediction(
  homeTeam: DetailedTeamStats | null,
  awayTeam: DetailedTeamStats | null,
  h2hAvg: number | null
): Omit<PredictionData, "match" | "homeTeam" | "awayTeam"> | null {
  if (!homeTeam || !awayTeam) return null;

  const weights = { base: 0.4, recent: 0.25, h2h: 0.2, overall: 0.15 };

  let homeExpected = 
    homeTeam.avgCornersHome * weights.base +
    homeTeam.avgLast5 * weights.recent +
    homeTeam.avgCornersFor * weights.overall;
  
  let awayExpected = 
    awayTeam.avgCornersAway * weights.base +
    awayTeam.avgLast5 * weights.recent +
    awayTeam.avgCornersFor * weights.overall;

  if (h2hAvg) {
    const h2hAdjustment = (h2hAvg - (homeExpected + awayExpected)) * weights.h2h;
    homeExpected += h2hAdjustment / 2;
    awayExpected += h2hAdjustment / 2;
  } else {
    homeExpected *= 1 + weights.h2h;
    awayExpected *= 1 + weights.h2h;
  }

  const expectedTotal = homeExpected + awayExpected;
  const variance = 2.5;
  
  // Calculate 1st and 2nd half predictions
  const home1stHalf = homeTeam.avgCornersFirstHalf * 0.6 + (homeExpected * 0.45) * 0.4;
  const away1stHalf = awayTeam.avgCornersFirstHalf * 0.6 + (awayExpected * 0.45) * 0.4;
  const home2ndHalf = homeTeam.avgCornersSecondHalf * 0.6 + (homeExpected * 0.55) * 0.4;
  const away2ndHalf = awayTeam.avgCornersSecondHalf * 0.6 + (awayExpected * 0.55) * 0.4;
  
  const expected1stHalf = home1stHalf + away1stHalf;
  const expected2ndHalf = home2ndHalf + away2ndHalf;
  
  const calcOverProb = (threshold: number) => {
    const zScore = (threshold - expectedTotal) / variance;
    const prob = 100 * (1 - (0.5 * (1 + Math.tanh(zScore * 0.8))));
    return Math.min(95, Math.max(5, Math.round(prob)));
  };

  // 1st half over probabilities (lower variance for half)
  const variance1stHalf = 1.5;
  const calcOver1stHalfProb = (threshold: number) => {
    const zScore = (threshold - expected1stHalf) / variance1stHalf;
    const prob = 100 * (1 - (0.5 * (1 + Math.tanh(zScore * 0.8))));
    return Math.min(95, Math.max(5, Math.round(prob)));
  };

  const over75 = calcOverProb(7.5);
  const over85 = calcOverProb(8.5);
  const over95 = calcOverProb(9.5);
  const over105 = calcOverProb(10.5);
  const over115 = calcOverProb(11.5);
  
  const over35_1stHalf = calcOver1stHalfProb(3.5);
  const over45_1stHalf = calcOver1stHalfProb(4.5);
  const over55_1stHalf = calcOver1stHalfProb(5.5);

  const homeConsistency = Math.abs(homeTeam.avgLast5 - homeTeam.avgCornersFor) < 1;
  const awayConsistency = Math.abs(awayTeam.avgLast5 - awayTeam.avgCornersFor) < 1;
  const hasH2H = h2hAvg !== null;
  
  let confidence: "alta" | "média" | "baixa" = "média";
  if (homeConsistency && awayConsistency && hasH2H) confidence = "alta";
  else if (!homeConsistency && !awayConsistency) confidence = "baixa";

  const markets = [
    { market: "Over 7.5", probability: over75, threshold: 65 },
    { market: "Over 8.5", probability: over85, threshold: 55 },
    { market: "Over 9.5", probability: over95, threshold: 50 },
    { market: "Over 10.5", probability: over105, threshold: 45 },
    { market: "Under 11.5", probability: 100 - over115, threshold: 55 },
    { market: "Under 10.5", probability: 100 - over105, threshold: 55 },
    { market: "Under 9.5", probability: 100 - over95, threshold: 60 },
  ];

  const bestMarket = markets.reduce((best, current) => {
    const currentEdge = current.probability - current.threshold;
    const bestEdge = best.probability - best.threshold;
    return currentEdge > bestEdge ? current : best;
  });

  const edgeValue = bestMarket.probability - 50;
  let edge: "forte" | "moderada" | "fraca" = "fraca";
  if (edgeValue > 20) edge = "forte";
  else if (edgeValue > 10) edge = "moderada";

  return {
    expectedTotal: Math.round(expectedTotal * 10) / 10,
    homeCorners: Math.round(homeExpected * 10) / 10,
    awayCorners: Math.round(awayExpected * 10) / 10,
    expected1stHalf: Math.round(expected1stHalf * 10) / 10,
    expected2ndHalf: Math.round(expected2ndHalf * 10) / 10,
    home1stHalf: Math.round(home1stHalf * 10) / 10,
    away1stHalf: Math.round(away1stHalf * 10) / 10,
    home2ndHalf: Math.round(home2ndHalf * 10) / 10,
    away2ndHalf: Math.round(away2ndHalf * 10) / 10,
    confidence,
    over75,
    over85,
    over95,
    over105,
    over115,
    over35_1stHalf,
    over45_1stHalf,
    over55_1stHalf,
    recommendation: { market: bestMarket.market, probability: bestMarket.probability, edge },
  };
}

interface PredictionCardProps {
  prediction: PredictionData;
  onSelect?: (home: string, away: string) => void;
}

function PredictionCard({ prediction, onSelect }: PredictionCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const matchDate = new Date(prediction.match.date);
  const formattedDate = matchDate.toLocaleDateString("pt-BR", { 
    weekday: "short", 
    day: "2-digit", 
    month: "2-digit" 
  });

  const confidenceColors = {
    alta: "bg-green-500/20 text-green-400 border-green-500/30",
    média: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    baixa: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const edgeColors = {
    forte: "text-green-400 bg-green-500/10",
    moderada: "text-amber-400 bg-amber-500/10",
    fraca: "text-muted-foreground bg-muted/30",
  };

  return (
    <Card className="overflow-hidden hover:border-primary/30 transition-colors">
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
            <Badge variant="outline" className="text-xs">{prediction.match.competition}</Badge>
          </div>
          <Badge className={confidenceColors[prediction.confidence]}>
            {prediction.confidence}
          </Badge>
        </div>

        {/* Teams and Prediction */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{prediction.match.homeTeam}</p>
            <p className="text-sm text-muted-foreground">vs</p>
            <p className="font-semibold truncate">{prediction.match.awayTeam}</p>
          </div>

          {/* Expected Total */}
          <div className="text-center px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-2xl font-bold text-primary">{prediction.expectedTotal}</p>
            <p className="text-xs text-muted-foreground">esperado</p>
          </div>

          {/* Recommendation */}
          <div className={`text-center px-4 py-2 rounded-lg ${edgeColors[prediction.recommendation.edge]}`}>
            <p className="text-lg font-bold">{prediction.recommendation.market}</p>
            <p className="text-sm font-medium">{prediction.recommendation.probability}%</p>
          </div>

          <Button variant="ghost" size="sm" className="ml-2">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-4">
          {/* Expected per Team */}
          <div className="flex items-center justify-center gap-8 py-2">
            <div className="text-center">
              <p className="text-lg font-medium">{prediction.homeCorners}</p>
              <p className="text-xs text-muted-foreground">{prediction.match.homeTeam}</p>
            </div>
            <span className="text-muted-foreground">+</span>
            <div className="text-center">
              <p className="text-lg font-medium">{prediction.awayCorners}</p>
              <p className="text-xs text-muted-foreground">{prediction.match.awayTeam}</p>
            </div>
          </div>

          {/* 1st/2nd Half Predictions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/30">
              <p className="text-xs text-violet-400 mb-1 font-medium">1º Tempo</p>
              <p className="text-2xl font-bold text-violet-400">{prediction.expected1stHalf}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {prediction.home1stHalf} + {prediction.away1stHalf}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <p className="text-xs text-cyan-400 mb-1 font-medium">2º Tempo</p>
              <p className="text-2xl font-bold text-cyan-400">{prediction.expected2ndHalf}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {prediction.home2ndHalf} + {prediction.away2ndHalf}
              </p>
            </div>
          </div>

          {/* 1st Half Over/Under */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">1º Tempo - Over/Under</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "3.5+", prob: prediction.over35_1stHalf },
                { label: "4.5+", prob: prediction.over45_1stHalf },
                { label: "5.5+", prob: prediction.over55_1stHalf },
              ].map(({ label, prob }) => (
                <div 
                  key={label} 
                  className={`text-center p-2 rounded-lg ${
                    prob >= 60 ? "bg-violet-500/10 border border-violet-500/30" : 
                    prob >= 45 ? "bg-amber-500/10 border border-amber-500/30" : 
                    "bg-muted/30 border border-border"
                  }`}
                >
                  <p className="text-xs text-muted-foreground">Over</p>
                  <p className="font-medium">{label}</p>
                  <p className={`text-lg font-bold ${
                    prob >= 60 ? "text-violet-400" : prob >= 45 ? "text-amber-400" : "text-muted-foreground"
                  }`}>{prob}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Over/Under Grid */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Jogo Completo - Over</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "7.5+", prob: prediction.over75 },
                { label: "8.5+", prob: prediction.over85 },
                { label: "9.5+", prob: prediction.over95 },
                { label: "10.5+", prob: prediction.over105 },
                { label: "11.5+", prob: prediction.over115 },
              ].map(({ label, prob }) => (
                <div 
                  key={label} 
                  className={`text-center p-2 rounded-lg ${
                    prob >= 60 ? "bg-green-500/10 border border-green-500/30" : 
                    prob >= 45 ? "bg-amber-500/10 border border-amber-500/30" : 
                    "bg-muted/30 border border-border"
                  }`}
                >
                  <p className="text-xs text-muted-foreground">Over</p>
                  <p className="font-medium">{label}</p>
                  <p className={`text-lg font-bold ${
                    prob >= 60 ? "text-green-400" : prob >= 45 ? "text-amber-400" : "text-muted-foreground"
                  }`}>{prob}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Under probabilities */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Jogo Completo - Under</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "7.5-", prob: 100 - prediction.over75 },
                { label: "8.5-", prob: 100 - prediction.over85 },
                { label: "9.5-", prob: 100 - prediction.over95 },
                { label: "10.5-", prob: 100 - prediction.over105 },
                { label: "11.5-", prob: 100 - prediction.over115 },
              ].map(({ label, prob }) => (
                <div 
                  key={label} 
                  className={`text-center p-2 rounded-lg ${
                    prob >= 60 ? "bg-blue-500/10 border border-blue-500/30" : 
                    prob >= 45 ? "bg-amber-500/10 border border-amber-500/30" : 
                    "bg-muted/30 border border-border"
                  }`}
                >
                  <p className="text-xs text-muted-foreground">Under</p>
                  <p className="font-medium">{label}</p>
                  <p className={`text-lg font-bold ${
                    prob >= 60 ? "text-blue-400" : prob >= 45 ? "text-amber-400" : "text-muted-foreground"
                  }`}>{prob}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          {onSelect && (
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onSelect(prediction.match.homeTeam, prediction.match.awayTeam);
              }}
              className="w-full"
              variant="outline"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Ver análise completa
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

interface PredictionsTabProps {
  onSelectMatch?: (home: string, away: string) => void;
}

export function PredictionsTab({ onSelectMatch }: PredictionsTabProps) {
  const [filters, setFilters] = useState<PredictionFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);

  const allPredictions = useMemo(() => {
    return upcomingMatches
      .map(match => {
        const homeTeam = findTeamByName(match.homeTeam) ?? null;
        const awayTeam = findTeamByName(match.awayTeam) ?? null;
        const h2h = getHeadToHead(match.homeTeam, match.awayTeam);
        const prediction = calculatePrediction(homeTeam, awayTeam, h2h?.avgTotalCorners ?? null);
        
        if (!prediction) return null;
        
        return {
          match,
          homeTeam,
          awayTeam,
          ...prediction,
        } as PredictionData;
      })
      .filter((p): p is PredictionData => p !== null);
  }, []);

  // Apply filters
  const predictions = useMemo(() => {
    return allPredictions.filter(p => {
      // Date filter
      if (filters.dateFilter !== "all") {
        const dateRange = getDateRange(filters.dateFilter);
        if (dateRange) {
          const matchDate = new Date(p.match.date);
          const start = new Date(dateRange.start);
          const end = new Date(dateRange.end);
          if (matchDate < start || matchDate > end) return false;
        }
      }

      // Total corners filter
      if (filters.minExpectedTotal !== null && p.expectedTotal < filters.minExpectedTotal) return false;
      if (filters.maxExpectedTotal !== null && p.expectedTotal > filters.maxExpectedTotal) return false;

      // 1st half filter
      if (filters.minExpected1stHalf !== null && p.expected1stHalf < filters.minExpected1stHalf) return false;
      if (filters.maxExpected1stHalf !== null && p.expected1stHalf > filters.maxExpected1stHalf) return false;

      // 2nd half filter
      if (filters.minExpected2ndHalf !== null && p.expected2ndHalf < filters.minExpected2ndHalf) return false;

      // Strong picks only
      if (filters.onlyStrongPicks && p.recommendation.edge !== "forte") return false;

      // Team search
      if (filters.searchTeam) {
        const search = filters.searchTeam.toLowerCase();
        if (!p.match.homeTeam.toLowerCase().includes(search) && 
            !p.match.awayTeam.toLowerCase().includes(search)) return false;
      }

      return true;
    });
  }, [allPredictions, filters]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, PredictionData[]> = {};
    predictions.forEach(p => {
      const date = p.match.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(p);
    });
    return groups;
  }, [predictions]);

  // Summary stats
  const strongPicks = predictions.filter(p => p.recommendation.edge === "forte");
  const moderatePicks = predictions.filter(p => p.recommendation.edge === "moderada");
  const avgExpected = predictions.length > 0 
    ? (predictions.reduce((sum, p) => sum + p.expectedTotal, 0) / predictions.length).toFixed(1)
    : "0";

  const hasActiveFilters = filters.dateFilter !== "all" || 
    filters.minExpectedTotal !== null || 
    filters.maxExpectedTotal !== null ||
    filters.minExpected1stHalf !== null ||
    filters.maxExpected1stHalf !== null ||
    filters.minExpected2ndHalf !== null ||
    filters.onlyStrongPicks ||
    filters.searchTeam !== "";

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card className="p-5 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Previsões de Escanteios</h2>
              <p className="text-sm text-muted-foreground">Análise estatística dos próximos jogos</p>
            </div>
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <Badge className="ml-1 bg-primary/20 text-primary text-xs px-1.5">!</Badge>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-background/50">
            <p className="text-2xl font-bold text-green-400">{strongPicks.length}</p>
            <p className="text-xs text-muted-foreground">Apostas fortes</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background/50">
            <p className="text-2xl font-bold text-amber-400">{moderatePicks.length}</p>
            <p className="text-xs text-muted-foreground">Apostas moderadas</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background/50">
            <p className="text-2xl font-bold text-primary">{avgExpected}</p>
            <p className="text-xs text-muted-foreground">Média esperada</p>
          </div>
        </div>
      </Card>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4 border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtrar Previsões
            </h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters(defaultFilters)}
                className="text-muted-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {/* Team search */}
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Buscar time</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Ex: Flamengo, Palmeiras..."
                  value={filters.searchTeam}
                  onChange={(e) => setFilters({...filters, searchTeam: e.target.value})}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted/30 border border-border text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            {/* Date filter */}
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Data</label>
              <DateFilterCompact
                value={filters.dateFilter}
                onChange={(val) => setFilters({...filters, dateFilter: val})}
              />
            </div>

            {/* Total corners range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Total mínimo</label>
                <select
                  value={filters.minExpectedTotal ?? ""}
                  onChange={(e) => setFilters({...filters, minExpectedTotal: e.target.value ? Number(e.target.value) : null})}
                  className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm"
                >
                  <option value="">Qualquer</option>
                  {[7, 8, 9, 10, 11, 12].map(n => (
                    <option key={n} value={n}>{n}+ esperados</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Total máximo</label>
                <select
                  value={filters.maxExpectedTotal ?? ""}
                  onChange={(e) => setFilters({...filters, maxExpectedTotal: e.target.value ? Number(e.target.value) : null})}
                  className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm"
                >
                  <option value="">Qualquer</option>
                  {[8, 9, 10, 11, 12, 13].map(n => (
                    <option key={n} value={n}>até {n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 1st half range */}
            <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
              <label className="text-sm text-violet-400 mb-2 block font-medium">1º Tempo</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Mínimo 1T</label>
                  <select
                    value={filters.minExpected1stHalf ?? ""}
                    onChange={(e) => setFilters({...filters, minExpected1stHalf: e.target.value ? Number(e.target.value) : null})}
                    className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm"
                  >
                    <option value="">Qualquer</option>
                    {[3, 3.5, 4, 4.5, 5, 5.5, 6].map(n => (
                      <option key={n} value={n}>{n}+ no 1T</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Máximo 1T</label>
                  <select
                    value={filters.maxExpected1stHalf ?? ""}
                    onChange={(e) => setFilters({...filters, maxExpected1stHalf: e.target.value ? Number(e.target.value) : null})}
                    className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm"
                  >
                    <option value="">Qualquer</option>
                    {[3.5, 4, 4.5, 5, 5.5, 6].map(n => (
                      <option key={n} value={n}>até {n}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2nd half min */}
            <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
              <label className="text-sm text-cyan-400 mb-2 block font-medium">2º Tempo</label>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mínimo 2T</label>
                <select
                  value={filters.minExpected2ndHalf ?? ""}
                  onChange={(e) => setFilters({...filters, minExpected2ndHalf: e.target.value ? Number(e.target.value) : null})}
                  className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm"
                >
                  <option value="">Qualquer</option>
                  {[3.5, 4, 4.5, 5, 5.5, 6, 6.5].map(n => (
                    <option key={n} value={n}>{n}+ no 2T</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Strong picks only */}
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <input
                type="checkbox"
                checked={filters.onlyStrongPicks}
                onChange={(e) => setFilters({...filters, onlyStrongPicks: e.target.checked})}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm">
                <span className="text-green-400 font-medium">Apenas apostas fortes</span>
                <span className="text-muted-foreground ml-1">(edge &gt; 20%)</span>
              </span>
            </label>
          </div>
        </Card>
      )}

      {/* Results count when filtered */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            {predictions.length} de {allPredictions.length} jogos
          </p>
        </div>
      )}

      {/* Strong Picks Highlight */}
      {strongPicks.length > 0 && (
        <Card className="p-4 border-green-500/30 bg-gradient-to-r from-green-500/5 to-emerald-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-green-400">Melhores Oportunidades</h3>
          </div>
          <div className="space-y-2">
            {strongPicks.map((p, i) => (
              <div 
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-background/50 cursor-pointer hover:bg-background/80 transition-colors"
                onClick={() => onSelectMatch?.(p.match.homeTeam, p.match.awayTeam)}
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="font-medium">{p.match.homeTeam} vs {p.match.awayTeam}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-500/20 text-green-400">{p.recommendation.market}</Badge>
                  <span className="font-bold text-green-400">{p.recommendation.probability}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Predictions by Date */}
      {Object.entries(groupedByDate).map(([date, preds]) => {
        const formattedDate = new Date(date).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        
        return (
          <div key={date} className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2 capitalize">
              <Calendar className="w-5 h-5 text-primary" />
              {formattedDate}
            </h3>
            <div className="space-y-3">
              {preds.map((prediction, i) => (
                <PredictionCard 
                  key={i} 
                  prediction={prediction} 
                  onSelect={onSelectMatch}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Disclaimer */}
      <Card className="p-4 bg-muted/20 border-muted">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Aviso:</span> Estas previsões são baseadas em dados históricos. 
              Resultados podem variar devido a fatores imprevisíveis. Use como referência, não como garantia.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
