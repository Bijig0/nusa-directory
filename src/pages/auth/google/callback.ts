import type { APIRoute } from 'astro';
import { googleClient, googleExchange } from '../../../infra/auth/google';
import { signInWithGoogle, startSession, safeNext } from '../../../services/auth.service';

export const prerender = false;

export const GET: APIRoute = async ({ locals, cookies, url, request, redirect }) => {
  const { deps } = locals;
  const { env, siteUrl } = deps;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = cookies.get('g_state')?.value;
  const verifier = cookies.get('g_verifier')?.value;
  const next = safeNext(cookies.get('g_next')?.value);
  const linkUserId = cookies.get('g_link')?.value ?? null;
  for (const name of ['g_state', 'g_verifier', 'g_next', 'g_link']) cookies.delete(name, { path: '/' });
  if (!code || !state || !savedState || !verifier || state !== savedState || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return redirect('/auth/login/?error=google', 302);
  }
  try {
    const client = googleClient(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, `${siteUrl}/auth/google/callback`);
    const claims = await googleExchange(client, code, verifier);
    const result = await signInWithGoogle(deps, claims, linkUserId && locals.user?.id === linkUserId ? linkUserId : null);
    if (!result.ok) return redirect(`/auth/login/?error=${result.error}`, 302);
    if (!result.value.linked || !locals.user) await startSession(deps, cookies, request, result.value.user);
    return redirect(next, 302);
  } catch (error) {
    console.error('[google] callback failed', error);
    return redirect('/auth/login/?error=google', 302);
  }
};
