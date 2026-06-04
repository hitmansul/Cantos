'use client';

import { useState, useEffect } from 'react';
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  Radio,
  RefreshCw,
  Loader2,
  ExternalLink,
  Search,
  UserRound,
  Ruler,
  Cake,
  Building2,
  Shirt,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

type WCTeam = { country: string; flag: string };

type DisplayMatch = {
  id?: number;
  startTime: string;
  venue?: string;
  flag?: string;
  homeTeam: WCTeam;
  awayTeam: WCTeam;
};

type FifaSquadPlayer = {
  number: number;
  position: 'GK' | 'DF' | 'MF' | 'FW';
  playerName: string;
  shirtName: string;
  dateOfBirth: string;
  club: string;
  heightCm: number | null;
};

type FifaSquad = {
  team: string;
  code: string;
  coach?: {
    name: string;
    nationality: string;
  };
  players: FifaSquadPlayer[];
};

type PositionFilter = FifaSquadPlayer['position'] | 'ALL';

type FifaSquadsResponse = {
  source: {
    url: string;
    articleUrl: string;
    lastModified: string | null;
    footerUpdatedAt: string | null;
    version: string | null;
  };
  generatedAt: string;
  totalTeams: number;
  totalPlayers: number;
  teams: FifaSquad[];
};

const POSITION_LABELS: Record<FifaSquadPlayer['position'], string> = {
  GK: 'Goleiros',
  DF: 'Defensores',
  MF: 'Meias',
  FW: 'Atacantes',
};

const POSITION_SHORT_LABELS: Record<FifaSquadPlayer['position'], string> = {
  GK: 'Goleiro',
  DF: 'Defensor',
  MF: 'Meia',
  FW: 'Atacante',
};

const POSITION_FILTERS: Array<{ value: PositionFilter; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'GK', label: 'Goleiros' },
  { value: 'DF', label: 'Defensores' },
  { value: 'MF', label: 'Meias' },
  { value: 'FW', label: 'Atacantes' },
];

const SQUAD_TEAM_ALIASES: Record<string, string> = {
  alemanha: 'Germany',
  argentina: 'Argentina',
  argelia: 'Algeria',
  australia: 'Australia',
  austria: 'Austria',
  belgica: 'Belgium',
  bosnia: 'Bosnia And Herzegovina',
  'bosnia e herzegovina': 'Bosnia And Herzegovina',
  brasil: 'Brazil',
  canada: 'Canada',
  catar: 'Qatar',
  colombia: 'Colombia',
  'coreia do sul': 'Korea Republic',
  croacia: 'Croatia',
  curacao: 'Curacao',
  equador: 'Ecuador',
  escocia: 'Scotland',
  espanha: 'Spain',
  estados: 'USA',
  'estados unidos': 'USA',
  eua: 'USA',
  franca: 'France',
  gana: 'Ghana',
  haiti: 'Haiti',
  holanda: 'Netherlands',
  inglaterra: 'England',
  ira: 'IR Iran',
  japao: 'Japan',
  marrocos: 'Morocco',
  mexico: 'Mexico',
  noruega: 'Norway',
  paraguai: 'Paraguay',
  portugal: 'Portugal',
  'rep tcheca': 'Czechia',
  'republica tcheca': 'Czechia',
  senegal: 'Senegal',
  suica: 'Switzerland',
  turquia: 'Turkiye',
  uruguai: 'Uruguay',
};

const TEAM_FLAGS: Record<string, string> = {
  Brasil: '🇧🇷',
  Brazil: '🇧🇷',
  Marrocos: '🇲🇦',
  Morocco: '🇲🇦',
  Haiti: '🇭🇹',
  Escócia: '🏴',
  Scotland: '🏴',
  México: '🇲🇽',
  'África do Sul': '🇿🇦',
  'Coreia do Sul': '🇰🇷',
  'República Tcheca': '🇨🇿',
  Canadá: '🇨🇦',
  'Bósnia e Herzegovina': '🇧🇦',
  EUA: '🇺🇸',
  Paraguai: '🇵🇾',
  Catar: '🇶🇦',
  Suíça: '🇨🇭',
};

// Copa do Mundo 2026 — 12 grupos, 48 seleções (Sorteio: 5 de dezembro de 2024)
const WC_GROUPS: Record<string, WCTeam[]> = {
  A: [
    { country: 'México', flag: '🇲🇽' },
    { country: 'Argentina', flag: '🇦🇷' },
    { country: 'Polônia', flag: '🇵🇱' },
    { country: 'Eswatini', flag: '🇸🇿' },
  ],
  B: [
    { country: 'Holanda', flag: '🇳🇱' },
    { country: 'Portugal', flag: '🇵🇹' },
    { country: 'Irã', flag: '🇮🇷' },
    { country: 'Equador', flag: '🇪🇨' },
  ],
  C: [
    { country: 'Brasil', flag: '🇧🇷' },
    { country: 'Marrocos', flag: '🇲🇦' },
    { country: 'Haiti', flag: '🇭🇹' },
    { country: 'Escócia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  ],
  D: [
    { country: 'França', flag: '🇫🇷' },
    { country: 'Bélgica', flag: '🇧🇪' },
    { country: 'Suíça', flag: '🇨🇭' },
    { country: 'Tailândia', flag: '🇹🇭' },
  ],
  E: [
    { country: 'Alemanha', flag: '🇩🇪' },
    { country: 'Espanha', flag: '🇪🇸' },
    { country: 'Indonésia', flag: '🇮🇩' },
    { country: 'Paraguai', flag: '🇵🇾' },
  ],
  F: [
    { country: 'Portugal', flag: '🇵🇹' },
    { country: 'Camarões', flag: '🇨🇲' },
    { country: 'Cuba', flag: '🇨🇺' },
    { country: 'Eslováquia', flag: '🇸🇰' },
  ],
  G: [
    { country: 'EUA', flag: '🇺🇸' },
    { country: 'Canadá', flag: '🇨🇦' },
    { country: 'Uruguai', flag: '🇺🇾' },
    { country: 'Panamá', flag: '🇵🇦' },
  ],
  H: [
    { country: 'Colômbia', flag: '🇨🇴' },
    { country: 'Holanda', flag: '🇳🇱' },
    { country: 'Gana', flag: '🇬🇭' },
    { country: 'Azerbaijão', flag: '🇦🇿' },
  ],
  I: [
    { country: 'Japão', flag: '🇯🇵' },
    { country: 'Turquia', flag: '🇹🇷' },
    { country: 'Costa do Marfim', flag: '🇨🇮' },
    { country: 'Rep. Tcheca', flag: '🇨🇿' },
  ],
  J: [
    { country: 'Croácia', flag: '🇭🇷' },
    { country: 'Argélia', flag: '🇩🇿' },
    { country: 'Bolívia', flag: '🇧🇴' },
    { country: 'Austrália', flag: '🇦🇺' },
  ],
  K: [
    { country: 'Coreia do Sul', flag: '🇰🇷' },
    { country: 'Polônia', flag: '🇵🇱' },
    { country: 'El Salvador', flag: '🇸🇻' },
    { country: 'Gabão', flag: '🇬🇦' },
  ],
  L: [
    { country: 'Peru', flag: '🇵🇪' },
    { country: 'Costa Rica', flag: '🇨🇷' },
    { country: 'Romênia', flag: '🇷🇴' },
    { country: 'Angola', flag: '🇦🇴' },
  ],
};

// Lista reserva confirmada no 365Scores em 01/06/2026.
const BRAZIL_MATCHES: DisplayMatch[] = [
  {
    startTime: '2026-06-13T22:00:00+00:00',
    venue: 'SoFi Stadium, Los Angeles',
    homeTeam: { country: 'Brasil', flag: TEAM_FLAGS.Brasil },
    awayTeam: { country: 'Marrocos', flag: TEAM_FLAGS.Marrocos },
  },
  {
    startTime: '2026-06-20T00:30:00+00:00',
    venue: 'MetLife Stadium, Nova York/NJ',
    homeTeam: { country: 'Brasil', flag: TEAM_FLAGS.Brasil },
    awayTeam: { country: 'Haiti', flag: TEAM_FLAGS.Haiti },
  },
  {
    startTime: '2026-06-24T22:00:00+00:00',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    venue: 'AT&T Stadium, Dallas',
    homeTeam: { country: 'Escócia', flag: TEAM_FLAGS.Escócia },
    awayTeam: { country: 'Brasil', flag: TEAM_FLAGS.Brasil },
  },
];

// Sedes do torneio
const VENUES = [
  { city: 'Nova York/Nova Jersey', stadium: 'MetLife Stadium', cap: '82.500', flag: '🇺🇸' },
  { city: 'Los Angeles', stadium: 'SoFi Stadium', cap: '70.240', flag: '🇺🇸' },
  { city: 'Dallas', stadium: 'AT&T Stadium', cap: '80.000', flag: '🇺🇸' },
  { city: 'San Francisco', stadium: "Levi's Stadium", cap: '68.500', flag: '🇺🇸' },
  { city: 'Miami', stadium: 'Hard Rock Stadium', cap: '64.767', flag: '🇺🇸' },
  { city: 'Atlanta', stadium: 'Mercedes-Benz Stadium', cap: '71.000', flag: '🇺🇸' },
  { city: 'Seattle', stadium: 'Lumen Field', cap: '68.740', flag: '🇺🇸' },
  { city: 'Kansas City', stadium: 'Arrowhead Stadium', cap: '76.416', flag: '🇺🇸' },
  { city: 'Houston', stadium: 'NRG Stadium', cap: '72.220', flag: '🇺🇸' },
  { city: 'Philadelphia', stadium: 'Lincoln Financial Field', cap: '67.594', flag: '🇺🇸' },
  { city: 'Boston', stadium: 'Gillette Stadium', cap: '65.878', flag: '🇺🇸' },
  { city: 'Guadalajara', stadium: 'Estadio Akron', cap: '49.850', flag: '🇲🇽' },
  { city: 'Monterrey', stadium: 'Estadio BBVA', cap: '51.350', flag: '🇲🇽' },
  { city: 'Cidade do México', stadium: 'Estadio Azteca', cap: '87.523', flag: '🇲🇽' },
  { city: 'Toronto', stadium: 'BMO Field', cap: '30.000', flag: '🇨🇦' },
  { city: 'Vancouver', stadium: 'BC Place', cap: '54.320', flag: '🇨🇦' },
];

// Dias até a Copa começar — fixo (Copa começa 11 Jun 2026, hoje é 20 Mai 2026 = 22 dias)
const WC_DAYS_LEFT = 22;

function formatMatchDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatShortMatchDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatMatchTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatSourceDate(value?: string | null): string {
  if (!value) return 'data nao informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function normalizeTeamName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fifaTeamLookupName(value: string): string {
  const normalized = normalizeTeamName(value);
  return SQUAD_TEAM_ALIASES[normalized] ?? value;
}

function findSquadTeam(teams: FifaSquad[], query: string): FifaSquad | undefined {
  const normalizedQuery = normalizeTeamName(fifaTeamLookupName(query));
  const normalizedRaw = normalizeTeamName(query);
  return teams.find((team) => {
    const normalizedTeam = normalizeTeamName(`${team.team} ${team.code}`);
    return normalizedTeam.includes(normalizedQuery) || normalizedTeam.includes(normalizedRaw);
  });
}

function playerKey(teamCode: string, player: FifaSquadPlayer): string {
  return `${teamCode}-${player.number}-${player.playerName}`;
}

function parseFifaBirthDate(value: string): Date | null {
  const [day, month, year] = value.split('/').map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function playerAge(value: string): number | null {
  const date = parseFifaBirthDate(value);
  if (!date) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - date.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < date.getUTCDate())) age -= 1;
  return age;
}

function average(values: number[]): number | null {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
}

function selectedTeamSummary(team: FifaSquad) {
  const heights = team.players
    .map((player) => player.heightCm)
    .filter((height): height is number => typeof height === 'number' && Number.isFinite(height));
  const ages = team.players
    .map((player) => playerAge(player.dateOfBirth))
    .filter((age): age is number => typeof age === 'number' && Number.isFinite(age));
  const clubs = new Set(team.players.map((player) => player.club).filter(Boolean));
  const positions = (['GK', 'DF', 'MF', 'FW'] as FifaSquadPlayer['position'][]).map((position) => ({
    position,
    total: team.players.filter((player) => player.position === position).length,
  }));

  return {
    averageHeight: average(heights),
    averageAge: average(ages),
    clubs: clubs.size,
    positions,
  };
}

function flagForTeam(name: string): string {
  const normalized = normalizeTeamName(name);
  const known = Object.entries(TEAM_FLAGS).find(([team]) => normalizeTeamName(team) === normalized);
  return known?.[1] ?? '';
}

function isBrazilTeamName(name: string): boolean {
  return ['brasil', 'brazil'].includes(normalizeTeamName(name));
}

export function WorldCupPage() {
  const [activeGroup, setActiveGroup] = useState<string>('C');
  const [activeTab, setActiveTab] = useState('grupos');
  const [selectedTeamQuery, setSelectedTeamQuery] = useState('Brasil');

  function openTeamDetails(teamName: string) {
    setSelectedTeamQuery(teamName);
    setActiveTab('elencos');
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900 p-6 border border-emerald-500/30">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">🏆</span>
                <div>
                  <h2 className="text-2xl font-bold text-white">Copa do Mundo 2026</h2>
                  <p className="text-emerald-300 text-sm">EUA 🇺🇸 | México 🇲🇽 | Canadá 🇨🇦</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <Calendar className="w-3 h-3 mr-1" />
                  11 Jun – 19 Jul 2026
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  <Users className="w-3 h-3 mr-1" />
                  48 Seleções
                </Badge>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                  <MapPin className="w-3 h-3 mr-1" />
                  16 Estádios
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-center bg-black/30 rounded-xl px-6 py-4 border border-emerald-500/30 min-w-[120px]">
              <span className="text-4xl font-black text-emerald-400">{WC_DAYS_LEFT}</span>
              <span className="text-emerald-300 text-sm text-center">dias para o início</span>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 right-4 text-[120px]">⚽</div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="grupos" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Grupos</span>
          </TabsTrigger>
          <TabsTrigger value="brasil" className="gap-2">
            <span>🇧🇷</span>
            <span className="hidden sm:inline">Brasil</span>
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Agenda</span>
          </TabsTrigger>
          <TabsTrigger value="resultados" className="gap-2">
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Resultados</span>
          </TabsTrigger>
          <TabsTrigger value="elencos" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Selecoes</span>
          </TabsTrigger>
          <TabsTrigger value="sedes" className="gap-2">
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">Sedes</span>
          </TabsTrigger>
        </TabsList>

        {/* Grupos Tab */}
        <TabsContent value="grupos" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.keys(WC_GROUPS).map((group) => (
              <Button
                key={group}
                size="sm"
                variant={activeGroup === group ? 'default' : 'outline'}
                onClick={() => setActiveGroup(group)}
                className={
                  activeGroup === group ? 'bg-emerald-600 hover:bg-emerald-700 border-0' : ''
                }
              >
                Grupo {group}
                {group === 'C' && <span className="ml-1 text-xs">🇧🇷</span>}
              </Button>
            ))}
          </div>

          {activeGroup && (
            <Card className="overflow-hidden border-emerald-500/20">
              <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Grupo {activeGroup}
                  {activeGroup === 'C' && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      🇧🇷 Brasil
                    </Badge>
                  )}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Seleção</th>
                      <th className="px-4 py-2 text-center">J</th>
                      <th className="px-4 py-2 text-center">V</th>
                      <th className="px-4 py-2 text-center">E</th>
                      <th className="px-4 py-2 text-center">D</th>
                      <th className="px-4 py-2 text-center">SG</th>
                      <th className="px-4 py-2 text-center font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {WC_GROUPS[activeGroup].map((team, idx) => (
                      <tr
                        key={team.country}
                        className={`hover:bg-muted/50 transition-colors ${idx < 2 ? 'border-l-2 border-l-emerald-500' : ''}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openTeamDetails(team.country)}
                            className="flex items-center gap-3 rounded-lg px-2 py-1 -ml-2 text-left transition-colors hover:bg-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                          >
                            <span className="text-xl">{team.flag}</span>
                            <span className="font-medium">{team.country}</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">0</td>
                        <td className="px-4 py-3 text-center text-green-400">0</td>
                        <td className="px-4 py-3 text-center text-yellow-400">0</td>
                        <td className="px-4 py-3 text-center text-red-400">0</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">0</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-400">0</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
                <span className="inline-flex w-3 h-3 bg-emerald-500 rounded-sm"></span>
                <span>Os 2 primeiros de cada grupo avançam às oitavas</span>
              </div>
            </Card>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Todos os Grupos
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {Object.entries(WC_GROUPS).map(([group, teams]) => (
                <Card
                  key={group}
                  className={`p-3 cursor-pointer hover:border-emerald-500/50 transition-colors ${activeGroup === group ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                  onClick={() => setActiveGroup(group)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-muted-foreground uppercase">
                      Grupo {group}
                    </span>
                    {group === 'C' && <span className="text-xs">🇧🇷</span>}
                  </div>
                  <div className="space-y-1">
                    {teams.map((t) => (
                      <button
                        key={t.country}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openTeamDetails(t.country);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm transition-colors hover:bg-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      >
                        <span>{t.flag}</span>
                        <span className="truncate">{t.country}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Brasil Tab */}
        <TabsContent value="brasil" className="space-y-4">
          <Card className="overflow-hidden border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
            <div className="px-4 py-3 bg-green-500/10 border-b border-green-500/20">
              <h3 className="font-bold flex items-center gap-2">
                <span className="text-2xl">🇧🇷</span>
                Brasil — Grupo C
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {WC_GROUPS.C.map((team, idx) => (
                  <div
                    key={team.country}
                    className={`flex items-center gap-3 p-3 rounded-lg ${team.country === 'Brasil' ? 'bg-green-500/20 border border-green-500/30' : 'bg-muted/30'}`}
                  >
                    <span className="text-2xl">{team.flag}</span>
                    <div>
                      <div className="font-medium text-sm">{team.country}</div>
                      <div className="text-xs text-muted-foreground">Pos. {idx + 1}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Jogos do Brasil — Fase de Grupos
                </h4>
                <div className="space-y-3">
                  <BrazilMatches />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500" />
              Próximos Jogos — Copa do Mundo 2026 (ao vivo via API)
            </h4>
            <WorldCupMatches autoLoad />
          </Card>
        </TabsContent>

        {/* Agenda Tab — auto-loaded from 365Scores */}
        <TabsContent value="agenda" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Agenda Completa — Copa do Mundo 2026</h3>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                Auto-atualizado
              </Badge>
            </div>
            <WorldCupMatches autoLoad />
          </Card>
        </TabsContent>

        {/* Resultados Tab */}
        <TabsContent value="resultados" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold">Resultados — Copa do Mundo 2026</h3>
            </div>
            <WorldCupMatches autoLoad showResults />
          </Card>
        </TabsContent>

        {/* Elencos Tab */}
        <TabsContent value="elencos" className="space-y-4">
          <WorldCupSquads selectedTeamQuery={selectedTeamQuery} />
        </TabsContent>

        {/* Sedes Tab */}
        <TabsContent value="sedes" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {VENUES.map((v) => (
              <Card key={v.city} className="p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{v.flag}</span>
                  <div>
                    <div className="font-semibold">{v.city}</div>
                    <div className="text-sm text-muted-foreground">{v.stadium}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {v.cap} lugares
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BrazilMatches() {
  const [matches, setMatches] = useState<DisplayMatch[]>(BRAZIL_MATCHES);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/365scores/upcoming/copa_do_mundo');
        if (!res.ok) return;
        const data = await res.json();
        const rawMatches: Array<{
          id: number;
          startTime: string;
          venue?: string;
          homeTeam: { name: string };
          awayTeam: { name: string };
        }> = data.matches || [];

        const apiMatches = rawMatches
          .filter((match) =>
            [match.homeTeam.name, match.awayTeam.name].some((team) => isBrazilTeamName(team))
          )
          .map<DisplayMatch>((match) => ({
            id: match.id,
            startTime: match.startTime,
            venue: match.venue,
            homeTeam: {
              country: match.homeTeam.name,
              flag: flagForTeam(match.homeTeam.name),
            },
            awayTeam: {
              country: match.awayTeam.name,
              flag: flagForTeam(match.awayTeam.name),
            },
          }));

        if (!cancelled && apiMatches.length > 0) {
          setMatches(apiMatches);
        }
      } catch {
        if (!cancelled) setMatches(BRAZIL_MATCHES);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {matches.map((match, i) => (
        <div
          key={match.id ?? `${match.startTime}-${i}`}
          className="bg-muted/40 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">
                {formatShortMatchDate(match.startTime)}
              </div>
              <div className="font-bold text-sm text-primary">
                {formatMatchTime(match.startTime)} BRT
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{match.homeTeam.flag}</span>
              <span className="font-semibold">{match.homeTeam.country}</span>
              <span className="text-muted-foreground mx-2 font-bold">vs</span>
              <span className="font-semibold">{match.awayTeam.country}</span>
              <span className="text-2xl">{match.awayTeam.flag}</span>
            </div>
          </div>
          {match.venue && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {match.venue}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function WorldCupSquads({ selectedTeamQuery }: { selectedTeamQuery?: string }) {
  const [data, setData] = useState<FifaSquadsResponse | null>(null);
  const [selectedCode, setSelectedCode] = useState('BRA');
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(forceRefresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fifa/world-cup/squads${forceRefresh ? '?refresh=1' : ''}`);
      if (!res.ok) throw new Error('Nao foi possivel carregar os elencos oficiais agora.');
      const response = (await res.json()) as FifaSquadsResponse;
      setData(response);
      if (!response.teams.some((team) => team.code === selectedCode)) {
        setSelectedCode(response.teams[0]?.code ?? 'BRA');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data || !selectedTeamQuery) return;
    const team = findSquadTeam(data.teams, selectedTeamQuery);
    if (team) setSelectedCode(team.code);
  }, [data, selectedTeamQuery]);

  useEffect(() => {
    setPositionFilter('ALL');
    setSelectedPlayerKey(null);
  }, [selectedCode]);

  const selectedTeam = data?.teams.find((team) => team.code === selectedCode) ?? data?.teams[0];
  const selectedTeamStats = selectedTeam ? selectedTeamSummary(selectedTeam) : null;
  const visiblePlayers =
    selectedTeam?.players.filter((player) => positionFilter === 'ALL' || player.position === positionFilter) ?? [];
  const selectedPlayer =
    selectedTeam?.players.find((player) => playerKey(selectedTeam.code, player) === selectedPlayerKey) ??
    visiblePlayers[0] ??
    selectedTeam?.players[0] ??
    null;
  const filteredTeams =
    data?.teams.filter((team) => {
      const term = normalizeTeamName(query);
      if (!term) return true;
      return normalizeTeamName(`${team.team} ${team.code}`).includes(term);
    }) ?? [];

  return (
    <Card className="overflow-hidden border-emerald-500/20">
      <div className="p-4 border-b border-border bg-emerald-500/5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Selecoes e jogadores oficiais FIFA
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Lista oficial de convocados extraida do Football Data Platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Atualizar
            </Button>
            {data && (
              <Button variant="outline" size="sm" asChild>
                <a href={data.source.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  PDF oficial
                </a>
              </Button>
            )}
          </div>
        </div>

        {data && (
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Selecoes</div>
              <div className="text-xl font-bold text-emerald-400">{data.totalTeams}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Jogadores</div>
              <div className="text-xl font-bold text-emerald-400">{data.totalPlayers}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Fonte atualizada</div>
              <div className="text-sm font-semibold">
                {formatSourceDate(data.source.lastModified)}
              </div>
              {data.source.version && (
                <div className="text-xs text-muted-foreground">Versao {data.source.version}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <span className="ml-2 text-muted-foreground">Carregando elencos oficiais...</span>
        </div>
      ) : error ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-red-400">{error}</p>
          <Button variant="outline" onClick={() => load()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      ) : data && selectedTeam ? (
        <div className="grid lg:grid-cols-[280px_1fr]">
          <aside className="border-r border-border p-4 space-y-3">
            <label className="text-xs font-medium text-muted-foreground">Buscar selecao</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Brasil, Argentina..."
                className="w-full rounded-lg border border-border bg-muted/40 pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div className="max-h-[560px] overflow-auto pr-1 space-y-1">
              {filteredTeams.map((team) => (
                <button
                  key={team.code}
                  type="button"
                  onClick={() => setSelectedCode(team.code)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                    selectedTeam.code === team.code
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-muted/20 hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <span className="font-semibold">{team.team}</span>
                  <span className="text-muted-foreground ml-2">{team.code}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h4 className="text-xl font-bold flex items-center gap-2">
                  <span>{flagForTeam(selectedTeam.team)}</span>
                  {selectedTeam.team}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedTeam.players.length} convocados oficiais
                  {selectedTeam.coach?.name ? ` • Tecnico: ${selectedTeam.coach.name}` : ''}
                </p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                FIFA {data.source.version ? `v${data.source.version}` : ''}
              </Badge>
            </div>

            {selectedTeamStats && (
              <div className="grid sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Jogadores</div>
                  <div className="text-lg font-bold text-emerald-400">{selectedTeam.players.length}</div>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Clubes</div>
                  <div className="text-lg font-bold text-emerald-400">{selectedTeamStats.clubs}</div>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Altura media</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {selectedTeamStats.averageHeight ? `${selectedTeamStats.averageHeight} cm` : '-'}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Idade media</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {selectedTeamStats.averageAge ? `${selectedTeamStats.averageAge} anos` : '-'}
                  </div>
                </div>
              </div>
            )}

            {selectedTeamStats && (
              <div className="flex flex-wrap gap-2">
                {selectedTeamStats.positions.map((item) => (
                  <Badge key={item.position} variant="outline" className="bg-muted/30">
                    {POSITION_LABELS[item.position]}: {item.total}
                  </Badge>
                ))}
              </div>
            )}

            <div className="grid xl:grid-cols-[1fr_360px] gap-4">
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="border-b border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        Lista de jogadores
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {visiblePlayers.length} jogadores exibidos
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {POSITION_FILTERS.map((filter) => (
                      <button
                        key={filter.value}
                        type="button"
                        onClick={() => setPositionFilter(filter.value)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          positionFilter === filter.value
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {visiblePlayers.map((player) => {
                    const key = playerKey(selectedTeam.code, player);
                    const isSelected = selectedPlayer ? key === playerKey(selectedTeam.code, selectedPlayer) : false;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedPlayerKey(key)}
                        className={`grid w-full grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected ? 'bg-emerald-500/10' : 'hover:bg-muted/30'
                        }`}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 font-bold text-emerald-300">
                          {player.number}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{player.playerName}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {POSITION_SHORT_LABELS[player.position]} • {player.club}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <PlayerPersonalStats team={selectedTeam} player={selectedPlayer} />
            </div>
          </section>
        </div>
      ) : null}
    </Card>
  );
}

// Sub-component: fetches Copa do Mundo upcoming/results from 365Scores API — auto-loads
function PlayerPersonalStats({ team, player }: { team: FifaSquad; player: FifaSquadPlayer | null }) {
  if (!player) {
    return (
      <aside className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="text-sm text-muted-foreground">Nenhum jogador selecionado.</div>
      </aside>
    );
  }

  const age = playerAge(player.dateOfBirth);
  const teamStats = selectedTeamSummary(team);
  const heightDiff =
    player.heightCm && teamStats.averageHeight
      ? Math.round((player.heightCm - teamStats.averageHeight) * 10) / 10
      : null;

  const detailRows = [
    { icon: Shirt, label: 'Camisa', value: String(player.number) },
    { icon: UserRound, label: 'Posicao', value: POSITION_SHORT_LABELS[player.position] },
    { icon: Building2, label: 'Clube', value: player.club || '-' },
    { icon: Cake, label: 'Idade', value: age ? `${age} anos` : '-' },
    { icon: Calendar, label: 'Nascimento', value: player.dateOfBirth || '-' },
    { icon: Ruler, label: 'Altura', value: player.heightCm ? `${player.heightCm} cm` : '-' },
  ];

  return (
    <aside className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-lg font-black text-emerald-300">
            {player.number}
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
            {team.code}
          </Badge>
        </div>
        <h5 className="text-lg font-bold leading-tight">{player.playerName}</h5>
        <p className="text-sm text-muted-foreground">
          {POSITION_SHORT_LABELS[player.position]} de {team.team}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {detailRows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="w-3.5 h-3.5" />
                {row.label}
              </div>
              <div className="mt-1 text-sm font-semibold">{row.value}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          Estatisticas pessoais
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Altura vs. media da selecao</span>
            <span className="font-semibold">
              {heightDiff === null ? '-' : `${heightDiff > 0 ? '+' : ''}${heightDiff} cm`}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Jogadores da posicao</span>
            <span className="font-semibold">
              {team.players.filter((item) => item.position === player.position).length}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Fonte</span>
            <span className="font-semibold">FIFA</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function WorldCupMatches({
  showResults = false,
  autoLoad = false,
}: {
  showResults?: boolean;
  autoLoad?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [matchGroups, setMatchGroups] = useState<
    Array<{
      dateLabel: string;
      matches: Array<{
        id: number;
        homeTeam: string;
        awayTeam: string;
        timeLabel: string;
        homeScore?: number;
        awayScore?: number;
      }>;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = showResults
        ? '/api/365scores/results/copa_do_mundo'
        : '/api/365scores/upcoming/copa_do_mundo';
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Erro ao buscar dados');
      const data = await res.json();
      const rawMatches: Array<{
        id: number;
        startTime: string;
        homeTeam: { id: number; name: string; score?: number };
        awayTeam: { id: number; name: string; score?: number };
      }> = data.matches || [];

      const byDate: Record<string, (typeof matchGroups)[0]> = {};
      for (const m of rawMatches) {
        const dateLabel = formatMatchDate(m.startTime);
        const timeLabel = formatMatchTime(m.startTime);
        if (!byDate[dateLabel]) byDate[dateLabel] = { dateLabel, matches: [] };
        byDate[dateLabel].matches.push({
          id: m.id,
          homeTeam: m.homeTeam.name,
          awayTeam: m.awayTeam.name,
          timeLabel,
          homeScore: m.homeTeam.score,
          awayScore: m.awayTeam.score,
        });
      }
      setMatchGroups(Object.values(byDate));
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when requested
  useEffect(() => {
    if (autoLoad) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, showResults]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        <span className="ml-2 text-muted-foreground">Carregando jogos...</span>
      </div>
    );
  }

  if (!loaded && !autoLoad) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-muted-foreground text-sm">
          {showResults
            ? 'Clique para carregar os resultados'
            : 'Clique para carregar os próximos jogos'}{' '}
          da Copa do Mundo 2026
        </p>
        <Button onClick={load} className="bg-emerald-600 hover:bg-emerald-700">
          <Trophy className="w-4 h-4 mr-2" />
          Carregar Jogos
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-red-400 text-sm">{error}</p>
        <Button variant="outline" onClick={load} size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (loaded && matchGroups.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground text-sm">
          {showResults ? 'Nenhum resultado disponível ainda' : 'Nenhum jogo agendado disponível'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          A Copa do Mundo começa em 11 de junho de 2026
        </p>
        <Button variant="outline" onClick={load} size="sm" className="mt-3">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>
    );
  }

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3 h-3 mr-1" />
          Atualizar
        </Button>
      </div>
      {matchGroups.map((group) => (
        <div key={group.dateLabel} className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1">
            {group.dateLabel}
          </div>
          <div className="space-y-2">
            {group.matches.map((match) => {
              const hasScore = showResults && match.homeScore !== undefined;
              return (
                <div
                  key={match.id}
                  className="bg-muted/40 rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex-1 text-right pr-3">
                    <span className="font-semibold text-sm">{match.homeTeam}</span>
                  </div>
                  <div className="flex flex-col items-center min-w-[80px]">
                    <span className="text-xs text-muted-foreground">{match.timeLabel}</span>
                    {hasScore ? (
                      <span className="font-bold text-lg">
                        {match.homeScore} – {match.awayScore}
                      </span>
                    ) : (
                      <span className="text-emerald-500 font-bold text-sm">vs</span>
                    )}
                  </div>
                  <div className="flex-1 text-left pl-3">
                    <span className="font-semibold text-sm">{match.awayTeam}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
