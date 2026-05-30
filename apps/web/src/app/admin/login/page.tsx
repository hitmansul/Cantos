'use client';

import { useState } from 'react';
import { Shield, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('hitmansul@gmail.com');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        redirectTo?: string;
        mustChangePassword?: boolean;
      };

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Erro ao fazer login');
        return;
      }

      // Redirect (hard navigation so the new cookie is sent)
      window.location.href = data.redirectTo ?? '/admin';
    } catch {
      setError('Erro de rede. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-emerald-500/20 rounded-full p-4">
              <Shield className="w-10 h-10 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin — Cantos</h1>
          <p className="text-slate-400 text-sm mt-1">Acesso restrito ao painel administrativo</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={(e) => {
            void handleLogin(e);
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              placeholder="admin@email.com"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 pr-10 text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                placeholder="Sua senha"
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

          <Button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrando...
              </span>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>

        {/* Setup link */}
        <p className="text-center text-xs text-slate-500">
          Senha não configurada?{' '}
          <a href="/admin/setup" className="text-emerald-400 hover:text-emerald-300 underline">
            Configurar agora
          </a>
        </p>

        <p className="text-center text-xs text-slate-500">
          Sem acesso?{' '}
          <a href="/admin/emergency" className="text-amber-400 hover:text-amber-300 underline">
            ⚡ Acesso de emergência via CRON_SECRET
          </a>
        </p>

        {/* Back */}
        <div className="flex justify-center">
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao app
          </a>
        </div>
      </div>
    </div>
  );
}
