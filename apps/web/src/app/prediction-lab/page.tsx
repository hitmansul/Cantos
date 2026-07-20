'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Brain, Clock3, RefreshCw, ShieldCheck, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  calculateLiveIntelligence,
  type LiveIntelligenceInput,
} from '@/core/intelligence/live-intelligence';

type LiveMatch = LiveIntelligenceInput & {
  id: number;
  competition?: string;
  stoppage?: { predictedAddedMinutes?: number | null };
};

const scoreLabel = (score: number) => {
  if (score >= 80) return 'Muito forte';
  if (score >= 65) return 'Forte';
  if (score >= 50) return 'Moderado';
  return 'Baixo';
};

function Metric({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{Math.round(value)}{suffix}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </Card>
  );
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
      setError(cause instanceof Error ? cause.message : 'Erro inesperado ao carregar o laboratório.');
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
  const intelligence = useMemo(() => {
    if (!selected) return null;
    return calculateLiveIntelligence({
      ...selected,
      predictedAddedMinutes: selected.stoppage?.predictedAddedMinutes,
    });
  }, [selected]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline" className="mb-3">Intelligence Core v1</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Prediction Lab</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Laboratório ao vivo para validar Pressure Index, Momentum, probabilidades e explicações antes de distribuir os cálculos para todas as telas.
          </p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {error && <Card className="mb-6 border-destructive/40 p-4 text-destructive">{error}</Card>}

      {loading && matches.length === 0 ? (
        <div className="flex justify-center py-20"><RefreshCw className="h-8 w-8 animate-spin" /></div>
      ) : matches.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Não há partidas ao vivo neste momento. O laboratório será preenchido automaticamente quando uma partida começar.
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <p className="text-sm font-semibold">Partidas disponíveis</p>
            {matches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => setSelectedId(match.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === match.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <p className="text-xs text-muted-foreground">{match.competition ?? 'Competição'}</p>
                <p className="mt-1 font-semibold">{match.homeTeam.name} x {match.awayTeam.name}</p>
                <p className="mt-2 text-sm">{match.homeTeam.score} - {match.awayTeam.score} · {String(match.minute)}'</p>
              </button>
            ))}
          </aside>

          {selected && intelligence && (
            <section className="space-y-6">
              <Card className="overflow-hidden p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{selected.competition ?? 'Competição'}</p>
                    <h2 className="mt-1 text-2xl font-bold">{selected.homeTeam.name} x {selected.awayTeam.name}</h2>
                    <p className="mt-1 text-muted-foreground">{selected.homeTeam.score} - {selected.awayTeam.score} · {String(selected.minute)}'</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-sm text-muted-foreground">Intelligence Score</p>
                    <p className="text-5xl font-black text-primary">{Math.round(intelligence.intelligenceScore)}</p>
                    <Badge className="mt-2">{scoreLabel(intelligence.intelligenceScore)}</Badge>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label={`Pressão · ${selected.homeTeam.name}`} value={intelligence.home.pressure} />
                <Metric label={`Pressão · ${selected.awayTeam.name}`} value={intelligence.away.pressure} />
                <Metric label="Tempo restante estimado" value={intelligence.remainingTime} suffix=" min" />
                <Metric label="Qualidade dos dados" value={intelligence.dataQuality} suffix="%" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-5">
                  <div className="mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h3 className="font-semibold">Motores ao vivo</h3></div>
                  <div className="space-y-4">
                    <Metric label={`Momentum · ${selected.homeTeam.name}`} value={intelligence.home.momentum} />
                    <Metric label={`Próximo escanteio · ${selected.homeTeam.name}`} value={intelligence.home.cornerProbability} suffix="%" />
                    <Metric label={`Próximo gol · ${selected.homeTeam.name}`} value={intelligence.home.goalProbability} suffix="%" />
                  </div>
                </Card>
                <Card className="p-5">
                  <div className="mb-4 flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /><h3 className="font-semibold">Analyst AI · explicações</h3></div>
                  <div className="space-y-3">
                    {intelligence.insights.map((insight) => (
                      <div key={insight} className="rounded-lg bg-muted/60 p-3 text-sm">{insight}</div>
                    ))}
                  </div>
                </Card>
              </div>

              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h3 className="font-semibold">Confidence Breakdown</h3></div>
                <div className="space-y-4">
                  {intelligence.factors.map((factor) => (
                    <div key={factor.key} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{factor.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{factor.explanation}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{Math.round(factor.value)}</p>
                          <p className="text-xs text-muted-foreground">+{factor.contribution.toFixed(1)} no score</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="flex items-center gap-3 p-4"><Clock3 className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Confiança do tempo</p><p className="font-bold">{Math.round(intelligence.remainingTimeConfidence)}%</p></div></Card>
                <Card className="flex items-center gap-3 p-4"><Target className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Liderança de pressão</p><p className="font-bold">{intelligence.leadingSide === 'balanced' ? 'Equilibrada' : intelligence.leadingSide === 'home' ? selected.homeTeam.name : selected.awayTeam.name}</p></div></Card>
                <Card className="flex items-center gap-3 p-4"><Brain className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Motor</p><p className="font-bold">Explainable v1</p></div></Card>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
