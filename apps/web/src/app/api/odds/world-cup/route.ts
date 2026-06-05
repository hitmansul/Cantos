import { NextResponse } from 'next/server';
import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OddsSide = 'home' | 'draw' | 'away';

type ScheduleMatch = {
  id: string;
  startTime: string;
  roundName?: string;
  homeTeam: string;
  awayTeam: string;
};

type Raw365Game = {
  id: number;
  startTime: string;
  roundName?: string;
  homeCompetitor?: { name?: string };
  awayCompetitor?: { name?: string };
};

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
  source: 'real' | 'estimated';
  home: number | null;
  draw: number | null;
  away: number | null;
};

const STATIC_WORLD_CUP_MATCHES: ScheduleMatch[] = [
  {
    id: 'wc-brasil-marrocos',
    startTime: '2026-06-13T22:00:00+00:00',
    roundName: 'Fase de Grupos',
    homeTeam: 'Brasil',
    awayTeam: 'Marrocos',
  },
  {
    id: 'wc-brasil-haiti',
    startTime: '2026-06-20T00:30:00+00:00',
    roundName: 'Fase de Grupos',
    homeTeam: 'Brasil',
    awayTeam: 'Haiti',
  },
  {
    id: 'wc-escocia-brasil',
    startTime: '2026-06-24T22:00:00+00:00',
    roundName: 'Fase de Grupos',
    homeTeam: 'Escocia',
    awayTeam: 'Brasil',
  },
];

const STRENGTH: Record<string, number> = {
  argentina: 86,
  brasil: 84,
  france: 84,
  franca: 84,
  espanha: 83,
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
  escocia: 69,
  scotland: 69,
  coreia: 68,
  paraguai: 67,
  haiti: 55,
};

const BET365_REFERENCE: Record<string, { home: number; draw: number; away: number }> = {
  'brasil-marrocos': { home: 1.58, draw: 4.03, away: 5.54 },
  'brasil-haiti': { home: 1.06, draw: 17.0, away: 26.0 },
  'escocia-brasil': { home: 7.5, draw: 4.52, away: 1.39 },
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

function matchKey(homeTeam: string, awayTeam: string): string {
  return `${normalize(homeTeam).replace(/\s+/g, '-')}-${normalize(awayTeam).replace(/\s+/g, '-')}`;
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

function estimatedBookmakers(match: ScheduleMatch): NormalizedBookmaker[] {
  const reference = BET365_REFERENCE[matchKey(match.homeTeam, match.awayTeam)] ?? fairOdds(match.homeTeam, match.awayTeam);

  return [
    {
      name: 'Bet365 estimada',
      source: 'estimated',
      home: reference.home,
      draw: reference.draw,
      away: reference.away,
    },
    {
      name: 'Pinnacle estimada',
      source: 'estimated',
      home: roundOdd(reference.home * 1.02),
      draw: roundOdd(reference.draw * 1.01),
      away: roundOdd(reference.away * 1.02),
    },
    {
      name: 'Mercado estimado',
      source: 'estimated',
      home: roundOdd(reference.home * 0.98),
      draw: roundOdd(reference.draw * 0.99),
      away: roundOdd(reference.away * 0.98),
    },
  ];
}

async function worldCupSchedule(): Promise<ScheduleMatch[]> {
  try {
    const competition = SCORES365_COMPETITIONS.copa_do_mundo;
    const data = (await scores365Get('/web/games/', {
      competitions: competition.id.toString(),
      statuses: '1,2',
    })) as { games?: Raw365Game[] };

    const matches = (data.games ?? [])
      .filter((game) => game.homeCompetitor?.name && game.awayCompetitor?.name)
      .filter((game) => {
        const time = Date.parse(game.startTime);
        return Number.isFinite(time) && time >= Date.now() - 12 * 60 * 60 * 1000;
      })
      .map<ScheduleMatch>((game) => ({
        id: game.id.toString(),
        startTime: game.startTime,
        roundName: game.roundName,
        homeTeam: game.homeCompetitor?.name ?? 'Mandante',
        awayTeam: game.awayCompetitor?.name ?? 'Visitante',
      }))
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

    return matches.length > 0 ? matches : STATIC_WORLD_CUP_MATCHES;
  } catch {
    return STATIC_WORLD_CUP_MATCHES;
  }
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
  const [schedule, realEvents] = await Promise.all([worldCupSchedule(), oddsApiEvents()]);
  const realByKey = new Map(
    (realEvents ?? []).map((event) => [matchKey(event.home_team, event.away_team), event])
  );

  const scheduleEvents = schedule.map((match) => {
    const real = realByKey.get(matchKey(match.homeTeam, match.awayTeam));
    const bookmakers = real ? realBookmakers(real) : estimatedBookmakers(match);
    const fair = fairOdds(match.homeTeam, match.awayTeam);
    return {
      id: real?.id ?? match.id,
      startTime: real?.commence_time ?? match.startTime,
      roundName: match.roundName,
      homeTeam: real?.home_team ?? match.homeTeam,
      awayTeam: real?.away_team ?? match.awayTeam,
      fairOdds: fair,
      bookmakers,
      bestPick: bestPick(fair, bookmakers),
      source: bookmakers.some((bookmaker) => bookmaker.source === 'real') ? 'real' : 'estimated',
    };
  });

  const realOnlyEvents = (realEvents ?? [])
    .filter((event) => !scheduleEvents.some((item) => matchKey(item.homeTeam, item.awayTeam) === matchKey(event.home_team, event.away_team)))
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
        source: 'real',
      };
    });

  const events = [...scheduleEvents, ...realOnlyEvents].sort(
    (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)
  );

  const hasRealBet365 = events.some((event) =>
    event.bookmakers.some((bookmaker) => bookmaker.source === 'real' && normalize(bookmaker.name).includes('bet365'))
  );

  return NextResponse.json({
    configured: Boolean(process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY),
    source: events.some((event) => event.source === 'real') ? 'the-odds-api' : 'estimated',
    hasRealBet365,
    note: hasRealBet365
      ? 'Odds reais da Bet365 encontradas na fonte configurada.'
      : 'Bet365 real depende de provedor de odds configurado. Enquanto isso, valores Bet365 aparecem como estimativa local.',
    events,
    lastUpdated: new Date().toISOString(),
  });
}
