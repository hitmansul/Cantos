'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  ChevronDown,
  ChevronUp,
  Flag,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
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
  other: 'Outro',
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
    .trim();
}

function groupKey(line: CornerLineOdd): string {
  return `${line.market}|${line.line}|${line.side}|${line.label}`;
}

function bestOddForGroup(lines: CornerLineOdd[]) {
  return [...lines].sort((a, b) => b.odd - a.odd)[0] ?? null;
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
      odds: [...values].sort((a, b) => b.odd - a.odd),
    }))
    .sort((a, b) => {
      const lineA = Number(a.line);
      const lineB = Number(b.line);
      if (Number.isFinite(lineA) && Number.isFinite(lineB) && lineA !== lineB) return lineA - lineB;
      if (a.side !== b.side) return a.side.localeCompare(b.side, 'pt-BR');
      return (b.odds[0]?.odd ?? 0) - (a.odds[0]?.odd ?? 0);
    });
}

function compactMarketLabel(line: FeaturedLine | CornerAlert) {
  const side = SIDE_LABELS[line.side] ?? 'Linha';
  return `${line.market} — ${side} ${line.line}`;
}

function isFutureWorldCupEvent(event: CornerEvent): boolean {
  const kickoff = Date.parse(event.startTime);
  if (!Number.isFinite(kickoff)) return false;
  // Mantem jogos do dia um pouco antes do horario para evitar sumir por diferenca de relogio/cache.
  return kickoff >= Date.now() - 30 * 60 * 1000;
}

function onlyFutureEvents(data: OddsResponse | null): CornerEvent[] {
  return (data?.events ?? [])
    .filter(isFutureWorldCupEvent)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

function AlertOddsDetails({ alert, matchName }: { alert: CornerAlert; matchName?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg bg-background/40 p-3 text-sm">
      <button type="button" onClick={() => setOpen((current) => !current)} className="w-full text-left">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            {matchName && <div className="font-semibold text-foreground">{matchName}</div>}
            <div className={matchName ? 'text-sm text-muted-foreground' : 'font-semibold'}>{compactMarketLabel(alert)}</div>
            <div className="text-xs text-muted-foreground">
              {alert.label} | {alert.comparedBookmakers} casas comparadas
            </div>
          </div>

          <div className="text-left md:text-right">
            <div className="font-bold text-amber-300">
              {alert.bookmaker}: {alert.odd.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              {alert.nextBestBookmaker}: {alert.nextBestOdd.toFixed(2)} | Média {alert.averageOdd.toFixed(2)} | +{alert.edgePct}%
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="mt-3 rounded-md border border-amber-500/20 bg-background/50 p-3">
          <div className="mb-2 text-xs font-semibold text-amber-300">Odds de todas as casas nessa mesma linha</div>
          <div className="flex flex-wrap gap-2">
            {alert.odds.map((odd) => (
              <span
                key={`${odd.bookmaker}-${odd.odd}`}
                className={
                  normalize(odd.bookmaker) === normalize(alert.bookmaker)
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

function WorldCupCornerEventCard({ event }: { event: CornerEvent }) {
  const [expanded, setExpanded] = useState(false);
  const allLines = useMemo(() => groupCornerLines(event.cornerLines), [event.cornerLines]);
  const featuredLines = event.featuredLines?.length ? event.featuredLines : allLines.slice(0, 6);
  const visibleLines = expanded ? allLines : featuredLines;

  return (
    <Card className="p-4 space-y-4 border-emerald-500/20 bg-emerald-950/10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Copa do Mundo</Badge>
            {event.roundName && <Badge variant="outline" className="text-muted-foreground">{event.roundName}</Badge>}
            <Badge variant="outline" className="text-emerald-300">{event.cornerLines.length} linhas de escanteios</Badge>
            <Badge variant="outline" className="text-blue-300">{event.bookmakersCount} casas</Badge>
          </div>

          <h3 className="text-lg font-bold">{event.homeTeam} x {event.awayTeam}</h3>
          <p className="text-sm text-muted-foreground">{formatDate(event.startTime)} BRT</p>
        </div>

        {event.alerts.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <TrendingUp className="h-4 w-4" />
              {event.alerts.length} alerta(s) de odd acima do mercado
            </div>
            <div className="mt-1 text-foreground">Maior: {event.alerts[0].bookmaker} pagando {event.alerts[0].odd.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">
              {event.alerts[0].nextBestBookmaker} {event.alerts[0].nextBestOdd.toFixed(2)} | diferença +{event.alerts[0].edgePct}%
            </div>
          </div>
        )}
      </div>

      {event.alerts.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
            <BadgeDollarSign className="h-4 w-4" />
            Alertas de valor em escanteios
          </div>

          <div className="grid gap-2">
            {event.alerts.slice(0, expanded ? event.alerts.length : 4).map((alert) => (
              <AlertOddsDetails key={`${alert.market}-${alert.line}-${alert.side}-${alert.bookmaker}`} alert={alert} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-muted/30 p-3">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-emerald-300" />
            {expanded ? 'Todas as linhas de escanteios do jogo' : 'Linhas principais do jogo'}
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((current) => !current)}>
            {expanded ? (
              <><ChevronUp className="mr-2 h-4 w-4" />Recolher</>
            ) : (
              <><ChevronDown className="mr-2 h-4 w-4" />Ver todas as linhas deste jogo</>
            )}
          </Button>
        </div>

        <div className="grid gap-3">
          {visibleLines.map((line) => <FeaturedLineRow key={line.key} line={line} />)}
          {visibleLines.length === 0 && (
            <div className="rounded-lg bg-background/30 p-6 text-center text-sm text-muted-foreground">Nenhuma linha de escanteios encontrada para este jogo.</div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function WorldCupOddsAlerts() {
  const [data, setData] = useState<OddsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/odds/world-cup', { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível buscar odds de escanteios da Copa');
      setData((await response.json()) as OddsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

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

  const futureEvents = onlyFutureEvents(data);

  if (!data || futureEvents.length === 0) {
    const title = data?.configured ? 'Nenhuma linha real de escanteios encontrada para jogos futuros da Copa agora' : 'Fonte de odds reais não configurada';
    const description = data?.note ?? 'A aplicação não mostra odds estimadas. Só aparecem linhas retornadas por fonte real.';

    return (
      <Card className="p-8 text-center">
        <Flag className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">{title}</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        <Button variant="outline" size="sm" onClick={load} className="mt-4"><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </Card>
    );
  }

  const eventsWithAlerts = futureEvents.filter((event) => event.alerts.length > 0);
  const futureSummary = {
    eventsChecked: futureEvents.length,
    cornerLines: futureEvents.reduce((sum, event) => sum + event.cornerLines.length, 0),
    alerts: futureEvents.reduce((sum, event) => sum + event.alerts.length, 0),
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-amber-500/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold"><BadgeDollarSign className="h-5 w-5 text-emerald-300" />Odds de Escanteios da Copa do Mundo</h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{data.note}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-300">Fonte real conectada</Badge>
            <Badge variant="outline">{futureSummary.eventsChecked} jogos futuros</Badge>
            <Badge variant="outline">{futureSummary.cornerLines} linhas</Badge>
            <Badge variant="outline" className="text-amber-300">{futureSummary.alerts} alertas</Badge>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">Atualizado em {formatUpdated(data.lastUpdated)}. Esta tela mostra somente jogos que ainda vão acontecer. Alerta = mesma linha de escanteios com uma casa pagando pelo menos 25% acima da segunda melhor casa.</p>
      </Card>

      {eventsWithAlerts.length > 0 && (
        <Card className="p-4 border-amber-500/20 bg-amber-500/5">
          <div className="mb-3 flex items-center gap-2 font-semibold text-amber-300"><TrendingUp className="h-4 w-4" />Principais alertas</div>
          <div className="grid gap-2 md:grid-cols-2">
            {eventsWithAlerts.slice(0, 6).map((event) => {
              const alert = event.alerts[0];
              return <AlertOddsDetails key={`${event.id}-${alert.market}-${alert.line}-${alert.bookmaker}`} alert={alert} matchName={`${event.homeTeam} x ${event.awayTeam}`} />;
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {futureEvents.map((event) => <WorldCupCornerEventCard key={event.id} event={event} />)}
      </div>
    </div>
  );
}
