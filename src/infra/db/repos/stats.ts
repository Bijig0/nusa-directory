import { and, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { listingStatsDaily } from '../schema';

export type StatEvent = 'views' | 'reveals' | 'wa_clicks' | 'tg_clicks' | 'favorites';

/** 'YYYY-MM-DD' in Asia/Jakarta (UTC+7), the site's business day. */
export const jakartaDay = (now: Date): string => new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

const column: Record<StatEvent, string> = { views: 'views', reveals: 'reveals', wa_clicks: 'wa_clicks', tg_clicks: 'tg_clicks', favorites: 'favorites' };

export const incrementStat = (db: Db, listingId: string, event: StatEvent, now: Date) =>
  db.run(
    sql`INSERT INTO listing_stats_daily (listing_id, day, ${sql.raw(column[event])}) VALUES (${listingId}, ${jakartaDay(now)}, 1)
        ON CONFLICT(listing_id, day) DO UPDATE SET ${sql.raw(column[event])} = ${sql.raw(column[event])} + 1`,
  );

export const statsForListing = (db: Db, listingId: string, sinceDay: string) =>
  db.select().from(listingStatsDaily).where(and(eq(listingStatsDaily.listingId, listingId), gte(listingStatsDaily.day, sinceDay))).orderBy(listingStatsDaily.day);

export const statsTotals = async (db: Db, listingIds: readonly string[]) => {
  if (listingIds.length === 0) return [];
  return db
    .select({
      listingId: listingStatsDaily.listingId,
      views: sql<number>`sum(${listingStatsDaily.views})`,
      reveals: sql<number>`sum(${listingStatsDaily.reveals})`,
      waClicks: sql<number>`sum(${listingStatsDaily.waClicks})`,
    })
    .from(listingStatsDaily)
    .where(sql`${listingStatsDaily.listingId} IN ${listingIds}`)
    .groupBy(listingStatsDaily.listingId);
};
