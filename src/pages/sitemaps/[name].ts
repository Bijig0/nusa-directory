import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { staticSitemap, citiesSitemap, listingsSitemap, blogSitemap } from '../../services/sitemap.service';
import { STATIC_PAGE_PATHS } from '../../data/static-pages';
import { site } from '../../../site.config';

export const prerender = false;

const xml = (body: string) =>
  new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } });

export const GET: APIRoute = async ({ params, locals, site: astroSite }) => {
  const origin = (astroSite ?? new URL(site.url)).origin;
  const name = (params.name ?? '').replace(/\.xml$/, '');
  if (name === 'static') return xml(staticSitemap(origin, STATIC_PAGE_PATHS));
  if (name === 'cities') return xml(await citiesSitemap(locals.deps, origin));
  if (name === 'blog') {
    const posts = await getCollection('blog', (p) => p.id.startsWith('id/'));
    return xml(blogSitemap(origin, posts.map((p) => ({ path: `/blog/${p.id.slice(3)}/`, updated: p.data.updated ?? p.data.published }))));
  }
  const match = /^listings-(\d+)$/.exec(name);
  if (match) {
    const body = await listingsSitemap(locals.deps, origin, Number(match[1]));
    return body ? xml(body) : new Response(null, { status: 404 });
  }
  return new Response(null, { status: 404 });
};
