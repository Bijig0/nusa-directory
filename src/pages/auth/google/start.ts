import type { APIRoute } from 'astro';
import { googleClient, googleAuthUrl } from '../../../infra/auth/google';
import { safeNext } from '../../../services/auth.service';

export const prerender = false;

export const GET: APIRoute = ({ locals, cookies, url, redirect }) => {
  const { env, siteUrl, isDev } = locals.deps;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return new Response('Google sign-in is not configured', { status: 503 });
  const client = googleClient(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, `${siteUrl}/auth/google/callback`);
  const { url: authUrl, state, verifier } = googleAuthUrl(client);
  const opts = { httpOnly: true, secure: !isDev, sameSite: 'lax' as const, path: '/', maxAge: 600 };
  cookies.set('g_state', state, opts);
  cookies.set('g_verifier', verifier, opts);
  cookies.set('g_next', safeNext(url.searchParams.get('next')), opts);
  if (url.searchParams.get('link') === '1' && locals.user) cookies.set('g_link', locals.user.id, opts);
  return redirect(authUrl.toString(), 302);
};
