import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lte, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../client';
import { areas, categories, cities, listingPhotos, listingServices, listings, servicesCatalog, type Listing, type ListingPhoto } from '../schema';
import { toFtsQuery, toLikePatterns, type FilterParams, type Sort } from '../../../domain/search';

/** Columns needed to render a listing card. */
export const cardColumns = {
  id: listings.id,
  shortId: listings.shortId,
  slug: listings.slug,
  title: listings.title,
  age: listings.age,
  gender: listings.gender,
  nationality: listings.nationality,
  rate1h: listings.rate1h,
  incall: listings.incall,
  outcall: listings.outcall,
  verified: listings.verified,
  photoCount: listings.photoCount,
  bumpedAt: listings.bumpedAt,
  publishedAt: listings.publishedAt,
  featuredUntil: listings.featuredUntil,
  vipUntil: listings.vipUntil,
  citySlug: cities.slug,
  cityNameId: cities.nameId,
  cityNameEn: cities.nameEn,
  categorySlug: categories.slug,
  categoryNameId: categories.nameId,
  categoryNameEn: categories.nameEn,
  areaSlug: areas.slug,
  areaNameId: areas.nameId,
  areaNameEn: areas.nameEn,
  coverPhotoId: listingPhotos.id,
  coverStorage: listingPhotos.storage,
  coverColor: listingPhotos.colorHex,
  coverWidth: listingPhotos.width,
  coverHeight: listingPhotos.height,
} as const;

export type ListingCard = {
  [K in keyof typeof cardColumns]: (typeof cardColumns)[K]['_']['data'] | null;
} & { id: string; shortId: string; slug: string; title: string; age: number; citySlug: string; categorySlug: string };

const cardQuery = (db: Db) =>
  db
    .select(cardColumns)
    .from(listings)
    .innerJoin(cities, eq(cities.id, listings.cityId))
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .leftJoin(areas, eq(areas.id, listings.areaId))
    .leftJoin(listingPhotos, eq(listingPhotos.id, listings.coverPhotoId));

const publicVisible = (): SQL => and(eq(listings.status, 'active'), sql`${listings.moderation} != 'hidden'`)!;

const rankOrder = (sort: Sort, now: Date): SQL[] => {
  const nowMs = now.getTime();
  const pinned = [
    sql`CASE WHEN ${listings.vipUntil} > ${nowMs} THEN 1 ELSE 0 END DESC`,
    sql`CASE WHEN ${listings.featuredUntil} > ${nowMs} THEN 1 ELSE 0 END DESC`,
  ];
  switch (sort) {
    case 'newest':
      return [...pinned, desc(listings.publishedAt), desc(listings.id)];
    case 'price_asc':
      return [...pinned, sql`COALESCE(${listings.rate1h}, 1e12) ASC`, desc(listings.bumpedAt)];
    case 'price_desc':
      return [...pinned, sql`COALESCE(${listings.rate1h}, -1) DESC`, desc(listings.bumpedAt)];
    default:
      return [...pinned, desc(listings.bumpedAt), desc(listings.id)];
  }
};

export interface BrowseScope {
  cityId: string;
  categoryId: string;
  areaId?: string;
}

const filterConditions = (scope: BrowseScope, f: FilterParams): SQL[] => {
  const conds: SQL[] = [publicVisible(), eq(listings.cityId, scope.cityId), eq(listings.categoryId, scope.categoryId)];
  if (scope.areaId) conds.push(eq(listings.areaId, scope.areaId));
  if (f.ageMin !== undefined) conds.push(gte(listings.age, f.ageMin));
  if (f.ageMax !== undefined) conds.push(lte(listings.age, f.ageMax));
  if (f.priceMin !== undefined) conds.push(gte(listings.rate1h, f.priceMin));
  if (f.priceMax !== undefined) conds.push(lte(listings.rate1h, f.priceMax));
  if (f.gender) conds.push(eq(listings.gender, f.gender));
  if (f.nationality) conds.push(eq(listings.nationality, f.nationality));
  if (f.incall) conds.push(eq(listings.incall, true));
  if (f.outcall) conds.push(eq(listings.outcall, true));
  if (f.verified) conds.push(eq(listings.verified, true));
  if (f.photos) conds.push(gt(listings.photoCount, 0));
  if (f.q) {
    const fts = toFtsQuery(f.q);
    if (fts) {
      conds.push(sql`${listings.id} IN (SELECT l.id FROM listings l JOIN listings_fts ON listings_fts.rowid = l.rowid WHERE listings_fts MATCH ${fts})`);
    } else {
      for (const pattern of toLikePatterns(f.q)) conds.push(sql`(${listings.title} LIKE ${pattern} OR ${listings.description} LIKE ${pattern})`);
    }
  }
  return conds;
};

export interface BrowseResult {
  items: readonly ListingCard[];
  total: number;
}

export const browseListings = async (db: Db, scope: BrowseScope, f: FilterParams, now: Date, offset: number, limit: number): Promise<BrowseResult> => {
  const where = and(...filterConditions(scope, f));
  // Not `db.batch`: D1 batch results come back keyed by column name, so joined
  // tables with duplicate column names (slug, name_id…) would collide.
  const [items, totals] = await Promise.all([
    cardQuery(db).where(where).orderBy(...rankOrder(f.sort, now)).limit(limit).offset(offset),
    db.select({ n: sql<number>`count(*)` }).from(listings).where(where),
  ]);
  return { items: items as ListingCard[], total: Number(totals[0]?.n ?? 0) };
};

/** Fallback when an FTS MATCH expression is rejected: retry with LIKE. */
export const browseListingsSafe = async (...args: Parameters<typeof browseListings>): Promise<BrowseResult> => {
  try {
    return await browseListings(...args);
  } catch (error) {
    const [db, scope, f, now, offset, limit] = args;
    if (!f.q) throw error;
    console.warn('[search] FTS query failed, falling back to LIKE', error);
    const like = { ...f, q: undefined };
    const where = and(...filterConditions(scope, like), ...toLikePatterns(f.q).map((p) => sql`(${listings.title} LIKE ${p} OR ${listings.description} LIKE ${p})`));
    const [items, totals] = await Promise.all([
      cardQuery(db).where(where).orderBy(...rankOrder(f.sort, now)).limit(limit).offset(offset),
      db.select({ n: sql<number>`count(*)` }).from(listings).where(where),
    ]);
    return { items: items as ListingCard[], total: Number(totals[0]?.n ?? 0) };
  }
};

export const vipListings = async (db: Db, now: Date, cityId: string | undefined, limit: number): Promise<readonly ListingCard[]> => {
  const conds = [publicVisible(), gt(listings.vipUntil, now)];
  if (cityId) conds.push(eq(listings.cityId, cityId));
  const rows = await cardQuery(db).where(and(...conds)).orderBy(desc(listings.bumpedAt)).limit(limit);
  return rows as ListingCard[];
};

export const latestListings = async (db: Db, cityId: string | undefined, limit: number): Promise<readonly ListingCard[]> => {
  const conds = [publicVisible()];
  if (cityId) conds.push(eq(listings.cityId, cityId));
  const rows = await cardQuery(db).where(and(...conds)).orderBy(desc(listings.publishedAt)).limit(limit);
  return rows as ListingCard[];
};

export interface CountRow {
  cityId: string;
  categoryId: string;
  areaId: string | null;
  n: number;
}

/** Active listing counts grouped by city/category/area (for landing pages and SEO copy). */
export const listingCounts = async (db: Db, cityId?: string): Promise<readonly CountRow[]> => {
  const conds = [publicVisible()];
  if (cityId) conds.push(eq(listings.cityId, cityId));
  return db
    .select({ cityId: listings.cityId, categoryId: listings.categoryId, areaId: listings.areaId, n: sql<number>`count(*)` })
    .from(listings)
    .where(and(...conds))
    .groupBy(listings.cityId, listings.categoryId, listings.areaId);
};

export const findListingByShortId = (db: Db, shortId: string) =>
  db.select().from(listings).where(eq(listings.shortId, shortId)).get();

export const findListingById = (db: Db, id: string) => db.select().from(listings).where(eq(listings.id, id)).get();

export const listingPhotosOf = (db: Db, listingId: string): Promise<ListingPhoto[]> =>
  db.select().from(listingPhotos).where(eq(listingPhotos.listingId, listingId)).orderBy(asc(listingPhotos.position));

export const listingServiceIds = async (db: Db, listingId: string): Promise<string[]> => {
  const rows = await db.select({ id: listingServices.serviceId }).from(listingServices).where(eq(listingServices.listingId, listingId));
  return rows.map((r) => r.id);
};

export const listingServiceNames = (db: Db, listingId: string) =>
  db
    .select({ id: servicesCatalog.id, slug: servicesCatalog.slug, nameId: servicesCatalog.nameId, nameEn: servicesCatalog.nameEn })
    .from(listingServices)
    .innerJoin(servicesCatalog, eq(servicesCatalog.id, listingServices.serviceId))
    .where(eq(listingServices.listingId, listingId))
    .orderBy(asc(servicesCatalog.sortOrder));

/** Similar listings for the "more in this area" block. */
export const relatedListings = async (db: Db, listing: Listing, now: Date, limit: number): Promise<readonly ListingCard[]> => {
  const rows = await cardQuery(db)
    .where(and(publicVisible(), eq(listings.cityId, listing.cityId), eq(listings.categoryId, listing.categoryId), sql`${listings.id} != ${listing.id}`))
    .orderBy(...rankOrder('bumped', now))
    .limit(limit);
  return rows as ListingCard[];
};

export interface SitemapRow {
  slug: string;
  shortId: string;
  citySlug: string;
  categorySlug: string;
  updatedAt: Date;
}

export const activeListingsForSitemap = async (db: Db, offset: number, limit: number): Promise<readonly SitemapRow[]> =>
  db
    .select({ slug: listings.slug, shortId: listings.shortId, citySlug: cities.slug, categorySlug: categories.slug, updatedAt: listings.updatedAt })
    .from(listings)
    .innerJoin(cities, eq(cities.id, listings.cityId))
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(publicVisible())
    .orderBy(asc(listings.id))
    .limit(limit)
    .offset(offset);

export const countActiveListings = async (db: Db): Promise<number> => {
  const row = await db.select({ n: sql<number>`count(*)` }).from(listings).where(publicVisible()).get();
  return Number(row?.n ?? 0);
};

export const listingsByIds = async (db: Db, ids: readonly string[]): Promise<readonly ListingCard[]> => {
  if (ids.length === 0) return [];
  const rows = await cardQuery(db).where(and(inArray(listings.id, [...ids]), isNotNull(listings.publishedAt)));
  return rows as ListingCard[];
};
