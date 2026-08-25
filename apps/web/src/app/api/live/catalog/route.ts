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

type CatalogMatch = {
  id: number;
  minute: number | string;
  statusText: string;
  competition: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

function minuteValue(game: Scores365Game) {
  return game.preciseGameTime ?? game.gameTimeDisplay ?? (typeof game.gameTime === 'number' ? game.gameTime : game.statusText ?? 'AO VIVO');
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function minuteNumber(value: number | string) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const match = String(value).match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  return match ? Number(match[1]) + Number(match[2] ?? 0) : 0;
}

function catalogKey(match: CatalogMatch) {
  if (match.homeTeam.id > 0 && match.awayTeam.id > 0) {
    return `teams:${match.homeTeam.id}:${match.awayTeam.id}`;
  }
  return `names:${normalize(match.homeTeam.name)}:${normalize(match.awayTeam.name)}:${match.homeTeam.score}:${match.awayTeam.score}`;
}

function dedupeMatches(matches: CatalogMatch[]) {
  const unique = new Map<string, CatalogMatch>();
  for (const match of matches) {
    const key = catalogKey(match);
    const current = unique.get(key);
    if (!current || minuteNumber(match.minute) >= minuteNumber(current.minute)) unique.set(key, match);
  }
  return [...unique.values()];
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
    const rawMatches: CatalogMatch[] = (data.games ?? [])
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
    const matches = dedupeMatches(rawMatches);

    return NextResponse.json({
      matches,
      count: matches.length,
      lastUpdated: new Date().toISOString(),
      source: '365scores-light-catalog-deduplicated',
    });
  } catch (error) {
    return NextResponse.json(
      { matches: [], error: error instanceof Error ? error.message : 'Falha ao carregar catálogo ao vivo' },
      { status: 502 }
    );
  }
}
