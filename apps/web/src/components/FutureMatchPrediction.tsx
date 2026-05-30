'use client';

import { useMemo } from 'react';
import { AlertCircle, BarChart3, Clock, CreditCard, Target, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getHeadToHead,
  teamStats,
  type DetailedTeamStats,
} from '@/data/teamCornerStats';
import {
  brazilianTeamStats,
  championsLeagueTeamStats,
  conferenceLeagueTeamStats,
  copaDoBrasilTeamStats,
  europaLeagueTeamStats,
  libertadoresTeamStats,
  serieBTeamStats,
  sulAmericanaTeamStats,
  type TeamCornerStats,
} from '@/data/cornerStats';
import { findTeamCardStats, type TeamCardStats } from '@/data/teamCardStats';
import { findReferee, getRefereeStatsSummary } from '@/data/brazilianReferees';

interface FutureMatchPredictionProps {
  homeTeam: string;
  awayTeam: string;
  league?: string;
  kickoff?: string;
  kickoffLabel?: string;
  referee?: string | null;
  onClose?: () => void;
}

interface StatProfile {
  team: string;
  league: string;
  gamesPlayed: number;
  avgFor: number;
  avgAgainst: number;
  avgTotal: number;
  avgHome: number;
  avgAway: number;
  avgFirstHalf: number;
  avgSecondHalf: number;
  avgLast5: number;
  firstCornerPct: number;
  over85Pct: number;
  over95Pct: number;
  over105Pct: number;
  source: 'detalhado' | 'basico' | 'estimado';
}

const BASIC_STAT_SETS: Array<{ label: string; stats: TeamCornerStats[] }> = [
  { label: 'Brasileirao Serie A', stats: brazilianTeamStats },
  { label: 'Brasileirao Serie B', stats: serieBTeamStats },
  { label: 'Copa do Brasil', stats: copaDoBrasilTeamStats },
  { label: 'Copa Libertadores', stats: libertadoresTeamStats },
  { label: 'Copa Sul-Americana', stats: sulAmericanaTeamStats },
  { label: 'Champions League', stats: championsLeagueTeamStats },
  { label: 'Europa League', stats: europaLeagueTeamStats },
  { label: 'Conference League', stats: conferenceLeagueTeamStats },
];

const TEAM_ALIASES: Record<string, string[]> = {
  'paris saint germain': ['psg', 'paris sg'],
  psg: ['paris saint germain', 'paris sg'],
  'ogc nice': ['nice'],
  nice: ['ogc nice'],
  'saint etienne': ['st etienne', 'as saint etienne'],
  'st etienne': ['saint etienne', 'as saint etienne'],
  'bayern munchen': ['bayern munich', 'bayern'],
  'bayern munich': ['bayern munchen', 'bayern'],
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactText(value: string): string {
  return normalizeText(value)
    .replace(/\b(fc|cf|ac|sc|ec|club|de|da|do|the|afc|ogc|as)\b/g, '')
    .replace(/\s+/g, '');
}

function aliasesFor(teamName: string): string[] {
  const normalized = normalizeText(teamName);
  const compact = compactText(teamName);
  return [normalized, compact, ...(TEAM_ALIASES[normalized] ?? [])].filter(Boolean);
}

function teamNamesMatch(statTeam: string, inputTeam: string): boolean {
  const statAliases = aliasesFor(statTeam);
  const inputAliases = aliasesFor(inputTeam);
  return statAliases.some((statAlias) =>
    inputAliases.some(
      (inputAlias) =>
        statAlias === inputAlias ||
        statAlias.includes(inputAlias) ||
        inputAlias.includes(statAlias)
    )
  );
}

function leagueMatches(statLeague: string, requestedLeague?: string): boolean {
  if (!requestedLeague) return true;
  const stat = normalizeText(statLeague);
  const requested = normalizeText(requestedLeague);
  if (!requested || !stat) return true;
  if (requested.includes(stat) || stat.includes(requested)) return true;

  const checks: Array<[string, string[]]> = [
    ['copa libertadores', ['libertadores', 'conmebol']],
    ['copa sul americana', ['sul americana', 'sudamericana']],
    ['champions league', ['champions']],
    ['europa league', ['europa league']],
    ['conference league', ['conference']],
    ['brasileirao serie a', ['serie a', 'brasileirao a']],
    ['brasileirao serie b', ['serie b', 'brasileirao b']],
    ['copa do brasil', ['copa do brasil']],
  ];

  return checks.some(([canonical, aliases]) => {
    const statHit = stat.includes(canonical) || canonical.includes(stat);
    const requestedHit = aliases.some((alias) => requested.includes(alias));
    return statHit && requestedHit;
  });
}

function detailedToProfile(team: DetailedTeamStats): StatProfile {
  return {
    team: team.team,
    league: team.league,
    gamesPlayed: team.gamesPlayed,
    avgFor: team.avgCornersFor,
    avgAgainst: team.avgCornersAgainst,
    avgTotal: team.avgTotalCorners,
    avgHome: team.avgCornersHome,
    avgAway: team.avgCornersAway,
    avgFirstHalf: team.avgCornersFirstHalf,
    avgSecondHalf: team.avgCornersSecondHalf,
    avgLast5: team.avgLast5,
    firstCornerPct: team.firstCornerPct,
    over85Pct: team.over85Pct,
    over95Pct: team.over95Pct,
    over105Pct: team.over105Pct,
    source: 'detalhado',
  };
}

function basicToProfile(team: TeamCornerStats, fallbackLeague: string): StatProfile {
  return {
    team: team.team,
    league: team.league || fallbackLeague,
    gamesPlayed: team.gamesPlayed,
    avgFor: team.avgCornersFor,
    avgAgainst: team.avgCornersAgainst,
    avgTotal: team.avgTotalCorners,
    avgHome: team.avgCornersFor * 1.08,
    avgAway: team.avgCornersFor * 0.92,
    avgFirstHalf: team.avgCornersFor * 0.46,
    avgSecondHalf: team.avgCornersFor * 0.54,
    avgLast5: team.avgCornersFor,
    firstCornerPct: team.firstCornerPct,
    over85Pct: team.over85Pct,
    over95Pct: team.over95Pct,
    over105Pct: team.over105Pct,
    source: 'basico',
  };
}

function estimatedProfile(teamName: string, league?: string): StatProfile {
  return {
    team: teamName,
    league: league || 'Liga nao identificada',
    gamesPlayed: 0,
    avgFor: 5.0,
    avgAgainst: 4.8,
    avgTotal: 9.8,
    avgHome: 5.3,
    avgAway: 4.7,
    avgFirstHalf: 2.3,
    avgSecondHalf: 2.7,
    avgLast5: 5.0,
    firstCornerPct: 50,
    over85Pct: 55,
    over95Pct: 45,
    over105Pct: 32,
    source: 'estimado',
  };
}

function findProfile(teamName: string, league?: string): { profile: StatProfile; found: boolean } {
  const detailedMatches = teamStats.filter((team) => teamNamesMatch(team.team, teamName));
  const detailedByLeague = detailedMatches.find((team) => leagueMatches(team.league, league));
  if (detailedByLeague) return { profile: detailedToProfile(detailedByLeague), found: true };

  const basicMatches = BASIC_STAT_SETS.flatMap((set) =>
    set.stats
      .filter((team) => teamNamesMatch(team.team, teamName))
      .map((team) => ({
        profile: basicToProfile(team, set.label),
        setLabel: set.label,
      }))
  );
  const basicByLeague = basicMatches.find((match) => leagueMatches(match.setLabel, league));
  if (basicByLeague) return { profile: basicByLeague.profile, found: true };

  if (detailedMatches[0]) return { profile: detailedToProfile(detailedMatches[0]), found: true };
  if (basicMatches[0]) return { profile: basicMatches[0].profile, found: true };

  return { profile: estimatedProfile(teamName, league), found: false };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function calcOverProbability(mean: number, threshold: number, variance = 2.4): number {
  const zScore = (threshold - mean) / variance;
  const probability = 100 * (1 - 0.5 * (1 + Math.tanh(zScore * 0.8)));
  return Math.min(95, Math.max(5, Math.round(probability)));
}

function formatKickoff(kickoff?: string, kickoffLabel?: string): string | null {
  if (kickoffLabel) return kickoffLabel;
  if (!kickoff) return null;
  const numericMs = Number(kickoff);
  const ms = Number.isFinite(numericMs) ? numericMs : Date.parse(kickoff);
  if (!Number.isFinite(ms)) return kickoff;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms);
}

function teamCardAverage(teamCard?: TeamCardStats): number {
  return teamCard?.avgCardsPerMatch ?? 2.1;
}

export function FutureMatchPrediction({
  homeTeam,
  awayTeam,
  league,
  kickoff,
  kickoffLabel,
  referee,
  onClose,
}: FutureMatchPredictionProps) {
  const prediction = useMemo(() => {
    const home = findProfile(homeTeam, league);
    const away = findProfile(awayTeam, league);
    const h2h = getHeadToHead(home.profile.team, away.profile.team);
    const h2hAvg = h2h?.avgTotalCorners ?? null;

    let homeExpected =
      home.profile.avgHome * 0.35 +
      home.profile.avgLast5 * 0.25 +
      ((home.profile.avgFor * 1.08 + away.profile.avgAgainst) / 2) * 0.4;
    let awayExpected =
      away.profile.avgAway * 0.35 +
      away.profile.avgLast5 * 0.25 +
      ((away.profile.avgFor * 0.94 + home.profile.avgAgainst) / 2) * 0.4;

    if (h2hAvg) {
      const adjustment = (h2hAvg - (homeExpected + awayExpected)) * 0.18;
      homeExpected += adjustment / 2;
      awayExpected += adjustment / 2;
    }

    const total = homeExpected + awayExpected;
    const homeFirstShare = home.profile.avgFor > 0 ? home.profile.avgFirstHalf / home.profile.avgFor : 0.46;
    const awayFirstShare = away.profile.avgFor > 0 ? away.profile.avgFirstHalf / away.profile.avgFor : 0.46;
    const homeFirst = homeExpected * homeFirstShare;
    const awayFirst = awayExpected * awayFirstShare;
    const firstHalf = homeFirst + awayFirst;
    const secondHalf = Math.max(0, total - firstHalf);

    const homeCards = findTeamCardStats(homeTeam);
    const awayCards = findTeamCardStats(awayTeam);
    const refereeStats = referee ? findReferee(referee) : null;
    const refereeSummary = refereeStats ? getRefereeStatsSummary(refereeStats) : null;
    const teamCardsTotal =
      homeCards || awayCards ? teamCardAverage(homeCards) + teamCardAverage(awayCards) : null;
    const expectedCards = refereeStats
      ? teamCardsTotal
        ? refereeStats.avgCardsPerMatch * 0.6 + teamCardsTotal * 0.4
        : refereeStats.avgCardsPerMatch
      : teamCardsTotal ?? 4.2;
    const cardsFirstHalfPct = refereeStats
      ? refereeStats.halfDistribution.firstHalf
      : homeCards || awayCards
        ? 40
        : 38;

    const confidence =
      home.found && away.found ? 'alta' : home.found || away.found ? 'media' : 'baixa';

    return {
      home,
      away,
      h2h,
      homeExpected: round(homeExpected),
      awayExpected: round(awayExpected),
      total: round(total),
      firstHalf: round(firstHalf),
      secondHalf: round(secondHalf),
      homeFirst: round(homeFirst),
      awayFirst: round(awayFirst),
      confidence,
      overs: [
        { label: 'Over 7.5', probability: calcOverProbability(total, 7.5) },
        { label: 'Over 8.5', probability: calcOverProbability(total, 8.5) },
        { label: 'Over 9.5', probability: calcOverProbability(total, 9.5) },
        { label: 'Over 10.5', probability: calcOverProbability(total, 10.5) },
      ],
      halfOvers: [
        { label: '1T Over 3.5', probability: calcOverProbability(firstHalf, 3.5, 1.5) },
        { label: '1T Over 4.5', probability: calcOverProbability(firstHalf, 4.5, 1.5) },
        { label: '2T Over 4.5', probability: calcOverProbability(secondHalf, 4.5, 1.7) },
        { label: '2T Over 5.5', probability: calcOverProbability(secondHalf, 5.5, 1.7) },
      ],
      cards: {
        refereeStats,
        refereeSummary,
        homeCards,
        awayCards,
        expectedTotal: round(expectedCards),
        expectedYellow: round(expectedCards * 0.92),
        expectedRed: round(expectedCards * 0.08),
        firstHalf: round(expectedCards * (cardsFirstHalfPct / 100)),
        secondHalf: round(expectedCards * (1 - cardsFirstHalfPct / 100)),
      },
    };
  }, [awayTeam, homeTeam, league, referee]);

  const kickoffDisplay = formatKickoff(kickoff, kickoffLabel);
  const confidenceClass =
    prediction.confidence === 'alta'
      ? 'border-emerald-500/40 text-emerald-400'
      : prediction.confidence === 'media'
        ? 'border-amber-500/40 text-amber-400'
        : 'border-red-500/40 text-red-400';

  return (
    <Card className="p-4 border-primary/20 bg-muted/20 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-primary">
            <Target className="w-4 h-4" />
            <span className="font-semibold">Previsao do jogo</span>
            <Badge variant="outline" className={confidenceClass}>
              {prediction.confidence}
            </Badge>
          </div>
          <h4 className="mt-1 text-base font-bold">
            {homeTeam} <span className="text-muted-foreground">x</span> {awayTeam}
          </h4>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {league && <span>{league}</span>}
            {kickoffDisplay && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {kickoffDisplay}
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Total previsto</p>
          <p className="text-2xl font-bold text-emerald-400">{prediction.total}</p>
          <p className="text-xs text-muted-foreground">escanteios</p>
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">1o tempo</p>
          <p className="text-2xl font-bold text-violet-400">{prediction.firstHalf}</p>
          <p className="text-xs text-muted-foreground">
            {prediction.homeFirst} + {prediction.awayFirst}
          </p>
        </div>
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">2o tempo</p>
          <p className="text-2xl font-bold text-cyan-400">{prediction.secondHalf}</p>
          <p className="text-xs text-muted-foreground">
            {round(prediction.homeExpected - prediction.homeFirst)} +{' '}
            {round(prediction.awayExpected - prediction.awayFirst)}
          </p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Times</p>
          <p className="text-lg font-bold text-amber-400">
            {prediction.homeExpected} - {prediction.awayExpected}
          </p>
          <p className="text-xs text-muted-foreground">casa / fora</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Linhas de escanteios
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[...prediction.overs, ...prediction.halfOvers].map((line) => (
              <div key={line.label} className="rounded-lg bg-muted/40 p-2">
                <p className="text-xs text-muted-foreground">{line.label}</p>
                <p
                  className={`text-lg font-bold ${
                    line.probability >= 60
                      ? 'text-emerald-400'
                      : line.probability >= 45
                        ? 'text-amber-400'
                        : 'text-muted-foreground'
                  }`}
                >
                  {line.probability}%
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CreditCard className="w-4 h-4 text-amber-400" />
            Previsao de cartoes
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-amber-400">{prediction.cards.expectedTotal}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">Amarelos / vermelhos</p>
              <p className="text-lg font-bold">
                {prediction.cards.expectedYellow} / {prediction.cards.expectedRed}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">1o tempo</p>
              <p className="text-lg font-bold">{prediction.cards.firstHalf}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">2o tempo</p>
              <p className="text-lg font-bold">{prediction.cards.secondHalf}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {prediction.cards.refereeStats
              ? `Arbitro: ${prediction.cards.refereeStats.name} (${prediction.cards.refereeStats.avgCardsPerMatch.toFixed(1)} cartoes/jogo).`
              : 'Sem arbitro informado; usei as medias locais dos times quando disponiveis.'}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/40 p-3">
        <p className="mb-2 text-sm font-semibold">Dados locais usados</p>
        <div className="grid gap-2 md:grid-cols-2">
          {[prediction.home.profile, prediction.away.profile].map((team) => (
            <div key={`${team.team}-${team.league}`} className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{team.team}</p>
                <Badge variant="outline" className="text-xs">
                  {team.source}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{team.league}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <span>A favor: {round(team.avgFor)}</span>
                <span>Contra: {round(team.avgAgainst)}</span>
                <span>Total: {round(team.avgTotal)}</span>
                <span>1T: {round(team.avgFirstHalf)}</span>
                <span>2T: {round(team.avgSecondHalf)}</span>
                <span>Jogos: {team.gamesPlayed || 'base'}</span>
              </div>
            </div>
          ))}
        </div>
        {prediction.h2h ? (
          <p className="mt-2 text-xs text-muted-foreground">
            H2H local encontrado: media de {prediction.h2h.avgTotalCorners.toFixed(1)} escanteios.
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <AlertCircle className="w-3 h-3" />
            Sem H2H local para este confronto; a previsao usa medias dos times e liga.
          </p>
        )}
      </div>
    </Card>
  );
}
