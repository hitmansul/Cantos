'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDollarSign, Gauge, ShieldCheck, WalletCards } from 'lucide-react';
import {
  BANKROLL_VALUE_KEY,
  ENTRY_RISK_UNITS_KEY,
  formatUnits,
  readBettingUnitValue,
  readConfiguredDailyUnits,
  readConfiguredMonthlyUnits,
  readDailyLimitEnabled,
  readMonthlyLimitEnabled,
  saveBettingUnitValue,
  saveLimitSettings,
  unitsToStake,
} from '@/lib/unitSettings';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BankrollSettingsPage() {
  const [bankroll, setBankroll] = useState(1000);
  const [unitValue, setUnitValue] = useState(100);
  const [maxEntryUnits, setMaxEntryUnits] = useState(1);
  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [maxDailyUnits, setMaxDailyUnits] = useState(4);
  const [monthlyEnabled, setMonthlyEnabled] = useState(false);
  const [maxMonthlyUnits, setMaxMonthlyUnits] = useState(40);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUnitValue(readBettingUnitValue());
    setDailyEnabled(readDailyLimitEnabled());
    setMonthlyEnabled(readMonthlyLimitEnabled());
    setMaxDailyUnits(readConfiguredDailyUnits());
    setMaxMonthlyUnits(readConfiguredMonthlyUnits());
    const storedBankroll = Number(window.localStorage.getItem(BANKROLL_VALUE_KEY));
    const storedEntry = Number(window.localStorage.getItem(ENTRY_RISK_UNITS_KEY));
    if (Number.isFinite(storedBankroll) && storedBankroll > 0) setBankroll(storedBankroll);
    if (Number.isFinite(storedEntry) && storedEntry > 0) setMaxEntryUnits(storedEntry);
  }, []);

  function save() {
    saveBettingUnitValue(unitValue);
    window.localStorage.setItem(BANKROLL_VALUE_KEY, String(bankroll));
    window.localStorage.setItem(ENTRY_RISK_UNITS_KEY, String(maxEntryUnits));
    saveLimitSettings({ dailyEnabled, dailyUnits: maxDailyUnits, monthlyEnabled, monthlyUnits: maxMonthlyUnits });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  const unitPercent = bankroll > 0 ? unitValue / bankroll * 100 : 0;
  const valid = bankroll > 0 && unitValue > 0 && maxEntryUnits > 0 && (!dailyEnabled || maxDailyUnits > 0) && (!monthlyEnabled || maxMonthlyUnits > 0);

  return <main className="mx-auto min-h-screen w-full max-w-6xl px-3 py-6 sm:px-5 lg:px-8">
    <header><div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-black text-primary"><WalletCards className="h-4 w-4" /> Gestão padronizada de stake</div><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Configurações da Banca</h1><p className="mt-2 max-w-3xl text-muted-foreground">Defina o valor da unidade e escolha se deseja aplicar limites por entrada, por dia e por mês.</p></header>

    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Metric icon={WalletCards} label="Banca configurada" value={money.format(bankroll)} detail="Base financeira" />
      <Metric icon={CircleDollarSign} label="Valor de 1 U" value={money.format(unitValue)} detail={`${unitPercent.toFixed(1)}% da banca`} />
      <Metric icon={Gauge} label="Limite por entrada" value={formatUnits(maxEntryUnits)} detail={money.format(unitsToStake(maxEntryUnits, unitValue))} />
      <Metric icon={ShieldCheck} label="Limite diário" value={dailyEnabled ? formatUnits(maxDailyUnits) : 'Sem limite'} detail={dailyEnabled ? money.format(unitsToStake(maxDailyUnits, unitValue)) : 'Controle desativado'} />
      <Metric icon={ShieldCheck} label="Limite mensal" value={monthlyEnabled ? formatUnits(maxMonthlyUnits) : 'Sem limite'} detail={monthlyEnabled ? money.format(unitsToStake(maxMonthlyUnits, unitValue)) : 'Controle desativado'} />
    </section>

    <section className="mt-6 rounded-3xl border bg-card p-5 sm:p-7">
      <h2 className="text-xl font-black">Parâmetros principais</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Banca total (R$)" value={bankroll} onChange={setBankroll} step="0.01" />
        <Field label="Valor de 1 unidade (R$)" value={unitValue} onChange={setUnitValue} step="0.01" />
        <Field label="Máximo por entrada (U)" value={maxEntryUnits} onChange={setMaxEntryUnits} step="0.25" />
        <LimitField title="Limite diário" enabled={dailyEnabled} setEnabled={setDailyEnabled} value={maxDailyUnits} setValue={setMaxDailyUnits} />
        <LimitField title="Limite mensal" enabled={monthlyEnabled} setEnabled={setMonthlyEnabled} value={maxMonthlyUnits} setValue={setMaxMonthlyUnits} />
      </div>
      <button onClick={save} disabled={!valid} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-black text-primary-foreground disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Salvar configurações</button>
      {saved && <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-600">Configurações salvas e disponíveis para os demais módulos.</div>}
    </section>

    <section className="mt-6 rounded-3xl border bg-card p-5 sm:p-7"><h2 className="text-xl font-black">Tabela de conversão</h2><p className="mt-1 text-sm text-muted-foreground">Referência rápida usando a unidade configurada.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[0.25, 0.5, 0.75, 1, 1.5].map((units) => <div key={units} className="rounded-2xl bg-muted/50 p-4"><div className="text-2xl font-black">{formatUnits(units)}</div><div className="mt-1 text-sm text-muted-foreground">{money.format(unitsToStake(units, unitValue))}</div></div>)}</div></section>
  </main>;
}

function LimitField({ title, enabled, setEnabled, value, setValue }: { title: string; enabled: boolean; setEnabled: (value: boolean) => void; value: number; setValue: (value: number) => void }) {
  return <div className="rounded-2xl border p-4">
    <label className="flex items-center justify-between gap-4 font-bold"><span>{title}</span><span className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Ativar</span></label>
    <input type="number" min="0.25" step="0.25" value={value} disabled={!enabled} onChange={(event) => setValue(Number(event.target.value) || 0)} className="mt-3 min-h-11 w-full rounded-xl border bg-background px-3 disabled:cursor-not-allowed disabled:opacity-50" />
    <p className="mt-2 text-xs text-muted-foreground">{enabled ? `Controle ativo em ${formatUnits(value)}.` : 'Sem limite: o sistema não bloqueará novas entradas por este período.'}</p>
  </div>;
}

function Field({ label, value, onChange, step }: { label: string; value: number; onChange: (value: number) => void; step: string }) { return <label className="text-sm font-bold">{label}<input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" /></label>; }
function Metric({ icon: Icon, label, value, detail }: { icon: typeof WalletCards; label: string; value: string; detail: string }) { return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-2 text-2xl font-black">{value}</div><div className="text-xs text-muted-foreground">{detail}</div></div>; }
