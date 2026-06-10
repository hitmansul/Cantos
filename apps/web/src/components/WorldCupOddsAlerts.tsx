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
  nextBestOdd: number;
  averageOdd: number;
  edgePct: number;
  comparedBookmakers: number;
};

type CornerEvent = {
  id: string;
  startTime: string;
  roundName?: string;
  homeTeam: string;
  awayTeam: string;
  bookmakersCount: number;
  cornerLines: CornerLineOdd[];
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

function groupKey(line: CornerLineOdd): string {
  return `${line.market}|${line.line}|${line.side}|${line.label}`;
}

function bestOddForGroup(lines: CornerLineOdd[]) {
  return [...lines].sort((a, b) => b.odd - a.odd)[0] ?? null;
}

function groupCornerLines(lines: CornerLineOdd[]) {
  const groups = new Map<string, CornerLineOdd[]>();

  for (const line of lines) {
    const key = groupKey(line);
    const current = groups.get(key) ?? [];
    current.push(line);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, values]) => {
      const best = bestOddForGroup(values);
      return {
        key,
        market: values[0]?.market ?? '',
        line: values[0]?.line ?? '',
        side: values[0]?.side ?? 'other',
        label: values[0]?.label ?? '',
        values: [...values].sort((a, b) => b.odd - a.odd),
        bestOdd: best?.odd ?? 0,
      };
    })
    .sort((a, b) => {
      const lineA = Number(a.line);
      const lineB = Number(b.line);
      if (Number.isFinite(lineA) && Number.isFinite(lineB) && lineA !== lineB) return lineA - lineB;
      if (a.side !== b.side) return a.side.localeCompare(b.side, 'pt-BR');
      return b.bestOdd - a.bestOdd;
    });
}

function WorldCupCornerEventCard({ event }: { event: CornerEvent }) {
  const [expanded, setExpanded] = useState(event.alerts.length > 0);
  const groupedLines = useMemo(() => groupCornerLines(event.cornerLines), [event.cornerLines]);
  const visibleGroups = expanded ? groupedLines : groupedLines.slice(0, 5);

  return (
    <Card className="p-4 space-y-4 border-emerald-500/20 bg-emerald-950/10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
              Copa do Mundo
            </Badge>
            {event.roundName && (
              <Badge variant="outline" className="text-muted-foreground">
                {event.roundName}
              </Badge>
            )}
            <Badge variant="outline" className="text-emerald-300">
              {event.cornerLines.length} linhas de escanteios
            </Badge>
            <Badge variant="outline" className="text-blue-300">
              {event.bookmakersCount} casas
            </Badge>
          </div>
          <h3 className="text-lg font-bold">
            {event.homeTeam} x {event.awayTeam}
          </h3>
          <p className="text-sm text-muted-foreground">{formatDate(event.startTime)} BRT</p>
        </div>

        {event.alerts.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <TrendingUp className="h-4 w-4" />
              {event.alerts.length} alerta(s) de odd acima do mercado
            </div>
            <div className="mt-1 text-foreground">
              Maior: {event.alerts[0].bookmaker} pagando {event.alerts[0].odd.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              Segunda melhor {event.alerts[0].nextBestOdd.toFixed(2)} | diferença +{event.alerts[0].edgePct}%
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
            {event.alerts.slice(0, 5).map((alert) => (
              <div
                key={`${alert.market}-${alert.line}-${alert.side}-${alert.bookmaker}`}
                className="rounded-md bg-background/40 p-3 text-sm"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold">
                      {alert.market} — {alert.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Linha {alert.line} | {alert.comparedBookmakers} casas comparadas
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="font-bold text-amber-300">
                      {alert.bookmaker}: {alert.odd.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Próxima {alert.nextBestOdd.toFixed(2)} | Média {alert.averageOdd.toFixed(2)} | +{alert.edgePct}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-muted/30 p-3">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-emerald-300" />
            Linhas de escanteios por casa
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((current) => !current)}>
            {expanded ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Recolher
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Mostrar todas
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-3">
          {visibleGroups.map((group) => (
            <div key={group.key} className="rounded-lg border border-border/60 bg-background/30 p-3">
              <div className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">{group.market}</div>
                  <div className="text-xs text-muted-foreground">
                    {SIDE_LABELS[group.side]} | Linha {group.line} | {group.label}
                  </div>
                </div>

                {group.values[0] && (
                  <Badge className="w-fit bg-emerald-500/20 text-emerald-300">
                    Melhor: {group.values[0].bookmaker} {group.values[0].odd.toFixed(2)}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {group.values.map((line) => (
                  <span
                    key={`${line.bookmaker}-${line.odd}`}
                    className={
                      line.odd === group.bestOdd
                        ? 'rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300'
                        : 'rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground'
                    }
                  >
                    {line.bookmaker}: {line.odd.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {groupedLines.length === 0 && (
            <div className="rounded-lg bg-background/30 p-6 text-center text-sm text-muted-foreground">
              Nenhuma linha de escanteios encontrada para este jogo.
            </div>
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

  useEffect(() => {
    load();
  }, []);

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
        <Button variant="outline" size="sm" onClick={load} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </Card>
    );
  }

  if (!data || data.events.length === 0) {
    const title = data?.configured
      ? 'Nenhuma linha real de escanteios encontrada para a Copa agora'
      : 'Fonte de odds reais não configurada';

    const description = data?.note ?? 'A aplicação não mostra odds estimadas. Só aparecem linhas retornadas por fonte real.';

    return (
      <Card className="p-8 text-center">
        <Flag className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">{title}</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        <Button variant="outline" size="sm" onClick={load} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </Card>
    );
  }

  const eventsWithAlerts = data.events.filter((event) => event.alerts.length > 0);

  return (
    <div className="space-y-4">
      <Card className="p-4 border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-amber-500/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <BadgeDollarSign className="h-5 w-5 text-emerald-300" />
              Odds de Escanteios da Copa do Mundo
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{data.note}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-300">Fonte real conectada</Badge>
            <Badge variant="outline">{data.summary.eventsChecked} jogos</Badge>
            <Badge variant="outline">{data.summary.cornerLines} linhas</Badge>
            <Badge variant="outline" className="text-amber-300">
              {data.summary.alerts} alertas
            </Badge>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Atualizado em {formatUpdated(data.lastUpdated)}. Alerta = mesma linha de escanteios com uma casa pagando pelo menos 25% acima da segunda melhor odd.
        </p>
      </Card>

      {eventsWithAlerts.length > 0 && (
        <Card className="p-4 border-amber-500/20 bg-amber-500/5">
          <div className="mb-3 flex items-center gap-2 font-semibold text-amber-300">
            <TrendingUp className="h-4 w-4" />
            Principais alertas
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {eventsWithAlerts.slice(0, 6).map((event) => {
              const alert = event.alerts[0];
              return (
                <div key={event.id} className="rounded-lg bg-background/40 p-3 text-sm">
                  <div className="font-semibold">
                    {event.homeTeam} x {event.awayTeam}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {alert.market} — {alert.label}
                  </div>
                  <div className="mt-1 font-bold text-amber-300">
                    {alert.bookmaker} {alert.odd.toFixed(2)} | próxima {alert.nextBestOdd.toFixed(2)} | +{alert.edgePct}%
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {data.events.map((event) => (
          <WorldCupCornerEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
