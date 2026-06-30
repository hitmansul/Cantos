import { NextRequest, NextResponse } from 'next/server';
import { getFifaWorldCupSquads } from '@/lib/fifaWorldCup';
import { runPostGamePipeline } from '@/lib/pipeline/postGamePipeline';

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV === 'development';
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const { searchParams } = new URL(request.url);
  return searchParams.get('secret') === cronSecret;
}

async function runWorldCupFifaPmsrSync(baseUrl: string) {
  const url = `${baseUrl}/api/world-cup/fifa-pmsr-sync?dryRun=false&onlyMissing=true&mode=both&limit=20&maxMatchNumber=104`;
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') }));
  return { success: response.ok, status: response.status, url, ...payload };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const task = searchParams.get('task') as 'import' | 'fill' | 'all' | 'fifa' | null;
  const baseUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL ?? request.nextUrl.origin ?? 'http://localhost:3000';

  try {
    const fifaRefresh = await getFifaWorldCupSquads(true)
      .then((data) => ({
        success: true,
        totalTeams: data.totalTeams,
        totalPlayers: data.totalPlayers,
        lastModified: data.source.lastModified,
        fallback: data.source.fallback ?? false,
        fallbackReason: data.source.fallbackReason,
      }))
      .catch((error) => ({ success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar FIFA' }));

    const worldCupPmsr = await runWorldCupFifaPmsrSync(baseUrl).catch((error) => ({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao sincronizar PMSR FIFA.',
    }));

    if (task === 'fifa' || !process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          success: fifaRefresh.success || worldCupPmsr.success,
          fifa: fifaRefresh,
          worldCupPmsr,
          sync: { skipped: !process.env.DATABASE_URL, reason: !process.env.DATABASE_URL ? 'DATABASE_URL nao configurado.' : 'Sincronizacao FIFA executada.' },
          timestamp: new Date().toISOString(),
        },
        { status: fifaRefresh.success || worldCupPmsr.success ? 200 : 500 }
      );
    }

    const postGamePipeline = await runPostGamePipeline().catch((error) => ({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao executar pipeline persistente.',
    }));

    const res = await fetch(`${baseUrl}/api/admin/sync-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-cron': process.env.CRON_SECRET ?? '' },
      body: JSON.stringify({ task: task ?? 'all', limit: 30 }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ success: false, fifa: fifaRefresh, worldCupPmsr, error: `sync-all returned ${res.status}: ${errText}` }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, fifa: fifaRefresh, worldCupPmsr, persistentPipeline: postGamePipeline, ...data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[CRON] Erro:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }, { status: 500 });
  }
}
