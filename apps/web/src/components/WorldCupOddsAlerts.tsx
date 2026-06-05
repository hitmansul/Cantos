'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeDollarSign, Loader2, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type OddsSide = 'home' | 'draw' | 'away';

type OddsBookmaker = {
  name: string;
  source: 'real';
  home: number | null;
  draw: number | null;
  away: number | null;
};

type OddsEvent = {
  id: string;
  startTime: string;
  roundName?: string;
  homeTeam: string;
  awayTeam: string;
  fairOdds: Record<OddsSide, number>;
  bookmakers: OddsBookmaker[];
  bestPick?: {
    side: OddsSide;
    label: string;
    bookmaker: string;
    odd: number;
    fairOdd: number;
    edgePct: number;
  } | null;
  source: 'real';
};

type OddsResponse = {
  configured: boolean;
  source: 'api-football' | 'the-odds-api' | 'not-configured';
  hasRealBet365: boolean;
  note: string;
  events: OddsEvent[];
  lastUpdated: string;
};

const SIDE_LABELS: Record<OddsSide, string> = {
  home: 'Casa',
  draw: 'Empate',
  away: 'Fora',
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

function sideOdd(bookmaker: OddsBookmaker, side: OddsSide): number | null {
  return bookmaker[side];
}

function bestSideOdd(event: OddsEvent, side: OddsSide): number | null {
  const values = event.bookmakers
    .map((bookmaker) => sideOdd(bookmaker, side))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length > 0 ? Math.max(...values) : null;
}

function bookmakerFocusOdd(bookmaker: OddsBookmaker, focusSide: OddsSide): number {
  return sideOdd(bookmaker, focusSide) ?? bookmaker.home ?? bookmaker.draw ?? bookmaker.away ?? 0;
}

function WorldCupOddsEventCard({ event }: { event: OddsEvent }) {
  const [showAllBookmakers, setShowAllBookmakers] = useState(false);
  const bet365 = event.bookmakers.find((bookmaker) => bookmaker.name.toLowerCase().includes('bet365'));
  const focusSide = event.bestPick?.side ?? 'home';
  const visibleBookmakers = useMemo(() => {
    const sorted = [...event.bookmakers].sort((a, b) => {
      const oddDiff = bookmakerFocusOdd(b, focusSide) - bookmakerFocusOdd(a, focusSide);
      if (oddDiff !== 0) return oddDiff;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    return showAllBookmakers ? sorted : sorted.slice(0, 8);
  }, [event.bookmakers, focusSide, showAllBookmakers]);
  const hiddenBookmakerCount = Math.max(0, event.bookmakers.length - visibleBookmakers.length);

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
              odds reais
            </Badge>
            <Badge variant="outline" className="text-blue-300">
              {event.bookmakers.length} casas
            </Badge>
          </div>
          <h3 className="text-lg font-bold">
            {event.homeTeam} x {event.awayTeam}
          </h3>
          <p className="text-sm text-muted-foreground">{formatDate(event.startTime)} BRT</p>
        </div>

        {event.bestPick && event.bestPick.edgePct > 0 && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-emerald-300">
              <TrendingUp className="h-4 w-4" />
              Melhor valor detectado
            </div>
            <div className="mt-1 text-foreground">
              {event.bestPick.label} em {event.bestPick.bookmaker}
            </div>
            <div className="text-xs text-muted-foreground">
              odd {event.bestPick.odd.toFixed(2)} | valor +{event.bestPick.edgePct}%
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(180px,220px)_1fr]">
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-blue-300" />
            Odds justas
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {(['home', 'draw', 'away'] as OddsSide[]).map((side) => (
              <div key={side} className="rounded-md bg-background/40 p-2">
                <div className="text-xs text-muted-foreground">{SIDE_LABELS[side]}</div>
                <div className="font-bold">{event.fairOdds[side].toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BadgeDollarSign className="h-4 w-4 text-amber-300" />
              Comparacao de casas
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="outline" className="text-blue-300">
                melhores odds destacadas
              </Badge>
              {bet365 && (
                <Badge className="bg-emerald-500/20 text-emerald-300">
                  Bet365 disponivel
                </Badge>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Casa</th>
                  <th className="py-2 text-center">{event.homeTeam}</th>
                  <th className="py-2 text-center">Empate</th>
                  <th className="py-2 text-center">{event.awayTeam}</th>
                  <th className="py-2 text-center">Fonte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visibleBookmakers.map((bookmaker) => (
                  <tr key={bookmaker.name}>
                    <td className="py-2 font-medium">{bookmaker.name}</td>
                    {(['home', 'draw', 'away'] as OddsSide[]).map((side) => {
                      const odd = sideOdd(bookmaker, side);
                      const isBestOdd = odd !== null && odd === bestSideOdd(event, side);
                      return (
                        <td key={side} className="py-2 text-center font-semibold">
                          <span
                            className={
                              isBestOdd
                                ? 'inline-flex min-w-[3.5rem] items-center justify-center rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-300'
                                : 'inline-flex min-w-[3.5rem] items-center justify-center px-2 py-1'
                            }
                          >
                            {odd?.toFixed(2) ?? '-'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-2 text-center">
                      <Badge variant="outline" className="text-emerald-300">
                        real
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {event.bookmakers.length > 8 && (
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAllBookmakers((current) => !current)}
              >
                {showAllBookmakers ? 'Recolher casas' : `Mostrar mais ${hiddenBookmakerCount} casas`}
              </Button>
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
      if (!response.ok) throw new Error('Nao foi possivel buscar odds da Copa');
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
        <p className="text-sm text-muted-foreground">Carregando alertas de odds...</p>
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
    const title = data?.configured ? 'Nenhuma odd real encontrada para a Copa agora' : 'Odds reais nao configuradas';
    const description = data?.note ?? 'A aplicacao nao mostra odds estimadas.';
    return (
      <Card className="p-8 text-center">
        <BadgeDollarSign className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">{title}</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        <Button variant="outline" size="sm" onClick={load} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-amber-500/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <BadgeDollarSign className="h-5 w-5 text-emerald-300" />
              Alertas de Odds da Copa do Mundo
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{data.note}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={data.source !== 'not-configured' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}>
              {data.source !== 'not-configured' ? 'Fonte real conectada' : 'Fonte real pendente'}
            </Badge>
            <Badge variant="outline">{data.events.length} jogos</Badge>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Atualizado em {formatUpdated(data.lastUpdated)}. A tela so lista cotacoes recebidas de uma fonte real.
        </p>
      </Card>

      <div className="grid gap-3">
        {data.events.map((event) => (
          <WorldCupOddsEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
