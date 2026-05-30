'use client';

import { useState } from 'react';
import { Zap, Eye, EyeOff, CheckCircle, AlertTriangle, Lock } from 'lucide-react';

export default function AdminEmergencyPage() {
  const [secret, setSecret] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message?: string;
    error?: string;
    redirectTo?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: secret.trim(),
          email: 'hitmansul@gmail.com',
          newPassword: newPassword || undefined,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        redirectTo?: string;
      };

      if (!res.ok || !data.success) {
        setResult({ ok: false, error: data.error ?? `Erro ${res.status}` });
        return;
      }

      setResult({ ok: true, message: data.message, redirectTo: data.redirectTo });

      // Auto-redirect after a brief pause so user sees the success
      setTimeout(() => {
        window.location.href = data.redirectTo ?? '/admin';
      }, 1800);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : 'Erro de rede' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-2xl mb-4">
            <Zap className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Acesso de Emergência</h1>
          <p className="text-slate-400 text-sm mt-1">
            Use o <span className="font-mono text-amber-300">CRON_SECRET</span> para entrar direto e
            definir uma nova senha.
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
          {!result ? (
            <form
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="space-y-4"
            >
              {/* CRON_SECRET */}
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">
                  CRON_SECRET
                  <span className="text-slate-500 ml-1">(nas Secrets do projeto)</span>
                </label>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  required
                  placeholder="Cole o CRON_SECRET aqui"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* New password */}
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">
                  Nova Senha <span className="text-slate-500">(opcional — mín. 8 caracteres)</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    placeholder="Deixe em branco para só entrar sem definir senha"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-10 py-2.5 text-white text-sm placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Se informar uma senha, ela será salva e você poderá usar o login normal depois.
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300">
                🔐 Esta página usa o <strong>CRON_SECRET</strong> para autenticar diretamente, sem
                precisar de email/senha. Use só para recuperação de acesso.
              </div>

              <button
                type="submit"
                disabled={loading || !secret}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Processando…
                  </span>
                ) : (
                  '⚡ Entrar no Admin'
                )}
              </button>

              <div className="text-center">
                <a
                  href="/admin/login"
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ← Voltar para o login normal
                </a>
              </div>
            </form>
          ) : result.ok ? (
            <div className="space-y-4 text-center py-2">
              <div className="flex justify-center">
                <CheckCircle className="w-14 h-14 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">Acesso liberado!</p>
                <p className="text-slate-400 text-sm mt-1">{result.message}</p>
                <p className="text-slate-500 text-xs mt-2">Redirecionando para /admin…</p>
              </div>
              <a
                href="/admin"
                className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-lg transition text-sm"
              >
                Ir para o Admin agora →
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-red-300">Erro</p>
                  <p className="text-sm text-red-400 mt-1 break-all">{result.error}</p>
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
    </div>
  );
}
