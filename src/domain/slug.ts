import { isShortId, SHORT_ID_LENGTH } from './ids';

const ASCII_MAP: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a', æ: 'ae',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', ö: 'o', õ: 'o', ø: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n', ß: 'ss', ý: 'y', ÿ: 'y',
};

/** Lowercase, ASCII-only, hyphen separated. Never longer than `maxLength`, never empty. */
export const slugify = (input: string, maxLength = 60): string => {
  const ascii = Array.from(input.toLowerCase().normalize('NFKD'))
    .map((ch) => ASCII_MAP[ch] ?? ch)
    .join('')
    .replace(/[̀-ͯ]/g, '');
  const slug = ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'iklan';
};

export interface ListingSegment {
  slug: string;
  shortId: string;
}

/** Parses `<slug>-<shortId>`; returns undefined when the segment is not a listing URL. */
export const parseListingSegment = (segment: string): ListingSegment | undefined => {
  if (segment.length < SHORT_ID_LENGTH + 2) return undefined;
  const shortId = segment.slice(-SHORT_ID_LENGTH);
  const separator = segment.charAt(segment.length - SHORT_ID_LENGTH - 1);
  if (separator !== '-' || !isShortId(shortId)) return undefined;
  const slug = segment.slice(0, -SHORT_ID_LENGTH - 1);
  return slug.length > 0 ? { slug, shortId } : undefined;
};

export const listingSegment = (slug: string, shortId: string): string => `${slug}-${shortId}`;

/** Locale-less canonical path of a listing. */
export const listingPath = (citySlug: string, categorySlug: string, slug: string, shortId: string): string =>
  `/${citySlug}/${categorySlug}/${listingSegment(slug, shortId)}/`;

export const cityPath = (citySlug: string): string => `/${citySlug}/`;
export const categoryPath = (citySlug: string, categorySlug: string): string => `/${citySlug}/${categorySlug}/`;
export const areaPath = (citySlug: string, categorySlug: string, areaSlug: string): string =>
  `/${citySlug}/${categorySlug}/${areaSlug}/`;

/** Area slugs must never be mistaken for a listing segment. */
export const isSafeAreaSlug = (slug: string): boolean =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && parseListingSegment(slug) === undefined;
