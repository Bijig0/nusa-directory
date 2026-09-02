import { and, desc, eq, gte, sql, inArray } from 'drizzle-orm';
import type { Db } from '../client';
import { auditLog, listings, orders, reports, reviews, users, identities, cities, categories, areas, products, type Report, type Review, type User, type Listing } from '../schema';
import { newId } from '../../../domain/ids';

// --- Reports ---
export const insertReport = (db: Db, row: typeof reports.$inferInsert) => db.insert(reports).values(row);
export const openReports = (db: Db, limit = 100) =>
  db.select({ report: reports, listing: listings }).from(reports).innerJoin(listings, eq(listings.id, reports.listingId)).where(eq(reports.status, 'open')).orderBy(desc(reports.createdAt)).limit(limit);
export const reportsForListing = (db: Db, listingId: string): Promise<Report[]> => db.select().from(reports).where(eq(reports.listingId, listingId)).orderBy(desc(reports.createdAt));
export const resolveReport = (db: Db, id: string, status: 'resolved' | 'dismissed', adminId: string, now: Date) =>
  db.update(reports).set({ status, resolvedBy: adminId, resolvedAt: now }).where(eq(reports.id, id));
export const resolveReportsForListing = (db: Db, listingId: string, adminId: string, now: Date) =>
  db.update(reports).set({ status: 'resolved', resolvedBy: adminId, resolvedAt: now }).where(and(eq(reports.listingId, listingId), eq(reports.status, 'open')));
export const countReportsToday = async (db: Db, ipHash: string, since: Date): Promise<number> => {
  const row = await db.select({ n: sql<number>`count(*)` }).from(reports).where(and(eq(reports.ipHash, ipHash), gte(reports.createdAt, since))).get();
  return Number(row?.n ?? 0);
};

// --- Reviews ---
export const insertReview = (db: Db, row: typeof reviews.$inferInsert) => db.insert(reviews).values(row).onConflictDoNothing();
export const findReview = (db: Db, id: string): Promise<Review | undefined> => db.select().from(reviews).where(eq(reviews.id, id)).get();
export const pendingReviews = (db: Db, limit = 100) =>
  db.select({ review: reviews, listing: listings }).from(reviews).innerJoin(listings, eq(listings.id, reviews.listingId)).where(eq(reviews.status, 'pending')).orderBy(desc(reviews.createdAt)).limit(limit);
export const moderateReview = (db: Db, id: string, status: 'approved' | 'rejected', adminId: string, now: Date) =>
  db.update(reviews).set({ status, moderatedBy: adminId, moderatedAt: now }).where(eq(reviews.id, id));
export const replyToReview = (db: Db, id: string, reply: string, now: Date) => db.update(reviews).set({ posterReply: reply, posterRepliedAt: now }).where(eq(reviews.id, id));
export const hasReviewed = async (db: Db, walletId: string, listingId: string): Promise<boolean> =>
  Boolean(await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.walletId, walletId), eq(reviews.listingId, listingId))).get());

// --- Listing queues ---
export type Queue = 'new' | 'reported' | 'edited' | 'all';

export interface QueueRow {
  listing: Listing;
  owner: User;
  reportCount: number;
  cityName: string;
  categoryName: string;
}

export const listingQueue = async (db: Db, queue: Queue, limit = 100): Promise<QueueRow[]> => {
  const reportCount = sql<number>`(SELECT count(*) FROM reports r WHERE r.listing_id = ${listings.id} AND r.status = 'open')`;
  const where =
    queue === 'new' ? and(eq(listings.moderation, 'pending'), sql`${listings.editedAt} IS NULL`, sql`${listings.status} IN ('active','paused','draft')`)
    : queue === 'edited' ? and(eq(listings.moderation, 'pending'), sql`${listings.editedAt} IS NOT NULL`)
    : queue === 'reported' ? sql`${reportCount} > 0`
    : sql`${listings.status} != 'removed'`;
  const rows = await db
    .select({ listing: listings, owner: users, reportCount, cityName: cities.nameId, categoryName: categories.nameId })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.ownerUserId))
    .innerJoin(cities, eq(cities.id, listings.cityId))
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(where)
    .orderBy(desc(listings.updatedAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, reportCount: Number(r.reportCount) }));
};

// --- Users ---
export interface UserRow {
  user: User;
  identities: string;
  listingCount: number;
}
export const usersList = async (db: Db, limit = 100, q?: string): Promise<UserRow[]> => {
  const rows = await db
    .select({
      user: users,
      identities: sql<string>`(SELECT group_concat(provider_id, ', ') FROM identities i WHERE i.user_id = ${users.id})`,
      listingCount: sql<number>`(SELECT count(*) FROM listings l WHERE l.owner_user_id = ${users.id} AND l.status != 'removed')`,
    })
    .from(users)
    .where(q ? sql`${users.id} IN (SELECT user_id FROM identities WHERE provider_id LIKE ${'%' + q + '%'}) OR ${users.displayName} LIKE ${'%' + q + '%'}` : sql`1`)
    .orderBy(desc(users.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, listingCount: Number(r.listingCount) }));
};

// --- KPIs ---
export const adminKpis = async (db: Db, now: Date) => {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [active, pending, openRep, paid, userCount] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(listings).where(eq(listings.status, 'active')).get(),
    db.select({ n: sql<number>`count(*)` }).from(listings).where(and(eq(listings.moderation, 'pending'), sql`${listings.status} != 'removed'`)).get(),
    db.select({ n: sql<number>`count(*)` }).from(reports).where(eq(reports.status, 'open')).get(),
    db.select({ n: sql<number>`count(*)`, sum: sql<number>`coalesce(sum(${orders.amountIdr}), 0)` }).from(orders).where(and(eq(orders.status, 'paid'), gte(orders.paidAt, since))).get(),
    db.select({ n: sql<number>`count(*)` }).from(users).get(),
  ]);
  return { active: Number(active?.n ?? 0), pending: Number(pending?.n ?? 0), openReports: Number(openRep?.n ?? 0), paidOrders30: Number(paid?.n ?? 0), revenue30: Number(paid?.sum ?? 0), users: Number(userCount?.n ?? 0) };
};

// --- Products & geo edits ---
export const updateProductPrice = (db: Db, code: string, priceIdr: number, isActive: boolean, now: Date) =>
  db.update(products).set({ priceIdr, isActive, updatedAt: now }).where(eq(products.code, code as typeof products.$inferSelect.code));
export const upsertArea = async (db: Db, row: { id: string; cityId: string; slug: string; nameId: string; nameEn: string }) =>
  db.insert(areas).values({ ...row, sortOrder: 999, isActive: true }).onConflictDoUpdate({ target: [areas.cityId, areas.slug], set: { nameId: row.nameId, nameEn: row.nameEn, isActive: true } });
export const setAreaActive = (db: Db, id: string, isActive: boolean) => db.update(areas).set({ isActive }).where(eq(areas.id, id));
export const setCityActive = (db: Db, id: string, isActive: boolean) => db.update(cities).set({ isActive }).where(eq(cities.id, id));

// --- Audit ---
export const audit = (db: Db, entry: { actorUserId: string | null; actorType: 'admin' | 'system' | 'user'; action: string; targetType: string; targetId: string; before?: unknown; after?: unknown }, now: Date) =>
  db.insert(auditLog).values({ id: newId(now.getTime()), actorUserId: entry.actorUserId, actorType: entry.actorType, action: entry.action, targetType: entry.targetType, targetId: entry.targetId, before: entry.before ? JSON.stringify(entry.before).slice(0, 4000) : null, after: entry.after ? JSON.stringify(entry.after).slice(0, 4000) : null, ipHash: null, createdAt: now });

export const listingsByIdsAdmin = (db: Db, ids: string[]) => (ids.length ? db.select().from(listings).where(inArray(listings.id, ids)) : Promise.resolve([] as Listing[]));
export { identities };
