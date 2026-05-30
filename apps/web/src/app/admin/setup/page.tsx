'use client';

import { useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, Eye, EyeOff, Copy, Check, Zap } from 'lucide-react';

export default function AdminSetupPage() {
  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    tempPassword?: string;
    isTemp?: boolean;
  } | null>(null);

  const callSetup = async (payload: {
    secret: string;
    password?: string;
    generateTemp?: boolean;
  }) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
        tempPassword?: string;
        isTemp?: boolean;
      };
      setResult({
        success: res.ok && !!data.success,
        message: data.message,
        error: data.error,
        tempPassword: data.tempPassword,
        isTemp: data.isTemp,
      });
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Erro de rede' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    await callSetup({ secret, password });
  };

  const handleGenerateTemp = async () => {
    if (!secret) {
      setResult({ success: false, error: 'Preencha o CRON_SECRET primeiro' });
      return;
    }
    await callSetup({ secret, generateTemp: true });
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 max-w-lg w-full space-y-5">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Configurar Senha Admin</h1>
            <p className="text-slate-400 text-sm">Defina a senha de acesso ao painel admin</p>
          </div>
        </div>

        {!result ? (
          <div className="space-y-5">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300">
              ⚠️ Use o valor do <strong>CRON_SECRET</strong> das suas Secrets do projeto para
              autorizar esta operação.
            </div>

            {/* CRON_SECRET — shared by both actions */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">CRON_SECRET</label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Seu CRON_SECRET"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Option 1 — Generate temp password */}
            <div className="bg-slate-700/40 border border-amber-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <p className="text-sm font-semibold text-white">Gerar senha temporária</p>
              </div>
              <p className="text-xs text-slate-400">
                Gera uma senha segura automaticamente. Você precisará trocá-la no primeiro login.
              </p>
              <button
                type="button"
                onClick={() => void handleGenerateTemp()}
                disabled={loading || !secret}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition text-sm"
              >
                {loading ? 'Gerando…' : '⚡ Gerar senha temporária'}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-500">ou escolha sua própria senha</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            {/* Option 2 — Manual password */}
            <form
              onSubmit={(e) => {
                void handleManualSetup(e);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Nova Senha (mín. 8 caracteres)
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Escolha uma senha forte"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 pr-10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition text-sm"
              >
                {loading ? 'Configurando…' : 'Configurar Senha'}
              </button>
            </form>
          </div>
        ) : result.success ? (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-300">
                  {result.isTemp ? '⚡ Senha temporária gerada!' : '✅ Senha configurada!'}
                </p>
                <p className="text-sm text-emerald-400 mt-1">{result.message}</p>
              </div>
            </div>

            {/* Temp password display */}
            {result.isTemp && result.tempPassword && (
              <div className="bg-slate-700 border border-amber-500/40 rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-amber-300 uppercase tracking-wider">
                  🔑 Sua senha temporária — anote agora!
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xl font-mono font-bold text-white tracking-widest bg-slate-800 rounded-lg px-4 py-3 text-center select-all">
                    {result.tempPassword}
                  </code>
                  <button
                    onClick={() => handleCopy(result.tempPassword!)}
                    className="p-3 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors shrink-0"
                    title="Copiar senha"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-300" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-amber-400">
                  ⚠️ Esta senha não será exibida novamente. Copie antes de sair!
                </p>
              </div>
            )}

            <a
              href="/admin/login"
              className="block w-full text-center bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition text-sm"
            >
              Ir para Login →
            </a>
            <button
              onClick={() => setResult(null)}
              className="w-full border border-slate-600 text-slate-400 hover:bg-slate-700 py-2.5 rounded-lg transition text-sm"
            >
              Configurar novamente
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-300">❌ Erro</p>
                <p className="text-sm text-red-400 mt-1">{result.error}</p>
              </div>
            </div>
            <button
              onClick={() => setResult(null)}
              className="w-full border border-slate-600 text-slate-300 hover:bg-slate-700 py-3 rounded-lg transition text-sm"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
