'use client';

import { useMemo } from 'react';
import { AlertCircle, BarChart3, Clock, CreditCard, Target, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { teamStats, type DetailedTeamStats } from '@/data/teamCornerStats';
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
import { findTeamCardStats } from '@/data/teamCardStats';
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
  over85Pct: number;
  over95Pct: number;
  over105Pct: number;
  source: 'detalhado' | 'basico' | 'estimado';
}

const BASIC_STAT_SETS: Array<{ label: string; stats: TeamCornerStats[] }> = [
  { label: 'Brasileirão Série A', stats: brazilianTeamStats },
  { label: 'Brasileirão Série B', stats: serieBTeamStats },
  { label: 'Copa do Brasil', stats: copaDoBrasilTeamStats },
  { label: 'Copa Libertadores', stats: libertadoresTeamStats },
  { label: 'Copa Sul-Americana', stats: sulAmericanaTeamStats },
  { label: 'Champions League', stats: championsLeagueTeamStats },
  { label: 'Europa League', stats: europaLeagueTeamStats },
  { label: 'Conference League', stats: conferenceLeagueTeamStats },
];

const TEAM_ALIASES: Record<string, string[]> = {
  psg: ['paris saint germain', 'paris sg'],
  'paris saint germain': ['psg', 'paris sg'],
  'bayern munich': ['bayern munchen', 'bayern'],
  'bayern munchen': ['bayern munich', 'bayern'],
  'man city': ['manchester city'],
  'man united': ['manchester united'],
  'inter milan': ['internazionale'],
};

const LEAGUE_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'brasileirao serie a', aliases: ['brasileirao', 'brasileirao serie a', 'brasileirão', 'serie a brasil'] },
  { canonical: 'brasileirao serie b', aliases: ['brasileirao serie b', 'serie b', 'brasileirão série b'] },
  { canonical: 'copa do brasil', aliases: ['copa do brasil'] },
  { canonical: 'copa libertadores', aliases: ['libertadores', 'conmebol libertadores', 'copa libertadores'] },
  { canonical: 'copa sul americana', aliases: ['sul americana', 'sul-americana', 'sudamericana'] },
  { canonical: 'champions league', aliases: ['champions', 'uefa champions league'] },
  { canonical: 'europa league', aliases: ['europa league'] },
  { canonical: 'conference league', aliases: ['conference league'] },
  { canonical: 'copa do mundo', aliases: ['copa do mundo', 'world cup', 'fifa world cup'] },
];

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value: unknown): string {
  return normalizeText(value)
    .replace(/\b(fc|cf|ac|sc|ec|club|clube|de|da|do|the|afc|ogc|as)\b/g, '')
    .replace(/\s+/g, '');
}

function aliasesFor(teamName: string): string[] {
  const normalized = normalizeText(teamName);
  return [normalized, compactText(teamName), ...(TEAM_ALIASES[normalized] ?? [])].filter(Boolean);
}

function teamNamesMatch(statTeam: string, inputTeam: string): boolean {
  const statAliases = aliasesFor(statTeam);
  const inputAliases = aliasesFor(inputTeam);
  return statAliases.some((statAlias) => inputAliases.some((inputAlias) => statAlias === inputAlias || statAlias.includes(inputAlias) || inputAlias.includes(statAlias)));
}

function canonicalLeague(value?: string): string {
  const n = normalizeText(value ?? '');
  if (!n) return '';
  const hit = LEAGUE_ALIASES.find((item) => item.canonical === n || item.aliases.some((alias) => n.includes(normalizeText(alias)) || normalizeText(alias).includes(n)));
  return hit?.canonical ?? n;
}

function leagueMatches(statLeague: string, requestedLeague?: string): boolean {
  const requested = canonicalLeague(requestedLeague);
  if (!requested) return true;
  const stat = canonicalLeague(statLeague);
  return stat === requested || stat.includes(requested) || requested.includes(stat);
}

function isWorldCup(league?: string): boolean {
  return canonicalLeague(league) === 'copa do mundo';
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
    over85Pct: team.over85Pct,
    over95Pct: team.over95Pct,
    over105Pct: team.over105Pct,
    source: 'basico',
  };
}

function estimatedProfile(teamName: string, league?: string): StatProfile {
  return {
    team: teamName,
    league: league || 'Competição sem base própria',
    gamesPlayed: 0,
    avgFor: 0,
    avgAgainst: 0,
    avgTotal: 0,
    avgHome: 0,
    avgAway: 0,
    avgFirstHalf: 0,
    avgSecondHalf: 0,
    avgLast5: 0,
    over85Pct: 0,
    over95Pct: 0,
    over105Pct: 0,
    source: 'estimado',
  };
}

function findProfile(teamName: string, league?: string): { profile: StatProfile; found: boolean; reason?: string } {
  // Regra principal: nunca reaproveitar médias de outra competição.
  // Isso evita que Copa do Mundo, Libertadores, Champions etc. herdem números do Brasileirão.
  const requested = canonicalLeague(league);

  const detailedMatches = teamStats.filter((team) => teamNamesMatch(team.team, teamName));
  const detailedByLeague = detailedMatches.find((team) => leagueMatches(team.league, league));
  if (detailedByLeague) return { profile: detailedToProfile(detailedByLeague), found: true };

  const allowedSets = BASIC_STAT_SETS.filter((set) => !requested || leagueMatches(set.label, league));
  const basicMatches = allowedSets.flatMap((set) =>
    set.stats
      .filter((team) => teamNamesMatch(team.team, teamName))
      .map((team) => ({ profile: basicToProfile(team, set.label), setLabel: set.label }))
  );
  const basicByLeague = basicMatches.find((match) => leagueMatches(match.setLabel, league));
  if (basicByLeague) return { profile: basicByLeague.profile, found: true };

  return {
    profile: estimatedProfile(teamName, league),
    found: false,
    reason: requested ? `Sem base local específica para ${league}.` : 'Competição não informada.',
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function calcOverProbability(mean: number, threshold: number, variance = 2.4): number {
  if (mean <= 0) return 0;
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
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(ms);
}

function teamCardAverage(teamCard?: { avgCardsPerMatch?: number }): number {
  return teamCard?.avgCardsPerMatch ?? 0;
}

function confidenceClass(confidence: 'alta' | 'media' | 'baixa') {
  if (confidence === 'alta') return 'border-emerald-500/40 text-emerald-400';
  if (confidence === 'media') return 'border-amber-500/40 text-amber-400';
  return 'border-red-500/40 text-red-400';
}

export function FutureMatchPrediction({ homeTeam, awayTeam, league, kickoff, kickoffLabel, referee, onClose }: FutureMatchPredictionProps) {
  const prediction = useMemo(() => {
    const home = findProfile(homeTeam, league);
    const away = findProfile(awayTeam, league);
    const hasBothTeams = home.found && away.found;

    const homeExpected = hasBothTeams ? round(home.profile.avgHome * 0.35 + home.profile.avgLast5 * 0.25 + ((home.profile.avgFor * 1.08 + away.profile.avgAgainst) / 2) * 0.4) : 0;
    const awayExpected = hasBothTeams ? round(away.profile.avgAway * 0.35 + away.profile.avgLast5 * 0.25 + ((away.profile.avgFor * 0.94 + home.profile.avgAgainst) / 2) * 0.4) : 0;
    const total = round(homeExpected + awayExpected);
    const homeFirstShare = home.profile.avgFor > 0 ? home.profile.avgFirstHalf / home.profile.avgFor : 0.46;
    const awayFirstShare = away.profile.avgFor > 0 ? away.profile.avgFirstHalf / away.profile.avgFor : 0.46;
    const homeFirst = hasBothTeams ? round(homeExpected * homeFirstShare) : 0;
    const awayFirst = hasBothTeams ? round(awayExpected * awayFirstShare) : 0;
    const firstHalf = round(homeFirst + awayFirst);
    const secondHalf = round(Math.max(0, total - firstHalf));

    const homeCards = findTeamCardStats(homeTeam);
    const awayCards = findTeamCardStats(awayTeam);
    const refereeStats = referee ? findReferee(referee) : null;
    const teamCardsTotal = hasBothTeams && (homeCards || awayCards) ? teamCardAverage(homeCards) + teamCardAverage(awayCards) : 0;
    const expectedCards = refereeStats ? (teamCardsTotal ? refereeStats.avgCardsPerMatch * 0.6 + teamCardsTotal * 0.4 : refereeStats.avgCardsPerMatch) : teamCardsTotal;
    const cardsFirstHalfPct = refereeStats ? refereeStats.halfDistribution.firstHalf : 40;

    const confidence: 'alta' | 'media' | 'baixa' = hasBothTeams ? 'alta' : home.found || away.found ? 'media' : 'baixa';

    return {
      home,
      away,
      hasBothTeams,
      missingMessage: hasBothTeams ? null : `Ainda não há base local suficiente para prever ${homeTeam} x ${awayTeam} em ${league || 'esta competição'}. Não usei médias de outra liga para evitar distorção.`,
      homeExpected,
      awayExpected,
      total,
      firstHalf,
      secondHalf,
      homeFirst,
      awayFirst,
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
        refereeSummary: refereeStats ? getRefereeStatsSummary(refereeStats) : null,
        expectedTotal: round(expectedCards),
        expectedYellow: round(expectedCards * 0.92),
        expectedRed: round(expectedCards * 0.08),
        firstHalf: round(expectedCards * (cardsFirstHalfPct / 100)),
        secondHalf: round(expectedCards * (1 - cardsFirstHalfPct / 100)),
      },
    };
  }, [awayTeam, homeTeam, league, referee]);

  const kickoffDisplay = formatKickoff(kickoff, kickoffLabel);

  return (
    <Card className="space-y-4 border-primary/20 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-primary">
            <Target className="h-4 w-4" />
            <span className="font-semibold">Previsão do jogo</span>
            <Badge variant="outline" className={confidenceClass(prediction.confidence)}>{prediction.confidence}</Badge>
          </div>
          <h4 className="mt-1 text-base font-bold">{homeTeam} <span className="text-muted-foreground">x</span> {awayTeam}</h4>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {league && <span>{league}</span>}
            {kickoffDisplay && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{kickoffDisplay}</span>}
          </div>
        </div>
        {onClose && <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8"><X className="h-4 w-4" /></Button>}
      </div>

      {prediction.missingMessage && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          <div className="mb-1 flex items-center gap-2 font-semibold text-amber-300"><AlertCircle className="h-4 w-4" />Base específica indisponível</div>
          <p>{prediction.missingMessage}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-center"><p className="text-xs text-muted-foreground">Total previsto</p><p className="text-2xl font-bold text-emerald-400">{prediction.hasBothTeams ? prediction.total : '—'}</p><p className="text-xs text-muted-foreground">escanteios</p></div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-3 text-center"><p className="text-xs text-muted-foreground">1º tempo</p><p className="text-2xl font-bold text-violet-400">{prediction.hasBothTeams ? prediction.firstHalf : '—'}</p><p className="text-xs text-muted-foreground">{prediction.hasBothTeams ? `${prediction.homeFirst} + ${prediction.awayFirst}` : 'sem base'}</p></div>
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-center"><p className="text-xs text-muted-foreground">2º tempo</p><p className="text-2xl font-bold text-cyan-400">{prediction.hasBothTeams ? prediction.secondHalf : '—'}</p><p className="text-xs text-muted-foreground">competição própria</p></div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-center"><p className="text-xs text-muted-foreground">Times</p><p className="text-lg font-bold text-amber-400">{prediction.hasBothTeams ? `${prediction.homeExpected} - ${prediction.awayExpected}` : '—'}</p><p className="text-xs text-muted-foreground">casa / fora</p></div>
      </div>

      {prediction.hasBothTeams && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-emerald-400" />Linhas de escanteios</p>
            <div className="grid grid-cols-2 gap-2">
              {[...prediction.overs, ...prediction.halfOvers].map((line) => <div key={line.label} className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground">{line.label}</p><p className={`text-lg font-bold ${line.probability >= 60 ? 'text-emerald-400' : line.probability >= 45 ? 'text-amber-400' : 'text-muted-foreground'}`}>{line.probability}%</p></div>)}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4 text-amber-400" />Previsão de cartões</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold text-amber-400">{prediction.cards.expectedTotal || '—'}</p></div>
              <div className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground">Amarelos / vermelhos</p><p className="text-lg font-bold">{prediction.cards.expectedTotal ? `${prediction.cards.expectedYellow} / ${prediction.cards.expectedRed}` : '—'}</p></div>
              <div className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground">1º tempo</p><p className="text-lg font-bold">{prediction.cards.expectedTotal ? prediction.cards.firstHalf : '—'}</p></div>
              <div className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground">2º tempo</p><p className="text-lg font-bold">{prediction.cards.expectedTotal ? prediction.cards.secondHalf : '—'}</p></div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-background/40 p-3">
        <p className="mb-2 text-sm font-semibold">Dados locais usados</p>
        <div className="grid gap-2 md:grid-cols-2">
          {[prediction.home.profile, prediction.away.profile].map((team) => (
            <div key={`${team.team}-${team.league}`} className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2"><p className="font-medium">{team.team}</p><Badge variant="outline" className="text-xs">{team.source}</Badge></div>
              <p className="text-xs text-muted-foreground">{team.league}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <span>A favor: {round(team.avgFor) || '—'}</span><span>Contra: {round(team.avgAgainst) || '—'}</span><span>Total: {round(team.avgTotal) || '—'}</span><span>1T: {round(team.avgFirstHalf) || '—'}</span><span>2T: {round(team.avgSecondHalf) || '—'}</span><span>Jogos: {team.gamesPlayed || '—'}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><AlertCircle className="h-3 w-3" />As previsões agora respeitam a competição informada. Se não houver base específica, o app não reaproveita médias de outra liga.</p>
      </div>
    </Card>
  );
}
