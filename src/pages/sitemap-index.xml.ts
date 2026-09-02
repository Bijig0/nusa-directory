import type { APIRoute } from 'astro';
import { sitemapIndex } from '../services/sitemap.service';
import { site } from '../../site.config';

export const prerender = false;
export const GET: APIRoute = async ({ locals, site: astroSite }) => {
  const origin = (astroSite ?? new URL(site.url)).origin;
  return new Response(await sitemapIndex(locals.deps, origin), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  });
};
