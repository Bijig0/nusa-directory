import type { Deps } from '../infra/env';
import { err, ok, type Result } from '../domain/result';
import { readImageInfo, readJpegOrientation, rotationFor, MAX_UPLOAD_BYTES, MAX_PIXELS } from '../domain/images';
import { newId } from '../domain/ids';
import { sharpProcessor } from '../infra/images/sharp';
import { photoKey, photoObjectKeys } from '../infra/storage/r2';
import { deletePhotoRow, findPhoto, insertPhoto, nextPhotoPosition, reorderPhotos, syncPhotoSummary } from '../infra/db/repos/listing-write';
import { listingPhotosOf } from '../infra/db/repos/listings';
import { ownedListing, photoLimitOf } from './listing.service';
import { site } from '../../site.config';
import type { ListingPhoto, User } from '../infra/db/schema';

export type PhotoError = 'not_found' | 'forbidden' | 'too_large' | 'unsupported' | 'too_many_pixels' | 'limit_reached' | 'processing_failed';

export const uploadPhoto = async (deps: Deps, user: User, listingId: string, bytes: Uint8Array, isAdmin = false): Promise<Result<ListingPhoto, PhotoError>> => {
  const owned = await ownedListing(deps, user, listingId, isAdmin);
  if (!owned.ok) return err(owned.error.kind === 'forbidden' ? 'forbidden' : 'not_found');
  const listing = owned.value;
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return err('too_large');
  const info = readImageInfo(bytes);
  if (!info) return err('unsupported');
  if (info.width * info.height > MAX_PIXELS) return err('too_many_pixels');
  const now = deps.clock.now();
  if (listing.photoCount >= photoLimitOf(listing, now)) return err('limit_reached');

  const rotate = info.format === 'jpeg' ? rotationFor(readJpegOrientation(bytes)) : 0;
  let variants;
  try {
    variants = await sharpProcessor.process({ bytes, rotate, watermarkText: site.domain });
  } catch (error) {
    console.error('[photo] processing failed', error);
    return err('processing_failed');
  }
  const store = deps.photos;
  const photoId = newId(now.getTime());
  await Promise.all(variants.map((v) => store.put(photoKey(listingId, photoId, v.name), v.bytes, 'image/jpeg')));
  const full = variants.find((v) => v.name === 'full')!;
  const position = await nextPhotoPosition(deps.db, listingId);
  const row: ListingPhoto = { id: photoId, listingId, position, storage: 'r2', width: full.width, height: full.height, bytesFull: full.bytes.byteLength, colorHex: null, createdAt: now };
  await insertPhoto(deps.db, row);
  await syncPhotoSummary(deps.db, listingId, now);
  return ok(row);
};

export const deletePhoto = async (deps: Deps, user: User, listingId: string, photoId: string, isAdmin = false): Promise<Result<void, PhotoError>> => {
  const owned = await ownedListing(deps, user, listingId, isAdmin);
  if (!owned.ok) return err(owned.error.kind === 'forbidden' ? 'forbidden' : 'not_found');
  const photo = await findPhoto(deps.db, photoId);
  if (!photo || photo.listingId !== listingId) return err('not_found');
  await deletePhotoRow(deps.db, photoId);
  await syncPhotoSummary(deps.db, listingId, deps.clock.now());
  if (photo.storage === 'r2') deps.waitUntil(deps.photos.delete(photoObjectKeys(listingId, photoId)));
  return ok(undefined);
};

export const reorderListingPhotos = async (deps: Deps, user: User, listingId: string, orderedIds: readonly string[], isAdmin = false): Promise<Result<void, PhotoError>> => {
  const owned = await ownedListing(deps, user, listingId, isAdmin);
  if (!owned.ok) return err(owned.error.kind === 'forbidden' ? 'forbidden' : 'not_found');
  const existing = await listingPhotosOf(deps.db, listingId);
  const ids = new Set(existing.map((p) => p.id));
  const valid = orderedIds.filter((id) => ids.has(id));
  const rest = existing.map((p) => p.id).filter((id) => !valid.includes(id));
  await reorderPhotos(deps.db, listingId, [...valid, ...rest], deps.clock.now());
  return ok(undefined);
};
