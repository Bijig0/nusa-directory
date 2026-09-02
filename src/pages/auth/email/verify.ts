import type { APIRoute } from 'astro';
import { verifyMagicLink, startSession, safeNext } from '../../../services/auth.service';

export const prerender = false;

export const GET: APIRoute = async ({ locals, cookies, url, request, redirect }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect('/auth/login/?error=link', 302);
  const result = await verifyMagicLink(locals.deps, token);
  if (!result.ok) return redirect(`/auth/login/?error=${result.error}`, 302);
  if (!result.value.linked || !locals.user) await startSession(locals.deps, cookies, request, result.value.user);
  return redirect(safeNext(url.searchParams.get('next')), 302);
};
