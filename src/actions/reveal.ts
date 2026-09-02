import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { revealContact } from '../services/reveal.service';
import { actingPrincipal } from '../services/principal.service';
import { clientIp } from '../services/device.service';

export const reveal = {
  reveal: defineAction({
    input: z.object({ listingId: z.string().min(10).max(40) }),
    handler: async ({ listingId }, context) => {
      const principal = await actingPrincipal(context.locals, context.cookies, context.request);
      const result = await revealContact(context.locals.deps, principal, listingId, clientIp(context.request), context.locals.locale);
      if (result.status === 'not_found') throw new ActionError({ code: 'NOT_FOUND' });
      if (result.status === 'rate_limited') throw new ActionError({ code: 'TOO_MANY_REQUESTS' });
      return result;
    },
  }),
};
