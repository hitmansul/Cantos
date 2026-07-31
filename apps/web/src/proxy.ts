import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname !== '/api/365scores/live') return NextResponse.next();

  // Chamadas internas da camada de enriquecimento pedem explicitamente a fonte bruta.
  if (searchParams.get('raw') === '1') return NextResponse.next();

  // Apenas requisições vindas do navegador são enriquecidas. Dessa forma,
  // as rotas internas continuam estáveis e não entram em recursão.
  const isBrowserRequest = Boolean(request.headers.get('sec-fetch-mode'));
  if (!isBrowserRequest) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/api/live/corners-fast';
  url.search = '';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/api/365scores/live'],
};
