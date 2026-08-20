import { NextResponse } from 'next/server';

type Scores365Game = {
  id: number;
  sportId?: number;
  statusGroup?: number;
  statusText?: string;
  gameTime?: number;
  preciseGameTime?: string;
  gameTimeDisplay?: string;
  competitionDisplayName?: string;
  competition?: { name?: string };
  homeCompetitor?: { id?: number; name?: string; score?: number; sportId?: number };
  awayCompetitor?: { id?: number; name?: string; score?: number };
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

function minuteValue(game: Scores365Game) {
  return game.preciseGameTime ?? game.gameTimeDisplay ?? (typeof game.gameTime === 'number' ? game.gameTime : game.statusText ?? 'AO VIVO');
}

export async function GET() {
  try {
    const response = await fetch(
      'https://webws.365scores.com/web/games/?appTypeId=5&langId=31&statuses=2',
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!response.ok) {
      return NextResponse.json({ matches: [], error: `365Scores ${response.status}` }, { status: 502 });
    }

    const data = (await response.json()) as { games?: Scores365Game[] };
    const matches = (data.games ?? [])
      .filter((game) => {
        const football = game.sportId === 1 || game.homeCompetitor?.sportId === 1;
        return football && game.statusGroup === 3 && game.homeCompetitor && game.awayCompetitor;
      })
      .map((game) => ({
        id: game.id,
        minute: minuteValue(game),
        statusText: game.statusText ?? 'Ao vivo',
        competition: game.competitionDisplayName ?? game.competition?.name ?? 'Competição',
        homeTeam: {
          id: game.homeCompetitor?.id ?? 0,
          name: game.homeCompetitor?.name ?? 'Mandante',
          score: game.homeCompetitor?.score ?? 0,
        },
        awayTeam: {
          id: game.awayCompetitor?.id ?? 0,
          name: game.awayCompetitor?.name ?? 'Visitante',
          score: game.awayCompetitor?.score ?? 0,
        },
      }));

    return NextResponse.json({
      matches,
      count: matches.length,
      lastUpdated: new Date().toISOString(),
      source: '365scores-light-catalog',
    });
  } catch (error) {
    return NextResponse.json(
      { matches: [], error: error instanceof Error ? error.message : 'Falha ao carregar catálogo ao vivo' },
      { status: 502 }
    );
  }
}
