import type { APIRoute } from 'astro';
import { runSeed } from '../../../services/seed.service';

export const prerender = false;

/** Dev-only: wipes and reseeds the local database. Guarded by ENVIRONMENT + SEED_TOKEN. */
export const POST: APIRoute = async ({ locals, request }) => {
  const { deps } = locals;
  if (!deps.isDev) return new Response('Not found', { status: 404 });
  if (request.headers.get('x-seed-token') !== deps.env.SEED_TOKEN) return new Response('Forbidden', { status: 403 });
  const summary = await runSeed(deps);
  return Response.json({ ok: true, ...summary });
};
