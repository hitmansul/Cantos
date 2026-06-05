"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Filter,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type MarketType = 'corners' | 'other';
type AlertConfidence = 'alta' | 'moderada' | 'fraca';

type OddsOffer = {
  bookmaker: string;
  odd: number;
};

type OddsAlert = {
  id: string;
  eventId: number;
  startTime: string;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  marketType: MarketType;
  marketName: string;
  selectionLabel: string;
  lineLabel: string;
  bestBookmaker: string;
  bestOdd: number;
  medianOdd: number;
  secondBestOdd: number | null;
  edgePct: number;
  confidence: AlertConfidence;
  bookmakersCompared: number;
  bookmakers: OddsOffer[];
};

type OddsAlertsResponse = {
  configured: boolean;
  source: 'api-football' | 'not-configured';
  focus: 'corner-lines';
  note: string;
  summary: {
    leaguesChecked: number;
    eventsChecked: number;
    cornerAlerts: number;
    otherValueAlerts: number;
    bookmakersCompared: number;
  };
  alerts: OddsAlert[];
  lastUpdated: string;
};

type AlertTab = 'corners' | 'other';

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

function confidenceClass(confidence: AlertConfidence) {
  if (confidence === 'alta') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (confidence === 'moderada') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
}

function normalizeFilter(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function groupByLeague(alerts: OddsAlert[]) {
  return alerts.reduce<Array<{ key: string; leagueName: string; country: string; alerts: OddsAlert[] }>>(
    (acc, alert) => {
      const key = `${alert.country}|${alert.leagueName}`;
      const group = acc.find((item) => item.key === key);
      if (group) {
        group.alerts.push(alert);
      } else {
        acc.push({
          key,
          leagueName: alert.leagueName,
          country: alert.country,
          alerts: [alert],
        });
      }
      return acc;
    },
    []
  );
}

function OddsAlertCard({ alert, selectedBookmakers }: { alert: OddsAlert; selectedBookmakers: string[] }) {
  const selectedSet = new Set(selectedBookmakers.map(normalizeFilter));
  const filteredBookmakers =
    selectedSet.size > 0
      ? alert.bookmakers.filter((bookmaker) => selectedSet.has(normalizeFilter(bookmaker.bookmaker)))
      : alert.bookmakers;

  const visibleBookmakers = filteredBookmakers.slice(0, 8);
  const bestVisibleBookmaker =
    visibleBookmakers.reduce<OddsOffer | null>(
      (best, bookmaker) => (!best || bookmaker.odd > best.odd ? bookmaker : best),
      null
    ) ?? alert.bookmakers[0];

  const hasBet365 = alert.bookmakers.some((bookmaker) => bookmaker.bookmaker.toLowerCase().includes('bet365'));

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                alert.marketType === 'corners'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-violet-500/15 text-violet-300 border-violet-500/30'
              }
            >
              {alert.marketType === 'corners' ? 'Escanteios' : 'Outro mercado'}
            </Badge>
            <Badge variant="outline">{alert.country}</Badge>
            <Badge variant="outline">{alert.bookmakersCompared} casas</Badge>
            {hasBet365 && <Badge className="bg-yellow-500/15 text-yellow-200 border-yellow-500/30">Bet365</Badge>}
          </div>

          <div>
            <h4 className="text-base font-bold leading-tight">
              {alert.homeTeam} x {alert.awayTeam}
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(alert.startTime)} BRT</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-background/40 px-2 py-1 font-semibold">{alert.marketName}</span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-300">{alert.lineLabel}</span>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <BadgeDollarSign className="h-4 w-4" />
            {selectedBookmakers.length > 0 ? 'Melhor odd nos filtros' : 'Melhor odd'}
          </div>
          <div className="mt-1 text-lg font-bold">
            {bestVisibleBookmaker.odd.toFixed(2)}{' '}
            <span className="text-sm font-medium text-muted-foreground">{bestVisibleBookmaker.bookmaker}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>mediana {alert.medianOdd.toFixed(2)}</span>
            {alert.edgePct > 0 && <span>+{alert.edgePct}% acima</span>}
            <Badge className={confidenceClass(alert.confidence)}>{alert.confidence}</Badge>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {visibleBookmakers.map((bookmaker) => {
          const isBest =
            bookmaker.bookmaker === bestVisibleBookmaker.bookmaker && bookmaker.odd === bestVisibleBookmaker.odd;
          return (
            <div
              key={`${alert.id}-${bookmaker.bookmaker}`}
              className={
                isBest
                  ? 'rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2'
                  : 'rounded-md border border-border/60 bg-background/30 px-3 py-2'
              }
            >
              <div className="truncate text-sm font-semibold">{bookmaker.bookmaker}</div>
              <div className={isBest ? 'text-lg font-bold text-emerald-300' : 'text-lg font-bold'}>
                {bookmaker.odd.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ValueAlerts() {
  const [data, setData] = useState<OddsAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AlertTab>('corners');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [bookmakerSearch, setBookmakerSearch] = useState('');
  const [selectedBookmakers, setSelectedBookmakers] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/odds/alerts', { cache: 'no-store' });
      if (!response.ok) throw new Error('Nao foi possivel buscar odds reais agora.');
      const payload = (await response.json()) as OddsAlertsResponse;
      setData(payload);
      if (payload.summary.cornerAlerts === 0 && payload.summary.otherValueAlerts > 0) setTab('other');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao buscar odds.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const leagueOptions = useMemo(() => {
    const alerts = data?.alerts ?? [];
    return [...new Set(alerts.map((alert) => `${alert.country}|${alert.leagueName}`))]
      .map((key) => {
        const [country, leagueName] = key.split('|');
        return { key, country, leagueName };
      })
      .sort((a, b) => `${a.country} ${a.leagueName}`.localeCompare(`${b.country} ${b.leagueName}`));
  }, [data?.alerts]);

  const teamOptions = useMemo(() => {
    const alerts = data?.alerts ?? [];
    return [...new Set(alerts.flatMap((alert) => [alert.homeTeam, alert.awayTeam]))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [data?.alerts]);

  const bookmakerOptions = useMemo(() => {
    const alerts = data?.alerts ?? [];
    return [...new Set(alerts.flatMap((alert) => alert.bookmakers.map((bookmaker) => bookmaker.bookmaker)))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [data?.alerts]);

  const filteredBookmakerOptions = useMemo(() => {
    const term = normalizeFilter(bookmakerSearch);
    if (!term) return bookmakerOptions;
    return bookmakerOptions.filter((bookmaker) => normalizeFilter(bookmaker).includes(term));
  }, [bookmakerOptions, bookmakerSearch]);

  function toggleBookmaker(bookmaker: string, checked: boolean) {
    setSelectedBookmakers((current) => {
      if (checked) return current.includes(bookmaker) ? current : [...current, bookmaker].sort((a, b) => a.localeCompare(b));
      return current.filter((item) => item !== bookmaker);
    });
  }

  function clearFilters() {
    setLeagueFilter('all');
    setTeamFilter('all');
    setSelectedBookmakers([]);
    setBookmakerSearch('');
  }

  const hasActiveFilters =
    leagueFilter !== 'all' || teamFilter !== 'all' || selectedBookmakers.length > 0 || bookmakerSearch.trim() !== '';

  const visibleAlerts = useMemo(() => {
    const alerts = data?.alerts ?? [];
    const selectedSet = new Set(selectedBookmakers.map(normalizeFilter));

    return alerts.filter((alert) => {
      if (alert.marketType !== tab) return false;
      if (leagueFilter !== 'all' && `${alert.country}|${alert.leagueName}` !== leagueFilter) return false;
      if (teamFilter !== 'all' && alert.homeTeam !== teamFilter && alert.awayTeam !== teamFilter) return false;
      if (
        selectedSet.size > 0 &&
        !alert.bookmakers.some((bookmaker) => selectedSet.has(normalizeFilter(bookmaker.bookmaker)))
      ) {
        return false;
      }
      return true;
    });
  }, [data?.alerts, leagueFilter, selectedBookmakers, tab, teamFilter]);

  const groups = useMemo(() => groupByLeague(visibleAlerts), [visibleAlerts]);

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-emerald-400" />
        <p className="text-sm text-muted-foreground">Buscando odds reais nas ligas integradas...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-amber-400" />
        <p className="font-semibold">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={load} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </Card>
    );
  }

  if (!data || !data.configured) {
    return (
      <Card className="p-6 border-amber-500/30 bg-amber-500/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Odds reais nao configuradas</h3>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Configure a chave da API-Football para comparar odds reais. A aplicacao nao cria cotacoes estimadas.
              </p>
            </div>
          </div>
          <Badge className="w-fit bg-amber-500/15 text-amber-300 border-amber-500/30">
            Somente odds reais
          </Badge>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-blue-500/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <BadgeDollarSign className="h-5 w-5 text-emerald-300" />
              Alertas de Odds Reais
            </h3>
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{data.note}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Atualizado em {formatUpdated(data.lastUpdated)}. Escanteios sao prioridade; outros mercados aparecem
              apenas quando uma casa esta pagando muito acima das demais.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              API-Football
            </Badge>
            <Badge variant="outline">{data.summary.leaguesChecked} ligas</Badge>
            <Badge variant="outline">{data.summary.eventsChecked} jogos</Badge>
            <Button type="button" variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4 text-emerald-300" />
            Escanteios
          </div>
          <div className="mt-1 text-2xl font-bold">{data.summary.cornerAlerts}</div>
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4 text-violet-300" />
            Outras distorcoes
          </div>
          <div className="mt-1 text-2xl font-bold">{data.summary.otherValueAlerts}</div>
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-blue-300" />
            Casas comparadas
          </div>
          <div className="mt-1 text-2xl font-bold">{data.summary.bookmakersCompared}</div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4 text-amber-300" />
            Jogos com odds
          </div>
          <div className="mt-1 text-2xl font-bold">{data.summary.eventsChecked}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === 'corners' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('corners')}
        >
          <Target className="mr-2 h-4 w-4" />
          Linhas de escanteios ({data.summary.cornerAlerts})
        </Button>
        <Button
          type="button"
          variant={tab === 'other' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('other')}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          Outras odds com valor ({data.summary.otherValueAlerts})
        </Button>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4 text-emerald-300" />
            Filtros
          </h4>
          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="odds-league-filter">
              Liga
            </label>
            <Select value={leagueFilter} onValueChange={setLeagueFilter}>
              <SelectTrigger id="odds-league-filter" className="w-full">
                <SelectValue placeholder="Todas as ligas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ligas</SelectItem>
                {leagueOptions.map((league) => (
                  <SelectItem key={league.key} value={league.key}>
                    {league.leagueName} - {league.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="odds-team-filter">
              Time
            </label>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger id="odds-team-filter" className="w-full">
                <SelectValue placeholder="Todos os times" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os times</SelectItem>
                {teamOptions.map((team) => (
                  <SelectItem key={team} value={team}>
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="odds-bookmaker-filter">
              Casas de apostas
            </label>
            <Input
              id="odds-bookmaker-filter"
              value={bookmakerSearch}
              onChange={(event) => setBookmakerSearch(event.target.value)}
              placeholder="Buscar casa..."
            />
            <div className="max-h-36 overflow-y-auto rounded-lg border border-border/70 bg-background/20 p-2">
              {filteredBookmakerOptions.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">Nenhuma casa encontrada.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredBookmakerOptions.map((bookmaker) => (
                    <label
                      key={bookmaker}
                      className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={selectedBookmakers.includes(bookmaker)}
                        onCheckedChange={(checked) => toggleBookmaker(bookmaker, checked === true)}
                      />
                      <span className="truncate">{bookmaker}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {selectedBookmakers.length > 0 && (
              <p className="text-xs text-muted-foreground">{selectedBookmakers.length} casas selecionadas.</p>
            )}
          </div>
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card className="p-8 text-center">
          <BadgeDollarSign className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">
            {hasActiveFilters
              ? 'Nenhum alerta encontrado com esses filtros'
              : tab === 'corners'
                ? 'Nenhuma linha real de escanteios retornada agora'
                : 'Nenhuma distorcao forte em outros mercados agora'}
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            A tela so mostra odds recebidas de fonte real. Se a API-Football nao enviar o mercado/casa para um jogo,
            ele fica fora da lista.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 text-base font-bold">
                  <Trophy className="h-4 w-4 text-amber-300" />
                  {group.leagueName}
                </h4>
                <Badge variant="outline">
                  {group.country} | {group.alerts.length} alertas
                </Badge>
              </div>
              <div className="space-y-3">
                {group.alerts.map((alert) => (
                  <OddsAlertCard key={alert.id} alert={alert} selectedBookmakers={selectedBookmakers} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
