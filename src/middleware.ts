import { defineMiddleware, sequence } from 'astro:middleware';
import { getDict } from './i18n';
import { defaultLocale, isLocale } from './domain/i18n';

const locale = defineMiddleware((context, next) => {
  const current = context.currentLocale;
  context.locals.locale = isLocale(current) ? current : defaultLocale;
  context.locals.dict = getDict(context.locals.locale);
  return next();
});

const securityHeaders = defineMiddleware(async (_context, next) => {
  const response = await next();
  const headers = response.headers;
  if (!headers.has('Referrer-Policy')) headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!headers.has('X-Content-Type-Options')) headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.has('X-Frame-Options')) headers.set('X-Frame-Options', 'SAMEORIGIN');
  return response;
});

export const onRequest = sequence(locale, securityHeaders);
