import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/app/api/utils/adminAuth';
import { SCORES365_COMPETITIONS } from '@/app/api/utils/scores365';

// ── Static team → league mapping ─────────────────────────────────────────────

const TEAM_LEAGUE_MAP: Record<string, string[]> = {
  // ── Copa do Mundo 2026 — Seleções Nacionais ───────────────────────────────
  brasil: ['copa_do_mundo', 'libertadores'],
  brazil: ['copa_do_mundo', 'libertadores'],
  argentina: ['copa_do_mundo', 'libertadores'],
  franca: ['copa_do_mundo'],
  france: ['copa_do_mundo'],
  alemanha: ['copa_do_mundo'],
  germany: ['copa_do_mundo'],
  espanha: ['copa_do_mundo'],
  spain: ['copa_do_mundo'],
  portugal: ['copa_do_mundo'],
  england: ['copa_do_mundo'],
  inglaterra: ['copa_do_mundo'],
  holanda: ['copa_do_mundo'],
  netherlands: ['copa_do_mundo'],
  belgica: ['copa_do_mundo'],
  belgium: ['copa_do_mundo'],
  croatia: ['copa_do_mundo'],
  croacia: ['copa_do_mundo'],
  marrocos: ['copa_do_mundo'],
  morocco: ['copa_do_mundo'],
  senegal: ['copa_do_mundo'],
  colombia: ['copa_do_mundo', 'libertadores', 'sudamericana'],
  uruguai: ['copa_do_mundo', 'libertadores'],
  uruguay: ['copa_do_mundo', 'libertadores'],
  paraguai: ['copa_do_mundo', 'libertadores'],
  equador: ['copa_do_mundo', 'libertadores'],
  ecuador: ['copa_do_mundo', 'libertadores'],
  mexico: ['copa_do_mundo', 'liga_mx'],
  eua: ['copa_do_mundo', 'mls'],
  usa: ['copa_do_mundo', 'mls'],
  canada: ['copa_do_mundo', 'mls'],
  australia: ['copa_do_mundo'],
  japao: ['copa_do_mundo', 'j1_league'],
  japan: ['copa_do_mundo', 'j1_league'],

  // ── Brasileirão Série A 2025 ──────────────────────────────────────────────
  flamengo: ['brasileirao_a', 'libertadores', 'copa_do_brasil'],
  palmeiras: ['brasileirao_a', 'libertadores', 'copa_do_brasil'],
  'sao paulo': ['brasileirao_a', 'libertadores', 'copa_do_brasil'],
  corinthians: ['brasileirao_a', 'sudamericana', 'copa_do_brasil'],
  gremio: ['brasileirao_a', 'sudamericana', 'copa_do_brasil'],
  internacional: ['brasileirao_a', 'libertadores', 'copa_do_brasil'],
  'atletico mineiro': ['brasileirao_a', 'libertadores', 'copa_do_brasil'],
  'atletico-mg': ['brasileirao_a', 'libertadores', 'copa_do_brasil'],
  botafogo: ['brasileirao_a', 'libertadores', 'copa_do_brasil'],
  fluminense: ['brasileirao_a', 'libertadores', 'copa_do_brasil'],
  vasco: ['brasileirao_a', 'copa_do_brasil'],
  'vasco da gama': ['brasileirao_a', 'copa_do_brasil'],
  cruzeiro: ['brasileirao_a', 'copa_do_brasil'],
  'sport recife': ['brasileirao_a'],
  fortaleza: ['brasileirao_a', 'sudamericana', 'copa_do_brasil'],
  ceara: ['brasileirao_a', 'brasileirao_b'],
  bahia: ['brasileirao_a', 'copa_do_brasil'],
  vitoria: ['brasileirao_a'],
  juventude: ['brasileirao_a'],
  santos: ['brasileirao_a', 'copa_do_brasil'],
  'red bull bragantino': ['brasileirao_a', 'sudamericana'],
  bragantino: ['brasileirao_a', 'sudamericana'],
  mirassol: ['brasileirao_a'],
  criciuma: ['brasileirao_a'],
  sport: ['brasileirao_a', 'brasileirao_b'],
  'atletico goianiense': ['brasileirao_a', 'copa_do_brasil'],
  'atletico-go': ['brasileirao_a'],
  // ── Brasileirão Série B 2025 ──────────────────────────────────────────────
  chapecoense: ['brasileirao_b'],
  csa: ['brasileirao_b'],
  avai: ['brasileirao_b'],
  'ponte preta': ['brasileirao_b'],
  goias: ['brasileirao_b'],
  'vila nova': ['brasileirao_b'],
  operario: ['brasileirao_b'],
  guarani: ['brasileirao_b'],
  sampaio: ['brasileirao_b'],
  paysandu: ['brasileirao_b'],
  remo: ['brasileirao_b'],
  abc: ['brasileirao_b'],
  coritiba: ['brasileirao_b'],
  'athletic club': ['brasileirao_b'],
  // ── Copa Libertadores 2025 ────────────────────────────────────────────────
  'river plate': ['libertadores', 'argentina'],
  'boca juniors': ['libertadores', 'argentina'],
  racing: ['libertadores', 'argentina'],
  'racing club': ['libertadores', 'argentina'],
  huracan: ['libertadores', 'argentina'],
  estudiantes: ['libertadores', 'argentina'],
  velez: ['libertadores', 'argentina'],
  talleres: ['libertadores', 'argentina'],
  defensa: ['libertadores', 'argentina'],
  'defensa y justicia': ['libertadores', 'argentina'],
  'independiente del valle': ['libertadores', 'ecuador_liga'],
  'liga de quito': ['libertadores', 'ecuador_liga'],
  'el nacional': ['ecuador_liga'],
  'barcelona sc': ['libertadores', 'ecuador_liga'],
  emelec: ['libertadores', 'ecuador_liga'],
  penarol: ['libertadores', 'uruguay_primera'],
  'nacional uruguay': ['libertadores', 'uruguay_primera'],
  olimpia: ['libertadores', 'paraguay_primera'],
  libertad: ['libertadores', 'paraguay_primera'],
  cerro: ['libertadores', 'paraguay_primera'],
  'cerro porteno': ['libertadores', 'paraguay_primera'],
  'colo colo': ['libertadores', 'chile_primera'],
  'universidad de chile': ['libertadores', 'chile_primera'],
  'u de chile': ['libertadores', 'chile_primera'],
  huachipato: ['libertadores', 'chile_primera'],
  'alianza lima': ['libertadores', 'peru_liga'],
  universitario: ['libertadores', 'peru_liga'],
  'sporting cristal': ['libertadores', 'peru_liga'],
  'atletico nacional': ['libertadores', 'colombia_liga'],
  millonarios: ['libertadores', 'colombia_liga'],
  junior: ['libertadores', 'colombia_liga'],
  'santa fe': ['colombia_liga'],
  caracas: ['libertadores', 'venezuela_primera'],
  monagas: ['libertadores', 'venezuela_primera'],
  'the strongest': ['libertadores', 'bolivia_liga'],
  bolivar: ['libertadores', 'bolivia_liga'],
  // ── MLS ───────────────────────────────────────────────────────────────────
  'inter miami': ['mls'],
  'atlanta united': ['mls'],
  'new york city': ['mls'],
  'new york red bulls': ['mls'],
  'la galaxy': ['mls'],
  lafc: ['mls'],
  'seattle sounders': ['mls'],
  'portland timbers': ['mls'],
  'toronto fc': ['mls'],
  'cf montreal': ['mls'],
  'chicago fire': ['mls'],
  'columbus crew': ['mls'],
  'nashville sc': ['mls'],
  'charlotte fc': ['mls'],
  'austin fc': ['mls'],
  'real salt lake': ['mls'],
  'colorado rapids': ['mls'],
  'minnesota united': ['mls'],
  'fc dallas': ['mls'],
  'houston dynamo': ['mls'],
  'new england revolution': ['mls'],
  'philadelphia union': ['mls'],
  'dc united': ['mls'],
  'orlando city': ['mls'],
  'san jose earthquakes': ['mls'],
  'vancouver whitecaps': ['mls'],
  'sporting kansas city': ['mls'],
  'st louis city': ['mls'],
  'san diego fc': ['mls'],
  // ── Liga MX ───────────────────────────────────────────────────────────────
  'club america': ['liga_mx'],
  chivas: ['liga_mx'],
  guadalajara: ['liga_mx'],
  'cruz azul': ['liga_mx'],
  pumas: ['liga_mx'],
  'pumas unam': ['liga_mx'],
  tigres: ['liga_mx'],
  monterrey: ['liga_mx'],
  toluca: ['liga_mx'],
  leon: ['liga_mx'],
  pachuca: ['liga_mx'],
  'santos laguna': ['liga_mx'],
  atlas: ['liga_mx'],
  tijuana: ['liga_mx'],
  necaxa: ['liga_mx'],
  // ── Premier League ────────────────────────────────────────────────────────
  'manchester city': ['premier_league', 'champions_league'],
  'man city': ['premier_league', 'champions_league'],
  'manchester united': ['premier_league', 'europa_league'],
  'man united': ['premier_league', 'europa_league'],
  arsenal: ['premier_league', 'champions_league'],
  liverpool: ['premier_league', 'champions_league'],
  chelsea: ['premier_league', 'conference_league'],
  tottenham: ['premier_league', 'europa_league'],
  newcastle: ['premier_league', 'europa_league'],
  'aston villa': ['premier_league', 'europa_league'],
  'west ham': ['premier_league'],
  brighton: ['premier_league'],
  everton: ['premier_league'],
  brentford: ['premier_league'],
  fulham: ['premier_league'],
  wolves: ['premier_league'],
  wolverhampton: ['premier_league'],
  'crystal palace': ['premier_league'],
  bournemouth: ['premier_league'],
  'nottingham forest': ['premier_league', 'europa_league'],
  // ── La Liga ───────────────────────────────────────────────────────────────
  'real madrid': ['la_liga', 'champions_league'],
  barcelona: ['la_liga', 'champions_league'],
  'atletico madrid': ['la_liga', 'champions_league'],
  sevilla: ['la_liga', 'europa_league'],
  villarreal: ['la_liga', 'europa_league'],
  'real sociedad': ['la_liga', 'europa_league'],
  'athletic bilbao': ['la_liga'],
  'real betis': ['la_liga'],
  osasuna: ['la_liga'],
  valencia: ['la_liga'],
  // ── Serie A ───────────────────────────────────────────────────────────────
  'inter milan': ['serie_a', 'champions_league'],
  internazionale: ['serie_a', 'champions_league'],
  'ac milan': ['serie_a', 'champions_league'],
  juventus: ['serie_a', 'champions_league'],
  napoli: ['serie_a', 'champions_league'],
  lazio: ['serie_a', 'europa_league'],
  'as roma': ['serie_a', 'europa_league'],
  atalanta: ['serie_a', 'champions_league'],
  fiorentina: ['serie_a', 'conference_league'],
  // ── Bundesliga ────────────────────────────────────────────────────────────
  'bayern munich': ['bundesliga', 'champions_league'],
  'bayer leverkusen': ['bundesliga', 'champions_league'],
  'borussia dortmund': ['bundesliga', 'champions_league'],
  'rb leipzig': ['bundesliga', 'champions_league'],
  'eintracht frankfurt': ['bundesliga', 'europa_league'],
  wolfsburg: ['bundesliga'],
  'union berlin': ['bundesliga'],
  freiburg: ['bundesliga'],
  // ── Ligue 1 ───────────────────────────────────────────────────────────────
  psg: ['ligue_1', 'champions_league'],
  'paris saint-germain': ['ligue_1', 'champions_league'],
  marseille: ['ligue_1', 'europa_league'],
  monaco: ['ligue_1', 'champions_league'],
  nice: ['ligue_1', 'europa_league'],
  lyon: ['ligue_1', 'europa_league'],
  lille: ['ligue_1', 'europa_league'],
  lens: ['ligue_1'],
  rennes: ['ligue_1'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function findLeaguesForTeam(teamName: string): string[] {
  const norm = normalize(teamName);
  const found = new Set<string>();

  for (const [key, leagues] of Object.entries(TEAM_LEAGUE_MAP)) {
    const normKey = normalize(key);
    if (norm === normKey || norm.includes(normKey) || normKey.includes(norm)) {
      leagues.forEach((l) => found.add(l));
    }
  }

  return Array.from(found);
}

function scoreCandidates(
  homeLeagues: string[],
  awayLeagues: string[],
  allLeagues: string[]
): Array<{ key: string; name: string; country: string; score: number; reason: string }> {
  const scoreMap: Record<string, number> = {};

  for (const l of homeLeagues) {
    if (awayLeagues.includes(l)) {
      scoreMap[l] = (scoreMap[l] || 0) + 10;
    } else {
      scoreMap[l] = (scoreMap[l] || 0) + 3;
    }
  }
  for (const l of awayLeagues) {
    if (!homeLeagues.includes(l)) {
      scoreMap[l] = (scoreMap[l] || 0) + 3;
    }
  }

  return allLeagues
    .filter((k) => scoreMap[k] > 0)
    .sort((a, b) => (scoreMap[b] || 0) - (scoreMap[a] || 0))
    .slice(0, 6)
    .map((key) => {
      const comp = SCORES365_COMPETITIONS[key];
      const score = scoreMap[key] || 0;
      const reason =
        score >= 10
          ? 'Ambos os times jogam nesta competição'
          : score >= 6
            ? 'Um dos times frequentemente participa'
            : 'Possível participante';
      return {
        key,
        name: comp?.name || key,
        country: comp?.country || '',
        score,
        reason,
      };
    });
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { homeTeam, awayTeam, currentLeague } = body as {
    homeTeam: string;
    awayTeam: string;
    currentLeague?: string;
  };

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ error: 'homeTeam and awayTeam required' }, { status: 400 });
  }

  const allLeagueKeys = Object.keys(SCORES365_COMPETITIONS);
  const homeLeagues = findLeaguesForTeam(homeTeam);
  const awayLeagues = findLeaguesForTeam(awayTeam);
  const suggestions = scoreCandidates(homeLeagues, awayLeagues, allLeagueKeys);

  // Ensure current league is always present
  const hasCurrent = suggestions.some((s) => s.key === currentLeague);
  if (currentLeague && !hasCurrent && SCORES365_COMPETITIONS[currentLeague]) {
    const comp = SCORES365_COMPETITIONS[currentLeague];
    suggestions.push({
      key: currentLeague,
      name: comp.name,
      country: comp.country,
      score: 0,
      reason: 'Liga atual (não reconhecida)',
    });
  }

  return NextResponse.json({
    homeTeam,
    awayTeam,
    suggestions,
    recognized: {
      home: homeLeagues.length > 0,
      away: awayLeagues.length > 0,
    },
  });
}
