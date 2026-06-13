'use client';

import { useState, useEffect, useMemo } from 'react';

type LocalIconProps = { className?: string };
const Trophy = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">🏆</span>;
const Calendar = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">▣</span>;
const MapPin = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">⌖</span>;
const Users = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">☷</span>;
const Radio = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">◉</span>;
const RefreshCw = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">↻</span>;
const Loader2 = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">◌</span>;
const ExternalLink = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">↗</span>;
const Search = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">⌕</span>;
const UserRound = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">♙</span>;
const Ruler = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">▱</span>;
const Cake = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">◇</span>;
const Building2 = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">▥</span>;
const Shirt = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">▤</span>;
const BarChart3 = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">▥</span>;
const ChevronRight = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">›</span>;
const ChevronDown = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">⌄</span>;
const ChevronUp = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">⌃</span>;
const Filter = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">▿</span>;
const Target = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">◎</span>;
const BadgeDollarSign = ({ className = '' }: LocalIconProps) => <span className={`inline-block ${className}`} aria-hidden="true">$</span>;

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { WorldCupOddsAlerts } from '@/components/WorldCupOddsAlerts';
import { FutureMatchPrediction } from '@/components/FutureMatchPrediction';

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
{ country: 'Coreia do Sul', flag: '🇰🇷' },
{ country: 'República Tcheca', flag: '🇨🇿' },
{ country: 'África do Sul', flag: '🇿🇦' },
],
B: [
{ country: 'Catar', flag: '🇶🇦' },
{ country: 'Suíça', flag: '🇨🇭' },
{ country: 'Canadá', flag: '🇨🇦' },
{ country: 'Bósnia e Herzegovina', flag: '🇧🇦' },
],
C: [
{ country: 'EUA', flag: '🇺🇸' },
{ country: 'Paraguai', flag: '🇵🇾' },
{ country: 'Austrália', flag: '🇦🇺' },
{ country: 'Turquia', flag: '🇹🇷' },
],
D: [
{ country: 'Brasil', flag: '🇧🇷' },
{ country: 'Marrocos', flag: '🇲🇦' },
{ country: 'Haiti', flag: '🇭🇹' },
{ country: 'Escócia', flag: '🏴' },
],
E: [
{ country: 'Alemanha', flag: '🇩🇪' },
{ country: 'Curaçao', flag: '🇨🇼' },
{ country: 'Costa do Marfim', flag: '🇨🇮' },
{ country: 'Equador', flag: '🇪🇨' },
],
F: [
{ country: 'Holanda', flag: '🇳🇱' },
{ country: 'Japão', flag: '🇯🇵' },
{ country: 'Suécia', flag: '🇸🇪' },
{ country: 'Tunísia', flag: '🇹🇳' },
],
G: [
{ country: 'Espanha', flag: '🇪🇸' },
{ country: 'Cabo Verde', flag: '🇨🇻' },
{ country: 'Arábia Saudita', flag: '🇸🇦' },
{ country: 'Uruguai', flag: '🇺🇾' },
],
H: [
{ country: 'Bélgica', flag: '🇧🇪' },
{ country: 'Egito', flag: '🇪🇬' },
{ country: 'Irã', flag: '🇮🇷' },
{ country: 'Nova Zelândia', flag: '🇳🇿' },
],
I: [
{ country: 'França', flag: '🇫🇷' },
{ country: 'Senegal', flag: '🇸🇳' },
{ country: 'Iraque', flag: '🇮🇶' },
{ country: 'Noruega', flag: '🇳🇴' },
],
J: [
{ country: 'Argentina', flag: '🇦🇷' },
{ country: 'Argélia', flag: '🇩🇿' },
{ country: 'Áustria', flag: '🇦🇹' },
{ country: 'Jordânia', flag: '🇯🇴' },
],
K: [
{ country: 'Portugal', flag: '🇵🇹' },
{ country: 'RD Congo', flag: '🇨🇩' },
{ country: 'Uzbequistão', flag: '🇺🇿' },
{ country: 'Colômbia', flag: '🇨🇴' },
],
L: [
{ country: 'Inglaterra', flag: '🏴' },
{ country: 'Croácia', flag: '🇭🇷' },
{ country: 'Gana', flag: '🇬🇭' },
{ country: 'Panamá', flag: '🇵🇦' },
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
if (!value) return 'data não informada';
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


function displayWorldCupTeamName(name: string): string {
  const normalized = normalizeTeamName(name);
  const names: Record<string, string> = {
    brazil: 'Brasil',
    brasil: 'Brasil',
    morocco: 'Marrocos',
    marocco: 'Marrocos',
    marrocos: 'Marrocos',
    mexico: 'México',
    canada: 'Canadá',
    usa: 'EUA',
    'united states': 'EUA',
    paraguay: 'Paraguai',
    qatar: 'Catar',
    switzerland: 'Suíça',
    haiti: 'Haiti',
    scotland: 'Escócia',
    australia: 'Austrália',
    turkiye: 'Turquia',
    turkey: 'Turquia',
    germany: 'Alemanha',
    curacao: 'Curaçao',
    netherlands: 'Holanda',
    japan: 'Japão',
    czechia: 'República Tcheca',
    'czech republic': 'República Tcheca',
    tchequia: 'República Tcheca',
    'republica tcheca': 'República Tcheca',
    'czech rep': 'República Tcheca',
    sweden: 'Suécia',
    tunisia: 'Tunísia',
    spain: 'Espanha',
    'cape verde': 'Cabo Verde',
    'cape verde islands': 'Cabo Verde',
    'saudi arabia': 'Arábia Saudita',
    uruguay: 'Uruguai',
    belgium: 'Bélgica',
    egypt: 'Egito',
    iran: 'Irã',
    'ir iran': 'Irã',
    'new zealand': 'Nova Zelândia',
    france: 'França',
    senegal: 'Senegal',
    iraq: 'Iraque',
    norway: 'Noruega',
    argentina: 'Argentina',
    algeria: 'Argélia',
    austria: 'Áustria',
    jordan: 'Jordânia',
    portugal: 'Portugal',
    'congo dr': 'RD Congo',
    'dr congo': 'RD Congo',
    'congo democratic republic': 'RD Congo',
    uzbekistan: 'Uzbequistão',
    colombia: 'Colômbia',
    england: 'Inglaterra',
    croatia: 'Croácia',
    ghana: 'Gana',
    panama: 'Panamá',
    'ivory coast': 'Costa do Marfim',
    ecuador: 'Equador',
    'bosnia and herzegovina': 'Bósnia e Herzegovina',
    'bosnia herzegovina': 'Bósnia e Herzegovina',
    'south africa': 'África do Sul',
  };
  return names[normalized] ?? name;
}

function canonicalWorldCupTeamName(name: string): string {
  const display = displayWorldCupTeamName(name);
  return normalizeTeamName(display);
}

function worldCupMatchDedupeKey(match: { startTime: string; homeTeam: string; awayTeam: string }): string {
  const date = match.startTime.slice(0, 10);
  const time = formatMatchTime(match.startTime);
  const teams = [canonicalWorldCupTeamName(match.homeTeam), canonicalWorldCupTeamName(match.awayTeam)].sort().join('-');
  return `${date}-${time}-${teams}`;
}


type WorldCupStandingRow = {
  team: WCTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  live: boolean;
};

type WorldCupResultInput = {
  id?: number | string;
  startTime: string;
  roundName?: string;
  statusId?: number;
  statusText?: string;
  competition?: string;
  homeTeam: { name: string; score?: number | null };
  awayTeam: { name: string; score?: number | null };
};

function initialWorldCupStandings(): Record<string, WorldCupStandingRow[]> {
  return Object.fromEntries(
    Object.entries(WC_GROUPS).map(([group, teams]) => [
      group,
      teams.map((team) => ({
        team,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        live: false,
      })),
    ])
  ) as Record<string, WorldCupStandingRow[]>;
}

function worldCupGroupForTeam(teamName: string): string | null {
  const canonical = canonicalWorldCupTeamName(teamName);
  for (const [group, teams] of Object.entries(WC_GROUPS)) {
    if (teams.some((team) => canonicalWorldCupTeamName(team.country) === canonical)) return group;
  }
  return null;
}

function worldCupTeamFlag(teamName: string): string {
  const canonical = canonicalWorldCupTeamName(teamName);
  for (const teams of Object.values(WC_GROUPS)) {
    const found = teams.find((team) => canonicalWorldCupTeamName(team.country) === canonical);
    if (found) return found.flag;
  }
  return TEAM_FLAGS[displayWorldCupTeamName(teamName)] ?? '🏳️';
}

function isWorldCupLiveMatch(match: WorldCupResultInput): boolean {
  const text = normalizeTeamName(`${match.competition ?? ''} ${match.statusText ?? ''}`);
  return text.includes('world cup') || text.includes('copa do mundo');
}

function isLiveStatus(statusText?: string, statusId?: number): boolean {
  const status = normalizeTeamName(statusText ?? '');
  return statusId === 2 || status.includes('ao vivo') || status.includes('live') || status.includes('primeiro') || status.includes('segundo') || status.includes('half');
}

function isFinishedStatus(statusText?: string, statusId?: number): boolean {
  const status = normalizeTeamName(statusText ?? '');
  return statusId === 3 || status.includes('encerr') || status.includes('final') || status.includes('fim') || status.includes('finished');
}

function applyWorldCupMatchToStandings(
  standings: Record<string, WorldCupStandingRow[]>,
  match: WorldCupResultInput,
  live: boolean
) {
  const homeName = displayWorldCupTeamName(match.homeTeam.name);
  const awayName = displayWorldCupTeamName(match.awayTeam.name);
  const group = worldCupGroupForTeam(homeName);
  if (!group || group !== worldCupGroupForTeam(awayName)) return;

  const homeScore = Number(match.homeTeam.score);
  const awayScore = Number(match.awayTeam.score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return;

  const rows = standings[group];
  const home = rows.find((row) => canonicalWorldCupTeamName(row.team.country) === canonicalWorldCupTeamName(homeName));
  const away = rows.find((row) => canonicalWorldCupTeamName(row.team.country) === canonicalWorldCupTeamName(awayName));
  if (!home || !away) return;

  home.played += 1;
  away.played += 1;
  home.goalsFor += homeScore;
  home.goalsAgainst += awayScore;
  away.goalsFor += awayScore;
  away.goalsAgainst += homeScore;
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
  home.live = home.live || live;
  away.live = away.live || live;

  if (homeScore > awayScore) {
    home.wins += 1;
    away.losses += 1;
    home.points += 3;
  } else if (homeScore < awayScore) {
    away.wins += 1;
    home.losses += 1;
    away.points += 3;
  } else {
    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
  }
}

function sortWorldCupStandings(rows: WorldCupStandingRow[]) {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.country.localeCompare(b.team.country, 'pt-BR');
  });
}

function buildWorldCupStandings(matches: WorldCupResultInput[]) {
  const standings = initialWorldCupStandings();
  const applied = new Map<string, WorldCupResultInput & { live: boolean }>();

  for (const match of matches) {
    const live = isLiveStatus(match.statusText, match.statusId) && !isFinishedStatus(match.statusText, match.statusId);
    const hasScore = match.homeTeam.score !== undefined && match.homeTeam.score !== null && match.awayTeam.score !== undefined && match.awayTeam.score !== null;
    if (!hasScore) continue;

    const home = displayWorldCupTeamName(match.homeTeam.name);
    const away = displayWorldCupTeamName(match.awayTeam.name);
    if (!worldCupGroupForTeam(home) || worldCupGroupForTeam(home) !== worldCupGroupForTeam(away)) continue;

    const key = worldCupMatchDedupeKey({ startTime: match.startTime, homeTeam: home, awayTeam: away });
    const previous = applied.get(key);
    if (!previous || live || isFinishedStatus(match.statusText, match.statusId)) applied.set(key, { ...match, live });
  }

  for (const match of applied.values()) applyWorldCupMatchToStandings(standings, match, match.live);

  return Object.fromEntries(
    Object.entries(standings).map(([group, rows]) => [group, sortWorldCupStandings(rows)])
  ) as Record<string, WorldCupStandingRow[]>;
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
const [activeGroup, setActiveGroup] = useState<string>('A');
const [activeTab, setActiveTab] = useState('grupos');
const [selectedTeamQuery, setSelectedTeamQuery] = useState('Brasil');
const [standings, setStandings] = useState<Record<string, WorldCupStandingRow[]>>(initialWorldCupStandings());
const [standingsUpdatedAt, setStandingsUpdatedAt] = useState<string>('');

async function loadWorldCupStandings() {
  try {
    const [resultsRes, liveRes] = await Promise.allSettled([
      fetch('/api/365scores/results/copa_do_mundo', { cache: 'no-store' }),
      fetch('/api/365scores/live', { cache: 'no-store' }),
    ]);

    const matches: WorldCupResultInput[] = [];

    if (resultsRes.status === 'fulfilled' && resultsRes.value.ok) {
      const data = await resultsRes.value.json();
      for (const match of data.matches ?? []) {
        matches.push(match);
      }
    }

    if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
      const data = await liveRes.value.json();
      for (const match of data.matches ?? []) {
        if (!isWorldCupLiveMatch(match)) continue;
        matches.push({
          id: match.id,
          startTime: new Date().toISOString(),
          statusText: match.statusText,
          competition: match.competition,
          homeTeam: { name: match.homeTeam?.name, score: match.homeTeam?.score },
          awayTeam: { name: match.awayTeam?.name, score: match.awayTeam?.score },
        });
      }
    }

    setStandings(buildWorldCupStandings(matches));
    setStandingsUpdatedAt(
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(Date.now())
    );
  } catch {
    setStandings(initialWorldCupStandings());
  }
}

useEffect(() => {
  loadWorldCupStandings();
  const interval = setInterval(loadWorldCupStandings, 30_000);
  return () => clearInterval(interval);
}, []);

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
<TabsList className="grid w-full grid-cols-8">
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
<TabsTrigger value="pesquisa" className="gap-2">
<Search className="w-4 h-4" />
<span className="hidden sm:inline">Pesquisa</span>
</TabsTrigger>
<TabsTrigger value="resultados" className="gap-2">
<Trophy className="w-4 h-4" />
<span className="hidden sm:inline">Resultados</span>
</TabsTrigger>
<TabsTrigger value="elencos" className="gap-2">
<Users className="w-4 h-4" />
<span className="hidden sm:inline">Seleções</span>
</TabsTrigger>
<TabsTrigger value="odds" className="gap-2">
<BadgeDollarSign className="w-4 h-4" />
<span className="hidden sm:inline">Odds</span>
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
{group === 'D' && <span className="ml-1 text-xs">🇧🇷</span>}
</Button>
))}
</div>

{activeGroup && (
<Card className="overflow-hidden border-emerald-500/20">
<div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
<h3 className="font-bold text-lg flex items-center gap-2">
<Trophy className="w-5 h-5 text-amber-400" />
Grupo {activeGroup}
{activeGroup === 'D' && (
<Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
🇧🇷 Brasil
</Badge>
)}
</h3>
{standingsUpdatedAt && (
<Badge variant="outline" className="text-xs text-emerald-300">Tabela auto: {standingsUpdatedAt}</Badge>
)}
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
{(standings[activeGroup] ?? initialWorldCupStandings()[activeGroup]).map((row, idx) => (
<tr
key={row.team.country}
className={`hover:bg-muted/50 transition-colors ${idx < 2 ? 'border-l-2 border-l-emerald-500' : ''}`}
>
<td className="px-4 py-3 text-muted-foreground font-mono">{idx + 1}</td>
<td className="px-4 py-3">
<button
type="button"
onClick={() => openTeamDetails(row.team.country)}
className="flex items-center gap-3 rounded-lg px-2 py-1 -ml-2 text-left transition-colors hover:bg-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
>
<span className="text-xl">{row.team.flag}</span>
<span className="font-medium">{row.team.country}</span>
{row.live && <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">ao vivo</Badge>}
<ChevronRight className="w-4 h-4 text-muted-foreground" />
</button>
</td>
<td className="px-4 py-3 text-center text-muted-foreground">{row.played}</td>
<td className="px-4 py-3 text-center text-green-400">{row.wins}</td>
<td className="px-4 py-3 text-center text-yellow-400">{row.draws}</td>
<td className="px-4 py-3 text-center text-red-400">{row.losses}</td>
<td className="px-4 py-3 text-center text-muted-foreground">{row.goalDifference}</td>
<td className="px-4 py-3 text-center font-bold text-emerald-400">{row.points}</td>
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
{group === 'D' && <span className="text-xs">🇧🇷</span>}
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
Brasil — Grupo D
</h3>
</div>
<div className="p-4 space-y-4">
<div className="grid grid-cols-2 gap-3">
{WC_GROUPS.D.map((team, idx) => (
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
  Próximos Jogos — Copa do Mundo 2026
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

{/* Pesquisa Tab — somente Copa do Mundo */}
<TabsContent value="pesquisa" className="space-y-4">
<WorldCupCornerSearch />
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

{/* Odds Tab */}
<TabsContent value="odds" className="space-y-4">
<WorldCupOddsAlerts />
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
        if (!res.ok) throw new Error('Não foi possível carregar os elencos oficiais agora.');
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
                    Seleções e jogadores oficiais FIFA
</h3>
<p className="text-sm text-muted-foreground mt-1">
                    Lista oficial de convocados extraída do Football Data Platform.
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
<div className="text-xs text-muted-foreground">Seleções</div>
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
<div className="text-xs text-muted-foreground">Versão {data.source.version}</div>
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
                      <div className="text-xs text-muted-foreground">Altura média</div>
<div className="text-lg font-bold text-emerald-400">
{selectedTeamStats.averageHeight ? `${selectedTeamStats.averageHeight} cm` : '-'}
</div>
</div>
<div className="rounded-lg bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Idade média</div>
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
          Estatísticas pessoais
</div>
<div className="space-y-2 text-sm">
<div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Altura vs. média da seleção</span>
<span className="font-semibold">
{heightDiff === null ? '-' : `${heightDiff > 0 ? '+' : ''}${heightDiff} cm`}
</span>
</div>
<div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Jogadores da posição</span>
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

type WorldCupSearchDateOption = 'today' | 'tomorrow' | 'week' | 'custom' | 'all';
type WorldCupSearchHalf = 'total' | '1st' | '2nd';

type WorldCupOddLine = {
bookmaker: string;
market: string;
line: string;
side: 'over' | 'under' | 'home' | 'away' | 'exact' | 'other';
label: string;
odd: number;
};

type WorldCupOddEvent = {
id: string;
startTime: string;
roundName?: string;
homeTeam: string;
awayTeam: string;
bookmakersCount: number;
cornerLines: WorldCupOddLine[];
featuredLines?: Array<{
key: string;
market: string;
line: string;
side: WorldCupOddLine['side'];
label: string;
odds: WorldCupOddLine[];
}>;
};

type WorldCupOddsSearchResponse = {
configured: boolean;
source: string;
note: string;
summary?: {
eventsChecked: number;
cornerLines: number;
alerts: number;
bookmakersCompared: number;
};
events: WorldCupOddEvent[];
lastUpdated: string;
};

type WorldCupUpcomingSearchMatch = {
id: number;
startTime: string;
roundName?: string;
referee?: string | null;
homeTeam: { id: number; name: string; score?: number };
awayTeam: { id: number; name: string; score?: number };
};

const WORLD_CUP_SEARCH_THRESHOLDS = [3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5];

function worldCupSearchDateKey(value: string): string {
const date = new Date(value);
if (Number.isNaN(date.getTime())) return '';
return new Intl.DateTimeFormat('en-CA', {
timeZone: 'America/Sao_Paulo',
year: 'numeric',
month: '2-digit',
day: '2-digit',
}).format(date);
}

function addDaysToDateKey(dateKey: string, days: number): string {
const [year, month, day] = dateKey.split('-').map(Number);
const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
date.setUTCDate(date.getUTCDate() + days);
return date.toISOString().slice(0, 10);
}

function currentSaoPauloDateKey(): string {
return worldCupSearchDateKey(new Date().toISOString());
}

function worldCupSearchMarketMatchesHalf(line: WorldCupOddLine, half: WorldCupSearchHalf): boolean {
const text = normalizeTeamName(`${line.market} ${line.label}`);
const isFirstHalf = text.includes('1st half') || text.includes('first half') || text.includes('1 tempo') || text.includes('1o tempo') || text.includes('primeiro tempo');
const isSecondHalf = text.includes('2nd half') || text.includes('second half') || text.includes('2 tempo') || text.includes('2o tempo') || text.includes('segundo tempo');
if (half === '1st') return isFirstHalf;
if (half === '2nd') return isSecondHalf;
return !isFirstHalf && !isSecondHalf;
}

function worldCupLineNumber(line: WorldCupOddLine): number | null {
const parsed = Number(String(line.line).replace(',', '.'));
return Number.isFinite(parsed) ? parsed : null;
}

function worldCupBestOdd(lines: WorldCupOddLine[]): WorldCupOddLine | null {
return [...lines].sort((a, b) => b.odd - a.odd)[0] ?? null;
}

function worldCupLineKey(line: WorldCupOddLine): string {
return [
normalizeTeamName(line.market),
line.line,
line.side,
normalizeTeamName(line.label).replace(/\d+(?:[.,]\d+)?/g, '').trim(),
].join('|');
}

function groupWorldCupCornerLines(lines: WorldCupOddLine[]): Array<{
key: string;
market: string;
line: string;
side: WorldCupOddLine['side'];
label: string;
odds: WorldCupOddLine[];
bestOdd: WorldCupOddLine | null;
}> {
const grouped = new Map<string, WorldCupOddLine[]>();
for (const line of lines) {
const key = worldCupLineKey(line);
const current = grouped.get(key) ?? [];
current.push(line);
grouped.set(key, current);
}
return [...grouped.entries()].map(([key, values]) => {
const uniqueByBookmaker = new Map<string, WorldCupOddLine>();
for (const value of values) {
const bookmakerKey = normalizeTeamName(value.bookmaker);
const previous = uniqueByBookmaker.get(bookmakerKey);
if (!previous || value.odd > previous.odd) uniqueByBookmaker.set(bookmakerKey, value);
}
const odds = [...uniqueByBookmaker.values()].sort((a, b) => b.odd - a.odd);
return {
key,
market: values[0]?.market ?? '',
line: values[0]?.line ?? '',
side: values[0]?.side ?? 'other',
label: values[0]?.label ?? '',
odds,
bestOdd: worldCupBestOdd(odds),
};
}).sort((a, b) => {
const aLine = Number(a.line);
const bLine = Number(b.line);
if (Number.isFinite(aLine) && Number.isFinite(bLine) && aLine !== bLine) return aLine - bLine;
return (b.bestOdd?.odd ?? 0) - (a.bestOdd?.odd ?? 0);
});
}

function worldCupLineTitle(line: { market: string; line: string; side: WorldCupOddLine['side']; label: string }): string {
const sideLabel: Record<WorldCupOddLine['side'], string> = {
over: 'Over',
under: 'Under',
home: 'Casa',
away: 'Fora',
exact: 'Exato',
other: 'Linha',
};
return `${line.market} — ${sideLabel[line.side]} ${line.line}`;
}

function WorldCupCornerSearch() {
const [dateOption, setDateOption] = useState<WorldCupSearchDateOption>('week');
const [customDate, setCustomDate] = useState('');
const [half, setHalf] = useState<WorldCupSearchHalf>('total');
const [threshold, setThreshold] = useState(8.5);
const [bookmakerFilter, setBookmakerFilter] = useState('all');
const [searchTeam, setSearchTeam] = useState('');
const [showFilters, setShowFilters] = useState(true);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [oddsData, setOddsData] = useState<WorldCupOddsSearchResponse | null>(null);
const [upcomingMatches, setUpcomingMatches] = useState<WorldCupUpcomingSearchMatch[]>([]);
const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

async function load() {
setLoading(true);
setError(null);
try {
const [oddsRes, upcomingRes] = await Promise.all([
fetch('/api/odds/world-cup', { cache: 'no-store' }),
fetch('/api/365scores/upcoming/copa_do_mundo', { cache: 'no-store' }),
]);
if (!oddsRes.ok) throw new Error('Erro ao buscar linhas de escanteios da Copa');
const oddsJson = (await oddsRes.json()) as WorldCupOddsSearchResponse;
setOddsData({ ...oddsJson, events: oddsJson.events ?? [] });
if (upcomingRes.ok) {
const upcomingJson = await upcomingRes.json();
setUpcomingMatches(upcomingJson.matches ?? []);
}
} catch (err) {
setError(err instanceof Error ? err.message : 'Erro desconhecido');
} finally {
setLoading(false);
}
}

useEffect(() => {
load();
}, []);

const availableBookmakers = useMemo(() => {
const names = new Set<string>();
for (const event of oddsData?.events ?? []) {
for (const line of event.cornerLines ?? []) {
if (line.bookmaker) names.add(line.bookmaker);
}
}
return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}, [oddsData?.events]);

const searchRows = useMemo(() => {
const oddsEvents = oddsData?.events ?? [];
const oddsByTeams = new Map<string, WorldCupOddEvent>();
for (const event of oddsEvents) {
const key = `${normalizeTeamName(event.homeTeam)}-${normalizeTeamName(event.awayTeam)}`;
oddsByTeams.set(key, event);
}

const baseEvents: WorldCupOddEvent[] = oddsEvents.length > 0
? oddsEvents
: upcomingMatches.map((match) => ({
id: String(match.id),
startTime: match.startTime,
roundName: match.roundName,
homeTeam: match.homeTeam.name,
awayTeam: match.awayTeam.name,
bookmakersCount: 0,
cornerLines: [],
featuredLines: [],
}));

return baseEvents.map((event) => {
const matchingLines = event.cornerLines.filter((line) => {
if (line.side !== 'over') return false;
if (!worldCupSearchMarketMatchesHalf(line, half)) return false;
if (bookmakerFilter !== 'all' && normalizeTeamName(line.bookmaker) !== normalizeTeamName(bookmakerFilter)) return false;
const lineNumber = worldCupLineNumber(line);
if (lineNumber === null || lineNumber < threshold) return false;
return true;
});
const groupedLines = groupWorldCupCornerLines(matchingLines);
const topLine = groupedLines[0] ?? null;
return {
...event,
groupedLines,
topLine,
};
});
}, [bookmakerFilter, half, oddsData?.events, threshold, upcomingMatches]);

const filteredRows = useMemo(() => {
const today = currentSaoPauloDateKey();
const tomorrow = addDaysToDateKey(today, 1);
const weekEnd = addDaysToDateKey(today, 7);
const requestedDate = dateOption === 'custom' ? customDate : '';

return searchRows.filter((event) => {
const eventDate = worldCupSearchDateKey(event.startTime);
if (dateOption === 'today' && eventDate !== today) return false;
if (dateOption === 'tomorrow' && eventDate !== tomorrow) return false;
if (dateOption === 'week' && (eventDate < today || eventDate > weekEnd)) return false;
if (dateOption === 'custom' && requestedDate && eventDate !== requestedDate) return false;
const teamQuery = normalizeTeamName(searchTeam);
if (teamQuery) {
const teams = normalizeTeamName(`${event.homeTeam} ${event.awayTeam}`);
if (!teams.includes(teamQuery)) return false;
}
if (event.groupedLines.length === 0) return false;
return true;
}).sort((a, b) => {
const bestA = a.topLine?.bestOdd?.odd ?? 0;
const bestB = b.topLine?.bestOdd?.odd ?? 0;
if (bestA !== bestB) return bestB - bestA;
return Date.parse(a.startTime) - Date.parse(b.startTime);
});
}, [customDate, dateOption, searchRows, searchTeam]);

const totalLines = filteredRows.reduce((sum, event) => sum + event.groupedLines.length, 0);
const halfLabel = half === '1st' ? '1º tempo' : half === '2nd' ? '2º tempo' : 'jogo completo';

return (
<div className="space-y-4">
<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-2">
<Target className="w-5 h-5 text-emerald-400" />
<div>
<h3 className="text-lg font-bold">Pesquisa de Escanteios — Copa do Mundo</h3>
<p className="text-xs text-muted-foreground">Busca somente jogos e linhas reais da Copa do Mundo.</p>
</div>
</div>
<Button variant="ghost" size="sm" onClick={() => setShowFilters((value) => !value)}>
<Filter className="w-4 h-4 mr-1" />
Filtros
{showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
</Button>
</div>

{showFilters && (
<Card className="p-4 space-y-4">
<div>
<label className="text-sm text-muted-foreground mb-2 block">
<Calendar className="w-4 h-4 inline mr-1" />
Quando?
</label>
<div className="flex flex-wrap gap-2">
{(['today', 'tomorrow', 'week', 'all', 'custom'] as WorldCupSearchDateOption[]).map((value) => (
<Button key={value} size="sm" variant={dateOption === value ? 'default' : 'outline'} onClick={() => setDateOption(value)}>
{value === 'today' ? 'Hoje' : value === 'tomorrow' ? 'Amanhã' : value === 'week' ? 'Próx. 7 dias' : value === 'all' ? 'Todos' : 'Data específica'}
</Button>
))}
</div>
{dateOption === 'custom' && (
<input
className="mt-2 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
type="date"
value={customDate}
onChange={(event) => setCustomDate(event.target.value)}
/>
)}
</div>

<div>
<label className="text-sm text-muted-foreground mb-2 block">
<Target className="w-4 h-4 inline mr-1" />
Período
</label>
<div className="flex flex-wrap gap-2">
{(['total', '1st', '2nd'] as WorldCupSearchHalf[]).map((value) => (
<Button key={value} size="sm" variant={half === value ? 'default' : 'outline'} onClick={() => setHalf(value)}>
{value === 'total' ? 'Completo' : value === '1st' ? '1º Tempo' : '2º Tempo'}
</Button>
))}
</div>
</div>

<div>
<label className="text-sm text-muted-foreground mb-2 block">Mínimo ({halfLabel})</label>
<div className="flex flex-wrap gap-2">
{WORLD_CUP_SEARCH_THRESHOLDS.map((value) => (
<Button key={value} size="sm" variant={threshold === value ? 'default' : 'outline'} onClick={() => setThreshold(value)}>
Over {value}
</Button>
))}
</div>
</div>

<div>
<label className="text-sm text-muted-foreground mb-2 block">Casa de aposta</label>
<div className="grid gap-2 md:grid-cols-[260px_1fr]">
<select
value={bookmakerFilter}
onChange={(event) => setBookmakerFilter(event.target.value)}
className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
>
<option value="all">Todas as casas</option>
{availableBookmakers.map((bookmaker) => (
<option key={bookmaker} value={bookmaker}>{bookmaker}</option>
))}
</select>
<div className="flex flex-wrap gap-2">
<Button size="sm" variant={bookmakerFilter === 'all' ? 'default' : 'outline'} onClick={() => setBookmakerFilter('all')}>
Todas
</Button>
{availableBookmakers.slice(0, 10).map((bookmaker) => (
<Button
key={bookmaker}
size="sm"
variant={bookmakerFilter === bookmaker ? 'default' : 'outline'}
onClick={() => setBookmakerFilter(bookmaker)}
>
{bookmaker}
</Button>
))}
</div>
</div>
</div>

<div>
<label className="text-sm text-muted-foreground mb-2 block">
<Search className="w-4 h-4 inline mr-1" />
Buscar seleção
</label>
<input
value={searchTeam}
onChange={(event) => setSearchTeam(event.target.value)}
placeholder="Ex: Brasil, México, França..."
className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
/>
</div>
</Card>
)}

<div className="flex flex-wrap items-center gap-2">
<Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Jogos ({filteredRows.length})</Badge>
<Badge variant="outline">Linhas ({totalLines})</Badge>
<Badge variant="outline">Over {threshold}</Badge>
<Badge variant="outline">{halfLabel}</Badge>
<Badge variant="outline">{bookmakerFilter === 'all' ? 'Todas as casas' : bookmakerFilter}</Badge>
<Button variant="outline" size="sm" onClick={load} disabled={loading}>
{loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
Atualizar
</Button>
</div>

{error && (
<Card className="p-4 border-red-500/30 bg-red-500/10">
<p className="text-sm text-red-300">{error}</p>
</Card>
)}

{loading && !oddsData ? (
<Card className="p-8 text-center">
<Loader2 className="mx-auto mb-3 w-6 h-6 animate-spin text-emerald-500" />
<p className="text-sm text-muted-foreground">Carregando linhas da Copa...</p>
</Card>
) : filteredRows.length === 0 ? (
<Card className="p-8 text-center">
<p className="text-sm text-muted-foreground">Nenhuma linha da Copa encontrada com os filtros atuais.</p>
<p className="text-xs text-muted-foreground mt-1">Tente ampliar a data, trocar o período, trocar a casa de aposta ou reduzir o Over mínimo.</p>
</Card>
) : (
<div className="space-y-3">
{filteredRows.map((event) => {
const selected = selectedMatchId === event.id;
return (
<Card key={event.id} className="p-4 border-emerald-500/20 space-y-4">
<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
<div>
<div className="flex flex-wrap items-center gap-2 mb-2">
<Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Copa do Mundo</Badge>
{event.roundName && <Badge variant="outline">{event.roundName}</Badge>}
<Badge variant="outline">{event.groupedLines.length} linhas filtradas</Badge>
<Badge variant="outline">{event.bookmakersCount} casas</Badge>
</div>
<h4 className="text-lg font-bold">{event.homeTeam} x {event.awayTeam}</h4>
<p className="text-sm text-muted-foreground">{formatShortMatchDate(event.startTime)} às {formatMatchTime(event.startTime)} BRT</p>
</div>
<Button variant={selected ? 'default' : 'outline'} size="sm" onClick={() => setSelectedMatchId(selected ? null : event.id)}>
{selected ? 'Fechar previsão' : 'Ver previsão'}
</Button>
</div>

<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
{event.groupedLines.slice(0, 6).map((line) => {
const best = line.bestOdd;
return (
<div key={line.key} className="rounded-lg bg-muted/30 border border-border p-3">
<div className="font-semibold text-sm">{worldCupLineTitle(line)}</div>
<div className="text-xs text-muted-foreground mb-2">{line.label}</div>
{best ? (
<div className="text-sm font-bold text-emerald-300">Melhor: {best.bookmaker} {best.odd.toFixed(2)}</div>
) : (
<div className="text-sm text-muted-foreground">Sem odd disponível</div>
)}
<div className="mt-2 flex flex-wrap gap-1">
{line.odds.slice(0, 4).map((odd) => (
<span key={`${odd.bookmaker}-${odd.odd}`} className="rounded-full bg-background/60 px-2 py-1 text-xs text-muted-foreground">
{odd.bookmaker}: {odd.odd.toFixed(2)}
</span>
))}
</div>
</div>
);
})}
</div>

{selected && (
<FutureMatchPrediction
homeTeam={event.homeTeam}
awayTeam={event.awayTeam}
league="Copa do Mundo 2026"
kickoff={event.startTime}
onClose={() => setSelectedMatchId(null)}
/>
)}
</Card>
);
})}
</div>
)}
</div>
);
}

function WorldCupMatches({
  showResults = false,
  autoLoad = false,
}: {
  showResults?: boolean;
  autoLoad?: boolean;
}) {
  type WorldCupDisplayMatch = {
    id: number;
    startTime: string;
    homeTeam: string;
    awayTeam: string;
    timeLabel: string;
    roundName?: string;
    statusId?: number;
    statusText?: string;
    referee?: string | null;
    homeScore?: number;
    awayScore?: number;
  };

  const [loading, setLoading] = useState(false);
  const [matchGroups, setMatchGroups] = useState<Array<{ dateLabel: string; matches: WorldCupDisplayMatch[] }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [dateOption, setDateOption] = useState<WorldCupSearchDateOption>('all');
  const [customDate, setCustomDate] = useState('');
  const [teamQuery, setTeamQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  function isLiveMatch(match: WorldCupDisplayMatch): boolean {
    const status = `${match.statusText ?? ''}`.toLowerCase();
    return match.statusId === 2 || status.includes('live') || status.includes('ao vivo') || status.includes('in play');
  }

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = showResults
        ? '/api/365scores/results/copa_do_mundo'
        : '/api/365scores/upcoming/copa_do_mundo';
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) throw new Error('Erro ao buscar dados');
      const data = await res.json();
      const rawMatches: Array<{
        id: number;
        startTime: string;
        roundName?: string;
        statusId?: number;
        statusText?: string;
        referee?: string | null;
        homeTeam: { id: number; name: string; score?: number };
        awayTeam: { id: number; name: string; score?: number };
      }> = data.matches || [];

      const deduped = new Map<string, WorldCupDisplayMatch>();

      for (const m of rawMatches) {
        const match: WorldCupDisplayMatch = {
          id: m.id,
          startTime: m.startTime,
          homeTeam: displayWorldCupTeamName(m.homeTeam.name),
          awayTeam: displayWorldCupTeamName(m.awayTeam.name),
          timeLabel: formatMatchTime(m.startTime),
          roundName: m.roundName,
          statusId: m.statusId,
          statusText: m.statusText,
          referee: m.referee,
          homeScore: m.homeTeam.score,
          awayScore: m.awayTeam.score,
        };

        const key = worldCupMatchDedupeKey(match);
        const previous = deduped.get(key);

        if (!previous) {
          deduped.set(key, match);
          continue;
        }

        const currentScore = (match.homeScore !== undefined ? 1 : 0) + (match.awayScore !== undefined ? 1 : 0);
        const previousScore = (previous.homeScore !== undefined ? 1 : 0) + (previous.awayScore !== undefined ? 1 : 0);
        if (currentScore >= previousScore) deduped.set(key, match);
      }

      const matches = [...deduped.values()].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
      const byDate: Record<string, { dateLabel: string; matches: WorldCupDisplayMatch[] }> = {};

      for (const match of matches) {
        const dateLabel = formatMatchDate(match.startTime);
        if (!byDate[dateLabel]) byDate[dateLabel] = { dateLabel, matches: [] };
        byDate[dateLabel].matches.push(match);
      }

      const sortedGroups = Object.values(byDate).sort(
        (a, b) => Date.parse(a.matches[0]?.startTime ?? '') - Date.parse(b.matches[0]?.startTime ?? '')
      );

      setMatchGroups(sortedGroups);
      setSelectedMatchId(null);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, showResults]);

  const filteredMatchGroups = useMemo(() => {
    const today = currentSaoPauloDateKey();
    const tomorrow = addDaysToDateKey(today, 1);
    const weekEnd = addDaysToDateKey(today, 7);
    const requestedDate = dateOption === 'custom' ? customDate : '';
    const query = normalizeTeamName(teamQuery);

    return matchGroups
      .map((group) => ({
        ...group,
        matches: group.matches.filter((match) => {
          const eventDate = worldCupSearchDateKey(match.startTime);
          if (dateOption === 'today' && eventDate !== today) return false;
          if (dateOption === 'tomorrow' && eventDate !== tomorrow) return false;
          if (dateOption === 'week' && (eventDate < today || eventDate > weekEnd)) return false;
          if (dateOption === 'custom' && requestedDate && eventDate !== requestedDate) return false;
          if (query) {
            const teams = normalizeTeamName(`${match.homeTeam} ${match.awayTeam}`);
            if (!teams.includes(query)) return false;
          }
          return true;
        }),
      }))
      .filter((group) => group.matches.length > 0);
  }, [customDate, dateOption, matchGroups, teamQuery]);

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
          {showResults ? 'Clique para carregar os resultados' : 'Clique para carregar os próximos jogos'} da Copa do Mundo 2026
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
        <p className="text-xs text-muted-foreground mt-1">A Copa do Mundo começa em 11 de junho de 2026</p>
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
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => setShowFilters((value) => !value)}>
          <Filter className="w-4 h-4 mr-1" />
          Filtros
          {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
        </Button>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3 h-3 mr-1" />
          Atualizar
        </Button>
      </div>

      {showFilters && (
        <Card className="p-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              <Calendar className="w-4 h-4 inline mr-1" />
              Quando?
            </label>
            <div className="flex flex-wrap gap-2">
              {(['today', 'tomorrow', 'week', 'all', 'custom'] as WorldCupSearchDateOption[]).map((value) => (
                <Button key={value} size="sm" variant={dateOption === value ? 'default' : 'outline'} onClick={() => setDateOption(value)}>
                  {value === 'today' ? 'Hoje' : value === 'tomorrow' ? 'Amanhã' : value === 'week' ? 'Próx. 7 dias' : value === 'all' ? 'Todos' : 'Data específica'}
                </Button>
              ))}
            </div>
            {dateOption === 'custom' && (
              <input
                className="mt-2 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
              />
            )}
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              <Search className="w-4 h-4 inline mr-1" />
              Buscar seleção
            </label>
            <input
              value={teamQuery}
              onChange={(event) => setTeamQuery(event.target.value)}
              placeholder="Ex: Brasil, México, França..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
            />
          </div>
        </Card>
      )}

      {filteredMatchGroups.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum jogo encontrado com os filtros atuais.</p>
        </Card>
      ) : filteredMatchGroups.map((group) => (
        <div key={group.dateLabel} className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1">
            {group.dateLabel}
          </div>
          <div className="space-y-2">
            {group.matches.map((match) => {
              const hasScore = showResults && match.homeScore !== undefined;
              const live = isLiveMatch(match);
              const selected = selectedMatchId === match.id;

              return (
                <div key={match.id} className="space-y-2">
                  <div
                    className={`bg-muted/40 rounded-lg px-4 py-3 flex items-center justify-between gap-3 border transition-colors ${
                      !showResults
                        ? 'cursor-pointer border-transparent hover:border-emerald-500/40 hover:bg-emerald-500/10'
                        : 'border-transparent'
                    } ${selected ? 'border-emerald-500/60 bg-emerald-500/10' : ''}`}
                    onClick={() => {
                      if (showResults) return;
                      setSelectedMatchId((current) => (current === match.id ? null : match.id));
                    }}
                  >
                    <div className="flex-1 text-right pr-3">
                      <span className="font-semibold text-sm">{match.homeTeam}</span>
                    </div>
                    <div className="flex flex-col items-center min-w-[80px]">
                      <span className="text-xs text-muted-foreground">{match.timeLabel}</span>
                      {hasScore ? (
                        <span className="font-bold text-lg">{match.homeScore} – {match.awayScore}</span>
                      ) : (
                        <span className="text-emerald-500 font-bold text-sm">vs</span>
                      )}
                      {live && <Badge className="mt-1 bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">AO VIVO</Badge>}
                    </div>
                    <div className="flex-1 text-left pl-3">
                      <span className="font-semibold text-sm">{match.awayTeam}</span>
                    </div>
                  </div>

                  {selected && !showResults && (
                    <FutureMatchPrediction
                      homeTeam={match.homeTeam}
                      awayTeam={match.awayTeam}
                      league="Copa do Mundo 2026"
                      kickoff={match.startTime}
                      referee={match.referee}
                      onClose={() => setSelectedMatchId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
