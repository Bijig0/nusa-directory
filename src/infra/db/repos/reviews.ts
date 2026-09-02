import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { reviews, type Review } from '../schema';

export const approvedReviews = (db: Db, listingId: string): Promise<Review[]> =>
  db.select().from(reviews).where(and(eq(reviews.listingId, listingId), eq(reviews.status, 'approved'))).orderBy(desc(reviews.createdAt)).limit(20);

export const reviewStats = async (db: Db, listingId: string): Promise<{ count: number; avg: number }> => {
  const row = await db
    .select({ count: sql<number>`count(*)`, avg: sql<number>`coalesce(avg(${reviews.rating}), 0)` })
    .from(reviews)
    .where(and(eq(reviews.listingId, listingId), eq(reviews.status, 'approved')))
    .get();
  return { count: Number(row?.count ?? 0), avg: Number(row?.avg ?? 0) };
};
