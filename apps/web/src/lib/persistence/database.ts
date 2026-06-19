import sql from '@/app/api/utils/sql';

export class PersistentDatabaseNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL nao esta configurado.');
    this.name = 'PersistentDatabaseNotConfiguredError';
  }
}

export function isPersistentDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function assertPersistentDatabaseConfigured(): void {
  if (!isPersistentDatabaseConfigured()) {
    throw new PersistentDatabaseNotConfiguredError();
  }
}

export async function pingPersistentDatabase(): Promise<boolean> {
  assertPersistentDatabaseConfigured();
  const result = await sql`SELECT 1 AS ok`;
  return Number(result[0]?.ok) === 1;
}

export async function touchDataSource(sourceKey: string, error?: string): Promise<void> {
  assertPersistentDatabaseConfigured();
  if (error) {
    await sql`
      UPDATE data_sources
      SET last_error = ${error}, updated_at = NOW()
      WHERE source_key = ${sourceKey}
    `;
    return;
  }

  await sql`
    UPDATE data_sources
    SET last_success_at = NOW(), last_error = NULL, updated_at = NOW()
    WHERE source_key = ${sourceKey}
  `;
}
