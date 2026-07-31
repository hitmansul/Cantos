import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // A rota enriquecida consulta internamente a fonte bruta da 365Scores.
  // Chamadas internas do servidor não possuem os cabeçalhos Sec-Fetch-* do navegador
  // e devem seguir para a rota original para evitar recursão.
  if (pathname === '/api/365scores/live' && !request.headers.get('sec-fetch-mode')) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/api/live/enriched';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/api/live', '/api/365scores/live'],
};
