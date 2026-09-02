import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { PRODUCT_CODES } from '../infra/db/schema';

/** Placeholder until the payments phase wires Midtrans; keeps the client contract stable. */
export const checkout = {
  createOrder: defineAction({
    input: z.object({ productCode: z.enum(PRODUCT_CODES), listingId: z.string().optional() }),
    handler: async () => {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'payments_unavailable' });
      // eslint-disable-next-line no-unreachable
      return { orderId: '', snapToken: '', snapJsUrl: '', clientKey: '', devAutoPaid: false };
    },
  }),
  orderStatus: defineAction({
    input: z.object({ orderId: z.string() }),
    handler: async () => ({ status: 'pending' as 'pending' | 'paid' | 'failed' | 'expired' }),
  }),
};
