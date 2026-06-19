import sql from '@/app/api/utils/sql';
import { assertPersistentDatabaseConfigured } from './database';

export type BookmakerInput = {
  key: string;
  name: string;
  sourceKey?: 'api-football' | '365scores';
  payload?: Record<string, unknown>;
};

export async function upsertBookmaker(bookmaker: BookmakerInput): Promise<void> {
  assertPersistentDatabaseConfigured();
  await sql`
    INSERT INTO bookmakers (bookmaker_key, name, source_key, source_payload)
    VALUES (
      ${bookmaker.key},
      ${bookmaker.name},
      ${bookmaker.sourceKey ?? 'api-football'},
      ${JSON.stringify(bookmaker.payload ?? {})}::jsonb
    )
    ON CONFLICT (bookmaker_key) DO UPDATE SET
      name = EXCLUDED.name,
      source_key = EXCLUDED.source_key,
      source_payload = EXCLUDED.source_payload,
      updated_at = NOW()
  `;
}
