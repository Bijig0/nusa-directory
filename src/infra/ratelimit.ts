import { sql } from 'drizzle-orm';
import type { Db } from './db/client';

export interface RateLimiter {
  /** Counts a hit for `key` in the current fixed window; returns whether it is within `limit`. */
  hit: (key: string, limit: number, windowSeconds: number, now: Date) => Promise<{ allowed: boolean; count: number }>;
  /** Reads the current count without incrementing. */
  peek: (key: string, windowSeconds: number, now: Date) => Promise<number>;
}

const windowStart = (now: Date, windowSeconds: number): number => Math.floor(now.getTime() / 1000 / windowSeconds) * windowSeconds;

/** Fixed-window counters stored in D1. Fine for OTP/reveal abuse limits; not for per-second limits. */
export const d1RateLimiter = (db: Db): RateLimiter => ({
  hit: async (key, limit, windowSeconds, now) => {
    const ws = windowStart(now, windowSeconds);
    const row = await db.get<{ count: number }>(
      sql`INSERT INTO rate_windows (key, window_start, count) VALUES (${key}, ${ws}, 1)
          ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count`,
    );
    const count = Number(row?.count ?? 1);
    return { allowed: count <= limit, count };
  },
  peek: async (key, windowSeconds, now) => {
    const ws = windowStart(now, windowSeconds);
    const row = await db.get<{ count: number }>(sql`SELECT count FROM rate_windows WHERE key = ${key} AND window_start = ${ws}`);
    return Number(row?.count ?? 0);
  },
});

export const noopRateLimiter: RateLimiter = {
  hit: async () => ({ allowed: true, count: 0 }),
  peek: async () => 0,
};

export const DAY = 86_400;
export const HOUR = 3_600;
export const QUARTER_HOUR = 900;
