import { createClient } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export type Db = LibSQLDatabase<typeof schema>;

/** Turso in production (`libsql://…` + token), an embedded SQLite file locally (`file:.data/dev.db`). */
export const makeDb = (url: string, authToken?: string): Db => {
  if (url.startsWith('file:')) ensureDir(url.slice(5));
  return drizzle(createClient({ url, authToken }), { schema });
};

const ensureDir = (filePath: string): void => {
  try {
    // Lazy require keeps this module importable in non-Node bundles (the check is dev-only anyway).
    const fs = require('node:fs') as typeof import('node:fs');
    const dir = filePath.replace(/[^/]+$/, '');
    if (dir) fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
};

/** Rows affected by a write, across drivers (libSQL: rowsAffected; D1: meta.changes). */
export const changesOf = (result: unknown): number => {
  const r = result as { rowsAffected?: number; meta?: { changes?: number } };
  return Number(r.rowsAffected ?? r.meta?.changes ?? 0);
};

export { schema };
