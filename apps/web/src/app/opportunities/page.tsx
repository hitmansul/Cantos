'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, RefreshCw, Search, ShieldCheck, Sparkles, Target } from 'lucide-react';

type Alert = {
  id: string;
  eventId: number;
  startTime: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  marketName: string;
  selectionLabel: string;
  bestBookmaker: string;
  bestOdd: number;
  medianOdd: number;
  edgePct: number;
  confidence: string;
  bookmakersCompared: number;
  discovery?: boolean;
};

type Payload = { configured: boolean; alerts: Alert[]; lastUpdated: string; note?: string };

type RadarAssessment = {
  score: number;
  grade: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
  status: 'Prioridade máxima' | 'Analisar agora' | 'Boa candidata' | 'Monitorar' | 'Cautela' | 'Sem sinal';
  reasons: string[];
  risks: string[];
};

const confidenceOrder: Record<string, number> = { high: 3, alta: 3, medium: 2, media: 2, média: 2, moderada: 2, low: 1, baixa: 1, fraca: 1 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function confidenceLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'high' || normalized === 'alta') return 'Alta';
  if (['medium', 'media', 'média', 'moderada'].includes(normalized)) return 'Média';
  if (['low', 'baixa', 'fraca'].includes(normalized)) return 'Baixa';
  return value || 'Não informada';
}

function isCornerMarket(alert: Alert) {
  const text = `${alert.marketName} ${alert.selectionLabel}`.toLowerCase();
  return text.includes('corner') || text.includes('escante');
}

function assessAlert(alert: Alert): RadarAssessment {
  const confidence = confidenceOrder[alert.confidence.toLowerCase()] ?? 0;
  const edgeScore = clamp(alert.edgePct / 20, 0, 1) * 50;
  const confidenceScore = confidence === 3 ? 25 : confidence === 2 ? 16 : confidence === 1 ? 8 : 3;
  const liquidityScore = clamp(alert.bookmakersCompared / 6, 0, 1) * 15;
  const confirmedScore = alert.discovery ? 0 : 10;
  const score = Math.round(clamp(edgeScore + confidenceScore + liquidityScore + confirmedScore, 0, 100));
  const grade = score >= 90 ? 'S+' : score >= 82 ? 'S' : score >= 72 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D';
  const status = grade === 'S+' ? 'Prioridade máxima' : grade === 'S' ? 'Analisar agora' : grade === 'A' ? 'Boa candidata' : grade === 'B' ? 'Monitorar' : grade === 'C' ? 'Cautela' : 'Sem sinal';
  const reasons: string[] = [];
  const risks: string[] = [];

  if (alert.edgePct >= 12) reasons.push(`Melhor odd está ${alert.edgePct.toFixed(1)}% acima da mediana do mercado.`);
  else if (alert.edgePct >= 5) reasons.push(`Existe diferença positiva de ${alert.edgePct.toFixed(1)}% entre a melhor odd e a mediana.`);
  else risks.push('A diferença entre as casas ainda é pequena.');

  if (confidence >= 3) reasons.push('A fonte classificou a oportunidade com confiança alta.');
  else if (confidence === 2) reasons.push('A confiança informada é intermediária e merece validação estatística.');
  else risks.push('A confiança informada pela fonte é baixa ou insuficiente.');

  if (alert.bookmakersCompared >= 4) reasons.push(`${alert.bookmakersCompared} casas foram comparadas, aumentando a qualidade da leitura de preço.`);
  else risks.push('Poucas casas foram comparadas; o movimento pode ser isolado.');

  if (alert.discovery) risks.push('Este item é um mercado disponível, ainda não uma recomendação confirmada pela IA estatística.');
  else reasons.push('O radar encontrou divergência real de preço entre casas.');

  return { score, grade, status, reasons, risks };
}

function gradeTone(grade: RadarAssessment['grade']) {
  if (grade === 'S+' || grade === 'S') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600';
  if (grade === 'A' || grade === 'B') return 'border-amber-500/40 bg-amber-500/10 text-amber-600';
  return 'border-red-500/40 bg-red-500/10 text-red-600';
}

export default function OpportunitiesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minimumEdge, setMinimumEdge] = useState(0);
  const [onlyCorners, setOnlyCorners] = useState(true);
  const [minimumConfidence, setMinimumConfidence] = useState('all');
  const [query, setQuery] = useState('');
  const [showOnlyConfirmed, setShowOnlyConfirmed] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const primaryResponse = await fetch('/api/odds/alerts?scope=all', { cache: 'no-store' });
      const primary = await primaryResponse.json() as Payload;
      if (!primaryResponse.ok) throw new Error('Não foi possível carregar o radar principal.');
      if ((primary.alerts ?? []).length > 0) { setData(primary); return; }
      const fallbackResponse = await fetch('/api/odds/discovery?days=7', { cache: 'no-store' });
      const fallback = await fallbackResponse.json() as Payload;
      if (!fallbackResponse.ok) throw new Error('Não foi possível carregar os mercados disponíveis.');
      setData(fallback);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar oportunidades.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const alerts = useMemo(() => {
    const minimumConfidenceValue = minimumConfidence === 'all' ? 0 : confidenceOrder[minimumConfidence] ?? 0;
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.alerts ?? [])
      .filter((alert) => alert.edgePct >= minimumEdge)
      .filter((alert) => !onlyCorners || isCornerMarket(alert))
      .filter((alert) => !showOnlyConfirmed || !alert.discovery)
      .filter((alert) => (confidenceOrder[alert.confidence.toLowerCase()] ?? 0) >= minimumConfidenceValue)
      .filter((alert) => !normalizedQuery || `${alert.homeTeam} ${alert.awayTeam} ${alert.leagueName} ${alert.marketName}`.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => assessAlert(b).score - assessAlert(a).score || b.edgePct - a.edgePct);
  }, [data, minimumEdge, onlyCorners, showOnlyConfirmed, minimumConfidence, query]);

  const summary = useMemo(() => ({
    total: alerts.length,
    confirmed: alerts.filter((alert) => !alert.discovery).length,
    elite: alerts.filter((alert) => ['S+', 'S'].includes(assessAlert(alert).grade)).length,
    leagues: new Set(alerts.map((alert) => alert.leagueName)).size,
  }), [alerts]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><Sparkles className="h-4 w-4" /> Scanner inteligente de escanteios</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Oportunidades priorizadas e explicadas</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">O radar ordena os mercados de escanteios pela qualidade preliminar do preço, confiança e quantidade de casas comparadas. A validação estatística final continua sendo feita pelo CornerGPT.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Itens exibidos" value={String(summary.total)} />
        <Metric label="S+ ou S" value={String(summary.elite)} />
        <Metric label="Oportunidades confirmadas" value={String(summary.confirmed)} />
        <Metric label="Competições" value={String(summary.leagues)} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-2 text-sm font-semibold">Diferença mínima: {minimumEdge}%<input type="range" min="0" max="30" value={minimumEdge} onChange={(event) => setMinimumEdge(Number(event.target.value))} /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Confiança informada<select value={minimumConfidence} onChange={(event) => setMinimumConfidence(event.target.value)} className="min-h-11 rounded-xl border bg-background px-3"><option value="all">Todas</option><option value="low">Baixa ou superior</option><option value="medium">Média ou superior</option><option value="high">Somente alta</option></select></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Pesquisar partida ou competição<div className="flex min-h-11 items-center gap-2 rounded-xl border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Fluminense" className="w-full bg-transparent outline-none" /></div></label>
          <label className="flex items-center gap-3 self-end rounded-xl border bg-background p-3 text-sm font-semibold"><input type="checkbox" checked={onlyCorners} onChange={(event) => setOnlyCorners(event.target.checked)} /> Somente escanteios</label>
          <label className="flex items-center gap-3 self-end rounded-xl border bg-background p-3 text-sm font-semibold"><input type="checkbox" checked={showOnlyConfirmed} onChange={(event) => setShowOnlyConfirmed(event.target.checked)} /> Somente confirmadas</label>
        </div>
      </section>

      <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-black">Leitura correta do Score Radar</p>
        <p className="mt-1 text-muted-foreground">O Score Radar mede a qualidade preliminar do preço disponível. Ele não substitui Score IA, EV, Kelly e projeção estatística. Use o botão <b>Validar no CornerGPT</b> antes de qualquer decisão.</p>
      </div>

      {data?.note && <div className="mt-4 rounded-xl border bg-card p-4 text-sm text-muted-foreground">{data.note}</div>}
      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}
      {!loading && !error && alerts.length === 0 && <div className="mt-5 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Nenhum mercado de escanteios foi disponibilizado pela fonte neste momento.</div>}

      <section className="mt-5 grid gap-4">
        {alerts.map((alert, index) => {
          const assessment = assessAlert(alert);
          const params = new URLSearchParams({ home: alert.homeTeam, away: alert.awayTeam, date: alert.startTime.slice(0, 10), competition: alert.leagueName });
          const cornerGptUrl = `/corner-gpt?${params}`;
          return (
            <article key={alert.id} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2 py-1 font-bold text-primary">#{index + 1}</span>
                    <span className={`rounded-full border px-2 py-1 font-black ${gradeTone(assessment.grade)}`}>{assessment.grade} · {assessment.status}</span>
                    <span>{alert.leagueName}</span><span>•</span><span>{alert.startTime ? new Date(alert.startTime).toLocaleString('pt-BR') : 'Horário não informado'}</span>
                  </div>
                  <h2 className="mt-2 break-words text-xl font-black">{alert.homeTeam} x {alert.awayTeam}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.marketName} — {alert.selectionLabel}</p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border bg-emerald-500/5 p-3">
                      <div className="flex items-center gap-2 text-sm font-black"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Por que entrou no radar</div>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{assessment.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
                    </div>
                    <div className="rounded-xl border bg-amber-500/5 p-3">
                      <div className="flex items-center gap-2 text-sm font-black"><AlertTriangle className="h-4 w-4 text-amber-500" /> Pontos de cautela</div>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{assessment.risks.length ? assessment.risks.map((risk) => <li key={risk}>• {risk}</li>) : <li>• Nenhum risco adicional identificado pelo radar de preço.</li>}</ul>
                    </div>
                  </div>
                </div>

                <div className="grid min-w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:min-w-[430px]">
                  <Metric label="Score Radar" value={`${assessment.score}/100`} />
                  <Metric label="Melhor casa" value={alert.bestBookmaker} />
                  <Metric label="Melhor odd" value={alert.bestOdd.toFixed(2)} />
                  <Metric label="Acima da mediana" value={`+${alert.edgePct.toFixed(1)}%`} />
                  <Metric label="Confiança da fonte" value={confidenceLabel(alert.confidence)} />
                  <Metric label="Casas comparadas" value={String(alert.bookmakersCompared)} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
                {isCornerMarket(alert) && <Link href={cornerGptUrl} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><BrainCircuit className="h-4 w-4" /> Validar no CornerGPT <ArrowRight className="h-4 w-4" /></Link>}
                <Link href={`/odds-intelligence?${params}`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><Target className="h-4 w-4" /> Comparar casas</Link>
                <Link href={`/market-replay?home=${encodeURIComponent(alert.homeTeam)}&away=${encodeURIComponent(alert.awayTeam)}`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><ShieldCheck className="h-4 w-4" /> Movimento das odds</Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 truncate font-black" title={value}>{value}</div></div>;
}
