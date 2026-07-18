'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  CornerUpRight,
  Radio,
  RefreshCw,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type PeriodKey = 'firstHalf' | 'secondHalf';

type StoppageIncident = {
  startAt: string;
  endAt?: string;
  durationMs: number;
  reason: string;
  period?: PeriodKey;
  timeline?: string;
  category?: string;
  considered?: boolean;
  weight?: number;
  consideredMs?: number;
  decisionReason?: string;
};

type PeriodSummary = {
  totalStoppedMinutes?: number | null;
  rawStoppedMinutes?: number | null;
  consideredStoppedMinutes?: number | null;
  predictedAddedMinutes?: number | null;
  actualAddedMinutes?: number | null;
  source?: string;
  kind?: string;
  incidents?: StoppageIncident[];
};

type LiveStatRow = {
  key: string;
  label: string;
  home: string;
  away: string;
};

type LiveMatch = {
  id: number;
  minute: number | string;
  statusText: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  competition?: string;
  competitionId: number;
  corners?: { home: number; away: number; total: number };
  liveStats?: LiveStatRow[];
  statsSource?: '365scores' | 'sofascore' | 'api-football';
  source?: string;
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  stoppage?: {
    totalStoppedMinutes?: number | null;
    predictedAddedMinutes?: number | null;
    actualAddedMinutes?: number | null;
    kind?: string;
    source?: string;
    incidents?: StoppageIncident[];
    periods?: { firstHalf?: PeriodSummary; secondHalf?: PeriodSummary };
  };
  periodStoppage?: { firstHalf?: PeriodSummary; secondHalf?: PeriodSummary };
};

type StoppageCacheValue = {
  firstHalf?: PeriodSummary;
  secondHalf?: PeriodSummary;
  updatedAt: string;
};

const CACHE_KEY = 'cantos_live_referee_added_time_v5';
const LEGACY_CACHE_KEYS = [
  'cantos_live_referee_added_time_v4',
  'cantos_live_referee_added_time_v3',
  'cantos_live_referee_added_time_v2',
];

const COMPETITION_ICONS: Record<number, string> = {
  113: '🇧🇷', 116: '🇧🇷', 117: '🇧🇷', 71: '🇧🇷', 72: '🇧🇷', 73: '🇧🇷',
  7: '🏴', 39: '🏴', 40: '🏴', 17: '🇮🇹', 135: '🇮🇹', 25: '🇩🇪',
  78: '🇩🇪', 35: '🇫🇷', 61: '🇫🇷', 140: '🇪🇸', 88: '🇳🇱', 94: '🇵🇹',
  65: '🇧🇪', 203: '🇹🇷', 197: '🇬🇷', 179: '🏴', 128: '🇦🇷',
  2: '🏆', 3: '🏆', 13: '🏆', 572: '🏆', 573: '🏆', 848: '🏆',
};

const TEAM_ALIASES: Record<string, string> = {
  brasil: 'brazil',
  brazil: 'brazil',
  espanha: 'spain',
  spain: 'spain',
  belgica: 'belgium',
  belgium: 'belgium',
  franca: 'france',
  france: 'france',
  marrocos: 'morocco',
  morocco: 'morocco',
  inglaterra: 'england',
  england: 'england',
  noruega: 'norway',
  norway: 'norway',
  egito: 'egypt',
  egypt: 'egypt',
  suica: 'switzerland',
  switzerland: 'switzerland',
  alemanha: 'germany',
  germany: 'germany',
  holanda: 'netherlands',
  netherlands: 'netherlands',
  eua: 'usa',
  usa: 'usa',
  'estados unidos': 'usa',
  'rd congo': 'congo dr',
  'dr congo': 'congo dr',
  'red bull bragantino': 'bragantino',
  'rb bragantino': 'bragantino',
};

function baseNorm(value: unknown) {
  const normalized = String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|ec|club|clube|futebol|sport|sporting|real|atletico)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return TEAM_ALIASES[normalized] ?? normalized;
}

function teamPairKey(match: Pick<LiveMatch, 'homeTeam' | 'awayTeam'>) {
  return [baseNorm(match.homeTeam.name), baseNorm(match.awayTeam.name)].sort().join('__vs__');
}

function competitionKey(value: unknown) {
  const key = baseNorm(value);
  if (key.includes('copa do mundo') || key.includes('world cup')) return 'world cup';
  return key;
}

function sourceRank(match: LiveMatch) {
  if (match.sourceIds?.scores365 || match.source === '365scores') return 1;
  if (match.sourceIds?.sofascore || match.statsSource === 'sofascore') return 2;
  if (match.sourceIds?.apiFootball || match.statsSource === 'api-football') return 3;
  return 9;
}

function hasPositive(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function formatMinutes(value?: number | null, prefix = '') {
  if (!hasPositive(value)) return 'não informado';
  return `${prefix}${value.toFixed(1).replace('.0', '')} min`;
}

function sourceLabel(source?: string) {
  if (!source) return 'fonte ao vivo';
  if (source.includes('365scores')) return '365Scores';
  if (source.includes('sofascore')) return 'SofaScore';
  if (source.includes('api-football')) return 'API-Football';
  if (source.includes('cache') || source.includes('clock')) return 'dados combinados';
  return 'fonte ao vivo';
}

function minuteNumber(match: LiveMatch) {
  return typeof match.minute === 'number'
    ? match.minute
    : Number(String(match.minute).match(/\d{1,3}/)?.[0]);
}

function currentPeriod(match: LiveMatch): PeriodKey {
  const raw = `${match.minute ?? ''} ${match.statusText ?? ''}`.toLowerCase();
  if (/\b(2h|2nd|second|segundo)\b/.test(raw)) return 'secondHalf';
  if (/\b(1h|1st|first|primeiro|ht|intervalo)\b/.test(raw)) return 'firstHalf';
  const explicit = raw.match(/\b(45|90)\s*\+\s*\d{1,2}/);
  if (explicit) return explicit[1] === '45' ? 'firstHalf' : 'secondHalf';
  const n = minuteNumber(match);
  return Number.isFinite(n) && n > 45 ? 'secondHalf' : 'firstHalf';
}

function displayedAddedMinutes(match: LiveMatch, period: PeriodKey) {
  const raw = `${match.minute ?? ''} ${match.statusText ?? ''}`;
  for (const found of raw.matchAll(/\b(45|90)\s*\+\s*(\d{1,2})/g)) {
    const foundPeriod: PeriodKey = found[1] === '45' ? 'firstHalf' : 'secondHalf';
    if (foundPeriod === period) {
      const value = Number(found[2]);
      if (hasPositive(value)) return value;
    }
  }
  return null;
}

function periodSummary(match: LiveMatch, period: PeriodKey): PeriodSummary | null {
  return match.periodStoppage?.[period] ?? match.stoppage?.periods?.[period] ?? null;
}

function isFinished(match: LiveMatch) {
  return /encerrado|fim|finished|final|ft/i.test(String(match.statusText ?? ''));
}

function finalizedAddedMinutes(
  match: LiveMatch,
  period: PeriodKey,
  summary?: PeriodSummary | null
) {
  const actual = summary?.actualAddedMinutes ?? null;
  if (hasPositive(actual)) return actual;
  const displayed = displayedAddedMinutes(match, period);
  if (hasPositive(displayed)) return displayed;
  const predicted = summary?.predictedAddedMinutes ?? null;
  if (!hasPositive(predicted) || currentPeriod(match) !== period) return null;
  if (period === 'secondHalf' && isFinished(match)) return predicted;
  return null;
}

function mergeSummary(
  base?: PeriodSummary | null,
  incoming?: PeriodSummary | null
): PeriodSummary | undefined {
  if (!base) return incoming ?? undefined;
  if (!incoming) return base;
  return {
    ...base,
    totalStoppedMinutes: base.totalStoppedMinutes ?? incoming.totalStoppedMinutes,
    rawStoppedMinutes: base.rawStoppedMinutes ?? incoming.rawStoppedMinutes,
    consideredStoppedMinutes:
      base.consideredStoppedMinutes ?? incoming.consideredStoppedMinutes,
    predictedAddedMinutes: base.predictedAddedMinutes ?? incoming.predictedAddedMinutes,
    actualAddedMinutes: hasPositive(base.actualAddedMinutes)
      ? base.actualAddedMinutes
      : incoming.actualAddedMinutes,
    source: base.source ?? incoming.source,
    kind: base.kind ?? incoming.kind,
    incidents:
      (incoming.incidents?.length ?? 0) > (base.incidents?.length ?? 0)
        ? incoming.incidents
        : base.incidents,
  };
}

function chooseStats(base: LiveMatch, incoming: LiveMatch) {
  const baseStats = base.liveStats ?? [];
  const incomingStats = incoming.liveStats ?? [];
  if (incomingStats.length > baseStats.length) {
    return { liveStats: incomingStats, statsSource: incoming.statsSource ?? base.statsSource };
  }
  if (baseStats.length > 0) {
    return { liveStats: baseStats, statsSource: base.statsSource ?? incoming.statsSource };
  }
  return {
    liveStats: incomingStats.length > 0 ? incomingStats : undefined,
    statsSource: incoming.statsSource ?? base.statsSource,
  };
}

function mergeMatch(base: LiveMatch, incoming: LiveMatch): LiveMatch {
  const preferred = sourceRank(incoming) < sourceRank(base) ? incoming : base;
  const other = preferred === base ? incoming : base;
  const firstHalf = mergeSummary(
    preferred.periodStoppage?.firstHalf ?? preferred.stoppage?.periods?.firstHalf,
    other.periodStoppage?.firstHalf ?? other.stoppage?.periods?.firstHalf
  );
  const secondHalf = mergeSummary(
    preferred.periodStoppage?.secondHalf ?? preferred.stoppage?.periods?.secondHalf,
    other.periodStoppage?.secondHalf ?? other.stoppage?.periods?.secondHalf
  );
  const minute = String(other.minute ?? '').includes('+') ? other.minute : preferred.minute;
  const stats = chooseStats(base, incoming);
  return {
    ...other,
    ...preferred,
    minute,
    competition: preferred.competition ?? other.competition,
    competitionId: preferred.competitionId || other.competitionId,
    corners: preferred.corners ?? other.corners,
    liveStats: stats.liveStats,
    statsSource: stats.statsSource,
    stoppage: preferred.stoppage ?? other.stoppage,
    sourceIds: { ...other.sourceIds, ...preferred.sourceIds },
    periodStoppage: { firstHalf, secondHalf },
  };
}

function dedupeMatches(matches: LiveMatch[]) {
  const byPair = new Map<string, LiveMatch>();
  for (const match of matches) {
    const key = teamPairKey(match);
    const existing = byPair.get(key);
    byPair.set(key, existing ? mergeMatch(existing, match) : match);
  }
  return Array.from(byPair.values()).sort(
    (a, b) =>
      sourceRank(a) - sourceRank(b) ||
      competitionKey(a.competition).localeCompare(competitionKey(b.competition))
  );
}

function readCache(): Record<string, StoppageCacheValue> {
  if (typeof window === 'undefined') return {};
  try {
    const current = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{}');
    if (Object.keys(current).length > 0) return current;
    for (const key of LEGACY_CACHE_KEYS) {
      const legacy = JSON.parse(window.localStorage.getItem(key) || '{}');
      if (Object.keys(legacy).length > 0) {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return {};
  }
  return {};
}

function writeCache(cache: Record<string, StoppageCacheValue>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Armazenamento local indisponível.
  }
}

function keepBestSummary(
  match: LiveMatch,
  period: PeriodKey,
  summary?: PeriodSummary | null,
  cached?: PeriodSummary | null
): PeriodSummary | undefined {
  const actual = finalizedAddedMinutes(match, period, summary);
  const cachedActual = cached?.actualAddedMinutes ?? null;
  const bestActual = hasPositive(actual) ? actual : cachedActual;
  const merged = mergeSummary(summary, cached);
  if (!merged && !hasPositive(bestActual)) return undefined;
  return {
    ...(merged ?? {}),
    actualAddedMinutes: bestActual ?? merged?.actualAddedMinutes ?? null,
    source: merged?.source ?? (hasPositive(bestActual) ? 'persistent-live-cache' : undefined),
  };
}

function restoreCachedAddedTime(matches: LiveMatch[]) {
  const cache = readCache();
  return matches.map((match) => {
    const saved = cache[teamPairKey(match)];
    return {
      ...match,
      periodStoppage: {
        firstHalf: keepBestSummary(
          match,
          'firstHalf',
          periodSummary(match, 'firstHalf'),
          saved?.firstHalf
        ),
        secondHalf: keepBestSummary(
          match,
          'secondHalf',
          periodSummary(match, 'secondHalf'),
          saved?.secondHalf
        ),
      },
    };
  });
}

function rememberAddedTime(matches: LiveMatch[]) {
  const cache = readCache();
  let changed = false;
  for (const match of matches) {
    const first = periodSummary(match, 'firstHalf');
    const second = periodSummary(match, 'secondHalf');
    const firstActual = finalizedAddedMinutes(match, 'firstHalf', first);
    const secondActual = finalizedAddedMinutes(match, 'secondHalf', second);
    if (!hasPositive(firstActual) && !hasPositive(secondActual)) continue;
    const key = teamPairKey(match);
    const current = cache[key] ?? { updatedAt: new Date().toISOString() };
    cache[key] = {
      updatedAt: new Date().toISOString(),
      firstHalf: hasPositive(firstActual)
        ? {
            ...(current.firstHalf ?? {}),
            ...(first ?? {}),
            actualAddedMinutes: firstActual,
            source: first?.source ?? 'clock-persistent-cache',
          }
        : current.firstHalf,
      secondHalf: hasPositive(secondActual)
        ? {
            ...(current.secondHalf ?? {}),
            ...(second ?? {}),
            actualAddedMinutes: secondActual,
            source: second?.source ?? 'clock-persistent-cache',
          }
        : current.secondHalf,
    };
    changed = true;
  }
  if (changed) writeCache(cache);
}

function minuteInfo(match: LiveMatch) {
  const raw = String(match.minute || match.statusText || 'AO VIVO');
  const period = currentPeriod(match);
  const summary = periodSummary(match, period);
  return {
    display: typeof match.minute === 'number' && match.minute > 0 ? `${match.minute}'` : raw,
    predicted: summary?.predictedAddedMinutes ?? null,
    stopped: summary?.consideredStoppedMinutes ?? summary?.totalStoppedMinutes ?? null,
    firstHalf: periodSummary(match, 'firstHalf'),
    secondHalf: periodSummary(match, 'secondHalf'),
  };
}

function BadgeInfo({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'cyan' | 'amber' | 'emerald';
}) {
  const klass =
    tone === 'cyan'
      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
      : tone === 'amber'
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
        : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  return (
    <Badge
      variant="outline"
      className={`h-auto max-w-full whitespace-normal break-words px-2 py-1 text-center leading-snug ${klass}`}
    >
      {children}
    </Badge>
  );
}

function IncidentList({ summary }: { summary: PeriodSummary | null }) {
  const incidents = summary?.incidents ?? [];
  if (incidents.length === 0) {
    return (
      <p className="mt-3 break-words text-xs text-muted-foreground">
        Nenhuma parada individual foi enviada pela fonte para conferência.
      </p>
    );
  }
  return (
    <div className="mt-3 min-w-0 space-y-2">
      <p className="break-words text-xs font-semibold text-cyan-300">
        Auditoria das paradas ({incidents.length})
      </p>
      {incidents.map((incident, index) => {
        const considered = incident.considered !== false;
        const consideredMinutes = (incident.consideredMs ?? incident.durationMs) / 60000;
        return (
          <div
            key={`${incident.startAt}-${index}`}
            className={`min-w-0 overflow-hidden rounded-md border p-2 text-xs ${
              considered
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-red-500/20 bg-red-500/5'
            }`}
          >
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <span className="flex min-w-0 items-start gap-1 font-medium">
                {considered ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                )}
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                  {incident.timeline || `Parada ${index + 1}`}
                </span>
              </span>
              <span
                className={`shrink-0 break-words ${
                  considered ? 'font-semibold text-emerald-300' : 'font-semibold text-red-300'
                }`}
              >
                {formatMinutes(incident.durationMs / 60000)}
                {considered && hasPositive(consideredMinutes) && incident.weight !== 1
                  ? ` → ${formatMinutes(consideredMinutes)}`
                  : ''}
              </span>
            </div>
            <p className="mt-1 break-words text-muted-foreground [overflow-wrap:anywhere]">
              {incident.reason}
            </p>
            <p className="mt-1 break-words font-medium [overflow-wrap:anywhere]">
              {considered ? 'Considerada' : 'Ignorada'}: {incident.decisionReason ?? 'Regra padrão.'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function PeriodCard({
  title,
  match,
  period,
  summary,
}: {
  title: string;
  match: LiveMatch;
  period: PeriodKey;
  summary: PeriodSummary | null;
}) {
  const actual = finalizedAddedMinutes(match, period, summary);
  const raw = summary?.rawStoppedMinutes ?? summary?.totalStoppedMinutes;
  const considered = summary?.consideredStoppedMinutes ?? summary?.totalStoppedMinutes;
  const items = [
    ['Tempo bruto', formatMinutes(raw), 'bg-slate-500/10'],
    ['Tempo considerado', formatMinutes(considered), 'bg-cyan-500/10 text-cyan-300'],
    ['Previsão de acréscimo', formatMinutes(summary?.predictedAddedMinutes, '+'), 'bg-amber-500/10 text-amber-300'],
    ['Acréscimo do árbitro', formatMinutes(actual, '+'), 'bg-emerald-500/10 text-emerald-300'],
  ];
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-background/40 p-3">
      <p className="mb-3 break-words text-sm font-semibold">{title}</p>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(([label, value, klass]) => (
          <div key={label} className={`min-w-0 overflow-hidden rounded-md p-3 ${klass}`}>
            <p className="break-words text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-base font-bold sm:text-lg [overflow-wrap:anywhere]">
              {value}
            </p>
          </div>
        ))}
      </div>
      <IncidentList summary={summary} />
      <p className="mt-3 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
        Fonte: {sourceLabel(summary?.source)}. A previsão usa somente as paradas aprovadas pelas regras.
      </p>
    </div>
  );
}

function LiveMatchCard({
  match,
  selected,
  onClick,
}: {
  match: LiveMatch;
  selected?: boolean;
  onClick?: () => void;
}) {
  const icon = COMPETITION_ICONS[match.competitionId] || '⚽';
  const info = minuteInfo(match);
  const firstActual = finalizedAddedMinutes(match, 'firstHalf', info.firstHalf);
  const secondActual = finalizedAddedMinutes(match, 'secondHalf', info.secondHalf);
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={`min-w-0 cursor-pointer overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-green-500/5 p-3 transition-all hover:border-emerald-400/50 sm:p-4 ${
        selected ? 'border-emerald-400 ring-2 ring-emerald-500/60' : ''
      }`}
    >
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-lg">{icon}</span>
          <span className="min-w-0 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {match.competition || 'Competição'}
          </span>
        </div>
        <Badge className="shrink-0 border-red-500/30 bg-red-500/20 text-red-400">
          <Radio className="mr-1 h-3 w-3" /> AO VIVO
        </Badge>
      </div>
      <div className="grid min-w-0 items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,auto)_minmax(0,1fr)]">
        <p className="min-w-0 break-words text-center font-semibold md:text-right [overflow-wrap:anywhere]">
          {match.homeTeam.name}
        </p>
        <div className="flex min-w-0 flex-col items-center">
          <div className="flex gap-2 text-2xl font-bold">
            <span className={match.homeTeam.score > match.awayTeam.score ? 'text-emerald-400' : ''}>
              {match.homeTeam.score}
            </span>
            <span className="text-muted-foreground">-</span>
            <span className={match.awayTeam.score > match.homeTeam.score ? 'text-emerald-400' : ''}>
              {match.awayTeam.score}
            </span>
          </div>
          <Badge variant="outline" className="mt-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <Clock className="mr-1 h-3 w-3" /> {info.display}
          </Badge>
          <div className="mt-2 grid w-full min-w-0 gap-1 text-[11px]">
            <BadgeInfo tone="cyan">Tempo considerado: {formatMinutes(info.stopped)}</BadgeInfo>
            <BadgeInfo tone="amber">
              Previsão de acréscimo: {formatMinutes(info.predicted, '+')}
            </BadgeInfo>
            {hasPositive(firstActual) && (
              <BadgeInfo tone="emerald">Acréscimo 1ºT: {formatMinutes(firstActual, '+')}</BadgeInfo>
            )}
            {hasPositive(secondActual) && (
              <BadgeInfo tone="emerald">Acréscimo 2ºT: {formatMinutes(secondActual, '+')}</BadgeInfo>
            )}
          </div>
        </div>
        <p className="min-w-0 break-words text-center font-semibold md:text-left [overflow-wrap:anywhere]">
          {match.awayTeam.name}
        </p>
      </div>
      {match.corners && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm sm:gap-4">
            <div className="flex items-center gap-1 text-amber-400">
              <CornerUpRight className="h-4 w-4" /> {match.corners.home}
            </div>
            <span className="text-muted-foreground">Escanteios</span>
            <div className="flex items-center gap-1 text-amber-400">
              {match.corners.away} <CornerUpRight className="h-4 w-4 scale-x-[-1]" />
            </div>
          </div>
          <p className="mt-1 text-center text-xs text-muted-foreground">Total: {match.corners.total}</p>
        </div>
      )}
    </Card>
  );
}

function Details({
  match,
  competition,
  onClose,
}: {
  match: LiveMatch;
  competition: string;
  onClose: () => void;
}) {
  const first = periodSummary(match, 'firstHalf');
  const second = periodSummary(match, 'secondHalf');
  const stats = match.liveStats ?? [];
  return (
    <div className="min-w-0 space-y-4 overflow-hidden rounded-xl border border-emerald-500/20 bg-card/80 p-3 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <BarChart3 className="h-4 w-4 shrink-0" /> Estatísticas ao vivo
          </p>
          <h4 className="mt-1 break-words font-bold [overflow-wrap:anywhere]">
            {match.homeTeam.name} x {match.awayTeam.name}
          </h4>
          <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {competition} - fonte: {match.statsSource ?? match.source ?? 'ao vivo'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="min-w-0 p-3 text-center">
          <p className="text-xs text-muted-foreground">Placar</p>
          <p className="break-words text-2xl font-bold">{match.homeTeam.score} - {match.awayTeam.score}</p>
        </Card>
        <Card className="min-w-0 p-3 text-center">
          <p className="text-xs text-muted-foreground">Tempo</p>
          <p className="break-words text-2xl font-bold text-emerald-400">{minuteInfo(match).display}</p>
        </Card>
        <Card className="min-w-0 p-3 text-center">
          <p className="text-xs text-muted-foreground">Escanteios</p>
          <p className="break-words text-2xl font-bold text-amber-400">
            {match.corners ? `${match.corners.home} - ${match.corners.away}` : '-'}
          </p>
        </Card>
      </div>
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <PeriodCard title="Resumo do 1º tempo" match={match} period="firstHalf" summary={first} />
        <PeriodCard title="Resumo do 2º tempo" match={match} period="secondHalf" summary={second} />
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border bg-background/40 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Números do jogo</p>
          {stats.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {stats.length} estatísticas
            </Badge>
          )}
        </div>
        {stats.length === 0 ? (
          <p className="break-words text-sm text-muted-foreground">
            A fonte ainda não enviou estatísticas detalhadas para este jogo.
          </p>
        ) : (
          <div className="space-y-2">
            {stats.slice(0, 24).map((row) => (
              <div
                key={row.key}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(90px,1.4fr)_minmax(0,1fr)] items-center gap-2 rounded-md bg-background/50 px-2 py-2 text-xs sm:gap-3 sm:px-3 sm:text-sm"
              >
                <span className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{row.home}</span>
                <span className="min-w-0 break-words text-center text-muted-foreground [overflow-wrap:anywhere]">
                  {row.label}
                </span>
                <span className="min-w-0 break-words text-right font-semibold [overflow-wrap:anywhere]">{row.away}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LiveMatches() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedDisplay, setLastUpdatedDisplay] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedCompetition, setSelectedCompetition] = useState('all');
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);

  const fetchLiveMatches = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/live', { cache: 'no-store' });
      const data = (await response.json()) as {
        matches?: LiveMatch[];
        lastUpdated?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? 'Erro ao carregar jogos ao vivo');
      const deduped = dedupeMatches(data.matches ?? []);
      rememberAddedTime(deduped);
      setMatches(restoreCachedAddedTime(deduped));
      const updatedAt = data.lastUpdated ? new Date(data.lastUpdated) : new Date();
      setLastUpdatedDisplay(
        new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(updatedAt)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveMatches();
  }, [fetchLiveMatches]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLiveMatches, 25000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLiveMatches]);

  const matchesByCompetition = useMemo(
    () =>
      matches.reduce((acc, match) => {
        const key = match.competition || 'Outras Competições';
        (acc[key] ??= []).push(match);
        return acc;
      }, {} as Record<string, LiveMatch[]>),
    [matches]
  );

  const competitions = useMemo(
    () =>
      Object.entries(matchesByCompetition)
        .map(([competition, list]) => ({ competition, count: list.length }))
        .sort((a, b) => b.count - a.count || a.competition.localeCompare(b.competition)),
    [matchesByCompetition]
  );

  useEffect(() => {
    if (selectedCompetition !== 'all' && !matchesByCompetition[selectedCompetition]) {
      setSelectedCompetition('all');
    }
  }, [matchesByCompetition, selectedCompetition]);

  const visible =
    selectedCompetition === 'all'
      ? matches
      : matches.filter((match) =>
          (match.competition || 'Outras Competições') === selectedCompetition
        );

  const visibleByCompetition = visible.reduce((acc, match) => {
    const key = match.competition || 'Outras Competições';
    (acc[key] ??= []).push(match);
    return acc;
  }, {} as Record<string, LiveMatch[]>);

  if (loading && matches.length === 0) {
    return <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-emerald-500" /></div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
        <AlertCircle className="mb-2 h-5 w-5 text-red-500" />
        <h4 className="font-medium text-red-500">Erro ao carregar jogos</h4>
        <p className="break-words text-sm text-red-400/80">{error}</p>
        <Button onClick={fetchLiveMatches} variant="outline" size="sm" className="mt-3">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 shrink-0 text-red-500" />
            <h3 className="break-words text-lg font-semibold">Jogos Ao Vivo</h3>
          </div>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400">
            {visible.length} {visible.length === 1 ? 'jogo' : 'jogos'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-emerald-600 hover:bg-emerald-500' : ''}
          >
            {autoRefresh ? 'Auto ✓' : 'Auto'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchLiveMatches();
            }}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>
      </div>

      {lastUpdatedDisplay && (
        <p className="break-words text-xs text-muted-foreground">
          Última atualização: {lastUpdatedDisplay}{autoRefresh && ' (atualiza a cada 25s)'}
        </p>
      )}

      {matches.length > 0 && (
        <Card className="min-w-0 p-3">
          <label className="mb-2 block text-xs text-muted-foreground">Filtrar por liga</label>
          <select
            value={selectedCompetition}
            onChange={(event) => setSelectedCompetition(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">Todas as ligas ({matches.length})</option>
            {competitions.map((item) => (
              <option key={item.competition} value={item.competition}>
                {item.competition} ({item.count})
              </option>
            ))}
          </select>
        </Card>
      )}

      {matches.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h4 className="mb-2 text-lg font-medium">Nenhum jogo ao vivo no momento</h4>
          <p className="text-sm text-muted-foreground">
            Os jogos aparecerão aqui automaticamente quando começarem.
          </p>
        </Card>
      ) : (
        <div className="min-w-0 space-y-6">
          {Object.entries(visibleByCompetition).map(([competition, list]) => (
            <div key={competition} className="min-w-0 space-y-3">
              <h4 className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
                <Trophy className="h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{competition}</span>
                <Badge variant="outline" className="ml-auto shrink-0">{list.length}</Badge>
              </h4>
              {list.map((match) => {
                const key = `${competition}-${teamPairKey(match)}`;
                return (
                  <div key={key} className="min-w-0 space-y-3">
                    <LiveMatchCard
                      match={match}
                      selected={selectedMatchKey === key}
                      onClick={() =>
                        setSelectedMatchKey((current) => current === key ? null : key)
                      }
                    />
                    {selectedMatchKey === key && (
                      <Details
                        match={match}
                        competition={competition}
                        onClose={() => setSelectedMatchKey(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
