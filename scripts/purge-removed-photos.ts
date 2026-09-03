/// <reference types="node" />
/**
 * Backfill: listings removed before removal purged photos still have listing_photos rows and R2 objects.
 * Lists them by default; `--apply` drops the rows and deletes every stored variant.
 * Usage: bun run scripts/purge-removed-photos.ts [--apply]   (reads .env under bun; pass --env-file for another)
 */
import { eq, sql } from 'drizzle-orm';
import { makeDb } from '../src/infra/db/client';
import { listingPhotos, listings } from '../src/infra/db/schema';
import { s3PhotoStore, localPhotoStore } from '../src/infra/storage/r2';
import { loadEnv, hasR2 } from '../src/infra/config';
import { systemClock } from '../src/infra/clock';
import { purgeListingPhotos } from '../src/services/listing.service';
import type { Deps } from '../src/infra/env';

const apply = process.argv.includes('--apply');
const env = loadEnv();
const db = makeDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
const photos = hasR2(env)
  ? s3PhotoStore({ accountId: env.R2_ACCOUNT_ID!, accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY!, bucket: env.R2_BUCKET! })
  : localPhotoStore('.data/photos');

const stale = await db
  .select({ id: listings.id, title: listings.title, n: sql<number>`count(${listingPhotos.id})`, r2: sql<number>`sum(${listingPhotos.storage} = 'r2')` })
  .from(listings)
  .innerJoin(listingPhotos, eq(listingPhotos.listingId, listings.id))
  .where(eq(listings.status, 'removed'))
  .groupBy(listings.id);

console.log(`${stale.length} removed listing(s) still hold photos (${env.TURSO_DATABASE_URL.replace(/\/\/.*@/, '//')}, ${hasR2(env) ? `bucket ${env.R2_BUCKET}` : 'local store'})`);
for (const l of stale) console.log(`  ${l.id}  ${String(l.n).padStart(2)} photo(s), ${Number(l.r2)} in R2  "${l.title}"`);
if (!apply) {
  if (stale.length) console.log('Dry run. Re-run with --apply to purge.');
  process.exit(0);
}

const background: Promise<unknown>[] = [];
const deps = { db, clock: systemClock, photos, waitUntil: (p: Promise<unknown>) => { background.push(p); } } as unknown as Deps;
for (const l of stale) {
  await purgeListingPhotos(deps, l.id);
  console.log(`  purged ${l.id}`);
}
const results = await Promise.allSettled(background);
const failed = results.filter((r) => r.status === 'rejected');
for (const r of results) if (r.status === 'rejected') console.error('  object delete failed:', r.reason);
console.log(`done: ${stale.length} listing(s), ${failed.length} delete batch(es) failed`);
process.exit(failed.length ? 1 : 0);
