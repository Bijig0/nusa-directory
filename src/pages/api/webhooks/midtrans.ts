import type { APIRoute } from 'astro';
import { handleMidtransNotification } from '../../../services/checkout.service';

export const prerender = false;

/** Midtrans HTTP notification endpoint. Configure it in the Midtrans dashboard as {PUBLIC_SITE_URL}/api/webhooks/midtrans */
export const POST: APIRoute = async ({ request, locals }) => {
  const payload = await request.json().catch(() => null);
  const outcome = await handleMidtransNotification(locals.deps, payload);
  return new Response(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } });
};
