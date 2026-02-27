import { useMemo } from "react";
import { AlertTriangle, TrendingUp, Zap, Target, DollarSign, BarChart3, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import {
  type NextMatch,
  upcomingMatches,
  findTeamByName,
  getHeadToHead,
} from "@/react-app/data/teamCornerStats";

interface ValueBet {
  match: NextMatch;
  market: string;
  predictedProb: number;
  impliedProb: number;
  typicalOdds: number;
  fairOdds: number;
  edge: number;
  edgeType: "forte" | "moderada" | "fraca";
  confidence: "alta" | "média" | "baixa";
}

// Typical market odds for corner markets (based on common bookmaker offerings)
const TYPICAL_ODDS: Record<string, number> = {
  "Over 7.5": 1.35,
  "Over 8.5": 1.55,
  "Over 9.5": 1.85,
  "Over 10.5": 2.20,
  "Over 11.5": 2.75,
  "Under 7.5": 3.20,
  "Under 8.5": 2.45,
  "Under 9.5": 2.00,
  "Under 10.5": 1.70,
  "Under 11.5": 1.45,
};

function oddsToProb(odds: number): number {
  return (1 / odds) * 100;
}

function probToOdds(prob: number): number {
  return 100 / prob;
}

function calculateMatchPrediction(match: NextMatch) {
  const homeTeam = findTeamByName(match.homeTeam);
  const awayTeam = findTeamByName(match.awayTeam);
  const h2h = getHeadToHead(match.homeTeam, match.awayTeam);

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

  if (h2h) {
    const h2hAdjustment = (h2h.avgTotalCorners - (homeExpected + awayExpected)) * weights.h2h;
    homeExpected += h2hAdjustment / 2;
    awayExpected += h2hAdjustment / 2;
  } else {
    homeExpected *= 1 + weights.h2h;
    awayExpected *= 1 + weights.h2h;
  }

  const expectedTotal = homeExpected + awayExpected;
  const variance = 2.5;

  const calcOverProb = (threshold: number) => {
    const zScore = (threshold - expectedTotal) / variance;
    const prob = 100 * (1 - 0.5 * (1 + Math.tanh(zScore * 0.8)));
    return Math.min(95, Math.max(5, prob));
  };

  // Confidence based on data consistency
  const homeConsistency = Math.abs(homeTeam.avgLast5 - homeTeam.avgCornersFor) < 1;
  const awayConsistency = Math.abs(awayTeam.avgLast5 - awayTeam.avgCornersFor) < 1;
  const hasH2H = h2h !== null;

  let confidence: "alta" | "média" | "baixa" = "média";
  if (homeConsistency && awayConsistency && hasH2H) confidence = "alta";
  else if (!homeConsistency && !awayConsistency) confidence = "baixa";

  return {
    expectedTotal,
    probabilities: {
      "Over 7.5": calcOverProb(7.5),
      "Over 8.5": calcOverProb(8.5),
      "Over 9.5": calcOverProb(9.5),
      "Over 10.5": calcOverProb(10.5),
      "Over 11.5": calcOverProb(11.5),
      "Under 7.5": 100 - calcOverProb(7.5),
      "Under 8.5": 100 - calcOverProb(8.5),
      "Under 9.5": 100 - calcOverProb(9.5),
      "Under 10.5": 100 - calcOverProb(10.5),
      "Under 11.5": 100 - calcOverProb(11.5),
    },
    confidence,
  };
}

function findValueBets(): ValueBet[] {
  const valueBets: ValueBet[] = [];

  for (const match of upcomingMatches) {
    const prediction = calculateMatchPrediction(match);
    if (!prediction) continue;

    for (const [market, predictedProb] of Object.entries(prediction.probabilities)) {
      const typicalOdds = TYPICAL_ODDS[market];
      if (!typicalOdds) continue;

      const impliedProb = oddsToProb(typicalOdds);
      const edge = predictedProb - impliedProb;

      // Only consider significant edges (>5%)
      if (edge > 5) {
        let edgeType: "forte" | "moderada" | "fraca" = "fraca";
        if (edge > 15) edgeType = "forte";
        else if (edge > 10) edgeType = "moderada";

        valueBets.push({
          match,
          market,
          predictedProb: Math.round(predictedProb),
          impliedProb: Math.round(impliedProb),
          typicalOdds,
          fairOdds: Math.round(probToOdds(predictedProb) * 100) / 100,
          edge: Math.round(edge),
          edgeType,
          confidence: prediction.confidence,
        });
      }
    }
  }

  // Sort by edge (strongest first)
  return valueBets.sort((a, b) => b.edge - a.edge);
}

export function ValueAlerts() {
  const valueBets = useMemo(() => findValueBets(), []);

  const strongBets = valueBets.filter((b) => b.edgeType === "forte");
  const moderateBets = valueBets.filter((b) => b.edgeType === "moderada");
  const weakBets = valueBets.filter((b) => b.edgeType === "fraca");

  const edgeColors = {
    forte: "bg-green-500/20 text-green-400 border-green-500/30",
    moderada: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    fraca: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };

  if (valueBets.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum alerta de valor encontrado</p>
        <p className="text-sm text-muted-foreground mt-2">
          Os próximos jogos não apresentam divergências significativas entre previsões e odds típicas de mercado
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Alertas de Valor Encontrados</p>
              <p className="text-sm text-muted-foreground">
                {valueBets.length} oportunidades nos próximos jogos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {strongBets.length > 0 && (
              <Badge className={edgeColors.forte}>
                {strongBets.length} forte{strongBets.length > 1 ? "s" : ""}
              </Badge>
            )}
            {moderateBets.length > 0 && (
              <Badge className={edgeColors.moderada}>
                {moderateBets.length} moderada{moderateBets.length > 1 ? "s" : ""}
              </Badge>
            )}
            {weakBets.length > 0 && (
              <Badge className={edgeColors.fraca}>
                {weakBets.length} fraca{weakBets.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Strong Value Bets */}
      {strongBets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-green-400" />
            Vantagem Forte (+15%)
          </h3>
          <div className="grid gap-3">
            {strongBets.map((bet, index) => (
              <ValueBetCard key={`strong-${index}`} bet={bet} />
            ))}
          </div>
        </div>
      )}

      {/* Moderate Value Bets */}
      {moderateBets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            Vantagem Moderada (+10%)
          </h3>
          <div className="grid gap-3">
            {moderateBets.map((bet, index) => (
              <ValueBetCard key={`moderate-${index}`} bet={bet} />
            ))}
          </div>
        </div>
      )}

      {/* Weak Value Bets (collapsible or limited) */}
      {weakBets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Vantagem Pequena (+5%)
          </h3>
          <div className="grid gap-3">
            {weakBets.slice(0, 5).map((bet, index) => (
              <ValueBetCard key={`weak-${index}`} bet={bet} compact />
            ))}
            {weakBets.length > 5 && (
              <p className="text-sm text-muted-foreground text-center">
                + {weakBets.length - 5} outras oportunidades com vantagem pequena
              </p>
            )}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <Card className="p-4 bg-muted/20 border-muted">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <p className="text-sm">
              <span className="font-medium">Importante:</span> Alertas de valor são baseados em odds típicas de mercado
              e podem não refletir as odds atuais disponíveis. Sempre verifique as odds reais antes de apostar.
              A "vantagem" representa a diferença entre nossa probabilidade estimada e a probabilidade implícita nas odds típicas.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

interface ValueBetCardProps {
  bet: ValueBet;
  compact?: boolean;
}

function ValueBetCard({ bet, compact }: ValueBetCardProps) {
  const edgeColors = {
    forte: "border-green-500/30 bg-green-500/5",
    moderada: "border-amber-500/30 bg-amber-500/5",
    fraca: "border-blue-500/30 bg-blue-500/5",
  };

  const edgeBadgeColors = {
    forte: "bg-green-500/20 text-green-400",
    moderada: "bg-amber-500/20 text-amber-400",
    fraca: "bg-blue-500/20 text-blue-400",
  };

  const matchDate = new Date(bet.match.date);
  const isToday = new Date().toDateString() === matchDate.toDateString();
  const isTomorrow = new Date(Date.now() + 86400000).toDateString() === matchDate.toDateString();

  if (compact) {
    return (
      <Card className={`p-3 ${edgeColors[bet.edgeType]}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0">
              <Badge variant="outline" className="text-xs">
                {bet.market}
              </Badge>
            </div>
            <div className="truncate">
              <p className="text-sm font-medium truncate">
                {bet.match.homeTeam} x {bet.match.awayTeam}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm">
              {bet.predictedProb}% vs {bet.impliedProb}%
            </span>
            <Badge className={edgeBadgeColors[bet.edgeType]}>+{bet.edge}%</Badge>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${edgeColors[bet.edgeType]}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {bet.match.competition}
            </Badge>
            {isToday && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Hoje</Badge>
            )}
            {isTomorrow && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                Amanhã
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {matchDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </span>
        </div>
        <CardTitle className="text-base mt-2">
          {bet.match.homeTeam} x {bet.match.awayTeam}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Market and Edge */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{bet.market}</p>
              <p className="text-xs text-muted-foreground">Mercado recomendado</p>
            </div>
          </div>
          <Badge className={`text-lg px-3 py-1 ${edgeBadgeColors[bet.edgeType]}`}>
            +{bet.edge}% valor
          </Badge>
        </div>

        {/* Probability Comparison */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-lg bg-background/30">
            <p className="text-2xl font-bold text-primary">{bet.predictedProb}%</p>
            <p className="text-xs text-muted-foreground">Nossa previsão</p>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="p-3 rounded-lg bg-background/30">
            <p className="text-2xl font-bold text-muted-foreground">{bet.impliedProb}%</p>
            <p className="text-xs text-muted-foreground">Prob. do mercado</p>
          </div>
        </div>

        {/* Odds Comparison */}
        <div className="flex items-center justify-between text-sm border-t border-border/50 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Odds típica:</span>
            <span className="font-medium">{bet.typicalOdds}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Odds justa:</span>
            <span className="font-medium text-primary">{bet.fairOdds}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs">{bet.confidence === "alta" ? "🎯" : bet.confidence === "média" ? "📊" : "⚠️"}</span>
            <span className="text-xs text-muted-foreground">Confiança {bet.confidence}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
