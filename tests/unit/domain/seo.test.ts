import { describe, expect, it } from 'vitest';
import { landingSeo, listingSeo, breadcrumbList, relativeTime } from '@/domain/seo';

const now = new Date('2026-09-02T10:00:00Z');

describe('landingSeo', () => {
  it('fills category templates in Indonesian', () => {
    const seo = landingSeo({ locale: 'id', brand: 'Nusa', now, city: 'Batam', category: 'Pendamping', count: 12, areaNames: ['Nagoya', 'Jodoh', 'Harbour Bay', 'Batam Centre', 'Tiban'] });
    expect(seo.title).toBe('Pendamping di Batam — 12 Iklan Terbaru September 2026 | Nusa');
    expect(seo.h1).toBe('Pendamping di Batam');
    expect(seo.intro).toContain('Nagoya, Jodoh dan Harbour Bay');
    expect(seo.description).toContain('Nagoya, Jodoh, Harbour Bay dan Batam Centre');
  });
  it('fills area templates in English', () => {
    const seo = landingSeo({ locale: 'en', brand: 'Nusa', now, city: 'Batam', category: 'Escorts', area: 'Nagoya', count: 3, areaNames: [] });
    expect(seo.title).toBe('Escorts in Nagoya, Batam — 3 Ads September 2026 | Nusa');
    expect(seo.intro).toContain('Nagoya, Batam');
  });
  it('drops the count from every field when a page has no ads yet', () => {
    for (const locale of ['id', 'en'] as const) {
      const seo = landingSeo({ locale, brand: 'Nusa', now, city: 'Batam', category: 'Pendamping', count: 0, areaNames: ['Nagoya'] });
      for (const field of [seo.title, seo.description, seo.intro]) expect(field).not.toMatch(/0/);
      expect(seo.title).toContain('Batam');
      expect(seo.h1).toContain('Pendamping');
    }
    const area = landingSeo({ locale: 'id', brand: 'Nusa', now, city: 'Batam', category: 'Pendamping', area: 'Nagoya', count: 0, areaNames: [] });
    expect(area.title).not.toMatch(/0/);
    expect(area.intro).toContain('Nagoya');
  });
  it('falls back gracefully with no areas', () => {
    const seo = landingSeo({ locale: 'id', brand: 'Nusa', now, city: 'Batam', count: 0, areaNames: [] });
    expect(seo.intro).toContain('pusat kota');
  });
});

describe('listingSeo', () => {
  it('includes area and city', () => {
    const seo = listingSeo({ locale: 'id', brand: 'Nusa', title: 'Sari 23th', excerpt: 'Halo', city: 'Batam', category: 'Pendamping', area: 'Nagoya' });
    expect(seo.title).toBe('Sari 23th — Pendamping Nagoya, Batam | Nusa');
    expect(seo.description).toBe('Halo');
  });
});

describe('json-ld', () => {
  it('numbers breadcrumb positions', () => {
    const ld = breadcrumbList([{ name: 'A', url: 'https://x/a/' }, { name: 'B', url: 'https://x/b/' }]) as { itemListElement: { position: number }[] };
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
  });
});

describe('relativeTime', () => {
  it('formats by locale', () => {
    expect(relativeTime('id', new Date(now.getTime() - 3 * 3600_000), now)).toBe('3 jam lalu');
    expect(relativeTime('en', new Date(now.getTime() - 2 * 86400_000), now)).toBe('2 d ago');
  });
});
