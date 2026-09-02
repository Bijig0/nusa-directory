import { describe, expect, it } from 'vitest';
import { parseFilters, filtersToQuery, isIndexable, toFtsQuery, toLikePatterns, paginate } from '@/domain/search';

describe('parseFilters', () => {
  it('parses valid params and drops invalid ones', () => {
    const f = parseFilters(new URLSearchParams('age_min=20&age_max=abc&price_max=500000&gender=female&incall=1&sort=price_asc&page=2&q=+pijat+'));
    expect(f).toMatchObject({ ageMin: 20, ageMax: undefined, priceMax: 500000, gender: 'female', incall: true, sort: 'price_asc', page: 2, q: 'pijat' });
  });
  it('ignores unknown sorts and genders', () => {
    const f = parseFilters(new URLSearchParams('sort=hack&gender=robot&page=0'));
    expect(f.sort).toBe('bumped');
    expect(f.gender).toBeUndefined();
    expect(f.page).toBe(1);
  });
  it('fixed area wins over query area', () => {
    expect(parseFilters(new URLSearchParams('area=jodoh'), 'nagoya').area).toBe('nagoya');
  });
});

describe('filtersToQuery', () => {
  it('omits defaults and round-trips', () => {
    const f = parseFilters(new URLSearchParams('age_min=20&verified=1&page=3'));
    expect(filtersToQuery(f)).toBe('?age_min=20&verified=1&page=3');
    expect(filtersToQuery(f, { page: 1 })).toBe('?age_min=20&verified=1');
    expect(filtersToQuery(parseFilters(new URLSearchParams()))).toBe('');
  });
});

describe('isIndexable', () => {
  it('only area/page pages are indexable', () => {
    expect(isIndexable(parseFilters(new URLSearchParams('page=2'), 'nagoya'))).toBe(true);
    expect(isIndexable(parseFilters(new URLSearchParams('verified=1')))).toBe(false);
    expect(isIndexable(parseFilters(new URLSearchParams('sort=newest')))).toBe(false);
  });
});

describe('search text', () => {
  it('builds a safe FTS expression', () => {
    expect(toFtsQuery('pijat "panggilan" OR 1=1 nagoya')).toBe('"pijat"* AND "panggilan"* AND "or"* AND "nagoya"*');
    expect(toFtsQuery('a')).toBeUndefined();
  });
  it('builds LIKE patterns within the D1 limit', () => {
    expect(toLikePatterns('pijat panggilan')).toEqual(['%pijat%', '%panggilan%']);
    expect(toLikePatterns('x'.repeat(100))[0]!.length).toBeLessThanOrEqual(42);
  });
});

describe('paginate', () => {
  it('clamps page and computes offsets', () => {
    expect(paginate(5, 30, 24)).toMatchObject({ page: 2, totalPages: 2, offset: 24, hasPrev: true, hasNext: false });
    expect(paginate(0, 0)).toMatchObject({ page: 1, totalPages: 1, offset: 0 });
  });
});
