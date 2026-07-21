'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Brain, CheckCircle2, Clock3, RefreshCw, ShieldCheck, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { calculateLiveIntelligence, type LiveIntelligenceInput } from '@/core/intelligence/live-intelligence';
import { buildIntelligenceNarrative, intelligenceScoreLabel } from '@/core/intelligence/narrative-engine';

 type LiveMatch = LiveIntelligenceInput & {
  id: number;
  competition?: string;
  stoppage?: { predictedAddedMinutes?: number | null };
};

function level(value: number) {
  if (value >= 80) return 'Muito forte';
  if (value >= 65) return 'Forte';
  if (value >= 50) return 'Moderado';
  return 'Baixo';
}

function SimpleMetric({ title, value, suffix = '', help }: { title: string; value: number; suffix?: string; help: string }) {
  return <Card className="p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{help}</p></div>
      <Badge variant="secondary">{level(value)}</Badge>
    </div>
    <p className="mt-4 text-3xl font-black">{Math.round(value)}{suffix}</p>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>
  </Card>;
}

export default function PredictionLabPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/live', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Não foi possível carregar os jogos ao vivo.');
      const next = (payload.matches ?? []) as LiveMatch[];
      setMatches(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro inesperado ao carregar as previsões.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 25000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = matches.find((match) => match.id === selectedId) ?? matches[0];
  const intelligence = useMemo(() => selected ? calculateLiveIntelligence({ ...selected, predictedAddedMinutes: selected.stoppage?.predictedAddedMinutes }) : null, [selected]);
  const narrative = useMemo(() => selected && intelligence ? buildIntelligenceNarrative(selected, intelligence) : null, [selected, intelligence]);

  const recommendation = useMemo(() => {
    if (!selected || !intelligence) return null;
    const home = intelligence.home.cornerProbability;
    const away = intelligence.away.cornerProbability;
    const best = Math.max(home, away);
    const team = home >= away ? selected.homeTeam.name : selected.awayTeam.name;
    if (intelligence.dataQuality < 45) return { status: 'Aguardar', team, text: 'Os dados ainda não são confiáveis o suficiente para uma decisão.', tone: 'warning' as const };
    if (best >= 68 && intelligence.intelligenceScore >= 68) return { status: 'Oportunidade forte', team, text: `${team} apresenta a melhor combinação de pressão e chance do próximo escanteio.`, tone: 'positive' as const };
    if (best >= 55) return { status: 'Monitorar', team, text: `${team} está mais próximo do próximo escanteio, mas ainda sem confirmação forte.`, tone: 'neutral' as const };
    return { status: 'Sem entrada', team, text: 'Nenhum dos lados apresenta pressão suficiente neste momento.', tone: 'warning' as const };
  }, [selected, intelligence]);

  return <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><Badge variant="outline" className="mb-3">Previsões ao vivo</Badge><h1 className="text-3xl font-black tracking-tight">Laboratório de Previsões</h1><p className="mt-2 max-w-3xl text-muted-foreground">Escolha uma partida ao vivo e veja, em linguagem simples, qual equipe está pressionando mais, quem tem maior chance do próximo escanteio e se existe uma oportunidade real.</p></div>
      <Button onClick={load} disabled={loading} variant="outline"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar agora</Button>
    </div>

    <Card className="mb-6 p-5"><p className="font-black">Como interpretar esta tela</p><div className="mt-3 grid gap-3 text-sm md:grid-cols-3"><p><b>1. Escolha o jogo:</b> selecione uma partida na lista.</p><p><b>2. Veja a decisão:</b> o sistema informa se é melhor entrar, monitorar ou aguardar.</p><p><b>3. Confira os motivos:</b> pressão, probabilidade, tempo restante e qualidade dos dados.</p></div></Card>

    {error && <Card className="mb-6 border-destructive/40 p-4 text-destructive">{error}</Card>}
    {loading && matches.length === 0 ? <div className="flex justify-center py-20"><RefreshCw className="h-8 w-8 animate-spin" /></div> : matches.length === 0 ? <Card className="p-8 text-center text-muted-foreground">Não há partidas ao vivo neste momento. A tela será preenchida automaticamente quando um jogo começar.</Card> :
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3"><p className="text-sm font-bold">Partidas ao vivo</p>{matches.map((match) => <button key={match.id} type="button" onClick={() => setSelectedId(match.id)} className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === match.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}><p className="text-xs text-muted-foreground">{match.competition ?? 'Competição'}</p><p className="mt-1 font-bold">{match.homeTeam.name} x {match.awayTeam.name}</p><p className="mt-2 text-sm">{match.homeTeam.score} - {match.awayTeam.score} · {String(match.minute)} minutos</p></button>)}</aside>

        {selected && intelligence && narrative && recommendation && <section className="space-y-6">
          <Card className="p-6"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><p className="text-sm text-muted-foreground">{selected.competition ?? 'Competição'}</p><h2 className="mt-1 text-2xl font-black">{selected.homeTeam.name} x {selected.awayTeam.name}</h2><p className="mt-1 text-muted-foreground">Placar {selected.homeTeam.score} - {selected.awayTeam.score} · {String(selected.minute)} minutos</p></div><div className="md:text-right"><p className="text-sm text-muted-foreground">Força geral da leitura</p><p className="text-5xl font-black text-primary">{Math.round(intelligence.intelligenceScore)}%</p><Badge className="mt-2">{intelligenceScoreLabel(intelligence.intelligenceScore)}</Badge></div></div></Card>

          <Card className={`p-6 ${recommendation.tone === 'positive' ? 'border-primary/50' : recommendation.tone === 'warning' ? 'border-destructive/30' : ''}`}><div className="flex items-start gap-3">{recommendation.tone === 'positive' ? <CheckCircle2 className="mt-1 h-6 w-6 text-primary" /> : recommendation.tone === 'warning' ? <AlertTriangle className="mt-1 h-6 w-6 text-destructive" /> : <Target className="mt-1 h-6 w-6 text-primary" />}<div><p className="text-xs font-bold uppercase text-muted-foreground">Decisão da IA neste momento</p><h3 className="mt-1 text-2xl font-black">{recommendation.status}</h3><p className="mt-2 text-muted-foreground">{recommendation.text}</p></div></div></Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SimpleMetric title={`Pressão: ${selected.homeTeam.name}`} value={intelligence.home.pressure} help="Quanto o mandante está atacando e forçando o adversário." /><SimpleMetric title={`Pressão: ${selected.awayTeam.name}`} value={intelligence.away.pressure} help="Quanto o visitante está atacando e forçando o adversário." /><SimpleMetric title="Tempo provável restante" value={intelligence.remainingTime} suffix=" min" help="Estimativa de minutos ainda disponíveis para novos eventos." /><SimpleMetric title="Qualidade dos dados" value={intelligence.dataQuality} suffix="%" help="Confiabilidade das informações usadas nesta previsão." /></div>

          <Card className="border-primary/30 p-6"><div className="flex items-start gap-3"><Brain className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-xs font-bold uppercase text-primary">Explicação da previsão</p><h3 className="mt-1 text-xl font-black">{narrative.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{narrative.summary}</p><div className="mt-4 space-y-2">{narrative.reasons.map((reason) => <p key={reason} className="text-sm">• {reason}</p>)}</div>{narrative.caution && <p className="mt-4 rounded-lg bg-muted p-3 text-sm font-medium">Atenção: {narrative.caution}</p>}</div></div></Card>

          <div className="grid gap-4 md:grid-cols-2"><Card className="p-5"><div className="mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h3 className="font-black">Quem está mais perto do próximo evento?</h3></div><div className="space-y-4"><SimpleMetric title={`Próximo escanteio: ${selected.homeTeam.name}`} value={intelligence.home.cornerProbability} suffix="%" help="Probabilidade estimada de o próximo escanteio ser do mandante." /><SimpleMetric title={`Próximo escanteio: ${selected.awayTeam.name}`} value={intelligence.away.cornerProbability} suffix="%" help="Probabilidade estimada de o próximo escanteio ser do visitante." /><SimpleMetric title={`Próximo gol: ${selected.homeTeam.name}`} value={intelligence.home.goalProbability} suffix="%" help="Indicador complementar; não é garantia de gol." /></div></Card><Card className="p-5"><div className="mb-4 flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /><h3 className="font-black">Observações importantes</h3></div><div className="space-y-3">{intelligence.insights.map((insight) => <div key={insight} className="rounded-lg bg-muted/60 p-3 text-sm">{insight}</div>)}</div></Card></div>

          <Card className="p-5"><div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h3 className="font-black">O que formou a confiança da previsão</h3></div><div className="space-y-4">{intelligence.factors.map((factor) => <div key={factor.key} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-bold">{factor.label}</p><p className="mt-1 text-xs text-muted-foreground">{factor.explanation}</p></div><div className="text-right"><p className="text-lg font-black">{Math.round(factor.value)}%</p><p className="text-xs text-muted-foreground">peso {factor.contribution.toFixed(1)}</p></div></div></div>)}</div></Card>

          <div className="grid gap-4 sm:grid-cols-3"><Card className="flex items-center gap-3 p-4"><Clock3 className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Confiança no tempo restante</p><p className="font-black">{Math.round(intelligence.remainingTimeConfidence)}%</p></div></Card><Card className="flex items-center gap-3 p-4"><Target className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Equipe com maior pressão</p><p className="font-black">{intelligence.leadingSide === 'balanced' ? 'Jogo equilibrado' : intelligence.leadingSide === 'home' ? selected.homeTeam.name : selected.awayTeam.name}</p></div></Card><Card className="flex items-center gap-3 p-4"><Brain className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Modelo utilizado</p><p className="font-black">IA explicável</p></div></Card></div>
        </section>}
      </div>}
  </main>;
}
