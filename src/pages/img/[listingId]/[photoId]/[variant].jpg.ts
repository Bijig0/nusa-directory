import type { APIRoute } from 'astro';
import { eq, and } from 'drizzle-orm';
import { listingPhotos, listings } from '../../../../infra/db/schema';
import { photoKey, PHOTO_VARIANTS, type PhotoVariant } from '../../../../infra/storage/r2';

export const prerender = false;

const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';
/** Misses are cached briefly so a purged or unknown photo cannot be hammered, yet a fresh upload shows up soon. */
const NOT_FOUND = { 'Cache-Control': 'public, max-age=300' };

const placeholderSvg = (color: string, width: number, height: number, label: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#18181b" stop-opacity="0.85"/></linearGradient></defs>` +
  `<rect width="100%" height="100%" fill="url(#g)"/>` +
  `<text x="50%" y="52%" font-family="system-ui,sans-serif" font-size="${Math.round(width / 6)}" font-weight="800" fill="rgba(255,255,255,0.85)" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;

export const GET: APIRoute = async ({ params, locals }) => {
  const { listingId, photoId, variant } = params;
  if (!listingId || !photoId || !variant || !(PHOTO_VARIANTS as readonly string[]).includes(variant)) return new Response(null, { status: 404 });
  const { db, photos } = locals.deps;
  // Joined on listings: a removed listing's photos must not stay reachable by direct URL, even when
  // its rows or objects outlive the removal.
  const photo = await db
    .select({ storage: listingPhotos.storage, color: listingPhotos.colorHex, width: listingPhotos.width, height: listingPhotos.height, listingStatus: listings.status })
    .from(listingPhotos)
    .innerJoin(listings, eq(listings.id, listingPhotos.listingId))
    .where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId)))
    .get();
  if (!photo || photo.listingStatus === 'removed') return new Response(null, { status: 404, headers: NOT_FOUND });

  if (photo.storage === 'placeholder') {
    const scale = variant === 'thumb' ? 0.5 : variant === 'card' ? 1 : 2;
    const svg = placeholderSvg(photo.color ?? '#a1a1aa', Math.round(photo.width * scale), Math.round(photo.height * scale), photoId.slice(-2).toUpperCase());
    return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': IMMUTABLE } });
  }

  const object = await photos.get(photoKey(listingId, photoId, variant as PhotoVariant));
  if (!object) return new Response(null, { status: 404, headers: NOT_FOUND });
  const headers = new Headers({ 'Content-Type': object.contentType || 'image/jpeg', 'Cache-Control': IMMUTABLE });
  if (object.etag) headers.set('ETag', object.etag);
  return new Response(object.body as BodyInit, { headers });
};
