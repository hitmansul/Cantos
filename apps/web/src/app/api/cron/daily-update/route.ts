import { NextRequest, NextResponse } from 'next/server';

// ── Auth ──────────────────────────────────────────────────────────────────────
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV === 'development';
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') === cronSecret) return true;
  return false;
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const task = searchParams.get('task') as 'import' | 'fill' | 'all' | null;

  const baseUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL ?? 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/admin/sync-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass cron secret as admin auth for internal calls
        'x-admin-cron': process.env.CRON_SECRET ?? '',
      },
      body: JSON.stringify({ task: task ?? 'all', limit: 30 }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { success: false, error: `sync-all returned ${res.status}: ${errText}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, ...data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[CRON] Erro:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
