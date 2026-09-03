import type { APIRoute } from 'astro';
import { seedTaxonomyIfEmpty } from '../../../services/seed.service';

export const prerender = false;

/**
 * One-time production setup: seeds cities/areas/categories/services/products when the
 * database is empty. Never deletes anything. Guarded by SEED_TOKEN; remove the variable afterwards.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const { deps } = locals;
  const token = deps.env.SEED_TOKEN;
  if (!token || request.headers.get('x-setup-token') !== token) return new Response('Forbidden', { status: 403 });
  const result = await seedTaxonomyIfEmpty(deps);
  return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
};
