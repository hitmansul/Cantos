import Link from 'next/link';

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
        <h1 className="text-2xl font-bold">Cadastro desativado</h1>
        <p className="mt-3 text-sm text-slate-400">
          O app publico esta liberado sem cadastro. A area de contas fica para uma proxima etapa.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Ir para o app
        </Link>
      </section>
    </main>
  );
}
