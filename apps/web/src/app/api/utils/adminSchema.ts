import sql from '@/app/api/utils/sql';

export async function ensureAdminSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      email TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      admin_password_hash TEXT,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS user_id TEXT`;
  await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS admin_password_hash TEXT`;
  await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_change_password INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)`;
  await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)`;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_unique_idx
    ON admin_users (LOWER(email))
  `;
}

export async function ensureAdminUser(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  await ensureAdminSchema();

  const existing = await sql`
    SELECT id, email FROM admin_users
    WHERE LOWER(email) = ${normalizedEmail}
    LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE admin_users
      SET is_active = 1, updated_at = ${new Date().toISOString()}
      WHERE id = ${(existing[0] as { id: number }).id}
    `;
    return existing[0] as { id: number; email: string };
  }

  const inserted = await sql`
    INSERT INTO admin_users (user_id, email, is_active, must_change_password, created_at, updated_at)
    VALUES (${`local_${normalizedEmail}`}, ${normalizedEmail}, 1, 0, ${new Date().toISOString()}, ${new Date().toISOString()})
    RETURNING id, email
  `;

  return inserted[0] as { id: number; email: string };
}
