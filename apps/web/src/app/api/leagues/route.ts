import { NextResponse } from 'next/server';
import { getLeagues } from '@/app/api/utils/footballData';
import type { LeagueConfig } from '@/shared/footballDataTypes';

// Extra leagues (UEFA, Americas, Internacional) not in football-data.co.uk CSV source
// IDs intentionally match the SCORES365_COMPETITIONS keys so the whole pipeline works
const EXTRA_LEAGUES: LeagueConfig[] = [
  // ── FIFA ─────────────────────────────────────────────────────────────────
  { id: 'copa_do_mundo', name: '🏆 Copa do Mundo 2026', country: 'FIFA', csvUrl: '', flag: '🌍' },

  // ── UEFA competitions ─────────────────────────────────────────────────────
  { id: 'UCL', name: 'Champions League', country: 'UEFA', csvUrl: '', flag: '🏆' },
  { id: 'UEL', name: 'Europa League', country: 'UEFA', csvUrl: '', flag: '🏆' },
  { id: 'conference_league', name: 'Conference League', country: 'UEFA', csvUrl: '', flag: '🏆' },
  { id: 'nations_league', name: 'Nations League', country: 'UEFA', csvUrl: '', flag: '🏳️' },

  // ── CONMEBOL ─────────────────────────────────────────────────────────────
  { id: 'libertadores', name: 'Copa Libertadores', country: 'CONMEBOL', csvUrl: '', flag: '🏆' },
  { id: 'sudamericana', name: 'Copa Sul-Americana', country: 'CONMEBOL', csvUrl: '', flag: '🏅' },
  { id: 'copa_america', name: 'Copa América', country: 'CONMEBOL', csvUrl: '', flag: '🌎' },

  // ── América do Sul ────────────────────────────────────────────────────────
  { id: 'argentina', name: 'Liga Profesional', country: 'Argentina', csvUrl: '', flag: '🇦🇷' },
  { id: 'argentina_2', name: 'Primera Nacional', country: 'Argentina', csvUrl: '', flag: '🇦🇷' },
  { id: 'colombia_liga', name: 'Liga BetPlay', country: 'Colômbia', csvUrl: '', flag: '🇨🇴' },
  { id: 'chile_primera', name: 'Primera División', country: 'Chile', csvUrl: '', flag: '🇨🇱' },
  { id: 'peru_liga', name: 'Liga 1', country: 'Peru', csvUrl: '', flag: '🇵🇪' },
  { id: 'ecuador_liga', name: 'Liga Pro', country: 'Equador', csvUrl: '', flag: '🇪🇨' },
  { id: 'uruguay_primera', name: 'Primera División', country: 'Uruguai', csvUrl: '', flag: '🇺🇾' },

  // ── América do Norte ──────────────────────────────────────────────────────
  { id: 'mls', name: 'MLS', country: 'EUA', csvUrl: '', flag: '🇺🇸' },
  { id: 'liga_mx', name: 'Liga MX', country: 'México', csvUrl: '', flag: '🇲🇽' },

  // ── CAF ───────────────────────────────────────────────────────────────────
  { id: 'africa_cup', name: 'Copa África das Nações', country: 'CAF', csvUrl: '', flag: '🌍' },
  { id: 'caf_champions', name: 'CAF Champions League', country: 'CAF', csvUrl: '', flag: '🏆' },

  // ── AFC ───────────────────────────────────────────────────────────────────
  { id: 'j1_league', name: 'J1 League', country: 'Japão', csvUrl: '', flag: '🇯🇵' },
  { id: 'k_league_1', name: 'K League 1', country: 'Coreia do Sul', csvUrl: '', flag: '🇰🇷' },
  { id: 'saudi_pro', name: 'Saudi Pro League', country: 'Arábia Saudita', csvUrl: '', flag: '🇸🇦' },
  { id: 'afc_champions', name: 'AFC Champions League', country: 'AFC', csvUrl: '', flag: '🏆' },

  // ── Extra Europeu ─────────────────────────────────────────────────────────
  { id: 'liga_portugal_2', name: 'Liga Portugal 2', country: 'Portugal', csvUrl: '', flag: '🇵🇹' },
  { id: 'austrian', name: 'Bundesliga', country: 'Áustria', csvUrl: '', flag: '🇦🇹' },
  { id: 'swiss_super', name: 'Super League', country: 'Suíça', csvUrl: '', flag: '🇨🇭' },
  { id: 'russian_premier', name: 'Premier Liga', country: 'Rússia', csvUrl: '', flag: '🇷🇺' },
  { id: 'ukrainian_premier', name: 'Premier Liga', country: 'Ucrânia', csvUrl: '', flag: '🇺🇦' },
  { id: 'danish_super', name: 'Superliga', country: 'Dinamarca', csvUrl: '', flag: '🇩🇰' },
  { id: 'swedish_allsvenskan', name: 'Allsvenskan', country: 'Suécia', csvUrl: '', flag: '🇸🇪' },
  { id: 'norwegian_eliteserien', name: 'Eliteserien', country: 'Noruega', csvUrl: '', flag: '🇳🇴' },
  {
    id: 'SC0',
    name: 'Scottish Premiership',
    country: 'Escócia',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC0.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
  {
    id: 'SC1',
    name: 'Scottish Championship',
    country: 'Escócia',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC1.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
  {
    id: 'SC2',
    name: 'Scottish League One',
    country: 'Escócia',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC2.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
  {
    id: 'SC3',
    name: 'Scottish League Two',
    country: 'Escócia',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC3.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
  { id: 'liga_3', name: '3. Liga', country: 'Alemanha', csvUrl: '', flag: '🇩🇪' },
  {
    id: 'EC',
    name: 'National League',
    country: 'Inglaterra',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/EC.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
];

export async function GET() {
  const baseLeagues = getLeagues();
  // Merge, avoiding duplicates by id
  const existingIds = new Set(baseLeagues.map((l) => l.id));
  const merged = [...baseLeagues, ...EXTRA_LEAGUES.filter((l) => !existingIds.has(l.id))];
  return NextResponse.json({ leagues: merged });
}
