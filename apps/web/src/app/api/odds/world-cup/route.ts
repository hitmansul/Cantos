import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OddsSide = 'home' | 'draw' | 'away';

type OddsApiOutcome = {
  name: string;
  price: number;
};

type OddsApiBookmaker = {
  key: string;
  title: string;
  markets?: Array<{
    key: string;
    outcomes?: OddsApiOutcome[];
  }>;
};

type OddsApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsApiBookmaker[];
};

type NormalizedBookmaker = {
  name: string;
  source: 'real';
  home: number | null;
  draw: number | null;
  away: number | null;
};

const STRENGTH: Record<string, number> = {
  argentina: 86,
  brasil: 84,
  brazil: 84,
  france: 84,
  franca: 84,
  espanha: 83,
  spain: 83,
  germany: 82,
  alemanha: 82,
  england: 82,
  inglaterra: 82,
  portugal: 81,
  holanda: 80,
  netherlands: 80,
  uruguai: 78,
  croacia: 77,
  colombia: 76,
  marrocos: 74,
  morocco: 74,
  suica: 74,
  switzerland: 74,
  eua: 72,
  usa: 72,
  mexico: 72,
  canada: 70,
  japao: 70,
  japan: 70,
  escocia: 69,
  scotland: 69,
  coreia: 68,
  paraguai: 67,
  haiti: 55,
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roundOdd(value: number): number {
  return Math.round(value * 100) / 100;
}

function oddsFromProbability(probability: number, margin = 1.06): number {
  return roundOdd(1 / Math.max(0.01, probability * margin));
}

function teamStrength(team: string): number {
  const normalized = normalize(team);
  const direct = STRENGTH[normalized];
  if (direct !== undefined) return direct;
  const partial = Object.entries(STRENGTH).find(([name]) => normalized.includes(name) || name.includes(normalized));
  return partial?.[1] ?? 64;
}

function fairOdds(homeTeam: string, awayTeam: string) {
  const homeStrength = teamStrength(homeTeam);
  const awayStrength = teamStrength(awayTeam);
  const diff = homeStrength - awayStrength;
  const drawProb = Math.min(0.31, Math.max(0.18, 0.25 - Math.abs(diff) * 0.0018));
  const homeProb = Math.min(0.82, Math.max(0.08, 0.375 + diff * 0.006));
  const awayProb = Math.max(0.06, 1 - drawProb - homeProb);
  const total = homeProb + drawProb + awayProb;

  return {
    home: oddsFromProbability(homeProb / total, 1),
    draw: oddsFromProbability(drawProb / total, 1),
    away: oddsFromProbability(awayProb / total, 1),
  };
}

function realBookmakers(event: OddsApiEvent): NormalizedBookmaker[] {
  return (event.bookmakers ?? [])
    .map((bookmaker) => {
      const h2h = bookmaker.markets?.find((market) => market.key === 'h2h');
      const outcomes = h2h?.outcomes ?? [];
      const findPrice = (name: string) =>
        outcomes.find((outcome) => normalize(outcome.name) === normalize(name))?.price ?? null;

      return {
        name: bookmaker.title,
        source: 'real' as const,
        home: findPrice(event.home_team),
        draw: outcomes.find((outcome) => normalize(outcome.name) === 'draw')?.price ?? null,
        away: findPrice(event.away_team),
      };
    })
    .filter((bookmaker) => bookmaker.home || bookmaker.draw || bookmaker.away);
}

async function oddsApiEvents(): Promise<OddsApiEvent[] | null> {
  const apiKey = process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY;
  if (!apiKey) return null;

  const url = new URL('https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', 'eu,uk,us');
  url.searchParams.set('markets', 'h2h');
  url.searchParams.set('oddsFormat', 'decimal');
  url.searchParams.set('dateFormat', 'iso');
  url.searchParams.set('bookmakers', 'bet365,pinnacle,williamhill,betfair_ex_uk,onexbet');

  const response = await fetch(url, { next: { revalidate: 300 } });
  if (!response.ok) return [];
  return (await response.json()) as OddsApiEvent[];
}

function bestPick(
  fair: { home: number; draw: number; away: number },
  bookmakers: NormalizedBookmaker[]
): { side: OddsSide; label: string; bookmaker: string; odd: number; fairOdd: number; edgePct: number } | null {
  const labels: Record<OddsSide, string> = { home: 'Mandante', draw: 'Empate', away: 'Visitante' };
  const candidates = bookmakers.flatMap((bookmaker) =>
    (['home', 'draw', 'away'] as OddsSide[])
      .map((side) => {
        const odd = bookmaker[side];
        if (!odd) return null;
        const edgePct = Math.round(((odd / fair[side]) - 1) * 100);
        return { side, label: labels[side], bookmaker: bookmaker.name, odd, fairOdd: fair[side], edgePct };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  );

  return candidates.sort((a, b) => b.edgePct - a.edgePct)[0] ?? null;
}

export async function GET() {
  const realEvents = await oddsApiEvents();

  if (realEvents === null) {
    return NextResponse.json({
      configured: false,
      source: 'not-configured',
      hasRealBet365: false,
      note: 'Nenhum provedor de odds reais esta configurado. A aplicacao nao mostra odds estimadas.',
      events: [],
      lastUpdated: new Date().toISOString(),
    });
  }

  const events = realEvents
    .map((event) => {
      const bookmakers = realBookmakers(event);
      const fair = fairOdds(event.home_team, event.away_team);
      return {
        id: event.id,
        startTime: event.commence_time,
        homeTeam: event.home_team,
        awayTeam: event.away_team,
        fairOdds: fair,
        bookmakers,
        bestPick: bestPick(fair, bookmakers),
        source: 'real' as const,
      };
    })
    .filter((event) => event.bookmakers.length > 0)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

  const hasRealBet365 = events.some((event) =>
    event.bookmakers.some((bookmaker) => normalize(bookmaker.name).includes('bet365'))
  );

  return NextResponse.json({
    configured: true,
    source: 'the-odds-api',
    hasRealBet365,
    note: hasRealBet365
      ? 'Odds reais da Bet365 encontradas na fonte configurada.'
      : 'Fonte real configurada, mas nenhuma odd real da Bet365 foi retornada agora.',
    events,
    lastUpdated: new Date().toISOString(),
  });
}
