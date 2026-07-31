import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/api/live/enriched';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/api/live'],
};
