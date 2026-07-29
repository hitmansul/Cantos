'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDollarSign, Gauge, ShieldCheck, WalletCards } from 'lucide-react';
import { formatUnits, readBettingUnitValue, saveBettingUnitValue, unitsToStake } from '@/lib/unitSettings';

const BANKROLL_KEY = 'ia-cantos-performance-bankroll-v1';
const RISK_LIMIT_KEY = 'ia-cantos-daily-risk-units-v1';
const ENTRY_LIMIT_KEY = 'ia-cantos-entry-risk-units-v1';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BankrollSettingsPage() {
  const [bankroll, setBankroll] = useState(1000);
  const [unitValue, setUnitValue] = useState(100);
  const [maxEntryUnits, setMaxEntryUnits] = useState(1);
  const [maxDailyUnits, setMaxDailyUnits] = useState(4);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUnitValue(readBettingUnitValue());
    const storedBankroll = Number(window.localStorage.getItem(BANKROLL_KEY));
    const storedEntry = Number(window.localStorage.getItem(ENTRY_LIMIT_KEY));
    const storedDaily = Number(window.localStorage.getItem(RISK_LIMIT_KEY));
    if (Number.isFinite(storedBankroll) && storedBankroll > 0) setBankroll(storedBankroll);
    if (Number.isFinite(storedEntry) && storedEntry > 0) setMaxEntryUnits(storedEntry);
    if (Number.isFinite(storedDaily) && storedDaily > 0) setMaxDailyUnits(storedDaily);
  }, []);

  function save() {
    saveBettingUnitValue(unitValue);
    window.localStorage.setItem(BANKROLL_KEY, String(bankroll));
    window.localStorage.setItem(ENTRY_LIMIT_KEY, String(maxEntryUnits));
    window.localStorage.setItem(RISK_LIMIT_KEY, String(maxDailyUnits));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  const unitPercent = bankroll > 0 ? unitValue / bankroll * 100 : 0;

  return <main className="mx-auto min-h-screen w-full max-w-6xl px-3 py-6 sm:px-5 lg:px-8">
    <header><div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-black text-primary"><WalletCards className="h-4 w-4" /> Gestão padronizada de stake</div><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Configurações da Banca</h1><p className="mt-2 max-w-3xl text-muted-foreground">Defina uma vez o valor da sua unidade. Toda entrada poderá ser apresentada simultaneamente em unidades e reais.</p></header>

    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={WalletCards} label="Banca configurada" value={money.format(bankroll)} detail="Base financeira" /><Metric icon={CircleDollarSign} label="Valor de 1 U" value={money.format(unitValue)} detail={`${unitPercent.toFixed(1)}% da banca`} /><Metric icon={Gauge} label="Limite por entrada" value={formatUnits(maxEntryUnits)} detail={money.format(unitsToStake(maxEntryUnits, unitValue))} /><Metric icon={ShieldCheck} label="Limite diário" value={formatUnits(maxDailyUnits)} detail={money.format(unitsToStake(maxDailyUnits, unitValue))} /></section>

    <section className="mt-6 rounded-3xl border bg-card p-5 sm:p-7"><h2 className="text-xl font-black">Parâmetros principais</h2><div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label="Banca total (R$)" value={bankroll} onChange={setBankroll} step="0.01" />
      <Field label="Valor de 1 unidade (R$)" value={unitValue} onChange={setUnitValue} step="0.01" />
      <Field label="Máximo por entrada (U)" value={maxEntryUnits} onChange={setMaxEntryUnits} step="0.25" />
      <Field label="Máximo por dia (U)" value={maxDailyUnits} onChange={setMaxDailyUnits} step="0.25" />
    </div><button onClick={save} disabled={bankroll <= 0 || unitValue <= 0 || maxEntryUnits <= 0 || maxDailyUnits <= 0} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-black text-primary-foreground disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Salvar configurações</button>{saved && <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-600">Configurações salvas e disponíveis para os demais módulos.</div>}</section>

    <section className="mt-6 rounded-3xl border bg-card p-5 sm:p-7"><h2 className="text-xl font-black">Tabela de conversão</h2><p className="mt-1 text-sm text-muted-foreground">Referência rápida usando a unidade configurada.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[0.25, 0.5, 0.75, 1, 1.5].map((units) => <div key={units} className="rounded-2xl bg-muted/50 p-4"><div className="text-2xl font-black">{formatUnits(units)}</div><div className="mt-1 text-sm text-muted-foreground">{money.format(unitsToStake(units, unitValue))}</div></div>)}</div></section>
  </main>;
}

function Field({ label, value, onChange, step }: { label: string; value: number; onChange: (value: number) => void; step: string }) { return <label className="text-sm font-bold">{label}<input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" /></label>; }
function Metric({ icon: Icon, label, value, detail }: { icon: typeof WalletCards; label: string; value: string; detail: string }) { return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-2 text-2xl font-black">{value}</div><div className="text-xs text-muted-foreground">{detail}</div></div>; }
