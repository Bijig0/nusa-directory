import type { ProductCode } from '../infra/db/schema';

export interface ProductSeed {
  id: string;
  code: ProductCode;
  kind: 'reveal_pack' | 'boost';
  nameId: string;
  nameEn: string;
  priceIdr: number;
  credits: number | null;
  durationDays: number | null;
  sortOrder: number;
}

export const productSeeds: readonly ProductSeed[] = [
  { id: 'prod_reveal_5', code: 'reveal_5', kind: 'reveal_pack', nameId: '5 Reveal', nameEn: '5 Reveals', priceIdr: 25_000, credits: 5, durationDays: null, sortOrder: 1 },
  { id: 'prod_reveal_15', code: 'reveal_15', kind: 'reveal_pack', nameId: '15 Reveal', nameEn: '15 Reveals', priceIdr: 60_000, credits: 15, durationDays: null, sortOrder: 2 },
  { id: 'prod_reveal_50', code: 'reveal_50', kind: 'reveal_pack', nameId: '50 Reveal', nameEn: '50 Reveals', priceIdr: 150_000, credits: 50, durationDays: null, sortOrder: 3 },
  { id: 'prod_bump', code: 'bump', kind: 'boost', nameId: 'Naikkan ke atas', nameEn: 'Bump to top', priceIdr: 15_000, credits: null, durationDays: null, sortOrder: 10 },
  { id: 'prod_featured_7d', code: 'featured_7d', kind: 'boost', nameId: 'Unggulan 7 hari', nameEn: 'Featured 7 days', priceIdr: 75_000, credits: null, durationDays: 7, sortOrder: 11 },
  { id: 'prod_vip_30d', code: 'vip_30d', kind: 'boost', nameId: 'VIP 30 hari', nameEn: 'VIP 30 days', priceIdr: 250_000, credits: null, durationDays: 30, sortOrder: 12 },
];
