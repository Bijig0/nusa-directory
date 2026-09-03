/// <reference types="node" />
/**
 * Applies ./migrations to the database in TURSO_DATABASE_URL (Turso, or a local file: URL).
 * Usage: bun run db:migrate        (reads .env automatically under bun)
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdirSync } from 'node:fs';

const url = process.env.TURSO_DATABASE_URL ?? 'file:.data/dev.db';
const token = process.env.TURSO_AUTH_TOKEN;
if (/REPLACE-ME/i.test(url) || /REPLACE-ME/i.test(token ?? '')) {
  console.error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN still contain the REPLACE-ME placeholder. Create the database at https://app.turso.tech and set the real libsql:// URL and token.');
  process.exit(1);
}
if (url.startsWith('libsql://') && !token) {
  console.error('TURSO_AUTH_TOKEN is missing for a remote Turso database.');
  process.exit(1);
}
if (url.startsWith('file:')) mkdirSync(url.slice(5).replace(/[^/]+$/, '') || '.', { recursive: true });
const client = createClient({ url, authToken: token });
try {
  await client.execute('SELECT 1');
} catch (error) {
  console.error(`Cannot reach the database at ${url.replace(/\/\/.*@/, '//')}: ${describe(error)}`);
  console.error('Checks: TURSO_DATABASE_URL must be the libsql:// URL of the database, and TURSO_AUTH_TOKEN a *database* token from its page (not the platform/API token).');
  process.exit(1);
}
try {
  await migrate(drizzle(client), { migrationsFolder: './migrations' });
} catch (error) {
  console.error(`Migration failed: ${describe(error)}`);
  process.exit(1);
}

function describe(error: unknown): string {
  const parts: string[] = [];
  let e: unknown = error;
  for (let i = 0; i < 5 && e; i++) {
    const o = e as { message?: string; status?: number; code?: string; cause?: unknown };
    parts.push([o.code, o.status ? `HTTP ${o.status}` : undefined, o.message?.split('\n')[0]].filter(Boolean).join(' '));
    e = o.cause;
  }
  return parts.filter(Boolean).join(' <- ');
}
const tables = await client.execute("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'");
console.log(`migrated ${url} (${tables.rows[0]?.n} tables)`);
