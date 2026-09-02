import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { REPORT_REASONS } from '../infra/db/schema';
import { submitReport, submitReview, posterReply } from '../services/moderation.service';
import { actingPrincipal } from '../services/principal.service';
import { clientIp } from '../services/device.service';

export const reports = {
  create: defineAction({
    input: z.object({ listingId: z.string().max(40), reason: z.enum(REPORT_REASONS), details: z.string().max(1000).optional() }),
    handler: async ({ listingId, reason, details }, context) => {
      const p = await actingPrincipal(context.locals, context.cookies, context.request);
      const r = await submitReport(context.locals.deps, p, listingId, reason, details, clientIp(context.request));
      if (!r.ok) throw new ActionError({ code: r.error === 'not_found' ? 'NOT_FOUND' : 'TOO_MANY_REQUESTS' });
      return { ok: true };
    },
  }),
};

export const reviews = {
  create: defineAction({
    input: z.object({ listingId: z.string().max(40), rating: z.number().int().min(1).max(5), body: z.string().trim().min(10).max(1000) }),
    handler: async ({ listingId, rating, body }, context) => {
      const p = await actingPrincipal(context.locals, context.cookies, context.request);
      const r = await submitReview(context.locals.deps, p, listingId, rating, body, clientIp(context.request));
      if (!r.ok) throw new ActionError({ code: r.error === 'not_found' ? 'NOT_FOUND' : r.error === 'rate_limited' ? 'TOO_MANY_REQUESTS' : 'BAD_REQUEST', message: r.error });
      return { ok: true };
    },
  }),
  reply: defineAction({
    accept: 'form',
    input: z.object({ reviewId: z.string().max(40), reply: z.string().trim().min(1).max(500) }),
    handler: async ({ reviewId, reply }, context) => {
      if (!context.locals.user) throw new ActionError({ code: 'UNAUTHORIZED' });
      const r = await posterReply(context.locals.deps, context.locals.user.id, reviewId, reply);
      if (!r.ok) throw new ActionError({ code: r.error === 'forbidden' ? 'FORBIDDEN' : 'NOT_FOUND' });
      return { ok: true };
    },
  }),
};
