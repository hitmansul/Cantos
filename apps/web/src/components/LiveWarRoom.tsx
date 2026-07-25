'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, BrainCircuit, Clock3, CornerUpRight, RefreshCw, Radio, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type StatRow = { key: string; label: string; home: string; away: string };
type LiveMatch = {
  id: number;
  minute: number | string;
  statusText: string;
  competition?: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  corners?: { home: number; away: number; total: number };
  liveStats?: StatRow[];
};

type Snapshot = {
  pressure: { home: number; away: number; combined: number; leader: 'home' | 'away' | 'balanced' };
  momentum: { score: number; label: 'very-high' | 'high' | 'moderate' | 'low'; leader: 'home' | 'away' | 'balanced' };
  projectedFinalCorners: number;
  projectedRange: { min: number; max: number };
  confidence: number;
  recommendation: 'bet' | 'monitor' | 'no-bet' | 'market-closed';
  reasons: string[];
  alert?: string;
};

type WarRoomMatch = LiveMatch & { intelligence?: Snapshot; intelligenceError?: string };

const REFRESH_MS = 30_000;

function numberFrom(value: unknown) {
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function minuteFrom(match: LiveMatch) {
  if (typeof match.minute === 'number') return Math.min(130, Math.max(0, match.minute));
  return Math.min(130, Math.max(0, numberFrom(String(match.minute).match(/\d{1,3}/)?.[0])));
}

function stat(match: LiveMatch, aliases: string[], side: 'home' | 'away') {
  const normalizedAliases = aliases.map((item) => item.toLowerCase());
  const row = match.liveStats?.find((item) => {
    const text = `${item.key} ${item.label}`.toLowerCase();
    return normalizedAliases.some((alias) => text.includes(alias));
  });
  return numberFrom(row?.[side]);
}

function payloadFor(match: LiveMatch) {
  const corners = match.corners ?? { home: 0, away: 0, total: 0 };
  const buildSide = (side: 'home' | 'away') => ({
    dangerousAttacks: stat(match, ['dangerous attack', 'ataques perigosos'], side),
    attacks: stat(match, ['total attacks', 'ataques'], side),
    shots: stat(match, ['total shots', 'finalizações', 'shots'], side),
    shotsOnTarget: stat(match, ['shots on target', 'no alvo'], side),
    crosses: stat(match, ['crosses', 'cruzamentos'], side),
    possession: stat(match, ['possession', 'posse'], side),
    corners: corners[side],
    goals: side === 'home' ? match.homeTeam.score : match.awayTeam.score,
    redCards: stat(match, ['red cards', 'cartões vermelhos', 'cartao vermelho'], side),
  });

  const elapsed = Math.max(1, minuteFrom(match));
  const paceProjection = Math.min(18, Math.max(5, corners.total * (90 / elapsed)));
  const pregameExpectedTotal = Number(((paceProjection * 0.55) + 5.3).toFixed(2));

  return {
    fixtureKey: String(match.id),
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    minute: minuteFrom(match),
    home: buildSide('home'),
    away: buildSide('away'),
    pregameExpectedTotal,
    pregameConfidence: match.liveStats?.length ? 0.64 : 0.48,
    riskProfile: 'balanced' as const,
  };
}

function recommendationLabel(value?: Snapshot['recommendation']) {
  if (value === 'bet') return 'ENTRADA RECOMENDADA';
  if (value === 'monitor') return 'MONITORAR';
  if (value === 'market-closed') return 'MERCADO ENCERRADO';
  return 'SEM ENTRADA';
}

function momentumLabel(value?: Snapshot['momentum']['label']) {
  if (value === 'very-high') return 'Muito alto';
  if (value === 'high') return 'Alto';
  if (value === 'moderate') return 'Moderado';
  return 'Baixo';
}

function recommendationClass(value?: Snapshot['recommendation']) {
  if (value === 'bet') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  if (value === 'monitor') return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}

export function LiveWarRoom() {
  const [matches, setMatches] = useState<WarRoomMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState('');

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    try {
      setError(null);
      const response = await fetch('/api/live', { cache: 'no-store' });
      const data = await response.json() as { matches?: LiveMatch[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Falha ao carregar jogos ao vivo.');

      const baseMatches = data.matches ?? [];
      const enriched = await Promise.all(baseMatches.map(async (match): Promise<WarRoomMatch> => {
        try {
          const intelligenceResponse = await fetch('/api/ai-corners/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadFor(match)),
          });
          const intelligenceData = await intelligenceResponse.json() as { snapshot?: Snapshot; error?: string };
          if (!intelligenceResponse.ok || !intelligenceData.snapshot) {
            throw new Error(intelligenceData.error ?? 'Inteligência indisponível.');
          }
          return { ...match, intelligence: intelligenceData.snapshot };
        } catch (intelligenceError) {
          return { ...match, intelligenceError: intelligenceError instanceof Error ? intelligenceError.message : 'Inteligência indisponível.' };
        }
      }));

      enriched.sort((a, b) => {
        const aRank = a.intelligence?.recommendation === 'bet' ? 3 : a.intelligence?.recommendation === 'monitor' ? 2 : 1;
        const bRank = b.intelligence?.recommendation === 'bet' ? 3 : b.intelligence?.recommendation === 'monitor' ? 2 : 1;
        return bRank - aRank || (b.intelligence?.pressure.combined ?? 0) - (a.intelligence?.pressure.combined ?? 0);
      });
      setMatches(enriched);
      setUpdatedAt(new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao atualizar a central.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const metrics = useMemo(() => {
    const withIntel = matches.filter((match) => match.intelligence);
    const opportunities = withIntel.filter((match) => match.intelligence?.recommendation === 'bet').length;
    const monitoring = withIntel.filter((match) => match.intelligence?.recommendation === 'monitor').length;
    const averagePressure = withIntel.length ? withIntel.reduce((sum, match) => sum + (match.intelligence?.pressure.combined ?? 0), 0) / withIntel.length : 0;
    const averageConfidence = withIntel.length ? withIntel.reduce((sum, match) => sum + (match.intelligence?.confidence ?? 0), 0) / withIntel.length : 0;
    return { opportunities, monitoring, averagePressure, averageConfidence };
  }, [matches]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Radio className="h-5 w-5 text-red-400" /><h2 className="text-xl font-bold">War Room Live</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Ranking operacional com pressão, momentum, projeção e recomendação atualizados a cada 30 segundos.</p>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && <Badge variant="outline"><Clock3 className="mr-1 h-3.5 w-3.5" />{updatedAt}</Badge>}
          <Button variant="outline" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Jogos monitorados', matches.length, Radio],
          ['Entradas recomendadas', metrics.opportunities, ShieldCheck],
          ['Em monitoramento', metrics.monitoring, Activity],
          ['Pressão média', `${metrics.averagePressure.toFixed(0)}%`, TrendingUp],
        ].map(([label, value, Icon]) => (
          <Card key={String(label)} className="p-4">
            <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{String(label)}</p><Icon className="h-4 w-4 text-primary" /></div>
            <p className="mt-2 text-2xl font-bold">{String(value)}</p>
          </Card>
        ))}
      </div>

      {error && <Card className="border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</Card>}
      {loading && <Card className="p-8 text-center text-muted-foreground"><RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin" />Processando inteligência dos jogos ao vivo...</Card>}
      {!loading && !error && matches.length === 0 && <Card className="p-8 text-center"><Radio className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><p className="font-semibold">Nenhum jogo ao vivo neste momento</p><p className="mt-1 text-sm text-muted-foreground">A central começará a classificar as partidas assim que elas entrarem ao vivo.</p></Card>}

      <div className="grid gap-4 xl:grid-cols-2">
        {matches.map((match, index) => {
          const intel = match.intelligence;
          const corners = match.corners?.total ?? 0;
          return (
            <Card key={match.id} className="overflow-hidden border-primary/15">
              <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2"><Badge variant="outline">#{index + 1}</Badge><span className="text-xs text-muted-foreground">{match.competition ?? 'Competição'}</span></div>
                <Badge className="border-red-500/30 bg-red-500/15 text-red-300"><Radio className="mr-1 h-3 w-3" />{minuteFrom(match)}&apos;</Badge>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                  <p className="font-semibold">{match.homeTeam.name}</p>
                  <div><p className="text-2xl font-black">{match.homeTeam.score} - {match.awayTeam.score}</p><p className="text-xs text-muted-foreground">{corners} escanteios</p></div>
                  <p className="font-semibold">{match.awayTeam.name}</p>
                </div>

                {intel ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="rounded-xl bg-muted/30 p-3 text-center"><Activity className="mx-auto h-4 w-4 text-emerald-400" /><p className="mt-1 text-xl font-bold">{intel.pressure.combined.toFixed(0)}%</p><p className="text-[11px] text-muted-foreground">Pressão IA</p></div>
                      <div className="rounded-xl bg-muted/30 p-3 text-center"><Sparkles className="mx-auto h-4 w-4 text-violet-400" /><p className="mt-1 font-bold">{momentumLabel(intel.momentum.label)}</p><p className="text-[11px] text-muted-foreground">Momentum</p></div>
                      <div className="rounded-xl bg-muted/30 p-3 text-center"><CornerUpRight className="mx-auto h-4 w-4 text-amber-400" /><p className="mt-1 text-xl font-bold">{intel.projectedFinalCorners.toFixed(1)}</p><p className="text-[11px] text-muted-foreground">Projeção final</p></div>
                      <div className="rounded-xl bg-muted/30 p-3 text-center"><BrainCircuit className="mx-auto h-4 w-4 text-cyan-400" /><p className="mt-1 text-xl font-bold">{(intel.confidence * 100).toFixed(0)}%</p><p className="text-[11px] text-muted-foreground">Confiança</p></div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs"><span>Intensidade do jogo</span><span>{intel.pressure.combined.toFixed(0)}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, intel.pressure.combined)}%` }} /></div>
                    </div>
                    <div className={`rounded-xl border p-3 ${recommendationClass(intel.recommendation)}`}>
                      <div className="flex items-center justify-between gap-2"><p className="font-black">{recommendationLabel(intel.recommendation)}</p><Badge variant="outline">Faixa {intel.projectedRange.min.toFixed(0)}–{intel.projectedRange.max.toFixed(0)}</Badge></div>
                      <p className="mt-2 text-sm opacity-90">{intel.alert ?? intel.reasons[0] ?? 'Aguardando novos sinais do jogo.'}</p>
                    </div>
                    {intel.reasons.length > 0 && <div className="rounded-xl border bg-background/40 p-3"><p className="mb-2 flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4" />Leitura da IA</p><ul className="space-y-1 text-sm text-muted-foreground">{intel.reasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}</ul></div>}
                  </>
                ) : (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-300"><AlertTriangle className="mr-2 inline h-4 w-4" />{match.intelligenceError ?? 'Inteligência temporariamente indisponível.'}</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
