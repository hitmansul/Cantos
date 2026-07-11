'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, ListChecks, RefreshCw, Sparkles, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scores365Results, Scores365Standings, Scores365UpcomingMatches } from '@/components/Scores365Components';
import { WorldCupBracket } from '@/components/WorldCupBracket';
import { WorldCupOddsAlerts } from '@/components/WorldCupOddsAlerts';

type SummaryMatch = {
  id?: number | string;
  startTime?: string;
  statusText?: string;
  homeTeam?: { name?: string; score?: number };
  awayTeam?: { name?: string; score?: number };
};

function rows(payload: unknown): SummaryMatch[] {
  if (!payload || typeof payload !== 'object') return [];
  const source = payload as Record<string, unknown>;
  return [source.matches, source.items, source.results, source.fixtures, source.response, source.data]
    .flatMap((value) => (Array.isArray(value) ? value : [])) as SummaryMatch[];
}

function isFinished(match: SummaryMatch) {
  return /fim|final|finished|encerrado|ft/i.test(String(match.statusText ?? '')) ||
    (typeof match.homeTeam?.score === 'number' && typeof match.awayTeam?.score === 'number');
}

function Overview() {
  const [matches, setMatches] = useState<SummaryMatch[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const endpoints = [
        '/api/365scores/upcoming/copa_do_mundo',
        '/api/365scores/results/copa_do_mundo',
        '/api/world-cup/matches',
      ];
      const responses = await Promise.allSettled(
        endpoints.map((endpoint) => fetch(endpoint, { cache: 'no-store' }).then((response) => response.ok ? response.json() : null))
      );
      const combined = responses.flatMap((result) => result.status === 'fulfilled' ? rows(result.value) : []);
      const unique = new Map<string, SummaryMatch>();
      combined.forEach((match, index) => {
        const key = String(match.id ?? `${match.homeTeam?.name}-${match.awayTeam?.name}-${match.startTime}-${index}`);
        unique.set(key, match);
      });
      setMatches([...unique.values()]);
      setUpdatedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const finished = useMemo(() => matches.filter(isFinished), [matches]);
  const upcoming = useMemo(() => matches.filter((match) => !isFinished(match)), [matches]);
  const goals = useMemo(
    () => finished.reduce((total, match) => total + (match.homeTeam?.score ?? 0) + (match.awayTeam?.score ?? 0), 0),
    [finished]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4"><Trophy className="mb-2 h-5 w-5 text-amber-400"/><p className="text-sm text-muted-foreground">Jogos encontrados</p><b className="text-3xl">{matches.length}</b></Card>
        <Card className="p-4"><ListChecks className="mb-2 h-5 w-5 text-emerald-400"/><p className="text-sm text-muted-foreground">Encerrados</p><b className="text-3xl">{finished.length}</b></Card>
        <Card className="p-4"><CalendarDays className="mb-2 h-5 w-5 text-cyan-400"/><p className="text-sm text-muted-foreground">Próximos</p><b className="text-3xl">{upcoming.length}</b></Card>
        <Card className="p-4"><BarChart3 className="mb-2 h-5 w-5 text-violet-400"/><p className="text-sm text-muted-foreground">Gols computados</p><b className="text-3xl">{goals}</b></Card>
      </div>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-bold">Central da Copa do Mundo</h3><p className="text-sm text-muted-foreground">Acesse grupos, calendário, resultados, estatísticas, previsões, mata-mata e odds sem perder funcionalidades.</p></div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Atualizar</Button>
        </div>
        {updatedAt && <p className="mt-3 text-xs text-muted-foreground">Atualização: {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(updatedAt))}</p>}
      </Card>
    </div>
  );
}

export function WorldCupPage() {
  const [tab, setTab] = useState('visao-geral');

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/30 bg-gradient-to-br from-green-950 via-emerald-900 to-teal-950 p-5">
        <h2 className="text-2xl font-bold text-white">🏆 Copa do Mundo 2026</h2>
        <p className="text-sm text-emerald-200">Área completa restaurada, mantendo o chaveamento profissional e os módulos de dados.</p>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4 xl:grid-cols-8">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="grupos"><Users className="mr-1 h-4 w-4"/>Grupos</TabsTrigger>
          <TabsTrigger value="jogos"><CalendarDays className="mr-1 h-4 w-4"/>Jogos</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
          <TabsTrigger value="estatisticas"><BarChart3 className="mr-1 h-4 w-4"/>Estatísticas</TabsTrigger>
          <TabsTrigger value="previsoes"><Sparkles className="mr-1 h-4 w-4"/>Previsões</TabsTrigger>
          <TabsTrigger value="mata-mata"><Trophy className="mr-1 h-4 w-4"/>Mata-mata</TabsTrigger>
          <TabsTrigger value="odds">Odds</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral"><Overview /></TabsContent>
        <TabsContent value="grupos"><Scores365Standings league="copa_do_mundo" /></TabsContent>
        <TabsContent value="jogos"><Scores365UpcomingMatches league="copa_do_mundo" /></TabsContent>
        <TabsContent value="resultados"><Scores365Results league="copa_do_mundo" /></TabsContent>
        <TabsContent value="estatisticas" className="space-y-4">
          <Card className="p-4"><h3 className="font-bold">Estatísticas oficiais da Copa</h3><p className="text-sm text-muted-foreground">Abra os jogos encerrados para consultar escanteios, finalizações, posse, cartões, passes e demais métricas disponíveis.</p></Card>
          <Scores365Results league="copa_do_mundo" />
        </TabsContent>
        <TabsContent value="previsoes" className="space-y-4">
          <Card className="p-4"><h3 className="font-bold">Previsões dos próximos jogos</h3><p className="text-sm text-muted-foreground">As previsões usam somente a base específica da Copa; médias de outras competições não são reaproveitadas.</p></Card>
          <Scores365UpcomingMatches league="copa_do_mundo" />
        </TabsContent>
        <TabsContent value="mata-mata"><WorldCupBracket /></TabsContent>
        <TabsContent value="odds"><WorldCupOddsAlerts /></TabsContent>
      </Tabs>
    </div>
  );
}

export default WorldCupPage;
