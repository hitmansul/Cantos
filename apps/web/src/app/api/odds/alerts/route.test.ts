import { describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET } from './route';

describe('/api/odds/alerts', () => {
  it('does not return estimated odds when API-Football is not configured', async () => {
    const previousApiFootballKey = process.env.API_FOOTBALL_KEY;
    const previousApiSportsKey = process.env.APISPORTS_KEY;
    const previousRapidApiKey = process.env.RAPIDAPI_KEY;
    delete process.env.API_FOOTBALL_KEY;
    delete process.env.APISPORTS_KEY;
    delete process.env.RAPIDAPI_KEY;

    try {
      const request = { nextUrl: new URL('http://localhost/api/odds/alerts') } as NextRequest;
      const response = await GET(request);
      const body = await response.json();

      expect(body.configured).toBe(false);
      expect(body.source).toBe('not-configured');
      expect(body.alerts).toEqual([]);
      expect(body.note).toContain('nao mostra odds estimadas');
    } finally {
      if (previousApiFootballKey === undefined) delete process.env.API_FOOTBALL_KEY;
      else process.env.API_FOOTBALL_KEY = previousApiFootballKey;

      if (previousApiSportsKey === undefined) delete process.env.APISPORTS_KEY;
      else process.env.APISPORTS_KEY = previousApiSportsKey;

      if (previousRapidApiKey === undefined) delete process.env.RAPIDAPI_KEY;
      else process.env.RAPIDAPI_KEY = previousRapidApiKey;
    }
  });
});
