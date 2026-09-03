import { beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '@/infra/db/schema';
import type { Deps } from '@/infra/env';
import { fixedClock } from '@/infra/clock';
import { photoKey, photoObjectKeys, PHOTO_VARIANTS, type PhotoStore } from '@/infra/storage/r2';
import { removeListing } from '@/services/listing.service';
import { adminListingAction } from '@/services/admin.service';
import { GET as servePhoto } from '@/pages/img/[listingId]/[photoId]/[variant].jpg';

const NOW = new Date('2026-09-03T00:00:00Z');
const OWNER: schema.User = { id: 'u_owner', displayName: null, status: 'active', bannedReason: null, walletId: 'w_owner', createdAt: NOW, lastLoginAt: null };
const ADMIN: schema.User = { ...OWNER, id: 'u_admin', walletId: 'w_admin' };

/** A PhotoStore backed by a Map, so the test can see exactly which objects survive a removal. */
const memoryStore = () => {
  const objects = new Map<string, Uint8Array>();
  const store: PhotoStore = {
    put: async (key, bytes) => { objects.set(key, bytes); },
    get: async (key) => { const body = objects.get(key); return body ? { body, contentType: 'image/jpeg' } : null; },
    delete: async (keys) => { for (const key of keys) objects.delete(key); },
    ensureBucket: async () => 'noop',
  };
  return { store, objects };
};

const makeDeps = async () => {
  const db = drizzle(createClient({ url: ':memory:' }), { schema });
  await migrate(db, { migrationsFolder: 'migrations' });
  const { store, objects } = memoryStore();
  const background: Promise<unknown>[] = [];
  const deps = { db, clock: fixedClock(NOW), waitUntil: (p: Promise<unknown>) => { background.push(p); }, photos: store } as unknown as Deps;
  await db.insert(schema.users).values([OWNER, ADMIN]);
  await db.insert(schema.cities).values({ id: 'city_jakarta', slug: 'jakarta', nameId: 'Jakarta', nameEn: 'Jakarta', province: 'DKI Jakarta' });
  await db.insert(schema.categories).values({ id: 'cat_escorts', slug: 'escorts', nameId: 'Escort', nameEn: 'Escorts', descId: '', descEn: '' });
  return { deps, db, objects, flushBackground: () => Promise.all(background) };
};

type Fixture = Awaited<ReturnType<typeof makeDeps>>;

/** A draft with two R2 photos (all variants stored) and one placeholder photo. */
const seedListing = async ({ db, objects }: Fixture, id: string) => {
  await db.insert(schema.listings).values({
    id, shortId: `s_${id}`, ownerUserId: OWNER.id, categoryId: 'cat_escorts', cityId: 'city_jakarta', areaId: null, slug: 'cantik', title: 'Cantik & ramah', description: 'Foto asli.',
    age: 25, gender: 'female', languages: [], phoneE164: `+62812${id}`, status: 'draft', moderation: 'pending', photoCount: 3, coverPhotoId: `${id}_p1`, createdAt: NOW, updatedAt: NOW,
  });
  const photo = (photoId: string, position: number, storage: 'r2' | 'placeholder'): schema.ListingPhoto =>
    ({ id: photoId, listingId: id, position, storage, width: 800, height: 1200, bytesFull: 1000, colorHex: storage === 'placeholder' ? '#f472b6' : null, createdAt: NOW });
  await db.insert(schema.listingPhotos).values([photo(`${id}_p1`, 0, 'r2'), photo(`${id}_p2`, 1, 'r2'), photo(`${id}_p3`, 2, 'placeholder')]);
  for (const photoId of [`${id}_p1`, `${id}_p2`]) for (const key of photoObjectKeys(id, photoId)) objects.set(key, new Uint8Array([0xff, 0xd8]));
};

const photoRowsOf = (db: Fixture['db'], listingId: string) => db.select().from(schema.listingPhotos).where(eq(schema.listingPhotos.listingId, listingId));
const listingOf = async (db: Fixture['db'], id: string) => (await db.select().from(schema.listings).where(eq(schema.listings.id, id)).get())!;

const fetchPhoto = (deps: Deps, listingId: string, photoId: string, variant = 'card') =>
  servePhoto({ params: { listingId, photoId, variant }, locals: { deps } } as unknown as Parameters<typeof servePhoto>[0]);

describe('removing a listing', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await makeDeps();
    await seedListing(f, 'l1');
  });

  it('serves the photos of a live listing', async () => {
    expect((await fetchPhoto(f.deps, 'l1', 'l1_p1')).status).toBe(200);
    const placeholder = await fetchPhoto(f.deps, 'l1', 'l1_p3');
    expect(placeholder.status).toBe(200);
    expect(placeholder.headers.get('content-type')).toBe('image/svg+xml');
  });

  it('owner removal drops the photo rows and every stored variant', async () => {
    const r = await removeListing(f.deps, OWNER, 'l1');
    expect(r.ok).toBe(true);
    await f.flushBackground();

    const listing = await listingOf(f.db, 'l1');
    expect(listing.status).toBe('removed');
    expect(listing.removedReason).toBe('owner');
    expect(listing.photoCount).toBe(0);
    expect(listing.coverPhotoId).toBeNull();
    expect(await photoRowsOf(f.db, 'l1')).toHaveLength(0);
    expect([...f.objects.keys()]).toEqual([]);
  });

  it('admin removal purges photos the same way', async () => {
    const after = await adminListingAction(f.deps, ADMIN.id, 'l1', 'remove');
    await f.flushBackground();
    expect(after?.status).toBe('removed');
    expect(after?.photoCount).toBe(0);
    expect(await photoRowsOf(f.db, 'l1')).toHaveLength(0);
    expect(f.objects.size).toBe(0);
  });

  it('the /img route answers 404 (briefly cached) for a removed listing', async () => {
    await removeListing(f.deps, OWNER, 'l1');
    for (const variant of PHOTO_VARIANTS) {
      const res = await fetchPhoto(f.deps, 'l1', 'l1_p1', variant);
      expect(res.status).toBe(404);
      expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    }
  });

  it('the /img route refuses photos whose rows and objects outlived an older removal', async () => {
    // Listings removed before the purge existed still have their rows and objects; the route must not serve them.
    await seedListing(f, 'l2');
    await f.db.update(schema.listings).set({ status: 'removed' }).where(eq(schema.listings.id, 'l2'));
    expect(await photoRowsOf(f.db, 'l2')).toHaveLength(3);
    expect(f.objects.has(photoKey('l2', 'l2_p1', 'card'))).toBe(true);

    const r2 = await fetchPhoto(f.deps, 'l2', 'l2_p1');
    expect(r2.status).toBe(404);
    expect(r2.headers.get('cache-control')).toBe('public, max-age=300');
    expect((await fetchPhoto(f.deps, 'l2', 'l2_p3')).status).toBe(404);
    // Other listings are unaffected.
    expect((await fetchPhoto(f.deps, 'l1', 'l1_p1')).status).toBe(200);
  });

  it('does not purge photos of a listing the caller does not own', async () => {
    const stranger: schema.User = { ...OWNER, id: 'u_other', walletId: 'w_other' };
    await f.db.insert(schema.users).values(stranger);
    const r = await removeListing(f.deps, stranger, 'l1');
    expect(r.ok).toBe(false);
    expect(await photoRowsOf(f.db, 'l1')).toHaveLength(3);
    expect(f.objects.size).toBe(2 * PHOTO_VARIANTS.length);
  });
});
