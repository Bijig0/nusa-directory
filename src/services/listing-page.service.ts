import type { Deps } from '../infra/env';
import type { Locale } from '../../site.config';
import { site } from '../../site.config';
import { loadGeo, cityById, categoryById, areaById, type Geo } from '../infra/db/repos/geo';
import { findListingByShortId, listingPhotosOf, listingServiceNames, relatedListings, type ListingCard } from '../infra/db/repos/listings';
import { approvedReviews } from '../infra/db/repos/reviews';
import { activeProducts } from '../infra/db/repos/products';
import { parseListingSegment, listingPath, cityPath, categoryPath, areaPath } from '../domain/slug';
import { listingSeo, breadcrumbList, webPage, type PageSeo, type Crumb } from '../domain/seo';
import { excerpt, tierOf, type Tier } from '../domain/listing';
import { localizedPath } from '../domain/i18n';
import type { Area, Category, City, Listing, ListingPhoto, Product, Review } from '../infra/db/schema';

const name = (locale: Locale, row: { nameId: string; nameEn: string }): string => (locale === 'en' ? row.nameEn : row.nameId);

export type ListingPageResult =
  | { kind: 'not_found' }
  | { kind: 'redirect'; to: string }
  | { kind: 'gone'; city: City; category: Category; listing: Listing }
  | { kind: 'ok'; page: ListingPage };

export interface ListingPage {
  listing: Listing;
  city: City;
  category: Category;
  area?: Area;
  geo: Geo;
  photos: readonly ListingPhoto[];
  services: readonly { id: string; slug: string; nameId: string; nameEn: string }[];
  related: readonly ListingCard[];
  reviews: readonly Review[];
  packs: readonly Product[];
  seo: PageSeo;
  crumbs: readonly Crumb[];
  jsonLd: readonly Record<string, unknown>[];
  canonicalPath: string;
  tier: Tier;
  now: Date;
  isOwner: boolean;
}

export const loadListingPage = async (
  deps: Deps, locale: Locale, citySlug: string, categorySlug: string, segment: string, origin: string, viewerUserId: string | undefined, isAdmin: boolean,
): Promise<ListingPageResult> => {
  const parsed = parseListingSegment(segment);
  if (!parsed) return { kind: 'not_found' };
  const listing = await findListingByShortId(deps.db, parsed.shortId);
  if (!listing) return { kind: 'not_found' };
  const geo = await loadGeo(deps.db);
  const city = cityById(geo, listing.cityId);
  const category = categoryById(geo, listing.categoryId);
  if (!city || !category) return { kind: 'not_found' };
  const canonicalPath = localizedPath(locale, listingPath(city.slug, category.slug, listing.slug, listing.shortId));
  const isOwner = viewerUserId !== undefined && viewerUserId === listing.ownerUserId;
  const privileged = isOwner || isAdmin;
  if (listing.status === 'expired' || listing.status === 'removed') return { kind: 'gone', city, category, listing };
  if ((listing.status === 'draft' || listing.status === 'paused' || listing.moderation === 'hidden') && !privileged) return { kind: 'not_found' };
  if (city.slug !== citySlug || category.slug !== categorySlug || listing.slug !== parsed.slug) return { kind: 'redirect', to: canonicalPath };

  const now = deps.clock.now();
  const [photos, services, related, reviews, packs] = await Promise.all([
    listingPhotosOf(deps.db, listing.id),
    listingServiceNames(deps.db, listing.id),
    relatedListings(deps.db, listing, now, 6),
    approvedReviews(deps.db, listing.id),
    activeProducts(deps.db),
  ]);
  const area = areaById(geo, listing.areaId);
  const seo = listingSeo({ locale, brand: site.name, title: listing.title, excerpt: excerpt(listing.description), city: name(locale, city), category: name(locale, category), area: area ? name(locale, area) : undefined });
  const crumbs: Crumb[] = [
    { name: locale === 'en' ? 'Home' : 'Beranda', url: `${origin}${localizedPath(locale, '/')}` },
    { name: name(locale, city), url: `${origin}${localizedPath(locale, cityPath(city.slug))}` },
    { name: name(locale, category), url: `${origin}${localizedPath(locale, categoryPath(city.slug, category.slug))}` },
    ...(area ? [{ name: name(locale, area), url: `${origin}${localizedPath(locale, areaPath(city.slug, category.slug, area.slug))}` }] : []),
    { name: listing.title, url: `${origin}${canonicalPath}` },
  ];
  const cover = photos[0];
  const image = cover ? `${origin}/img/${listing.id}/${cover.id}/card.jpg` : undefined;
  return {
    kind: 'ok',
    page: {
      listing, city, category, area, geo, photos, services, related, reviews, packs, seo, crumbs, canonicalPath, now, isOwner,
      tier: tierOf(listing, now),
      jsonLd: [breadcrumbList(crumbs), webPage({ name: seo.title, description: seo.description, url: `${origin}${canonicalPath}`, image, datePublished: listing.publishedAt ?? undefined, dateModified: listing.updatedAt, locale })],
    },
  };
};
