import type { Deps } from '../infra/env';
import { loadGeo, areasOf } from '../infra/db/repos/geo';
import { activeListingsForSitemap, countActiveListings } from '../infra/db/repos/listings';
import { alternates, localizedPath, locales } from '../domain/i18n';
import { cityPath, categoryPath, areaPath, listingPath } from '../domain/slug';

export const LISTINGS_PER_SITEMAP = 5000;

const escapeXml = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** One <url> per locale, each carrying hreflang alternates. */
const urlEntries = (origin: string, path: string, lastmod?: Date, changefreq = 'daily', priority = '0.7'): string => {
  const alts = alternates(path, origin).map((a) => `<xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`).join('');
  return locales
    .map(
      (locale) =>
        `<url><loc>${escapeXml(`${origin}${localizedPath(locale, path)}`)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}<changefreq>${changefreq}</changefreq><priority>${priority}</priority>${alts}</url>`,
    )
    .join('');
};

const wrap = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${body}</urlset>`;

export const sitemapIndex = async (deps: Deps, origin: string): Promise<string> => {
  const total = await countActiveListings(deps.db);
  const chunks = Math.max(1, Math.ceil(total / LISTINGS_PER_SITEMAP));
  const names = ['static', 'cities', ...Array.from({ length: chunks }, (_, i) => `listings-${i + 1}`), 'blog'];
  const items = names.map((n) => `<sitemap><loc>${origin}/sitemaps/${n}.xml</loc></sitemap>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
};

export const staticSitemap = (origin: string, staticPaths: readonly string[]): string =>
  wrap([urlEntries(origin, '/', undefined, 'hourly', '1.0'), ...staticPaths.map((p) => urlEntries(origin, p, undefined, 'monthly', '0.3'))].join(''));

export const citiesSitemap = async (deps: Deps, origin: string): Promise<string> => {
  const geo = await loadGeo(deps.db);
  const entries: string[] = [];
  for (const city of geo.cities) {
    entries.push(urlEntries(origin, cityPath(city.slug), undefined, 'daily', '0.9'));
    for (const category of geo.categories) {
      entries.push(urlEntries(origin, categoryPath(city.slug, category.slug), undefined, 'hourly', '0.9'));
      for (const area of areasOf(geo, city.id)) entries.push(urlEntries(origin, areaPath(city.slug, category.slug, area.slug), undefined, 'daily', '0.6'));
    }
  }
  return wrap(entries.join(''));
};

export const listingsSitemap = async (deps: Deps, origin: string, chunk: number): Promise<string | undefined> => {
  if (chunk < 1) return undefined;
  const rows = await activeListingsForSitemap(deps.db, (chunk - 1) * LISTINGS_PER_SITEMAP, LISTINGS_PER_SITEMAP);
  if (rows.length === 0 && chunk > 1) return undefined;
  return wrap(rows.map((r) => urlEntries(origin, listingPath(r.citySlug, r.categorySlug, r.slug, r.shortId), r.updatedAt, 'weekly', '0.8')).join(''));
};

export const blogSitemap = (origin: string, posts: readonly { path: string; updated: Date }[]): string =>
  wrap(posts.map((p) => urlEntries(origin, p.path, p.updated, 'monthly', '0.5')).join(''));
