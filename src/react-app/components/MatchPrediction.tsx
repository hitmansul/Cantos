import { useMemo } from "react";
import { TrendingUp, TrendingDown, Target, BarChart3, AlertCircle, CheckCircle2, XCircle, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import {
  type DetailedTeamStats,
  type NextMatch,
  findTeamByName,
  getHeadToHead,
} from "@/react-app/data/teamCornerStats";

interface PredictionResult {
  expectedTotal: number;
  homeCorners: number;
  awayCorners: number;
  confidence: "alta" | "média" | "baixa";
  over75: number;
  over85: number;
  over95: number;
  over105: number;
  over115: number;
  recommendation: {
    market: string;
    probability: number;
    edge: "forte" | "moderada" | "fraca";
  };
  factors: {
    label: string;
    impact: "positivo" | "negativo" | "neutro";
    value: string;
  }[];
}

function calculatePrediction(
  homeTeam: DetailedTeamStats | null,
  awayTeam: DetailedTeamStats | null,
  h2hAvg: number | null
): PredictionResult | null {
  if (!homeTeam || !awayTeam) return null;

  // Base calculation: home team's home avg + away team's away avg
  const homeBase = homeTeam.avgCornersHome;
  const awayBase = awayTeam.avgCornersAway;
  
  // Weight factors
  const weights = {
    base: 0.4,
    recent: 0.25,
    h2h: 0.2,
    overall: 0.15,
  };

  // Recent form adjustment
  const homeRecent = homeTeam.avgLast5;
  const awayRecent = awayTeam.avgLast5;
  
  // Overall tendency
  const homeOverall = homeTeam.avgCornersFor;
  const awayOverall = awayTeam.avgCornersFor;

  // Calculate expected corners for each team
  let homeExpected = 
    homeBase * weights.base +
    homeRecent * weights.recent +
    homeOverall * weights.overall;
  
  let awayExpected = 
    awayBase * weights.base +
    awayRecent * weights.recent +
    awayOverall * weights.overall;

  // H2H adjustment
  if (h2hAvg) {
    const h2hAdjustment = (h2hAvg - (homeExpected + awayExpected)) * weights.h2h;
    homeExpected += h2hAdjustment / 2;
    awayExpected += h2hAdjustment / 2;
  } else {
    // Redistribute H2H weight to other factors
    homeExpected *= 1 + weights.h2h;
    awayExpected *= 1 + weights.h2h;
  }

  const expectedTotal = homeExpected + awayExpected;

  // Calculate probabilities using a simplified model
  // Based on Poisson-like distribution assumptions
  const variance = 2.5; // Typical variance in corner totals
  
  const calcOverProb = (threshold: number) => {
    const zScore = (threshold - expectedTotal) / variance;
    // Simplified probability calculation
    const prob = 100 * (1 - (0.5 * (1 + Math.tanh(zScore * 0.8))));
    return Math.min(95, Math.max(5, Math.round(prob)));
  };

  const over75 = calcOverProb(7.5);
  const over85 = calcOverProb(8.5);
  const over95 = calcOverProb(9.5);
  const over105 = calcOverProb(10.5);
  const over115 = calcOverProb(11.5);

  // Determine confidence based on data consistency
  const homeConsistency = Math.abs(homeTeam.avgLast5 - homeTeam.avgCornersFor) < 1;
  const awayConsistency = Math.abs(awayTeam.avgLast5 - awayTeam.avgCornersFor) < 1;
  const hasH2H = h2hAvg !== null;
  
  let confidence: "alta" | "média" | "baixa" = "média";
  if (homeConsistency && awayConsistency && hasH2H) {
    confidence = "alta";
  } else if (!homeConsistency && !awayConsistency) {
    confidence = "baixa";
  }

  // Find best recommendation
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

  // Build factors analysis
  const factors: PredictionResult["factors"] = [];
  
  // Home form
  if (homeTeam.avgLast5 > homeTeam.avgCornersFor + 0.5) {
    factors.push({
      label: `${homeTeam.team} em boa fase`,
      impact: "positivo",
      value: `${homeTeam.avgLast5.toFixed(1)} últimos 5 jogos`,
    });
  } else if (homeTeam.avgLast5 < homeTeam.avgCornersFor - 0.5) {
    factors.push({
      label: `${homeTeam.team} em má fase`,
      impact: "negativo",
      value: `${homeTeam.avgLast5.toFixed(1)} últimos 5 jogos`,
    });
  }

  // Away form
  if (awayTeam.avgLast5 > awayTeam.avgCornersFor + 0.5) {
    factors.push({
      label: `${awayTeam.team} em boa fase`,
      impact: "positivo",
      value: `${awayTeam.avgLast5.toFixed(1)} últimos 5 jogos`,
    });
  } else if (awayTeam.avgLast5 < awayTeam.avgCornersFor - 0.5) {
    factors.push({
      label: `${awayTeam.team} em má fase`,
      impact: "negativo",
      value: `${awayTeam.avgLast5.toFixed(1)} últimos 5 jogos`,
    });
  }

  // Home advantage
  if (homeTeam.avgCornersHome > homeTeam.avgCornersAway + 0.8) {
    factors.push({
      label: "Forte vantagem de casa",
      impact: "positivo",
      value: `+${(homeTeam.avgCornersHome - homeTeam.avgCornersAway).toFixed(1)} em casa`,
    });
  }

  // H2H influence
  if (h2hAvg) {
    if (h2hAvg > expectedTotal - 0.5) {
      factors.push({
        label: "H2H favorece mais escanteios",
        impact: "positivo",
        value: `${h2hAvg.toFixed(1)} média histórica`,
      });
    } else if (h2hAvg < expectedTotal - 1) {
      factors.push({
        label: "H2H favorece menos escanteios",
        impact: "negativo",
        value: `${h2hAvg.toFixed(1)} média histórica`,
      });
    }
  } else {
    factors.push({
      label: "Sem dados de H2H",
      impact: "neutro",
      value: "Previsão menos precisa",
    });
  }

  // First corner tendency
  if (homeTeam.firstCornerPct > 60 || awayTeam.firstCornerPct < 40) {
    factors.push({
      label: `${homeTeam.team} tende a ter 1º escanteio`,
      impact: "neutro",
      value: `${homeTeam.firstCornerPct}% das vezes`,
    });
  }

  return {
    expectedTotal: Math.round(expectedTotal * 10) / 10,
    homeCorners: Math.round(homeExpected * 10) / 10,
    awayCorners: Math.round(awayExpected * 10) / 10,
    confidence,
    over75,
    over85,
    over95,
    over105,
    over115,
    recommendation: {
      market: bestMarket.market,
      probability: bestMarket.probability,
      edge,
    },
    factors,
  };
}

interface MatchPredictionProps {
  match: NextMatch;
}

export function MatchPrediction({ match }: MatchPredictionProps) {
  const homeTeam = findTeamByName(match.homeTeam) ?? null;
  const awayTeam = findTeamByName(match.awayTeam) ?? null;
  const h2h = getHeadToHead(match.homeTeam, match.awayTeam);
  
  const prediction = useMemo(
    () => calculatePrediction(homeTeam, awayTeam, h2h?.avgTotalCorners ?? null),
    [homeTeam, awayTeam, h2h]
  );

  if (!prediction) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <AlertCircle className="w-5 h-5" />
          <p>Dados insuficientes para gerar previsão</p>
        </div>
      </Card>
    );
  }

  const confidenceColors = {
    alta: "bg-green-500/20 text-green-400 border-green-500/30",
    média: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    baixa: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const edgeColors = {
    forte: "text-green-400",
    moderada: "text-amber-400",
    fraca: "text-muted-foreground",
  };

  const impactIcons = {
    positivo: <TrendingUp className="w-4 h-4 text-green-400" />,
    negativo: <TrendingDown className="w-4 h-4 text-red-400" />,
    neutro: <Minus className="w-4 h-4 text-muted-foreground" />,
  };

  return (
    <div className="space-y-4">
      {/* Main Prediction Card */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-primary" />
              Previsão de Escanteios
            </CardTitle>
            <Badge className={confidenceColors[prediction.confidence]}>
              Confiança {prediction.confidence}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          {/* Expected Corners */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Total esperado</p>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{prediction.expectedTotal}</p>
                <p className="text-xs text-muted-foreground mt-1">escanteios</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-8 mt-4">
              <div className="text-center">
                <p className="font-medium">{prediction.homeCorners}</p>
                <p className="text-xs text-muted-foreground">{match.homeTeam}</p>
              </div>
              <div className="text-muted-foreground">+</div>
              <div className="text-center">
                <p className="font-medium">{prediction.awayCorners}</p>
                <p className="text-xs text-muted-foreground">{match.awayTeam}</p>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Recomendação</p>
                  <p className="text-2xl font-bold">{prediction.recommendation.market}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-bold ${edgeColors[prediction.recommendation.edge]}`}>
                  {prediction.recommendation.probability}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Vantagem {prediction.recommendation.edge}
                </p>
              </div>
            </div>
          </div>

          {/* Over/Under Probabilities */}
          <div>
            <p className="text-sm font-medium mb-3">Probabilidades Over/Under</p>
            <div className="space-y-2">
              {[
                { label: "Over 7.5", prob: prediction.over75 },
                { label: "Over 8.5", prob: prediction.over85 },
                { label: "Over 9.5", prob: prediction.over95 },
                { label: "Over 10.5", prob: prediction.over105 },
                { label: "Over 11.5", prob: prediction.over115 },
              ].map(({ label, prob }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-sm w-20">{label}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        prob >= 60 ? "bg-green-500" : prob >= 45 ? "bg-amber-500" : "bg-red-400"
                      }`}
                      style={{ width: `${prob}%` }}
                    />
                  </div>
                  <span className={`text-sm font-medium w-12 text-right ${
                    prob >= 60 ? "text-green-400" : prob >= 45 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {prob}%
                  </span>
                  {prob >= 55 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : prob <= 40 ? (
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Factors Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fatores da Análise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {prediction.factors.map((factor, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
              >
                {impactIcons[factor.impact]}
                <div className="flex-1">
                  <p className="font-medium text-sm">{factor.label}</p>
                  <p className="text-xs text-muted-foreground">{factor.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Card className="p-4 bg-muted/20 border-muted">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Aviso:</span> Estas previsões são baseadas em dados históricos e estatísticas. 
              Resultados reais podem variar devido a fatores não previsíveis como condições climáticas, 
              lesões, mudanças táticas, etc. Use como referência, não como garantia.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Compact version for listing
interface CompactPredictionProps {
  match: NextMatch;
  onClick?: () => void;
}

export function CompactMatchPrediction({ match, onClick }: CompactPredictionProps) {
  const homeTeam = findTeamByName(match.homeTeam) ?? null;
  const awayTeam = findTeamByName(match.awayTeam) ?? null;
  const h2h = getHeadToHead(match.homeTeam, match.awayTeam);
  
  const prediction = useMemo(
    () => calculatePrediction(homeTeam, awayTeam, h2h?.avgTotalCorners ?? null),
    [homeTeam, awayTeam, h2h]
  );

  if (!prediction) return null;

  return (
    <div
      className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 cursor-pointer hover:border-primary/40 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Previsão:</span>
          <span className="text-lg font-bold text-primary">{prediction.expectedTotal}</span>
          <span className="text-xs text-muted-foreground">escanteios</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {prediction.recommendation.market}
          </Badge>
          <span className={`text-sm font-medium ${
            prediction.recommendation.probability >= 60 ? "text-green-400" : 
            prediction.recommendation.probability >= 50 ? "text-amber-400" : "text-muted-foreground"
          }`}>
            {prediction.recommendation.probability}%
          </span>
        </div>
      </div>
    </div>
  );
}
