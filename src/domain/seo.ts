import type { Locale } from '../../site.config';
import { seoTemplate, monthName } from '../i18n/seo-templates';
import { translate } from './i18n';

export interface PageSeo {
  title: string;
  description: string;
  h1: string;
  intro: string;
}

export interface SeoContext {
  locale: Locale;
  brand: string;
  now: Date;
  city: string;
  category?: string;
  area?: string;
  count: number;
  areaNames: readonly string[];
}

const joinNames = (names: readonly string[], locale: Locale, max: number): string => {
  const picked = names.slice(0, max);
  if (picked.length === 0) return locale === 'en' ? 'the city centre' : 'pusat kota';
  if (picked.length === 1) return picked[0]!;
  const conj = locale === 'en' ? 'and' : 'dan';
  return `${picked.slice(0, -1).join(', ')} ${conj} ${picked.at(-1)}`;
};

const fill = (template: string, params: Record<string, string | number>): string =>
  Object.entries(params).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), template);

/** Builds title/description/H1/intro for city, category and area landing pages. */
export const landingSeo = (ctx: SeoContext): PageSeo => {
  const kind = ctx.area ? 'area' : ctx.category ? 'category' : 'city';
  const tpl = seoTemplate(ctx.locale, kind, ctx.count);
  const params = {
    brand: ctx.brand,
    city: ctx.city,
    category: ctx.category ?? '',
    area: ctx.area ?? '',
    count: ctx.count,
    month: monthName(ctx.locale, ctx.now),
    year: ctx.now.getFullYear(),
    areas: joinNames(ctx.areaNames, ctx.locale, 4),
    topAreas: joinNames(ctx.areaNames, ctx.locale, 3),
  };
  return { title: fill(tpl.title, params), description: fill(tpl.description, params), h1: fill(tpl.h1, params), intro: fill(tpl.intro, params) };
};

export interface ListingSeoInput {
  locale: Locale;
  brand: string;
  title: string;
  excerpt: string;
  city: string;
  category: string;
  area?: string;
}

export const listingSeo = (i: ListingSeoInput): PageSeo => {
  const tpl = seoTemplate(i.locale, 'listing');
  const params = { brand: i.brand, title: i.title, excerpt: i.excerpt, city: i.city, category: i.category, area: i.area ? `${i.area}, ` : '' };
  return { title: fill(tpl.title, params), description: fill(tpl.description, params), h1: i.title, intro: '' };
};

// ---------------------------------------------------------------------------
// JSON-LD builders
// ---------------------------------------------------------------------------

export interface Crumb {
  name: string;
  url: string;
}

export const breadcrumbList = (crumbs: readonly Crumb[]): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
});

export const itemList = (items: readonly { name: string; url: string }[]): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: it.url, name: it.name })),
});

export const webPage = (p: { name: string; description: string; url: string; image?: string; datePublished?: Date; dateModified?: Date; locale: Locale }): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: p.name,
  description: p.description,
  url: p.url,
  inLanguage: p.locale,
  ...(p.image ? { primaryImageOfPage: { '@type': 'ImageObject', url: p.image } } : {}),
  ...(p.datePublished ? { datePublished: p.datePublished.toISOString() } : {}),
  ...(p.dateModified ? { dateModified: p.dateModified.toISOString() } : {}),
});

export const article = (p: { headline: string; description: string; url: string; datePublished: Date; dateModified: Date; brand: string; locale: Locale; image?: string }): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: p.headline,
  description: p.description,
  url: p.url,
  inLanguage: p.locale,
  datePublished: p.datePublished.toISOString(),
  dateModified: p.dateModified.toISOString(),
  author: { '@type': 'Organization', name: p.brand },
  publisher: { '@type': 'Organization', name: p.brand },
  ...(p.image ? { image: p.image } : {}),
});

export const websiteAndOrg = (p: { brand: string; origin: string; locale: Locale; searchPath?: string }): readonly Record<string, unknown>[] => [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: p.brand,
    url: p.origin,
    inLanguage: p.locale,
    ...(p.searchPath
      ? { potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${p.origin}${p.searchPath}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } }
      : {}),
  },
  { '@context': 'https://schema.org', '@type': 'Organization', name: p.brand, url: p.origin },
];

/** Relative-time label for cards ("2 jam lalu"). */
export const relativeTime = (locale: Locale, at: Date, now: Date): string => {
  const t = translate(locale === 'en'
    ? { now: 'just now', m: '{n} min ago', h: '{n} h ago', d: '{n} d ago' }
    : { now: 'baru saja', m: '{n} mnt lalu', h: '{n} jam lalu', d: '{n} hari lalu' });
  const diff = Math.max(0, now.getTime() - at.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('now');
  if (minutes < 60) return t('m', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('h', { n: hours });
  return t('d', { n: Math.floor(hours / 24) });
};
