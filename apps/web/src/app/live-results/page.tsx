'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type Metric = {dimension:string;band:string;samples:number;hits_5m:number;measurable_5m:number;hits_10m:number;measurable_10m:number;inconclusive_10m:number;pending_10m:number;predicted_percent:number|null;actual_percent:number|null};
type RecordRow = {evaluation_key:string;fixture:string;competition:string|null;recorded_at:string;match_minute:number;score:number;probability:number|null;confidence:string;corners_before:number;outcome_5m:string;outcome_10m:string;reason_5m:string|null;reason_10m:string|null};
const reasons:Record<string,string> = {
  'invalid-baseline':'Contagem inicial inválida',
  'window-open':'Janela ainda em andamento',
  'coverage-gap-or-source-correction':'Lacuna nas observações, troca de fonte ou correção dos dados',
  'increase-observed-inside-window':'Novo escanteio observado dentro da janela',
  'increase-straddles-deadline':'Aumento observado após o limite; horário do escanteio incerto',
  'unchanged-counter-covers-deadline':'Contagem sem aumento até uma observação que cobre o limite',
  'awaiting-boundary-observation':'Aguardando observação no limite da janela',
  'missing-boundary-observation':'Sem observação suficiente para fechar a janela',
  'expired-evidence':'Prazo para obter evidência expirou',
};
function Outcome({value,reason}:{value:string;reason:string|null}) {
  const labels:Record<string,string>={hit:'Acerto',miss:'Sem novo escanteio',pending:'Em avaliação',inconclusive:'Inconclusivo'};
  return <div><span className={value==='hit'?'text-emerald-400':value==='miss'?'text-rose-400':'text-amber-400'}>{labels[value]||'Não disponível'}</span><p className="mt-1 text-xs text-muted-foreground">{reason ? reasons[reason]||'Motivo não identificado' : value==='pending'?'Aguardando apuração':'Motivo não registrado'}</p></div>;
}
function rate(hits:number,total:number) {return total>0?`${(100*hits/total).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`:'Sem amostra válida';}
export default function LiveResultsPage() {
  const [metrics,setMetrics]=useState<Metric[]>([]),[rows,setRows]=useState<RecordRow[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[updated,setUpdated]=useState('');
  const request=useRef<AbortController|null>(null);
  const load=useCallback(async()=>{
    if(request.current)return;
    const controller=new AbortController();request.current=controller;setLoading(true);setError('');
    const timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const responses=await Promise.all(['performance','history'].map(async path=>{
        const response=await fetch(`/api/live/recommendations/${path}`,{signal:controller.signal,cache:'no-store'});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao carregar resultados');return data;
      }));
      if(controller.signal.aborted)return;
      setMetrics(responses[0].rows);setRows(responses[1].rows);setUpdated(new Date().toISOString());
    }catch {if(request.current===controller)setError('Não foi possível atualizar. Tente novamente. Os dados anteriores, se houver, permanecem abaixo.');}
    finally{clearTimeout(timeout);if(request.current===controller){request.current=null;setLoading(false);}}
  },[]);
  useEffect(()=>{void load();return()=>{const active=request.current;request.current=null;active?.abort();};},[load]);
  const all=metrics.find(r=>r.dimension==='all');
  const cards=[['Oportunidades na amostra',all?.samples??0],['Acerto em até 5 min',rate(all?.hits_5m??0,all?.measurable_5m??0)],['Acerto em até 10 min',rate(all?.hits_10m??0,all?.measurable_10m??0)],['Inconclusivas em 10 min',all?.inconclusive_10m??0]];
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-400">IA Cantos · Motor Central</p><h1 className="mt-1 text-3xl font-black">Resultados das oportunidades</h1><p className="mt-2 text-muted-foreground">Veja o que a IA recomendou e o que foi observado nos 5 e 10 minutos seguintes.</p></div><div className="flex gap-3"><Link className="rounded-xl border px-4 py-3" href="/live-history">Ver partidas ao vivo</Link><button className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={loading} onClick={()=>void load()}>{loading?'Carregando…':'Atualizar'}</button></div></header>
    {error&&<p role="alert" className="rounded-xl border border-amber-500 p-4 text-amber-400">{error}</p>}
    {updated&&<p className="text-xs text-muted-foreground">Consultado em {new Date(updated).toLocaleString('pt-BR')} · Últimos 30 dias · Atualização manual</p>}
    {loading&&!updated?<p role="status">Consultando resultados registrados…</p>:updated&&<>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label,value])=><div key={label} className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</section>
      <section className="rounded-2xl border border-border bg-card p-5 text-sm"><h2 className="font-bold">Como interpretar</h2><p className="mt-2">Acerto significa novo escanteio observado dentro da janela. Casos inconclusivos e em avaliação ficam fora da taxa de acerto. Sem observações suficientes, não registramos vitória nem derrota.</p><p className="mt-2 text-muted-foreground">Amostra: primeira OPORTUNIDADE de cada partida em cada bloco de 10 minutos UTC. As janelas podem se sobrepor; as amostras não são independentes. A probabilidade prevista se refere a 10 minutos e ainda é heurística.</p><p className="mt-2">Base mensurável: {all?.measurable_5m??0} em 5 min e {all?.measurable_10m??0} em 10 min. Em avaliação (10 min): {all?.pending_10m??0}.</p></section>
      <section><h2 className="mb-3 text-xl font-bold">Últimas oportunidades</h2><p className="mb-3 text-sm text-muted-foreground">Até 100 registros da mesma amostra usada nos indicadores. Os indicadores abrangem todos os registros elegíveis dos últimos 30 dias.</p>{!rows.length?<div className="rounded-2xl border p-6">Ainda não há oportunidades registradas nesta amostra. As partidas continuam sendo acompanhadas; uma oportunidade exige dados suficientes e os critérios conservadores da IA.</div>:<div className="grid gap-4 lg:grid-cols-2">{rows.map(row=><article key={row.evaluation_key} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-bold">{row.fixture}</h3><span className="text-sm">{row.match_minute}′</span></div><p className="text-xs text-muted-foreground">{row.competition||'Competição não informada'} · {new Date(row.recorded_at).toLocaleString('pt-BR')}</p><p className="my-4 text-sm">Força {row.score} · Probabilidade {row.probability==null?'—':`${row.probability}%`} · Confiança {row.confidence} · Escanteios iniciais {row.corners_before}</p><div className="grid grid-cols-2 gap-4 border-t pt-3"><div><p className="mb-2 text-xs font-bold">ATÉ 5 MINUTOS</p><Outcome value={row.outcome_5m} reason={row.reason_5m}/></div><div><p className="mb-2 text-xs font-bold">ATÉ 10 MINUTOS</p><Outcome value={row.outcome_10m} reason={row.reason_10m}/></div></div></article>)}</div>}</section>
      <section className="overflow-x-auto rounded-2xl border p-5"><h2 className="mb-3 text-xl font-bold">Probabilidade prevista × resultado em 10 min</h2><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Faixa prevista</th><th className="p-2">Amostras</th><th className="p-2">Mensuráveis</th><th className="p-2">Acerto observado</th></tr></thead><tbody>{metrics.filter(r=>r.dimension==='probability').map(r=><tr key={r.band} className="border-t"><td className="p-2">{r.band}–{Math.min(100,Number(r.band)+9)}%</td><td className="p-2">{r.samples}</td><td className="p-2">{r.measurable_10m}</td><td className="p-2">{rate(r.hits_10m,r.measurable_10m)}</td></tr>)}</tbody></table></section>
    </>}
  </main>;
}
