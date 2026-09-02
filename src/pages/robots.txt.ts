import type { APIRoute } from 'astro';
import { site } from '../../site.config';

export const prerender = false;
export const GET: APIRoute = ({ site: astroSite }) => {
  const origin = (astroSite ?? new URL(site.url)).origin;
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /admin/', 'Disallow: /dashboard/', 'Disallow: /auth/', 'Disallow: /api/', 'Disallow: /_actions/', 'Disallow: /favorites/', '', `Sitemap: ${origin}/sitemap-index.xml`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
};
