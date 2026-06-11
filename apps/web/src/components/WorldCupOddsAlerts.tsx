'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Check,
  ChevronDown,
  CreditCard,
  Flag,
  Loader2,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type CornerSide = 'over' | 'under' | 'home' | 'away' | 'exact' | 'other';

type CornerLineOdd = {
  bookmaker: string;
  market: string;
  line: string;
  side: CornerSide;
  label: string;
  odd: number;
};

type CornerAlert = {
  market: string;
  line: string;
  side: CornerSide;
  label: string;
  bookmaker: string;
  odd: number;
  nextBestBookmaker: string;
  nextBestOdd: number;
  averageOdd: number;
  edgePct: number;
  comparedBookmakers: number;
  odds: CornerLineOdd[];
};

type FeaturedLine = {
  key: string;
  market: string;
  line: string;
  side: CornerSide;
  label: string;
  odds: CornerLineOdd[];
};

type CornerEvent = {
  id: string;
  startTime: string;
  roundName?: string;
  homeTeam: string;
  awayTeam: string;
  bookmakersCount: number;
  cornerLines: CornerLineOdd[];
  cardLines?: CornerLineOdd[];
  featuredLines?: FeaturedLine[];
  alerts: CornerAlert[];
  source: 'real';
};

type OddsResponse = {
  configured: boolean;
  source: 'api-football' | 'not-configured';
  focus: 'corner-lines';
  note: string;
  summary: {
    eventsChecked: number;
    cornerLines: number;
    cardLines?: number;
    alerts: number;
    bookmakersCompared: number;
  };
  bookmakers: string[];
  events: CornerEvent[];
  lastUpdated: string;
};

const SIDE_LABELS: Record<CornerSide, string> = {
  over: 'Mais de',
  under: 'Menos de',
  home: 'Time da casa',
  away: 'Time visitante',
  exact: 'Exato',
  other: 'Outra linha',
};

const TEAM_DISPLAY_NAMES: Record<string, string> = {
  brazil: 'Brasil',
  brasil: 'Brasil',
  mexico: 'México',
  'south africa': 'África do Sul',
  'korea republic': 'Coreia do Sul',
  'south korea': 'Coreia do Sul',
  czechia: 'República Tcheca',
  'czech republic': 'República Tcheca',
  canada: 'Canadá',
  'bosnia and herzegovina': 'Bósnia e Herzegovina',
  bosnia: 'Bósnia e Herzegovina',
  usa: 'EUA',
  'united states': 'EUA',
  qatar: 'Catar',
  switzerland: 'Suíça',
  scotland: 'Escócia',
  morocco: 'Marrocos',
  haiti: 'Haiti',
  paraguay: 'Paraguai',
};

const TEAM_ALIASES: Record<string, string[]> = {
  brasil: ['brazil'],
  brazil: ['brasil'],
  mexico: ['mexico', 'méxico'],
  'africa do sul': ['south africa'],
  'south africa': ['africa do sul', 'áfrica do sul'],
  'coreia do sul': ['south korea', 'korea republic'],
  'south korea': ['coreia do sul', 'korea republic'],
  czechia: ['republica tcheca', 'rep tcheca', 'czech republic'],
  'republica tcheca': ['czechia', 'czech republic'],
  canada: ['canadá'],
  'bosnia e herzegovina': ['bosnia and herzegovina', 'bosnia'],
  'bosnia and herzegovina': ['bosnia e herzegovina', 'bósnia e herzegovina'],
  eua: ['usa', 'united states'],
  usa: ['eua', 'united states'],
  catar: ['qatar'],
  qatar: ['catar'],
  suica: ['switzerland'],
  switzerland: ['suica', 'suíça'],
  escocia: ['scotland'],
  scotland: ['escocia', 'escócia'],
  marrocos: ['morocco'],
  morocco: ['marrocos'],
  paraguai: ['paraguay'],
  paraguay: ['paraguai'],
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.,+\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bookmakerKey(value: string): string {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function displayTeamName(value: string): string {
  return TEAM_DISPLAY_NAMES[normalize(value)] ?? value;
}

function aliasSet(value: string): Set<string> {
  const normalized = normalize(value);
  const aliases = TEAM_ALIASES[normalized] ?? [];
  return new Set([normalized, ...aliases.map(normalize)]);
}

function teamMatches(source: string, selected: string): boolean {
  const sourceAliases = aliasSet(source);
  const selectedAliases = aliasSet(selected);
  for (const sourceAlias of sourceAliases) {
    for (const selectedAlias of selectedAliases) {
      if (
        sourceAlias === selectedAlias ||
        sourceAlias.includes(selectedAlias) ||
        selectedAlias.includes(sourceAlias)
      ) {
        return true;
      }
    }
  }
  return false;
}

function groupKey(line: CornerLineOdd): string {
  const labelWithoutNumber = normalize(line.label)
    .replace(/\d+(?:[.,]\d+)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${normalize(line.market)}|${line.line}|${line.side}|${labelWithoutNumber}`;
}

function bestOddForGroup(lines: CornerLineOdd[]) {
  return [...lines].sort((a, b) => b.odd - a.odd)[0] ?? null;
}

function uniqueBestByBookmaker(lines: CornerLineOdd[]) {
  const map = new Map<string, CornerLineOdd>();
  for (const line of lines) {
    const key = bookmakerKey(line.bookmaker);
    const current = map.get(key);
    if (!current || line.odd > current.odd) map.set(key, line);
  }
  return [...map.values()].sort((a, b) => b.odd - a.odd || a.bookmaker.localeCompare(b.bookmaker, 'pt-BR'));
}

function groupCornerLines(lines: CornerLineOdd[]): FeaturedLine[] {
  const groups = new Map<string, CornerLineOdd[]>();

  for (const line of lines) {
    const key = groupKey(line);
    const current = groups.get(key) ?? [];
    current.push(line);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, values]) => ({
      key,
      market: values[0]?.market ?? '',
      line: values[0]?.line ?? '',
      side: values[0]?.side ?? 'other',
      label: values[0]?.label ?? '',
      odds: uniqueBestByBookmaker(values),
    }))
    .filter((line) => line.odds.length > 0)
    .sort((a, b) => {
      const aPeriod = isFullGameLine(a) ? 0 : isFirstHalfLine(a) ? 1 : 2;
      const bPeriod = isFullGameLine(b) ? 0 : isFirstHalfLine(b) ? 1 : 2;
      if (aPeriod !== bPeriod) return aPeriod - bPeriod;
      const lineA = Number(a.line);
      const lineB = Number(b.line);
      if (Number.isFinite(lineA) && Number.isFinite(lineB) && lineA !== lineB) return lineA - lineB;
      if (a.side !== b.side) return a.side.localeCompare(b.side, 'pt-BR');
      return (b.odds[0]?.odd ?? 0) - (a.odds[0]?.odd ?? 0);
    });
}

function isFirstHalfLine(line: Pick<FeaturedLine, 'market' | 'label'>) {
  const text = normalize(`${line.market} ${line.label}`);
  return text.includes('1st half') || text.includes('first half') || text.includes('1 tempo') || text.includes('1o tempo');
}

function isSecondHalfLine(line: Pick<FeaturedLine, 'market' | 'label'>) {
  const text = normalize(`${line.market} ${line.label}`);
  return text.includes('2nd half') || text.includes('second half') || text.includes('2 tempo') || text.includes('2o tempo');
}

function isFullGameLine(line: Pick<FeaturedLine, 'market' | 'label'>) {
  return !isFirstHalfLine(line) && !isSecondHalfLine(line);
}

function isCardLine(line: Pick<FeaturedLine, 'market' | 'label'>) {
  const text = normalize(`${line.market} ${line.label}`);
  return (
    text.includes('card') ||
    text.includes('cards') ||
    text.includes('cartao') ||
    text.includes('cartoes') ||
    text.includes('booking') ||
    text.includes('yellow') ||
    text.includes('red')
  );
}

function isCornerLine(line: Pick<FeaturedLine, 'market' | 'label'>) {
  return !isCardLine(line);
}

function isTeamSpecificCornerLine(line: Pick<FeaturedLine, 'market' | 'label'>) {
  const text = normalize(`${line.market} ${line.label}`);
  return (
    text.includes('home') ||
    text.includes('away') ||
    text.includes('mandante') ||
    text.includes('visitante') ||
    text.includes('team total') ||
    text.includes('time da casa') ||
    text.includes('time visitante')
  );
}

function cardAmount(line: Pick<FeaturedLine, 'market' | 'label' | 'line'>): number | null {
  const direct = Number(line.line);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const text = normalize(`${line.market} ${line.label}`);
  if (text.includes(' a card') || text.includes(' one card') || text.includes(' um cartao')) return 1;
  const match = text.match(/(\d+(?:[.,]\d+)?)(?:\+)?/);
  if (!match) return null;
  const parsed = Number(match[1].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function cardCountFromLine(line: Pick<FeaturedLine, 'market' | 'label' | 'line'>): number | null {
  const amount = cardAmount(line);
  if (amount === null) return null;
  if (amount <= 1) return 1;
  if (amount <= 2) return 2;
  return Math.ceil(amount);
}

function isBothTeamsCardLine(line: Pick<FeaturedLine, 'market' | 'label' | 'line'>) {
  if (!isCardLine(line)) return false;
  const text = normalize(`${line.market} ${line.label}`);
  return (
    text.includes('both') ||
    text.includes('ambos') ||
    text.includes('ambas') ||
    text.includes('each team') ||
    text.includes('cada time')
  );
}

function importantLines(lines: FeaturedLine[]): FeaturedLine[] {
  const selected = new Map<string, FeaturedLine>();
  const isMainSide = (line: FeaturedLine) => line.side === 'over' || line.side === 'under';
  const sorted = [...lines].sort((a, b) => {
    const aPeriod = isFullGameLine(a) ? 0 : isFirstHalfLine(a) ? 1 : 2;
    const bPeriod = isFullGameLine(b) ? 0 : isFirstHalfLine(b) ? 1 : 2;
    if (aPeriod !== bPeriod) return aPeriod - bPeriod;

    const aLine = Number(a.line);
    const bLine = Number(b.line);
    if (Number.isFinite(aLine) && Number.isFinite(bLine) && aLine !== bLine) return aLine - bLine;

    const aSide = a.side === 'over' ? 0 : a.side === 'under' ? 1 : 2;
    const bSide = b.side === 'over' ? 0 : b.side === 'under' ? 1 : 2;
    if (aSide !== bSide) return aSide - bSide;

    return (b.odds[0]?.odd ?? 0) - (a.odds[0]?.odd ?? 0);
  });

  const firstHalf45 = sorted
    .filter(
      (line) =>
        isCornerLine(line) &&
        isFirstHalfLine(line) &&
        line.line === '4.5' &&
        isMainSide(line) &&
        !isTeamSpecificCornerLine(line)
    )
    .slice(0, 2);
  for (const line of firstHalf45) selected.set(line.key, line);

  const firstFullGameLines = sorted
    .filter(
      (line) =>
        isCornerLine(line) &&
        isFullGameLine(line) &&
        isMainSide(line) &&
        !isTeamSpecificCornerLine(line)
    )
    .slice(0, 4);
  for (const line of firstFullGameLines) selected.set(line.key, line);

  const bothTeamsCards = sorted
    .filter((line) => {
      const amount = cardCountFromLine(line);
      return isBothTeamsCardLine(line) && (amount === 1 || amount === 2);
    })
    .slice(0, 4);
  for (const line of bothTeamsCards) selected.set(line.key, line);

  for (const line of sorted) {
    if (selected.size >= 8) break;
    if (isCornerLine(line) && isFullGameLine(line) && isMainSide(line) && !selected.has(line.key)) {
      selected.set(line.key, line);
    }
  }

  if (selected.size === 0) {
    for (const line of sorted.slice(0, 6)) selected.set(line.key, line);
  }

  return [...selected.values()].slice(0, 8);
}

function compactMarketLabel(line: FeaturedLine | CornerAlert) {
  if (isCardLine(line)) {
    const amount = cardCountFromLine(line);
    if (isBothTeamsCardLine(line) && amount) {
      return `Ambos os times tomam ${amount} ${amount === 1 ? 'cartão' : 'cartões'}`;
    }

    const side = SIDE_LABELS[line.side] ?? 'Linha';
    return line.line && line.line !== 'sem linha'
      ? `${translateMarketName(line.market)} - ${side} ${line.line}`
      : `${translateMarketName(line.market)} - ${line.label}`;
  }

  const side = SIDE_LABELS[line.side] ?? 'Linha';
  return `${translateMarketName(line.market)} - ${side} ${line.line}`;
}

function translateMarketName(value: string): string {
  const normalized = normalize(value);
  const isCards =
    normalized.includes('card') ||
    normalized.includes('cards') ||
    normalized.includes('cartao') ||
    normalized.includes('cartoes') ||
    normalized.includes('booking') ||
    normalized.includes('yellow') ||
    normalized.includes('red');
  if (isCards && (normalized.includes('1st half') || normalized.includes('first half'))) return 'Cartões no 1º tempo';
  if (isCards && (normalized.includes('2nd half') || normalized.includes('second half'))) return 'Cartões no 2º tempo';
  if (isCards) return 'Cartões';
  if (normalized.includes('1st half') || normalized.includes('first half')) return 'Escanteios no 1º tempo';
  if (normalized.includes('2nd half') || normalized.includes('second half')) return 'Escanteios no 2º tempo';
  if (normalized.includes('home')) return 'Escanteios do mandante';
  if (normalized.includes('away')) return 'Escanteios do visitante';
  if (normalized.includes('corner') || normalized.includes('corners')) return 'Escanteios';
  return value;
}

function filterLineByBookmakers(line: FeaturedLine, bookmakers: string[]) {
  if (bookmakers.length === 0) return line;
  const selected = new Set(bookmakers.map(bookmakerKey));
  return {
    ...line,
    odds: line.odds.filter((odd) => selected.has(bookmakerKey(odd.bookmaker))),
  };
}

function alertMatchesBookmakers(alert: CornerAlert, bookmakers: string[]) {
  if (bookmakers.length === 0) return true;
  const selected = new Set(bookmakers.map(bookmakerKey));
  return alert.odds.some((odd) => selected.has(bookmakerKey(odd.bookmaker)));
}

function AlertOddsDetails({ alert, matchName }: { alert: CornerAlert; matchName?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-sm">
      <button type="button" onClick={() => setOpen((current) => !current)} className="w-full text-left">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            {matchName && <div className="font-semibold text-foreground">{matchName}</div>}
            <div className={matchName ? 'text-sm text-muted-foreground' : 'font-semibold'}>{compactMarketLabel(alert)}</div>
            <div className="text-xs text-muted-foreground">
              {alert.label} | {alert.comparedBookmakers} casas comparadas
            </div>
          </div>

          <div className="shrink-0 text-left md:text-right">
            <div className="font-bold text-amber-300">
              {alert.bookmaker}: {alert.odd.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              {alert.nextBestBookmaker}: {alert.nextBestOdd.toFixed(2)} | média {alert.averageOdd.toFixed(2)} | +{alert.edgePct}%
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="mt-3 rounded-md border border-amber-500/20 bg-background/50 p-3">
          <div className="mb-2 text-xs font-semibold text-amber-300">Odds das casas nessa mesma linha</div>
          <div className="flex flex-wrap gap-2">
            {alert.odds.map((odd) => (
              <span
                key={`${odd.bookmaker}-${odd.odd}`}
                className={
                  bookmakerKey(odd.bookmaker) === bookmakerKey(alert.bookmaker)
                    ? 'rounded-full bg-amber-500/20 px-3 py-1 text-sm font-bold text-amber-300'
                    : 'rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground'
                }
              >
                {odd.bookmaker}: {odd.odd.toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturedLineRow({ line }: { line: FeaturedLine }) {
  const best = bestOddForGroup(line.odds);

  return (
    <div className="rounded-lg border border-border/60 bg-background/30 p-3">
      <div className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold">{compactMarketLabel(line)}</div>
          <div className="text-xs text-muted-foreground">{line.label}</div>
        </div>

        {best && <Badge className="w-fit bg-emerald-500/20 text-emerald-300">Melhor: {best.bookmaker} {best.odd.toFixed(2)}</Badge>}
      </div>

      <div className="flex flex-wrap gap-2">
        {line.odds.slice(0, 8).map((odd) => (
          <span
            key={`${odd.bookmaker}-${odd.odd}`}
            className={
              best && odd.bookmaker === best.bookmaker && odd.odd === best.odd
                ? 'rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300'
                : 'rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground'
            }
          >
            {odd.bookmaker}: {odd.odd.toFixed(2)}
          </span>
        ))}
      </div>
    </div>
  );
}

function WorldCupCornerEventCard({
  event,
  selectedBookmakers,
  onOpenAllOdds,
}: {
  event: CornerEvent;
  selectedBookmakers: string[];
  onOpenAllOdds: (eventId: string) => void;
}) {
  const allLines = useMemo(() => {
    const grouped = groupCornerLines([...event.cornerLines, ...(event.cardLines ?? [])])
      .map((line) => filterLineByBookmakers(line, selectedBookmakers))
      .filter((line) => line.odds.length > 0);
    return grouped;
  }, [event.cardLines, event.cornerLines, selectedBookmakers]);
  const primaryLines = useMemo(() => importantLines(allLines), [allLines]);
  const visibleAlerts = event.alerts.filter((alert) => alertMatchesBookmakers(alert, selectedBookmakers));
  const [showPrimaryLines, setShowPrimaryLines] = useState(false);

  return (
    <Card className="p-4 space-y-4 border-emerald-500/20 bg-emerald-950/10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Copa do Mundo</Badge>
            {event.roundName && <Badge variant="outline" className="text-muted-foreground">{event.roundName}</Badge>}
            <Badge variant="outline" className="text-emerald-300">{allLines.length} linhas no jogo</Badge>
            <Badge variant="outline" className="text-blue-300">{event.bookmakersCount} casas</Badge>
          </div>

          <h3 className="text-lg font-bold">{displayTeamName(event.homeTeam)} x {displayTeamName(event.awayTeam)}</h3>
          <p className="text-sm text-muted-foreground">{formatDate(event.startTime)} BRT</p>
        </div>

        {visibleAlerts.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <TrendingUp className="h-4 w-4" />
              {visibleAlerts.length} alerta(s) de valor
            </div>
            <div className="mt-1 text-foreground">Maior: {visibleAlerts[0].bookmaker} pagando {visibleAlerts[0].odd.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">
              {visibleAlerts[0].nextBestBookmaker} {visibleAlerts[0].nextBestOdd.toFixed(2)} | diferença +{visibleAlerts[0].edgePct}%
            </div>
          </div>
        )}
      </div>

      {visibleAlerts.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
            <BadgeDollarSign className="h-4 w-4" />
            Alertas de valor em escanteios
          </div>

          <div className="grid gap-2">
            {visibleAlerts.slice(0, 3).map((alert) => (
              <AlertOddsDetails key={`${alert.market}-${alert.line}-${alert.side}-${alert.bookmaker}`} alert={alert} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-muted/30 p-3">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-emerald-300" />
            Linhas principais
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {primaryLines.length} linhas
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPrimaryLines((current) => !current)}
            >
              <ChevronDown className={`mr-2 h-4 w-4 transition-transform ${showPrimaryLines ? 'rotate-180' : ''}`} />
              {showPrimaryLines ? 'Ocultar linhas' : 'Ver linhas principais'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenAllOdds(event.id)}>
              Ver todas as odds
            </Button>
          </div>
        </div>

        {showPrimaryLines ? (
          <div className="grid gap-3">
            {primaryLines.map((line) => <FeaturedLineRow key={line.key} line={line} />)}
            {primaryLines.length === 0 && (
              <div className="rounded-lg bg-background/30 p-6 text-center text-sm text-muted-foreground">Nenhuma linha encontrada com esses filtros.</div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 bg-background/30 p-3 text-sm text-muted-foreground">
            Clique em <span className="font-semibold text-foreground">Ver linhas principais</span> para abrir as odds resumidas deste jogo.
          </div>
        )}
      </div>
    </Card>
  );
}

function AllEventOddsView({
  event,
  selectedBookmakers,
  onBack,
}: {
  event: CornerEvent;
  selectedBookmakers: string[];
  onBack: () => void;
}) {
  const cornerLines = useMemo(
    () =>
      groupCornerLines(event.cornerLines)
        .map((line) => filterLineByBookmakers(line, selectedBookmakers))
        .filter((line) => line.odds.length > 0),
    [event.cornerLines, selectedBookmakers]
  );
  const cardLines = useMemo(
    () =>
      groupCornerLines(event.cardLines ?? [])
        .map((line) => filterLineByBookmakers(line, selectedBookmakers))
        .filter((line) => line.odds.length > 0),
    [event.cardLines, selectedBookmakers]
  );

  return (
    <div className="space-y-4">
      <Card className="overflow-visible p-4 border-emerald-500/20 bg-emerald-950/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Copa do Mundo</Badge>
              {event.roundName && <Badge variant="outline" className="text-muted-foreground">{event.roundName}</Badge>}
              <Badge variant="outline" className="text-emerald-300">{cornerLines.length} linhas de escanteios</Badge>
              <Badge variant="outline" className="text-amber-300">{cardLines.length} linhas de cartões</Badge>
            </div>
            <h3 className="text-xl font-bold">{displayTeamName(event.homeTeam)} x {displayTeamName(event.awayTeam)}</h3>
            <p className="text-sm text-muted-foreground">{formatDate(event.startTime)} BRT</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 border-emerald-500/20 bg-muted/20">
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <Target className="h-4 w-4 text-emerald-300" />
          Todas as odds de escanteios
        </div>
        <div className="grid gap-3">
          {cornerLines.map((line) => <FeaturedLineRow key={line.key} line={line} />)}
          {cornerLines.length === 0 && (
            <div className="rounded-lg bg-background/30 p-6 text-center text-sm text-muted-foreground">Nenhuma linha de escanteios encontrada com esses filtros.</div>
          )}
        </div>
      </Card>

      <Card className="p-4 border-amber-500/20 bg-muted/20">
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <CreditCard className="h-4 w-4 text-amber-300" />
          Todas as odds de cartões
        </div>
        <div className="grid gap-3">
          {cardLines.map((line) => <FeaturedLineRow key={line.key} line={line} />)}
          {cardLines.length === 0 && (
            <div className="rounded-lg bg-background/30 p-6 text-center text-sm text-muted-foreground">Nenhuma linha de cartões encontrada com esses filtros.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

function SearchableTeamFilter({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) => normalize(option).includes(normalize(query))).slice(0, 80);

  return (
    <div className={open ? 'relative z-[1000]' : 'relative z-10'}>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{value || 'Todas as seleções'}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-[1000] mt-2 w-full rounded-lg border border-border bg-popover p-2 shadow-2xl">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar seleção..."
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500/60"
            />
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            Todas as seleções
            {!value && <Check className="h-4 w-4 text-emerald-400" />}
          </button>
          <div className="max-h-72 overflow-auto pr-1">
            {filtered.map((option) => (
              <button
                type="button"
                key={option}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                {option}
                {value === option && <Check className="h-4 w-4 text-emerald-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BookmakerFilter({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) => normalize(option).includes(normalize(query))).slice(0, 120);
  const selectedSet = new Set(selected.map(bookmakerKey));

  function toggle(bookmaker: string) {
    const exists = selectedSet.has(bookmakerKey(bookmaker));
    onChange(exists ? selected.filter((item) => bookmakerKey(item) !== bookmakerKey(bookmaker)) : [...selected, bookmaker]);
  }

  return (
    <div className={open ? 'relative z-[1000]' : 'relative z-10'}>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.length === 0 ? 'Todas as casas' : `${selected.length} casa(s) selecionada(s)`}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-[1000] mt-2 w-full rounded-lg border border-border bg-popover p-2 shadow-2xl">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar casa..."
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500/60"
            />
          </div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
              Limpar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(options)}>
              Selecionar todas
            </Button>
          </div>
          <div className="max-h-72 overflow-auto pr-1">
            {filtered.map((option) => {
              const checked = selectedSet.has(bookmakerKey(option));
              return (
                <button
                  type="button"
                  key={option}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  onClick={() => toggle(option)}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border'}`}>
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function WorldCupOddsAlerts() {
  const [data, setData] = useState<OddsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState('');
  const [bookmakerFilters, setBookmakerFilters] = useState<string[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/odds/world-cup', { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível buscar odds de escanteios da Copa.');
      setData((await response.json()) as OddsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const teamOptions = useMemo(() => {
    const teams = new Set<string>();
    for (const event of data?.events ?? []) {
      teams.add(displayTeamName(event.homeTeam));
      teams.add(displayTeamName(event.awayTeam));
    }
    return [...teams].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data?.events]);

  const filteredEvents = useMemo(() => {
    const selectedBookmakers = new Set(bookmakerFilters.map(bookmakerKey));
    return (data?.events ?? []).filter((event) => {
      if (teamFilter && !teamMatches(event.homeTeam, teamFilter) && !teamMatches(event.awayTeam, teamFilter)) return false;
      if (selectedBookmakers.size === 0) return true;
      return [...event.cornerLines, ...(event.cardLines ?? [])].some((line) => selectedBookmakers.has(bookmakerKey(line.bookmaker)));
    });
  }, [bookmakerFilters, data?.events, teamFilter]);

  const filteredAlerts = useMemo(
    () =>
      filteredEvents
        .flatMap((event) =>
          event.alerts
            .filter((alert) => alertMatchesBookmakers(alert, bookmakerFilters))
            .map((alert) => ({ event, alert }))
        )
        .sort((a, b) => b.alert.edgePct - a.alert.edgePct),
    [bookmakerFilters, filteredEvents]
  );

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-emerald-400" />
        <p className="text-sm text-muted-foreground">Carregando odds de escanteios...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-amber-400" />
        <p className="font-semibold">{error}</p>
        <Button variant="outline" size="sm" onClick={load} className="mt-4"><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>
      </Card>
    );
  }

  if (!data || data.events.length === 0) {
    const title = data?.configured ? 'Nenhuma linha de escanteios encontrada para a Copa agora' : 'Odds reais não configuradas';
    const description = data?.configured
      ? 'Quando uma casa enviar mercados de escanteios para os jogos, eles aparecerão aqui.'
      : 'Configure a chave de odds para buscar mercados reais de escanteios.';

    return (
      <Card className="p-8 text-center">
        <Flag className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">{title}</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        <Button variant="outline" size="sm" onClick={load} className="mt-4"><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </Card>
    );
  }

  const hasFilters = Boolean(teamFilter || bookmakerFilters.length > 0);
  const selectedEvent = selectedEventId
    ? filteredEvents.find((event) => event.id === selectedEventId) ??
      data.events.find((event) => event.id === selectedEventId) ??
      null
    : null;

  if (selectedEvent) {
    return (
      <AllEventOddsView
        event={selectedEvent}
        selectedBookmakers={bookmakerFilters}
        onBack={() => setSelectedEventId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-amber-500/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold"><BadgeDollarSign className="h-5 w-5 text-emerald-300" />Odds de Escanteios da Copa do Mundo</h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Compare as melhores cotações de escanteios por jogo, seleção e casa de aposta.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{filteredEvents.length} jogos</Badge>
            <Badge variant="outline">{data.summary.cornerLines} linhas</Badge>
            <Badge variant="outline" className="text-amber-300">{filteredAlerts.length} alertas</Badge>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">Atualizado em {formatUpdated(data.lastUpdated)}. Alertas aparecem quando uma casa paga pelo menos 25% acima da segunda melhor casa na mesma linha.</p>
      </Card>

      <Card className="relative z-[200] !overflow-visible p-4 border-primary/20">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 font-semibold">
            <Search className="h-4 w-4 text-emerald-300" />
            Filtros
          </h4>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setTeamFilter('');
                setBookmakerFilters([]);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Seleção</label>
            <SearchableTeamFilter options={teamOptions} value={teamFilter} onChange={setTeamFilter} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Casas de apostas</label>
            <BookmakerFilter options={data.bookmakers} selected={bookmakerFilters} onChange={setBookmakerFilters} />
          </div>
        </div>
      </Card>

      {filteredAlerts.length > 0 && (
        <Card className="relative z-0 p-4 border-amber-500/20 bg-amber-500/5">
          <div className="mb-3 flex items-center gap-2 font-semibold text-amber-300"><TrendingUp className="h-4 w-4" />Principais alertas</div>
          <div className="grid gap-2 md:grid-cols-2">
            {filteredAlerts.slice(0, 6).map(({ event, alert }) => (
              <AlertOddsDetails
                key={`${event.id}-${alert.market}-${alert.line}-${alert.bookmaker}`}
                alert={alert}
                matchName={`${displayTeamName(event.homeTeam)} x ${displayTeamName(event.awayTeam)}`}
              />
            ))}
          </div>
        </Card>
      )}

      <div className="relative z-0 grid gap-3">
        {filteredEvents.map((event) => (
          <WorldCupCornerEventCard
            key={event.id}
            event={event}
            selectedBookmakers={bookmakerFilters}
            onOpenAllOdds={setSelectedEventId}
          />
        ))}
        {filteredEvents.length === 0 && (
          <Card className="p-8 text-center">
            <BadgeDollarSign className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">Nenhuma odd encontrada com esses filtros</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Tente remover uma casa selecionada ou escolher outra seleção.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
