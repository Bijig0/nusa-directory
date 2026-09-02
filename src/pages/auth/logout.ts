import type { APIRoute } from 'astro';
import { endSession } from '../../services/auth.service';

export const prerender = false;

export const POST: APIRoute = async ({ locals, cookies, request, redirect }) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new Response('Forbidden', { status: 403 });
  await endSession(locals.deps, cookies);
  return redirect('/', 303);
};
