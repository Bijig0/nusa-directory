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
if (url.startsWith('file:')) mkdirSync(url.slice(5).replace(/[^/]+$/, '') || '.', { recursive: true });
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
await migrate(drizzle(client), { migrationsFolder: './migrations' });
const tables = await client.execute("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'");
console.log(`migrated ${url} (${tables.rows[0]?.n} tables)`);
