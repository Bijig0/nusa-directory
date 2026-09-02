import type { APIRoute } from 'astro';
import { runHourly } from '../../../services/cron.service';

export const prerender = false;

/** Dev-only manual trigger for the hourly job (workerd dev has no cron). */
export const POST: APIRoute = async ({ locals, request }) => {
  const { deps } = locals;
  if (!deps.isDev) return new Response('Not found', { status: 404 });
  if (request.headers.get('x-seed-token') !== deps.env.SEED_TOKEN) return new Response('Forbidden', { status: 403 });
  return Response.json(await runHourly(deps));
};
