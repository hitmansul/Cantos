import { NextRequest, NextResponse } from 'next/server';
import { runPostGamePipeline } from '@/lib/pipeline/postGamePipeline';

import { authorized as isAuthorized } from '@/lib/live/cronAuth';

function optionalInteger(value: string | null): number | undefined {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : undefined;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const result = await runPostGamePipeline({
      fifaStats: {
        pdfLimit: optionalInteger(searchParams.get('fifaLimit')),
        pdfOffset: optionalInteger(searchParams.get('fifaOffset')),
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido no pipeline pos-jogo.',
        ranAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
