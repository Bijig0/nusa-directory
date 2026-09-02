import type { APIRoute } from 'astro';
import { runHourly } from '../../services/cron.service';

export const prerender = false;

/** Vercel Cron target (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
const handler: APIRoute = async ({ request, locals }) => {
  const { deps } = locals;
  const expected = deps.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) return new Response('Unauthorized', { status: 401 });
  return Response.json(await runHourly(deps), { headers: { 'Cache-Control': 'no-store' } });
};
export const GET = handler;
export const POST = handler;
