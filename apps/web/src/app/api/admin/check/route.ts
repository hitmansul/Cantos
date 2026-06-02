import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/app/api/utils/adminAuth';

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          isAdmin: false,
          error:
            'Banco de dados nao configurado. Configure DATABASE_URL na Vercel para usar o admin.',
        },
        { status: 503 }
      );
    }

    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    return NextResponse.json({ isAdmin: true, user: session });
  } catch (error) {
    console.error('Admin check error:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('admin_users') || message.includes('relation')) {
      return NextResponse.json(
        {
          isAdmin: false,
          error:
            'Tabela de administradores nao encontrada. Execute a configuracao/migracao do banco antes de acessar o admin.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}
