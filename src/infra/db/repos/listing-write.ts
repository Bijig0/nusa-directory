import { and, eq, sql, desc } from 'drizzle-orm';
import type { Db } from '../client';
import { listings, listingPhotos, listingServices, phoneClaims, boosts, type Listing, type NewListing, type ListingPhoto } from '../schema';

export const insertListing = (db: Db, row: NewListing) => db.insert(listings).values(row);
export const updateListing = (db: Db, id: string, patch: Partial<NewListing>) => db.update(listings).set(patch).where(eq(listings.id, id));

export const listingsOfOwner = (db: Db, ownerUserId: string): Promise<Listing[]> =>
  db.select().from(listings).where(and(eq(listings.ownerUserId, ownerUserId), sql`${listings.status} != 'removed'`)).orderBy(desc(listings.updatedAt));

export const countActiveOfOwner = async (db: Db, ownerUserId: string): Promise<number> => {
  const row = await db.select({ n: sql<number>`count(*)` }).from(listings).where(and(eq(listings.ownerUserId, ownerUserId), eq(listings.status, 'active'))).get();
  return Number(row?.n ?? 0);
};

export const replaceListingServices = async (db: Db, listingId: string, serviceIds: readonly string[]): Promise<void> => {
  await db.delete(listingServices).where(eq(listingServices.listingId, listingId));
  if (serviceIds.length > 0) await db.insert(listingServices).values(serviceIds.map((serviceId) => ({ listingId, serviceId })));
};

/** Claims a phone for a user; returns false when another user owns it. */
export const claimPhone = async (db: Db, phoneE164: string, userId: string, now: Date): Promise<boolean> => {
  const existing = await db.select().from(phoneClaims).where(eq(phoneClaims.phoneE164, phoneE164)).get();
  if (existing) return existing.userId === userId;
  await db.insert(phoneClaims).values({ phoneE164, userId, claimedAt: now }).onConflictDoNothing();
  const after = await db.select().from(phoneClaims).where(eq(phoneClaims.phoneE164, phoneE164)).get();
  return after?.userId === userId;
};

export const releasePhoneIfUnused = async (db: Db, phoneE164: string, userId: string): Promise<void> => {
  const still = await db.select({ id: listings.id }).from(listings).where(and(eq(listings.ownerUserId, userId), eq(listings.phoneE164, phoneE164), sql`${listings.status} != 'removed'`)).get();
  if (!still) await db.delete(phoneClaims).where(and(eq(phoneClaims.phoneE164, phoneE164), eq(phoneClaims.userId, userId)));
};

// --- Photos ---

export const insertPhoto = (db: Db, row: typeof listingPhotos.$inferInsert) => db.insert(listingPhotos).values(row);
export const findPhoto = (db: Db, id: string): Promise<ListingPhoto | undefined> => db.select().from(listingPhotos).where(eq(listingPhotos.id, id)).get();
export const deletePhotoRow = (db: Db, id: string) => db.delete(listingPhotos).where(eq(listingPhotos.id, id));
export const nextPhotoPosition = async (db: Db, listingId: string): Promise<number> => {
  const row = await db.select({ m: sql<number>`coalesce(max(${listingPhotos.position}), -1)` }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId)).get();
  return Number(row?.m ?? -1) + 1;
};

/** Recomputes photo_count and cover after any photo change. */
export const syncPhotoSummary = async (db: Db, listingId: string, now: Date): Promise<void> => {
  const first = await db.select({ id: listingPhotos.id }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId)).orderBy(listingPhotos.position).get();
  const count = await db.select({ n: sql<number>`count(*)` }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId)).get();
  await db.update(listings).set({ photoCount: Number(count?.n ?? 0), coverPhotoId: first?.id ?? null, updatedAt: now }).where(eq(listings.id, listingId));
};

export const reorderPhotos = async (db: Db, listingId: string, orderedIds: readonly string[], now: Date): Promise<void> => {
  // Two passes avoid the UNIQUE(listing_id, position) collision while shuffling.
  await db.batch([
    db.update(listingPhotos).set({ position: sql`${listingPhotos.position} + 1000` }).where(eq(listingPhotos.listingId, listingId)),
    ...orderedIds.map((id, i) => db.update(listingPhotos).set({ position: i }).where(and(eq(listingPhotos.id, id), eq(listingPhotos.listingId, listingId)))),
  ] as [ReturnType<Db['update']>['set'] extends never ? never : any, ...any[]]);
  await syncPhotoSummary(db, listingId, now);
};

export const insertBoost = (db: Db, row: typeof boosts.$inferInsert) => db.insert(boosts).values(row);
