import type { Deps } from '../infra/env';
import { site } from '../../site.config';
import { err, ok, type Result } from '../domain/result';
import { listingInputSchema, expiryFrom, tierOf, photoLimitFor, type ValidListing } from '../domain/listing';
import { newId, newShortId } from '../domain/ids';
import { slugify } from '../domain/slug';
import { findListingById, listingPhotosOf } from '../infra/db/repos/listings';
import { claimPhone, countActiveOfOwner, deletePhotosOfListing, insertListing, listingsOfOwner, releasePhoneIfUnused, replaceListingServices, syncPhotoSummary, updateListing } from '../infra/db/repos/listing-write';
import { photoObjectKeys } from '../infra/storage/r2';
import { loadGeo, findArea, categoryById, cityById } from '../infra/db/repos/geo';
import type { Listing, User } from '../infra/db/schema';

export type ListingError =
  | { kind: 'validation'; fields: Record<string, string> }
  | { kind: 'phone_taken' }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'free_limit'; limit: number }
  | { kind: 'declaration_required' }
  | { kind: 'bad_state' };

const zodFields = (issues: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> =>
  Object.fromEntries(issues.map((i) => [i.path.join('.') || '_', i.message]));

const validate = (input: unknown): Result<ValidListing, ListingError> => {
  const parsed = listingInputSchema.safeParse(input);
  return parsed.success ? ok(parsed.data) : err({ kind: 'validation', fields: zodFields(parsed.error.issues) });
};

const validateGeo = async (deps: Deps, v: ValidListing): Promise<Result<ValidListing, ListingError>> => {
  const geo = await loadGeo(deps.db);
  if (!cityById(geo, v.cityId) || !categoryById(geo, v.categoryId)) return err({ kind: 'validation', fields: { cityId: 'invalid' } });
  if (v.areaId && ![...(geo.areasByCity.get(v.cityId) ?? [])].some((a) => a.id === v.areaId)) return err({ kind: 'validation', fields: { areaId: 'invalid' } });
  const allowed = new Set(geo.services.filter((s) => s.categoryScope === null || s.categoryScope.includes(v.categoryId)).map((s) => s.id));
  return ok({ ...v, serviceIds: v.serviceIds.filter((id) => allowed.has(id)) });
};

const columnsFrom = (v: ValidListing) => ({
  categoryId: v.categoryId, cityId: v.cityId, areaId: v.areaId, title: v.title, description: v.description, age: v.age, gender: v.gender,
  nationality: v.nationality, ethnicity: v.ethnicity, heightCm: v.heightCm, bodyType: v.bodyType, languages: v.languages,
  rate1h: v.rate1h, rate2h: v.rate2h, rateOvernight: v.rateOvernight, incall: v.incall, outcall: v.outcall, availability: v.availability,
  phoneE164: v.phone, whatsappE164: v.whatsapp, telegramHandle: v.telegram,
});

export const ownedListing = async (deps: Deps, user: User, id: string, isAdmin = false): Promise<Result<Listing, ListingError>> => {
  const listing = await findListingById(deps.db, id);
  if (!listing || listing.status === 'removed') return err({ kind: 'not_found' });
  if (listing.ownerUserId !== user.id && !isAdmin) return err({ kind: 'forbidden' });
  return ok(listing);
};

/** Creates a draft (or updates an existing draft/listing). Publishing is a separate step. */
export const saveListing = async (deps: Deps, user: User, input: unknown, existingId?: string): Promise<Result<Listing, ListingError>> => {
  const v = validate(input);
  if (!v.ok) return v;
  const g = await validateGeo(deps, v.value);
  if (!g.ok) return g;
  const data = g.value;
  const now = deps.clock.now();
  const cols = columnsFrom(data);

  if (existingId) {
    const owned = await ownedListing(deps, user, existingId);
    if (!owned.ok) return owned;
    const prev = owned.value;
    if (prev.phoneE164 !== data.phone && !(await claimPhone(deps.db, data.phone, user.id, now))) return err({ kind: 'phone_taken' });
    const contentChanged = prev.title !== data.title || prev.description !== data.description;
    await updateListing(deps.db, prev.id, {
      ...cols,
      slug: slugify(data.title),
      updatedAt: now,
      ...(prev.status === 'active' && contentChanged ? { moderation: 'pending', editedAt: now } : {}),
    });
    await replaceListingServices(deps.db, prev.id, data.serviceIds);
    if (prev.phoneE164 !== data.phone) await releasePhoneIfUnused(deps.db, prev.phoneE164, user.id);
    return ok((await findListingById(deps.db, prev.id))!);
  }

  if (!(await claimPhone(deps.db, data.phone, user.id, now))) return err({ kind: 'phone_taken' });
  const listing = {
    id: newId(now.getTime()), shortId: newShortId(), ownerUserId: user.id, slug: slugify(data.title), ...cols,
    status: 'draft' as const, moderation: 'pending' as const, verified: false, photoCount: 0, coverPhotoId: null,
    bumpedAt: null, featuredUntil: null, vipUntil: null, publishedAt: null, expiresAt: null, renewalReminderSentAt: null,
    declarationAcceptedAt: null, declarationVersion: null, removedReason: null, editedAt: null, createdAt: now, updatedAt: now,
  };
  await insertListing(deps.db, listing);
  await replaceListingServices(deps.db, listing.id, data.serviceIds);
  return ok((await findListingById(deps.db, listing.id))!);
};

/** Publishes a draft/paused listing: requires the declaration and respects the free active cap. */
export const publishListing = async (deps: Deps, user: User, id: string, declarationAccepted: boolean): Promise<Result<Listing, ListingError>> => {
  const owned = await ownedListing(deps, user, id);
  if (!owned.ok) return owned;
  const l = owned.value;
  if (l.status === 'active') return ok(l);
  if (!declarationAccepted && !l.declarationAcceptedAt) return err({ kind: 'declaration_required' });
  const active = await countActiveOfOwner(deps.db, user.id);
  if (active >= site.freeActiveListings) return err({ kind: 'free_limit', limit: site.freeActiveListings });
  const now = deps.clock.now();
  const firstPublish = l.publishedAt === null;
  await updateListing(deps.db, l.id, {
    status: 'active',
    publishedAt: firstPublish ? now : l.publishedAt,
    bumpedAt: firstPublish ? now : (l.bumpedAt ?? now),
    expiresAt: l.status === 'expired' || firstPublish ? expiryFrom(now) : (l.expiresAt ?? expiryFrom(now)),
    renewalReminderSentAt: null,
    declarationAcceptedAt: l.declarationAcceptedAt ?? now,
    declarationVersion: l.declarationVersion ?? site.declarationVersion,
    updatedAt: now,
  });
  return ok((await findListingById(deps.db, l.id))!);
};

export const pauseListing = async (deps: Deps, user: User, id: string): Promise<Result<Listing, ListingError>> => {
  const owned = await ownedListing(deps, user, id);
  if (!owned.ok) return owned;
  if (owned.value.status !== 'active') return err({ kind: 'bad_state' });
  await updateListing(deps.db, id, { status: 'paused', updatedAt: deps.clock.now() });
  return ok((await findListingById(deps.db, id))!);
};

/** Free renewal: resets the 30-day clock (and bumps when the listing had expired). */
export const renewListing = async (deps: Deps, user: User, id: string): Promise<Result<Listing, ListingError>> => {
  const owned = await ownedListing(deps, user, id);
  if (!owned.ok) return owned;
  const l = owned.value;
  if (l.status !== 'active' && l.status !== 'expired') return err({ kind: 'bad_state' });
  if (l.status === 'expired') {
    const active = await countActiveOfOwner(deps.db, user.id);
    if (active >= site.freeActiveListings) return err({ kind: 'free_limit', limit: site.freeActiveListings });
  }
  const now = deps.clock.now();
  await updateListing(deps.db, id, { status: 'active', expiresAt: expiryFrom(now), renewalReminderSentAt: null, bumpedAt: l.status === 'expired' ? now : l.bumpedAt, updatedAt: now });
  return ok((await findListingById(deps.db, id))!);
};

/**
 * Drops a listing's photo rows and queues deletion of their stored files, so nothing of a removed
 * listing stays reachable through `/img/…` (the row check) or the bucket itself.
 */
export const purgeListingPhotos = async (deps: Deps, listingId: string): Promise<void> => {
  const photos = await listingPhotosOf(deps.db, listingId);
  if (photos.length === 0) return;
  await deletePhotosOfListing(deps.db, listingId);
  await syncPhotoSummary(deps.db, listingId, deps.clock.now());
  const keys = photos.filter((p) => p.storage === 'r2').flatMap((p) => photoObjectKeys(listingId, p.id));
  if (keys.length > 0) deps.waitUntil(deps.photos.delete(keys));
};

export const removeListing = async (deps: Deps, user: User, id: string, reason = 'owner'): Promise<Result<Listing, ListingError>> => {
  const owned = await ownedListing(deps, user, id);
  if (!owned.ok) return owned;
  await updateListing(deps.db, id, { status: 'removed', removedReason: reason, updatedAt: deps.clock.now() });
  await purgeListingPhotos(deps, id);
  await releasePhoneIfUnused(deps.db, owned.value.phoneE164, user.id);
  return ok((await findListingById(deps.db, id))!);
};

export const myListings = (deps: Deps, user: User) => listingsOfOwner(deps.db, user.id);

export const photoLimitOf = (listing: Listing, now: Date): number => photoLimitFor(tierOf(listing, now));

export const listingArea = async (deps: Deps, listing: Listing) => {
  const geo = await loadGeo(deps.db);
  return { city: cityById(geo, listing.cityId), category: categoryById(geo, listing.categoryId), area: listing.areaId ? findArea(geo, listing.cityId, '') ?? undefined : undefined, geo };
};
