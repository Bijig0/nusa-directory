import type { Deps } from '../infra/env';
import type { Locale } from '../../site.config';
import { site } from '../../site.config';
import { loadGeo, findCity, findCategory, findArea, areasOf, type Geo } from '../infra/db/repos/geo';
import { browseListingsSafe, listingCounts, vipListings, latestListings, type ListingCard, type CountRow } from '../infra/db/repos/listings';
import { parseFilters, paginate, isIndexable, filtersToQuery, type FilterParams, type Pagination } from '../domain/search';
import { landingSeo, breadcrumbList, itemList, type PageSeo, type Crumb } from '../domain/seo';
import { localizedPath } from '../domain/i18n';
import { categoryPath, areaPath, cityPath, listingPath } from '../domain/slug';
import type { Area, Category, City } from '../infra/db/schema';

const name = (locale: Locale, row: { nameId: string; nameEn: string }): string => (locale === 'en' ? row.nameEn : row.nameId);

const countFor = (rows: readonly CountRow[], pred: (r: CountRow) => boolean): number => rows.filter(pred).reduce((n, r) => n + r.n, 0);

export interface CityPage {
  city: City;
  geo: Geo;
  seo: PageSeo;
  crumbs: readonly Crumb[];
  jsonLd: readonly Record<string, unknown>[];
  categoriesWithCounts: readonly { category: Category; count: number }[];
  areasWithCounts: readonly { area: Area; count: number }[];
  vip: readonly ListingCard[];
  latest: readonly ListingCard[];
  total: number;
}

export const loadCityPage = async (deps: Deps, locale: Locale, citySlug: string, origin: string): Promise<CityPage | undefined> => {
  const geo = await loadGeo(deps.db);
  const city = findCity(geo, citySlug);
  if (!city) return undefined;
  const now = deps.clock.now();
  const [counts, vip, latest] = await Promise.all([listingCounts(deps.db, city.id), vipListings(deps.db, now, city.id, 8), latestListings(deps.db, city.id, 12)]);
  const total = countFor(counts, () => true);
  const areas = areasOf(geo, city.id);
  const areasWithCounts = areas.map((area) => ({ area, count: countFor(counts, (r) => r.areaId === area.id) })).sort((a, b) => b.count - a.count);
  const seo = landingSeo({ locale, brand: site.name, now, city: name(locale, city), count: total, areaNames: areasWithCounts.map((a) => name(locale, a.area)) });
  const crumbs: Crumb[] = [
    { name: locale === 'en' ? 'Home' : 'Beranda', url: `${origin}${localizedPath(locale, '/')}` },
    { name: name(locale, city), url: `${origin}${localizedPath(locale, cityPath(city.slug))}` },
  ];
  return {
    city, geo, seo, crumbs, total, vip, latest,
    jsonLd: [breadcrumbList(crumbs)],
    categoriesWithCounts: geo.categories.map((category) => ({ category, count: countFor(counts, (r) => r.categoryId === category.id) })),
    areasWithCounts,
  };
};

export interface CategoryPage {
  city: City;
  category: Category;
  area?: Area;
  geo: Geo;
  filters: FilterParams;
  items: readonly ListingCard[];
  pagination: Pagination;
  seo: PageSeo;
  indexable: boolean;
  crumbs: readonly Crumb[];
  jsonLd: readonly Record<string, unknown>[];
  areasWithCounts: readonly { area: Area; count: number }[];
  otherCategories: readonly { category: Category; count: number }[];
  basePath: string;
  hrefFor: (page: number) => string;
  areaHref: (areaSlug: string | undefined) => string;
  now: Date;
}

export const loadCategoryPage = async (
  deps: Deps, locale: Locale, citySlug: string, categorySlug: string, areaSlug: string | undefined, search: URLSearchParams, origin: string,
): Promise<CategoryPage | undefined> => {
  const geo = await loadGeo(deps.db);
  const city = findCity(geo, citySlug);
  const category = city && findCategory(geo, categorySlug);
  if (!city || !category) return undefined;
  const area = areaSlug ? findArea(geo, city.id, areaSlug) : undefined;
  if (areaSlug && !area) return undefined;
  const now = deps.clock.now();
  const filters = parseFilters(search, area?.slug);
  const provisional = paginate(filters.page, Number.MAX_SAFE_INTEGER);
  const scope = { cityId: city.id, categoryId: category.id, areaId: area?.id };
  const [result, counts] = await Promise.all([
    browseListingsSafe(deps.db, scope, filters, now, provisional.offset, provisional.pageSize),
    listingCounts(deps.db, city.id),
  ]);
  const pagination = paginate(filters.page, result.total);
  const areas = areasOf(geo, city.id);
  const areasWithCounts = areas.map((a) => ({ area: a, count: countFor(counts, (r) => r.categoryId === category.id && r.areaId === a.id) })).sort((a, b) => b.count - a.count);
  const seo = landingSeo({
    locale, brand: site.name, now, city: name(locale, city), category: name(locale, category), area: area ? name(locale, area) : undefined,
    count: result.total, areaNames: areasWithCounts.filter((a) => a.count > 0).map((a) => name(locale, a.area)),
  });
  const basePath = localizedPath(locale, area ? areaPath(city.slug, category.slug, area.slug) : categoryPath(city.slug, category.slug));
  const crumbs: Crumb[] = [
    { name: locale === 'en' ? 'Home' : 'Beranda', url: `${origin}${localizedPath(locale, '/')}` },
    { name: name(locale, city), url: `${origin}${localizedPath(locale, cityPath(city.slug))}` },
    { name: name(locale, category), url: `${origin}${localizedPath(locale, categoryPath(city.slug, category.slug))}` },
    ...(area ? [{ name: name(locale, area), url: `${origin}${basePath}` }] : []),
  ];
  const listItems = result.items.map((it) => ({ name: it.title, url: `${origin}${localizedPath(locale, listingPath(it.citySlug, it.categorySlug, it.slug, it.shortId))}` }));
  return {
    city, category, area, geo, filters, items: result.items, pagination, seo, crumbs, basePath, now,
    indexable: isIndexable(filters),
    jsonLd: [breadcrumbList(crumbs), ...(listItems.length ? [itemList(listItems)] : [])],
    areasWithCounts,
    otherCategories: geo.categories.filter((c) => c.id !== category.id).map((c) => ({ category: c, count: countFor(counts, (r) => r.categoryId === c.id) })),
    hrefFor: (page) => `${basePath}${filtersToQuery(filters, { page })}`,
    areaHref: (slug) => localizedPath(locale, slug ? areaPath(city.slug, category.slug, slug) : categoryPath(city.slug, category.slug)),
  };
};

export const pageTitleSuffix = (page: number, locale: Locale): string => (page > 1 ? (locale === 'en' ? ` — Page ${page}` : ` — Halaman ${page}`) : '');
