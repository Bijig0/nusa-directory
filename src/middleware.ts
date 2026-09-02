import { defineMiddleware, sequence } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { getDict } from './i18n';
import { defaultLocale, isLocale } from './domain/i18n';
import { makeDeps } from './infra/env';

const locale = defineMiddleware((context, next) => {
  const current = context.currentLocale;
  context.locals.locale = isLocale(current) ? current : defaultLocale;
  context.locals.dict = getDict(context.locals.locale);
  return next();
});

/** Canonical page URLs end with a slash; endpoints and files are left alone. */
const EXEMPT_PREFIXES = ['/api/', '/_actions/', '/_astro/', '/img/', '/auth/google/', '/auth/email/', '/auth/logout', '/sitemaps/', '/_image', '/__'];
const trailingSlash = defineMiddleware((context, next) => {
  const { pathname, search } = context.url;
  const isFile = /\.[a-z0-9]{2,5}$/i.test(pathname);
  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
  if (context.request.method === 'GET' && !pathname.endsWith('/') && !isFile && !exempt) {
    return context.redirect(`${pathname}/${search}`, 301);
  }
  return next();
});

const deps = defineMiddleware((context, next) => {
  context.locals.deps = makeDeps(env, context.locals.cfContext);
  return next();
});

const PRIVATE_PREFIXES = ['/admin', '/dashboard', '/auth', '/api', '/_actions', '/favorites'];
const securityHeaders = defineMiddleware(async (context, next) => {
  const response = await next();
  const headers = response.headers;
  const isHtml = (headers.get('Content-Type') ?? '').includes('text/html');
  const isPrivatePath = PRIVATE_PREFIXES.some((p) => context.url.pathname.startsWith(p));
  if (context.request.method === 'GET' && isHtml && response.status === 200 && !isPrivatePath && !context.cookies.has('sid') && !headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  } else if (isHtml && !headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'private, no-store');
  }
  if (!headers.has('Referrer-Policy')) headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!headers.has('X-Content-Type-Options')) headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.has('X-Frame-Options')) headers.set('X-Frame-Options', 'SAMEORIGIN');
  return response;
});

export const onRequest = sequence(trailingSlash, locale, deps, securityHeaders);
