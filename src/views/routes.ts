import type { AstroGlobal } from 'astro';
import { site } from '../../site.config';
import { loadCityPage, loadCategoryPage, type CityPage, type CategoryPage } from '../services/browse.service';
import { loadListingPage, type ListingPageResult } from '../services/listing-page.service';
import { parseListingSegment } from '../domain/slug';
import { getEntry, type CollectionEntry } from 'astro:content';

/**
 * Route resolvers run in page frontmatter (before streaming starts) so they can
 * return 404/301 responses and set the 410 status. Views only render.
 */
const originOf = (astro: AstroGlobal): string => (astro.site ?? new URL(site.url)).origin;
const notFound = (): Response => new Response(null, { status: 404 });

export const resolveCityRoute = async (astro: AstroGlobal): Promise<CityPage | Response> => {
  const page = await loadCityPage(astro.locals.deps, astro.locals.locale, astro.params.city ?? '', originOf(astro));
  return page ?? notFound();
};

export const resolveCategoryRoute = async (astro: AstroGlobal, areaSlug?: string): Promise<CategoryPage | Response> => {
  const page = await loadCategoryPage(astro.locals.deps, astro.locals.locale, astro.params.city ?? '', astro.params.category ?? '', areaSlug, astro.url.searchParams, originOf(astro));
  return page ?? notFound();
};

export type SegmentRoute =
  | { kind: 'category'; page: CategoryPage }
  | { kind: 'listing'; result: Extract<ListingPageResult, { kind: 'gone' | 'ok' }> };

/** `/[city]/[category]/[segment]/` is either an area landing page or a listing page. */
export const resolveSegmentRoute = async (astro: AstroGlobal): Promise<SegmentRoute | Response> => {
  const segment = astro.params.segment ?? '';
  if (parseListingSegment(segment) === undefined) {
    const page = await resolveCategoryRoute(astro, segment);
    return page instanceof Response ? page : { kind: 'category', page };
  }
  const locals = astro.locals as App.Locals & { user?: { id: string }; isAdmin?: boolean };
  const result = await loadListingPage(locals.deps, locals.locale, astro.params.city ?? '', astro.params.category ?? '', segment, originOf(astro), locals.user?.id, Boolean(locals.isAdmin));
  if (result.kind === 'not_found') return notFound();
  if (result.kind === 'redirect') return astro.redirect(result.to, 301);
  if (result.kind === 'gone') astro.response.status = 410;
  return { kind: 'listing', result };
};

/** Content entries are keyed `<locale>/<slug>`; missing entries 404 from the route file. */
export const resolveBlogEntry = async (astro: AstroGlobal): Promise<{ entry: CollectionEntry<'blog'>; slug: string } | Response> => {
  const slug = astro.params.slug ?? '';
  const entry = await getEntry('blog', `${astro.locals.locale}/${slug}`);
  return entry ? { entry, slug } : notFound();
};

export const resolvePageEntry = async (astro: AstroGlobal, key: string): Promise<CollectionEntry<'pages'> | Response> => {
  const entry = await getEntry('pages', `${astro.locals.locale}/${key}`);
  return entry ?? notFound();
};
