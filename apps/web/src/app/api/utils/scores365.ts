const SCORES365_BASE = 'https://webws.365scores.com';

export interface Scores365Competition {
  id: number;
  name: string;
  country: string;
  /** A sample of teams that must appear in standings to consider this ID valid */
  expectedTeams?: string[];
}

export const SCORES365_COMPETITIONS: Record<string, Scores365Competition> = {
  // ─── Brasil (verified IDs) ───
  brasileirao_a: {
    id: 113,
    name: 'Brasileirão Série A',
    country: 'Brasil',
    expectedTeams: ['Flamengo', 'Palmeiras', 'São Paulo'],
  },
  brasileirao_b: {
    id: 116,
    name: 'Brasileirão Série B',
    country: 'Brasil',
    expectedTeams: ['Goiás', 'Coritiba', 'Guarani'],
  },
  copa_do_brasil: {
    id: 115,
    name: 'Copa do Brasil',
    country: 'Brasil',
    expectedTeams: ['Flamengo', 'Palmeiras', 'Corinthians'],
  },
  paulistao: {
    id: 114,
    name: 'Campeonato Paulista',
    country: 'Brasil',
    expectedTeams: ['Corinthians', 'Palmeiras', 'Santos'],
  },
  mineiro: { id: 5057, name: 'Campeonato Mineiro', country: 'Brasil' },
  gaucho: { id: 5058, name: 'Campeonato Gaúcho', country: 'Brasil' },
  baiano: { id: 5059, name: 'Campeonato Baiano', country: 'Brasil' },
  carioca: { id: 5061, name: 'Campeonato Carioca', country: 'Brasil' },

  // ─── América do Sul (verified IDs) ───
  libertadores: {
    id: 102,
    name: 'Copa Libertadores',
    country: 'CONMEBOL',
    expectedTeams: ['Flamengo', 'River Plate', 'Boca Juniors'],
  },
  sudamericana: {
    id: 389,
    name: 'Copa Sul-Americana',
    country: 'CONMEBOL',
    expectedTeams: ['Fluminense', 'LDU', 'Athletico'],
  },
  argentina: {
    id: 72,
    name: 'Liga Profesional (Argentina)',
    country: 'Argentina',
    expectedTeams: ['River Plate', 'Boca Juniors', 'Racing'],
  },
  argentina_2: { id: 419, name: 'Primera Nacional (Argentina)', country: 'Argentina' },
  // Note: Colombia, Chile, Ecuador, Peru, Uruguay IDs change each 365scores season.
  // Removed until correct 2026 IDs are confirmed to avoid showing wrong league data.
  // colombia_liga, chile_primera, ecuador_liga, peru_liga, uruguay_primera — IDs TBD 2026

  // ─── América do Norte e Central ───
  // MLS: ID 118 was valid in 2025. Verify for 2026 season.
  mls: {
    id: 118,
    name: 'MLS (EUA)',
    country: 'EUA',
    expectedTeams: [
      'LA Galaxy',
      'Inter Miami',
      'New York City FC',
      'Atlanta United',
      'Seattle Sounders',
    ],
  },
  liga_mx: {
    id: 80,
    name: 'Liga MX (México)',
    country: 'México',
    expectedTeams: ['América', 'Chivas', 'Cruz Azul'],
  },
  liga_mx_expansion: { id: 81, name: 'Liga de Expansión MX', country: 'México' },
  concacaf_champions: { id: 140, name: 'CONCACAF Champions Cup', country: 'CONCACAF' },

  // ─── Europa — Top 5 (verified stable IDs) ───
  premier_league: {
    id: 7,
    name: 'Premier League (Inglaterra)',
    country: 'Inglaterra',
    expectedTeams: ['Arsenal', 'Manchester City', 'Liverpool'],
  },
  championship: { id: 1, name: 'Championship (Inglaterra)', country: 'Inglaterra' },
  league_one: { id: 2, name: 'League One (Inglaterra)', country: 'Inglaterra' },
  league_two: { id: 3, name: 'League Two (Inglaterra)', country: 'Inglaterra' },
  national_league: { id: 4, name: 'National League', country: 'Inglaterra' },
  la_liga: {
    id: 11,
    name: 'La Liga (Espanha)',
    country: 'Espanha',
    expectedTeams: ['Real Madrid', 'Barcelona', 'Atlético Madrid'],
  },
  segunda_division: { id: 12, name: 'La Liga 2 (Espanha)', country: 'Espanha' },
  serie_a: {
    id: 17,
    name: 'Serie A (Itália)',
    country: 'Itália',
    expectedTeams: ['Inter', 'Juventus', 'Napoli', 'AC Milan'],
  },
  serie_b_italy: { id: 18, name: 'Serie B (Itália)', country: 'Itália' },
  bundesliga: {
    id: 25,
    name: 'Bundesliga (Alemanha)',
    country: 'Alemanha',
    expectedTeams: ['Bayern München', 'Borussia Dortmund', 'RB Leipzig'],
  },
  bundesliga_2: { id: 26, name: '2. Bundesliga (Alemanha)', country: 'Alemanha' },
  liga_3: { id: 34, name: '3. Liga (Alemanha)', country: 'Alemanha' },
  ligue_1: {
    id: 35,
    name: 'Ligue 1 (França)',
    country: 'França',
    expectedTeams: ['PSG', 'Monaco', 'Marseille', 'Lyon'],
  },
  ligue_2: { id: 36, name: 'Ligue 2 (França)', country: 'França' },

  // ─── Europa — Outras Principais (verified stable IDs) ───
  eredivisie: {
    id: 63,
    name: 'Eredivisie (Holanda)',
    country: 'Holanda',
    expectedTeams: ['Ajax', 'PSV', 'Feyenoord'],
  },
  primeira_liga: {
    id: 266,
    name: 'Primeira Liga (Portugal)',
    country: 'Portugal',
    expectedTeams: ['Porto', 'Benfica', 'Sporting CP'],
  },
  liga_portugal_2: { id: 267, name: 'Liga Portugal 2', country: 'Portugal' },
  scottish_prem: {
    id: 68,
    name: 'Scottish Premiership',
    country: 'Escócia',
    expectedTeams: ['Celtic', 'Rangers'],
  },
  scottish_champ: { id: 69, name: 'Scottish Championship', country: 'Escócia' },
  scottish_league_one: { id: 70, name: 'Scottish League One', country: 'Escócia' },
  scottish_league_two: { id: 71, name: 'Scottish League Two', country: 'Escócia' },
  belgian_pro: {
    id: 98,
    name: 'Jupiler Pro League (Bélgica)',
    country: 'Bélgica',
    expectedTeams: ['Club Brugge', 'Anderlecht'],
  },
  austrian_bl: { id: 111, name: 'Bundesliga Österreich', country: 'Áustria' },
  austrian: { id: 111, name: 'Bundesliga Österreich', country: 'Áustria' },
  swiss_super: { id: 67, name: 'Super League (Suíça)', country: 'Suíça' },
  turkish_super: {
    id: 78,
    name: 'Süper Lig (Turquia)',
    country: 'Turquia',
    expectedTeams: ['Galatasaray', 'Fenerbahçe', 'Beşiktaş'],
  },
  greek_super: {
    id: 84,
    name: 'Super League (Grécia)',
    country: 'Grécia',
    expectedTeams: ['Olympiacos', 'Panathinaikos', 'PAOK'],
  },
  russian_premier: {
    id: 89,
    name: 'Premier Liga (Rússia)',
    country: 'Rússia',
    expectedTeams: ['Zenit', 'CSKA', 'Spartak'],
  },
  ukrainian_premier: { id: 129, name: 'Premier Liga (Ucrânia)', country: 'Ucrânia' },
  danish_super: { id: 119, name: 'Superliga (Dinamarca)', country: 'Dinamarca' },
  swedish_allsvenskan: { id: 122, name: 'Allsvenskan (Suécia)', country: 'Suécia' },
  norwegian_eliteserien: { id: 125, name: 'Eliteserien (Noruega)', country: 'Noruega' },
  polish_ekstraklasa: { id: 39, name: 'Ekstraklasa (Polônia)', country: 'Polônia' },
  romanian_superliga: { id: 41, name: 'SuperLiga (Romênia)', country: 'Romênia' },
  czech_first: { id: 38, name: 'First League (Rep. Tcheca)', country: 'Rep. Tcheca' },
  croatian_hnl: { id: 52, name: 'HNL (Croácia)', country: 'Croácia' },
  serbian_superliga: { id: 56, name: 'SuperLiga (Sérvia)', country: 'Sérvia' },
  hungarian_otp: { id: 57, name: 'OTP Bank Liga (Hungria)', country: 'Hungria' },
  bulgarian_first: { id: 83, name: 'First League (Bulgária)', country: 'Bulgária' },
  slovenian_liga: { id: 58, name: 'PrvaLiga (Eslovênia)', country: 'Eslovênia' },
  slovak_super: { id: 60, name: 'Super Liga (Eslováquia)', country: 'Eslováquia' },
  israeli_premier: { id: 85, name: 'Premier League (Israel)', country: 'Israel' },
  irish_loi: { id: 76, name: 'League of Ireland', country: 'Irlanda' },
  finnish_veikkaus: { id: 75, name: 'Veikkausliiga (Finlândia)', country: 'Finlândia' },
  azerbaijani_premier: { id: 133, name: 'Premier League (Azerbaijão)', country: 'Azerbaijão' },
  kazakh_premier: { id: 134, name: 'Premier League (Cazaquistão)', country: 'Cazaquistão' },

  // ─── UEFA (verified stable IDs) ───
  champions_league: {
    id: 572,
    name: 'UEFA Champions League',
    country: 'UEFA',
    expectedTeams: ['Real Madrid', 'Manchester City', 'Bayern München'],
  },
  europa_league: { id: 573, name: 'UEFA Europa League', country: 'UEFA' },
  conference_league: { id: 7685, name: 'UEFA Conference League', country: 'UEFA' },
  nations_league: { id: 5765, name: 'UEFA Nations League', country: 'UEFA' },

  // ─── Internacional — FIFA / CONMEBOL ───
  copa_do_mundo: { id: 5930, name: '🏆 Copa do Mundo 2026', country: 'FIFA' },
  copa_america: { id: 597, name: 'Copa América', country: 'CONMEBOL' },
  africa_cup: { id: 160, name: 'Copa África das Nações', country: 'CAF' },

  // ─── Ásia ───
  j1_league: { id: 102, name: 'J1 League (Japão)', country: 'Japão' },
  j2_league: { id: 103, name: 'J2 League (Japão)', country: 'Japão' },
  k_league_1: { id: 105, name: 'K League 1 (Coreia do Sul)', country: 'Coreia do Sul' },
  k_league_2: { id: 106, name: 'K League 2 (Coreia do Sul)', country: 'Coreia do Sul' },
  saudi_pro: {
    id: 174,
    name: 'Saudi Pro League',
    country: 'Arábia Saudita',
    expectedTeams: ['Al-Hilal', 'Al-Nassr', 'Al-Ittihad'],
  },
  afc_champions: { id: 580, name: 'AFC Champions League', country: 'AFC' },

  // ─── África ───
  caf_champions: { id: 584, name: 'CAF Champions League', country: 'CAF' },
};

export async function scores365Get(
  path: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const url = new URL(`${SCORES365_BASE}${path}`);
  url.searchParams.set('appTypeId', '5');
  url.searchParams.set('langId', '31');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`365Scores API error ${response.status}`);
  }

  return response.json();
}
