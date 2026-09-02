import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { adminListingAction, adminUserAction, adminReportAction, adminReviewAction, adminSetPrice, adminAddArea, adminToggleArea, adminToggleCity } from '../services/admin.service';
import { PRODUCT_CODES } from '../infra/db/schema';

const requireAdmin = (context: { locals: App.Locals }) => {
  if (!context.locals.user || !context.locals.isAdmin) throw new ActionError({ code: 'FORBIDDEN' });
  return context.locals.user;
};

/** Admin actions accept HTML form posts so the panel works without client JS. */
export const admin = {
  listing: defineAction({
    accept: 'form',
    input: z.object({ listingId: z.string().max(40), action: z.enum(['approve', 'hide', 'unhide', 'remove', 'verify', 'unverify', 'grant_featured', 'grant_vip']) }),
    handler: async ({ listingId, action }, context) => {
      const admin = requireAdmin(context);
      const l = await adminListingAction(context.locals.deps, admin.id, listingId, action);
      if (!l) throw new ActionError({ code: 'NOT_FOUND' });
      return { status: l.status, moderation: l.moderation, verified: l.verified };
    },
  }),
  user: defineAction({
    accept: 'form',
    input: z.object({ userId: z.string().max(40), action: z.enum(['ban', 'unban', 'add_credits']), reason: z.string().max(200).optional() }),
    handler: async ({ userId, action, reason }, context) => {
      const admin = requireAdmin(context);
      if (!(await adminUserAction(context.locals.deps, admin.id, userId, action, reason))) throw new ActionError({ code: 'NOT_FOUND' });
      return { ok: true };
    },
  }),
  report: defineAction({
    accept: 'form',
    input: z.object({ reportId: z.string().max(40), status: z.enum(['resolved', 'dismissed']) }),
    handler: async ({ reportId, status }, context) => {
      const admin = requireAdmin(context);
      await adminReportAction(context.locals.deps, admin.id, reportId, status);
      return { ok: true };
    },
  }),
  review: defineAction({
    accept: 'form',
    input: z.object({ reviewId: z.string().max(40), status: z.enum(['approved', 'rejected']) }),
    handler: async ({ reviewId, status }, context) => {
      const admin = requireAdmin(context);
      await adminReviewAction(context.locals.deps, admin.id, reviewId, status);
      return { ok: true };
    },
  }),
  price: defineAction({
    accept: 'form',
    input: z.object({ code: z.enum(PRODUCT_CODES), priceIdr: z.coerce.number().int().min(1000).max(100_000_000), isActive: z.coerce.boolean().optional() }),
    handler: async ({ code, priceIdr, isActive }, context) => {
      const admin = requireAdmin(context);
      await adminSetPrice(context.locals.deps, admin.id, code, priceIdr, isActive ?? false);
      return { ok: true };
    },
  }),
  addArea: defineAction({
    accept: 'form',
    input: z.object({ cityId: z.string().max(60), nameId: z.string().trim().min(2).max(60), nameEn: z.string().trim().max(60).optional() }),
    handler: async ({ cityId, nameId, nameEn }, context) => {
      const admin = requireAdmin(context);
      const r = await adminAddArea(context.locals.deps, admin.id, cityId, nameId, nameEn ?? '');
      if (r !== 'ok') throw new ActionError({ code: 'BAD_REQUEST', message: r });
      return { ok: true };
    },
  }),
  toggleGeo: defineAction({
    accept: 'form',
    input: z.object({ kind: z.enum(['city', 'area']), id: z.string().max(80), isActive: z.enum(['0', '1']) }),
    handler: async ({ kind, id, isActive }, context) => {
      requireAdmin(context);
      if (kind === 'city') await adminToggleCity(context.locals.deps, id, isActive === '1');
      else await adminToggleArea(context.locals.deps, id, isActive === '1');
      return { ok: true };
    },
  }),
};
