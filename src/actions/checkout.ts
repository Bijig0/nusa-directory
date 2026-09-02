import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { PRODUCT_CODES } from '../infra/db/schema';
import { createOrder, orderStatusFor } from '../services/checkout.service';
import { actingPrincipal, readPrincipal } from '../services/principal.service';

export const checkout = {
  createOrder: defineAction({
    input: z.object({ productCode: z.enum(PRODUCT_CODES), listingId: z.string().optional() }),
    handler: async ({ productCode, listingId }, context) => {
      const principal = await actingPrincipal(context.locals, context.cookies, context.request);
      const r = await createOrder(context.locals.deps, principal, productCode, listingId, context.locals.locale);
      if (!r.ok) throw new ActionError({ code: r.error === 'forbidden' ? 'FORBIDDEN' : 'BAD_REQUEST', message: r.error });
      return r.value;
    },
  }),
  orderStatus: defineAction({
    input: z.object({ orderId: z.string().max(40) }),
    handler: async ({ orderId }, context) => {
      const principal = await readPrincipal(context.locals, context.cookies);
      const r = await orderStatusFor(context.locals.deps, principal, orderId);
      if (!r) throw new ActionError({ code: 'NOT_FOUND' });
      return r;
    },
  }),
};
