import type { Gender } from '../infra/db/schema';

export const SORTS = ['bumped', 'newest', 'price_asc', 'price_desc'] as const;
export type Sort = (typeof SORTS)[number];

export interface FilterParams {
  area?: string;
  ageMin?: number;
  ageMax?: number;
  priceMin?: number;
  priceMax?: number;
  gender?: Gender;
  nationality?: string;
  incall?: boolean;
  outcall?: boolean;
  verified?: boolean;
  photos?: boolean;
  q?: string;
  sort: Sort;
  page: number;
}

export const PAGE_SIZE = 24;
const GENDERS: readonly Gender[] = ['female', 'male', 'trans', 'couple'];

const intParam = (v: string | null, min: number, max: number): number | undefined => {
  if (v === null || v === '') return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const boolParam = (v: string | null): boolean | undefined => (v === '1' || v === 'true' ? true : undefined);

/** Parses filters from the query string. Invalid values are dropped rather than rejected. */
export const parseFilters = (params: URLSearchParams, fixedArea?: string): FilterParams => {
  const gender = params.get('gender');
  const sort = params.get('sort');
  const q = params.get('q')?.trim().slice(0, 80);
  return {
    area: fixedArea ?? params.get('area')?.trim().toLowerCase() ?? undefined,
    ageMin: intParam(params.get('age_min'), 18, 99),
    ageMax: intParam(params.get('age_max'), 18, 99),
    priceMin: intParam(params.get('price_min'), 0, 1_000_000_000),
    priceMax: intParam(params.get('price_max'), 0, 1_000_000_000),
    gender: gender && (GENDERS as readonly string[]).includes(gender) ? (gender as Gender) : undefined,
    nationality: params.get('nat')?.trim().slice(0, 40) || undefined,
    incall: boolParam(params.get('incall')),
    outcall: boolParam(params.get('outcall')),
    verified: boolParam(params.get('verified')),
    photos: boolParam(params.get('photos')),
    q: q || undefined,
    sort: sort && (SORTS as readonly string[]).includes(sort) ? (sort as Sort) : 'bumped',
    page: intParam(params.get('page'), 1, 10_000) ?? 1,
  };
};

/** Serializes filters back into a query string (omits defaults). Area is a path segment, not a param. */
export const filtersToQuery = (f: FilterParams, overrides: Partial<FilterParams> = {}): string => {
  const merged = { ...f, ...overrides };
  const p = new URLSearchParams();
  if (merged.ageMin !== undefined) p.set('age_min', String(merged.ageMin));
  if (merged.ageMax !== undefined) p.set('age_max', String(merged.ageMax));
  if (merged.priceMin !== undefined) p.set('price_min', String(merged.priceMin));
  if (merged.priceMax !== undefined) p.set('price_max', String(merged.priceMax));
  if (merged.gender) p.set('gender', merged.gender);
  if (merged.nationality) p.set('nat', merged.nationality);
  if (merged.incall) p.set('incall', '1');
  if (merged.outcall) p.set('outcall', '1');
  if (merged.verified) p.set('verified', '1');
  if (merged.photos) p.set('photos', '1');
  if (merged.q) p.set('q', merged.q);
  if (merged.sort !== 'bumped') p.set('sort', merged.sort);
  if (merged.page > 1) p.set('page', String(merged.page));
  const qs = p.toString();
  return qs ? `?${qs}` : '';
};

/** True when the only "filters" are area/page — the URLs we want indexed. */
export const isIndexable = (f: FilterParams): boolean =>
  f.ageMin === undefined && f.ageMax === undefined && f.priceMin === undefined && f.priceMax === undefined &&
  f.gender === undefined && f.nationality === undefined && !f.incall && !f.outcall && !f.verified && !f.photos &&
  f.q === undefined && f.sort === 'bumped';

/**
 * Turns free text into a safe FTS5 MATCH expression: every token quoted, prefix-matched, AND-ed.
 * Returns undefined when nothing usable remains.
 */
export const toFtsQuery = (q: string): string | undefined => {
  const tokens = q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  if (tokens.length === 0) return undefined;
  return tokens.map((t) => `"${t.replaceAll('"', '')}"*`).join(' AND ');
};

/** LIKE fallback patterns (D1 limits LIKE patterns to 50 bytes). */
export const toLikePatterns = (q: string): readonly string[] =>
  q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2)
    .slice(0, 4)
    .map((t) => `%${t.slice(0, 40)}%`);

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  offset: number;
}

export const paginate = (page: number, total: number, pageSize = PAGE_SIZE): Pagination => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    page: current,
    pageSize,
    total,
    totalPages,
    hasPrev: current > 1,
    hasNext: current < totalPages,
    offset: (current - 1) * pageSize,
  };
};
