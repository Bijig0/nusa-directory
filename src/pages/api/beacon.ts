import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { incrementStat } from '../../infra/db/repos/stats';
import { clientIp } from '../../services/device.service';
import { HOUR } from '../../infra/ratelimit';

export const prerender = false;

const schema = z.object({ listingId: z.string().min(10).max(40), event: z.enum(['views', 'wa_clicks', 'tg_clicks']) });

/** Fire-and-forget analytics beacon (navigator.sendBeacon). Always 204. */
export const POST: APIRoute = async ({ request, locals }) => {
  const { deps } = locals;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 204 });
  const now = deps.clock.now();
  const ipHash = await deps.hashForAbuse(clientIp(request));
  const limit = await deps.rateLimiter.hit(`beacon:${ipHash}:${parsed.data.listingId}:${parsed.data.event}`, 3, HOUR, now);
  if (limit.allowed) deps.waitUntil(incrementStat(deps.db, parsed.data.listingId, parsed.data.event, now));
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};
