import { describe, expect, it } from 'vitest';
import { slugify, parseListingSegment, listingSegment, isSafeAreaSlug, listingPath } from '@/domain/slug';

describe('slugify', () => {
  it('lowercases, strips accents and collapses separators', () => {
    expect(slugify('  Sari — Pijat Panggilan 24 Jam!! ')).toBe('sari-pijat-panggilan-24-jam');
    expect(slugify('Café Ñandú')).toBe('cafe-nandu');
  });
  it('never returns an empty slug and respects max length', () => {
    expect(slugify('!!!')).toBe('iklan');
    expect(slugify('a'.repeat(100), 10)).toHaveLength(10);
    expect(slugify('abc-def-ghi', 8)).toBe('abc-def');
  });
});

describe('listing segments', () => {
  it('round-trips slug and short id', () => {
    const seg = listingSegment('sari-pijat', 'abc12de');
    expect(parseListingSegment(seg)).toEqual({ slug: 'sari-pijat', shortId: 'abc12de' });
  });
  it('rejects area-like segments', () => {
    expect(parseListingSegment('nagoya')).toBeUndefined();
    expect(parseListingSegment('batam-centre')).toBeUndefined();
    expect(parseListingSegment('harbour-bay')).toBeUndefined();
  });
  it('rejects invalid short ids (uppercase or ambiguous letters)', () => {
    expect(parseListingSegment('x-ABC12DE')).toBeUndefined();
    expect(parseListingSegment('x-abcilou')).toBeUndefined();
  });
  it('validates area slugs', () => {
    expect(isSafeAreaSlug('batam-centre')).toBe(true);
    expect(isSafeAreaSlug('area-abc12de')).toBe(false);
    expect(isSafeAreaSlug('Bad Slug')).toBe(false);
  });
  it('builds listing paths', () => {
    expect(listingPath('batam', 'escorts', 'sari', 'abc12de')).toBe('/batam/escorts/sari-abc12de/');
  });
});
