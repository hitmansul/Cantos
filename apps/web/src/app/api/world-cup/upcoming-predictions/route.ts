import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type MainPrediction = {
  id: string | number;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string | null;
  groupName?: string | null;
  roundName?: string | null;
  status?: string | null;
  sourceKey?: string | null;
  prediction?: {
    corners?: {
      home?: number;
      away?: number;
      total?: number;
      over75?: number;
      over85?: number;
      over95?: number;
      over105?: number;
    };
    cards?: {
      total?: number;
      over35?: number;
      over45?: number;
      over55?: number;
    };
    goals?: {
      homeXg?: number;
      awayXg?: number;
      totalXg?: number;
      over25?: number;
      bothTeamsScore?: number;
    };
    shots?: {
      home?: number;
      away?: number;
      total?: number;
    };
    fifaAverages?: Record<string, number>;
    recentHistory?: Record<string, unknown>;
    confidence?: number;
    note?: string;
  };
  samples?: { homeMatches?: number; awayMatches?: number };
};

type MainResponse = {
  success?: boolean;
  predictions?: MainPrediction[];
  sources?: Record<string, unknown>;
  lastUpdated?: string;
};

function clamp(value: number, min = 5, max = 95) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function probability(value: unknown, fallback: number) {
  const number = Number(value);
  return clamp(Number.isFinite(number) ? number : fallback);
}

function isFinished(status: unknown) {
  const value = String(status ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ['finished', 'final', 'fim', 'ft', 'encerrado'].some((term) => value.includes(term));
}

function toLegacyPrediction(row: MainPrediction) {
  const corners = row.prediction?.corners ?? {};
  const cards = row.prediction?.cards ?? {};
  const goals = row.prediction?.goals ?? {};
  const shots = row.prediction?.shots ?? {};
  const confidenceNumber = Number(row.prediction?.confidence ?? 35);

  return {
    matchId: row.id,
    fixtureKey: String(row.id),
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    groupName: row.groupName ?? null,
    roundName: row.roundName ?? null,
    kickoffAt: row.kickoffAt,
    status: row.status ?? 'Agendado',
    sourceKey: row.sourceKey ?? 'world-cup-predictions',
    expectedCorners: Number(corners.total ?? 9.4),
    corners: {
      homeExpected: Number(corners.home ?? 4.7),
      awayExpected: Number(corners.away ?? 4.7),
      expectedTotal: Number(corners.total ?? 9.4),
      over75: probability(corners.over75, 65),
      over85: probability(corners.over85, 55),
      over95: probability(corners.over95, 45),
      over105: probability(corners.over105, 35),
    },
    cards: {
      expectedTotal: Number(cards.total ?? 3.8),
      over35: probability(cards.over35, 54),
      over45: probability(cards.over45, 43),
      over55: probability(cards.over55, 31),
    },
    goals: {
      homeXg: Number(goals.homeXg ?? 1.2),
      awayXg: Number(goals.awayXg ?? 1.2),
      expectedTotalXg: Number(goals.totalXg ?? 2.4),
      over25: probability(goals.over25, 48),
      bothTeamsScore: probability(goals.bothTeamsScore, 52),
    },
    attack: {
      expectedXg: Number(goals.totalXg ?? 2.4),
      expectedShots: Number(shots.total ?? 21),
      homeShots: Number(shots.home ?? 10.5),
      awayShots: Number(shots.away ?? 10.5),
    },
    fifaAverages: row.prediction?.fifaAverages ?? {},
    recentHistory: row.prediction?.recentHistory ?? {},
    relevantStats: {
      sourcePriority: 'Banco persistido da Copa > FIFA > 365Scores/API-Football > fallback de calendário',
      samples: row.samples ?? { homeMatches: 0, awayMatches: 0 },
      note: row.prediction?.note ?? 'Modelo pronto para atualizar automaticamente quando houver novas estatísticas oficiais.',
    },
    confidence: confidenceNumber >= 70 ? 'alta' : confidenceNumber >= 50 ? 'media' : 'baixa',
    confidenceValue: confidenceNumber,
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL('/api/world-cup/predictions', request.nextUrl.origin);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Endpoint principal de previsões indisponível.');

    const payload = (await response.json()) as MainResponse;
    const predictions = (payload.predictions ?? [])
      .filter((match) => !isFinished(match.status))
      .map(toLegacyPrediction);

    return NextResponse.json({
      success: true,
      count: predictions.length,
      predictions,
      sources: payload.sources ?? {},
      lastUpdated: payload.lastUpdated ?? new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao gerar previsoes da Copa.',
        predictions: [],
      },
      { status: 500 }
    );
  }
}
