import { and, eq, sql } from 'drizzle-orm';
import type { Db } from './db/client';
import { rateWindows } from './db/schema';

export interface RateLimiter {
  /** Counts a hit for `key` in the current fixed window; returns whether it is within `limit`. */
  hit: (key: string, limit: number, windowSeconds: number, now: Date) => Promise<{ allowed: boolean; count: number }>;
  /** Reads the current count without incrementing. */
  peek: (key: string, windowSeconds: number, now: Date) => Promise<number>;
}

const windowStart = (now: Date, windowSeconds: number): number => Math.floor(now.getTime() / 1000 / windowSeconds) * windowSeconds;

/** Fixed-window counters stored in the database. Fine for OTP/reveal abuse limits; not for per-second limits. */
export const d1RateLimiter = (db: Db): RateLimiter => ({
  hit: async (key, limit, windowSeconds, now) => {
    const ws = windowStart(now, windowSeconds);
    const rows = await db
      .insert(rateWindows)
      .values({ key, windowStart: ws, count: 1 })
      .onConflictDoUpdate({ target: [rateWindows.key, rateWindows.windowStart], set: { count: sql`${rateWindows.count} + 1` } })
      .returning({ count: rateWindows.count });
    const count = Number(rows[0]?.count ?? 1);
    return { allowed: count <= limit, count };
  },
  peek: async (key, windowSeconds, now) => {
    const ws = windowStart(now, windowSeconds);
    const row = await db.select({ count: rateWindows.count }).from(rateWindows).where(and(eq(rateWindows.key, key), eq(rateWindows.windowStart, ws))).get();
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
