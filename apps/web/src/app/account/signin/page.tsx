'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

function SignInForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  // Email/password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const relativeCallback = callbackUrl.startsWith('/') ? callbackUrl : `/${callbackUrl}`;

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: relativeCallback,
      });
    } catch (err) {
      console.error('Google sign-in exception:', err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(msg);
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const result = await authClient.signUp.email({
          email,
          password,
          name: email.split('@')[0],
          callbackURL: relativeCallback,
        });
        if (result.error) {
          setError(result.error.message ?? 'Erro ao criar conta');
          setEmailLoading(false);
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: relativeCallback,
        });
        if (result.error) {
          setError(result.error.message ?? 'Email ou senha incorretos');
          setEmailLoading(false);
          return;
        }
      }
      router.push(relativeCallback);
    } catch (err) {
      console.error('Email auth exception:', err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(msg);
      setEmailLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-900 p-[16px]">
      <div className="flex w-full max-w-[400px] flex-col gap-[20px] rounded-[16px] bg-slate-800 p-[32px] shadow-xl border border-slate-700">
        <div className="text-center">
          <div className="text-[32px] mb-[8px]">⚽</div>
          <h1 className="text-[22px] font-bold text-white">Cantos IA</h1>
          <p className="text-[14px] text-slate-400 mt-[4px]">
            {mode === 'signin' ? 'Entre na sua conta' : 'Criar nova conta'}
          </p>
        </div>

        {/* Email/Password Form */}
        <form
          onSubmit={(e) => {
            void handleEmailAuth(e);
          }}
          className="flex flex-col gap-[12px]"
        >
          <div>
            <label className="text-[12px] font-medium text-slate-300 block mb-[6px]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="w-full rounded-[8px] border border-slate-600 bg-slate-700 px-[12px] py-[10px] text-[14px] text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-300 block mb-[6px]">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={8}
              className="w-full rounded-[8px] border border-slate-600 bg-slate-700 px-[12px] py-[10px] text-[14px] text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={emailLoading}
            className="w-full rounded-[8px] bg-emerald-500 px-[16px] py-[11px] text-[15px] font-semibold text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {emailLoading
              ? mode === 'signin'
                ? 'Entrando…'
                : 'Criando conta…'
              : mode === 'signin'
                ? 'Entrar'
                : 'Criar conta'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
          }}
          className="text-[13px] text-slate-400 hover:text-slate-200 text-center transition-colors"
        >
          {mode === 'signin' ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-[12px]">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-[12px] text-slate-500">ou</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* Google Button */}
        <button
          type="button"
          disabled={googleLoading}
          onClick={() => {
            void handleGoogleSignIn();
          }}
          className="flex w-full items-center justify-center gap-[10px] rounded-[8px] border border-slate-600 bg-slate-700 px-[16px] py-[10px] text-[14px] font-medium text-slate-200 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <span>Redirecionando…</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar com Google
            </>
          )}
        </button>

        {error && (
          <div className="rounded-[8px] bg-red-900/40 border border-red-500/40 p-[12px] text-[13px] text-red-300">
            <p className="font-semibold mb-[4px]">❌ Erro ao entrar</p>
            <p className="break-all">{error}</p>
            {error.toLowerCase().includes('redirect') ||
            error.toLowerCase().includes('oauth') ||
            error.toLowerCase().includes('google') ? (
              <div className="mt-[8px] p-[8px] bg-red-950/50 rounded text-[12px] text-red-400">
                <p className="font-semibold">URI de callback necessária no Google Cloud Console:</p>
                <code className="block mt-[4px] break-all text-yellow-300">
                  https://cantos-ia.created.app/api/auth/callback/google
                </code>
                <p className="mt-[4px]">Use o login por email/senha acima enquanto resolve isso.</p>
              </div>
            ) : null}
          </div>
        )}

        <p className="text-[11px] text-slate-600 text-center">
          Para acesso admin, use o mesmo email cadastrado como administrador.
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
