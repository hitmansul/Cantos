import { NextRequest, NextResponse } from 'next/server';
import { listRecentCornerDecisions } from '@/lib/corners/decisionWarehouse';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : 50;

    if (!Number.isFinite(limit) || limit < 1) {
      return NextResponse.json(
        { ok: false, error: 'O parâmetro limit deve ser um número positivo.' },
        { status: 400 },
      );
    }

    const decisions = await listRecentCornerDecisions(limit);

    return NextResponse.json({
      ok: true,
      count: decisions.length,
      decisions,
      warehouseEnabled: Boolean(process.env.DATABASE_URL),
    });
  } catch (error) {
    console.error('Falha ao consultar o histórico de decisões:', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível consultar o histórico de decisões.' },
      { status: 500 },
    );
  }
}
