import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('/api/odds/world-cup', () => {
  it('does not return estimated odds when no real provider is configured', async () => {
    const previousOddsApiKey = process.env.ODDS_API_KEY;
    const previousTheOddsApiKey = process.env.THE_ODDS_API_KEY;
    delete process.env.ODDS_API_KEY;
    delete process.env.THE_ODDS_API_KEY;

    try {
      const response = await GET();
      const body = await response.json();

      expect(body.configured).toBe(false);
      expect(body.source).toBe('not-configured');
      expect(body.events).toEqual([]);
      expect(body.note).toContain('nao mostra odds estimadas');
    } finally {
      if (previousOddsApiKey === undefined) delete process.env.ODDS_API_KEY;
      else process.env.ODDS_API_KEY = previousOddsApiKey;

      if (previousTheOddsApiKey === undefined) delete process.env.THE_ODDS_API_KEY;
      else process.env.THE_ODDS_API_KEY = previousTheOddsApiKey;
    }
  });
});
