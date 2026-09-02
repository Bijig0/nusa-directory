import type { Product } from '../infra/db/schema';

const DAY_MS = 86_400_000;

export interface BoostPatch {
  bumpedAt: Date;
  featuredUntil?: Date;
  vipUntil?: Date;
  type: 'bump' | 'featured' | 'vip';
  endsAt: Date | null;
}

/** Effect of buying a boost product on a listing. Every boost also bumps. Durations extend an active boost. */
export const applyBoost = (product: Pick<Product, 'code' | 'durationDays'>, current: { featuredUntil: Date | null; vipUntil: Date | null }, now: Date): BoostPatch | undefined => {
  const extendFrom = (until: Date | null): Date => new Date(Math.max(now.getTime(), until?.getTime() ?? 0) + (product.durationDays ?? 0) * DAY_MS);
  switch (product.code) {
    case 'bump':
      return { bumpedAt: now, type: 'bump', endsAt: null };
    case 'featured_7d': {
      const until = extendFrom(current.featuredUntil);
      return { bumpedAt: now, featuredUntil: until, type: 'featured', endsAt: until };
    }
    case 'vip_30d': {
      const until = extendFrom(current.vipUntil);
      return { bumpedAt: now, vipUntil: until, featuredUntil: current.featuredUntil && current.featuredUntil > until ? current.featuredUntil : until, type: 'vip', endsAt: until };
    }
    default:
      return undefined;
  }
};

export const ORDER_TTL_MINUTES = 60;
