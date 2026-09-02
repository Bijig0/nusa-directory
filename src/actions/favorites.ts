import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { actingPrincipal } from '../services/principal.service';
import { toggleFavorite } from '../infra/db/repos/wallets';
import { incrementStat } from '../infra/db/repos/stats';

export const favorites = {
  toggle: defineAction({
    input: z.object({ listingId: z.string().min(10).max(40) }),
    handler: async ({ listingId }, context) => {
      const { deps } = context.locals;
      const principal = await actingPrincipal(context.locals, context.cookies, context.request);
      const favorited = await toggleFavorite(deps.db, principal.walletId!, listingId, deps.clock.now());
      if (favorited) deps.waitUntil(incrementStat(deps.db, listingId, 'favorites', deps.clock.now()));
      return { favorited };
    },
  }),
};
