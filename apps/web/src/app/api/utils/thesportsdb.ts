export const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

export const THESPORTSDB_LEAGUES: Record<string, { id: number; name: string; season: string }> = {
  // ─── Brasil ───
  brasileirao_a: { id: 4351, name: 'Brasileirão Série A', season: '2026' },
  brasileirao_b: { id: 4355, name: 'Brasileirão Série B', season: '2026' },
  copa_do_brasil: { id: 4406, name: 'Copa do Brasil', season: '2026' },

  // ─── América do Sul ───
  libertadores: { id: 4408, name: 'Copa Libertadores', season: '2026' },
  argentina_primera: { id: 4397, name: 'Argentine Primera Division', season: '2025-2026' },

  // ─── América do Norte e Central ───
  mls: { id: 4346, name: 'MLS (EUA)', season: '2026' },
  liga_mx: { id: 4336, name: 'Liga MX (México)', season: '2025-2026' },

  // ─── Europa — Top 5 ───
  premier_league: { id: 4328, name: 'Premier League (Inglaterra)', season: '2025-2026' },
  la_liga: { id: 4335, name: 'La Liga (Espanha)', season: '2025-2026' },
  serie_a: { id: 4332, name: 'Serie A (Itália)', season: '2025-2026' },
  bundesliga: { id: 4331, name: 'Bundesliga (Alemanha)', season: '2025-2026' },
  ligue_1: { id: 4334, name: 'Ligue 1 (França)', season: '2025-2026' },

  // ─── Europa — Outras ───
  eredivisie: { id: 4337, name: 'Eredivisie (Holanda)', season: '2025-2026' },
  primeira_liga: { id: 4344, name: 'Primeira Liga (Portugal)', season: '2025-2026' },
  scottish_prem: { id: 4330, name: 'Scottish Premiership', season: '2025-2026' },
  belgian_pro: { id: 4342, name: 'Belgian Pro League', season: '2025-2026' },
  swiss_super: { id: 4343, name: 'Swiss Super League', season: '2025-2026' },
  danish_super: { id: 4345, name: 'Danish Superliga', season: '2025-2026' },
  turkish_super: { id: 4341, name: 'Süper Lig (Turquia)', season: '2025-2026' },
  russian_premier: { id: 4338, name: 'Russian Premier League', season: '2025-2026' },
  croatian_hnl: { id: 4340, name: 'Croatian HNL', season: '2025-2026' },

  // ─── UEFA ───
  champions_league: { id: 4480, name: 'UEFA Champions League', season: '2025-2026' },
  europa_league: { id: 4481, name: 'UEFA Europa League', season: '2025-2026' },

  // ─── Ásia ───
  j1_league: { id: 4347, name: 'J1 League (Japão)', season: '2026' },
  saudi_pro: { id: 4350, name: 'Saudi Pro League', season: '2025-2026' },
};

export const THESPORTSDB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

export interface TheSportsDBEvent {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  dateEvent: string;
  strTime: string;
  strTimestamp: string;
  intRound: string;
  strOfficial: string | null;
  strStatus: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strVenue: string | null;
  idHomeTeam: string;
  idAwayTeam: string;
  strHomeTeamBadge: string | null;
  strAwayTeamBadge: string | null;
}
