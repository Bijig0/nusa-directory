import { site, type Locale } from '../../site.config';

export type Dict = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number>>;

export const locales: readonly Locale[] = site.locales;
export const defaultLocale: Locale = site.defaultLocale;

export const isLocale = (value: string | undefined): value is Locale =>
  value !== undefined && (locales as readonly string[]).includes(value);

/** Interpolates `{name}` placeholders. Missing keys fall back to the key itself. */
export const translate =
  (dict: Dict) =>
  (key: string, params: Params = {}): string => {
    const template = dict[key] ?? key;
    return Object.entries(params).reduce(
      (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
      template,
    );
  };

/** Path prefix for a locale: '' for the default locale, '/en' otherwise. */
export const localePrefix = (locale: Locale): string =>
  locale === defaultLocale ? '' : `/${locale}`;

/** Static pages whose slug is translated per locale (key = Indonesian slug). */
const TRANSLATED_SLUGS: Record<string, Partial<Record<Locale, string>>> = {
  syarat: { en: 'terms' },
  privasi: { en: 'privacy' },
  'kebijakan-konten': { en: 'content-policy' },
  'anti-perdagangan-manusia': { en: 'anti-trafficking' },
};

/** Builds the same path for a target locale. `path` must be locale-less (e.g. '/batam/escorts/'). */
export const localizedPath = (locale: Locale, path: string): string => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const segment = normalized.split('/')[1] ?? '';
  const translated = TRANSLATED_SLUGS[segment]?.[locale];
  const localized = translated ? normalized.replace(`/${segment}/`, `/${translated}/`) : normalized;
  return `${localePrefix(locale)}${localized}`;
};

/** Strips a leading locale prefix from a pathname, returning the locale and the locale-less path. */
export const splitLocale = (pathname: string): { locale: Locale; path: string } => {
  const match = /^\/([a-z]{2})(\/|$)/.exec(pathname);
  const candidate = match?.[1];
  if (candidate && candidate !== defaultLocale && isLocale(candidate)) {
    return { locale: candidate, path: pathname.slice(candidate.length + 1) || '/' };
  }
  return { locale: defaultLocale, path: pathname };
};

export interface Alternate {
  hreflang: string;
  href: string;
}

/** hreflang alternates (all locales + x-default pointing at the default locale). */
export const alternates = (path: string, origin: string): readonly Alternate[] => [
  ...locales.map((locale) => ({ hreflang: locale, href: `${origin}${localizedPath(locale, path)}` })),
  { hreflang: 'x-default', href: `${origin}${localizedPath(defaultLocale, path)}` },
];

export const ogLocale = (locale: Locale): string => (locale === 'id' ? 'id_ID' : 'en_US');
