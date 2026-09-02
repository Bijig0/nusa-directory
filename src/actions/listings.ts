import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { saveListing, publishListing, pauseListing, renewListing, removeListing, type ListingError } from '../services/listing.service';
import type { Listing } from '../infra/db/schema';

const requireUser = (context: { locals: App.Locals }) => {
  if (!context.locals.user) throw new ActionError({ code: 'UNAUTHORIZED' });
  return context.locals.user;
};

const toActionError = (e: ListingError): never => {
  if (e.kind === 'validation') throw new ActionError({ code: 'BAD_REQUEST', message: JSON.stringify({ kind: 'validation', fields: e.fields }) });
  if (e.kind === 'not_found') throw new ActionError({ code: 'NOT_FOUND' });
  if (e.kind === 'forbidden') throw new ActionError({ code: 'FORBIDDEN' });
  throw new ActionError({ code: 'BAD_REQUEST', message: JSON.stringify(e) });
};

const summary = (l: Listing) => ({ id: l.id, shortId: l.shortId, slug: l.slug, status: l.status, moderation: l.moderation, photoCount: l.photoCount, expiresAt: l.expiresAt?.getTime() ?? null });

export const listings = {
  save: defineAction({
    input: z.object({ id: z.string().optional(), data: z.record(z.string(), z.unknown()) }),
    handler: async ({ id, data }, context) => {
      const user = requireUser(context);
      const r = await saveListing(context.locals.deps, user, data, id);
      return r.ok ? summary(r.value) : toActionError(r.error);
    },
  }),
  publish: defineAction({
    input: z.object({ id: z.string(), declarationAccepted: z.boolean() }),
    handler: async ({ id, declarationAccepted }, context) => {
      const user = requireUser(context);
      const r = await publishListing(context.locals.deps, user, id, declarationAccepted);
      return r.ok ? summary(r.value) : toActionError(r.error);
    },
  }),
  pause: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }, context) => {
      const r = await pauseListing(context.locals.deps, requireUser(context), id);
      return r.ok ? summary(r.value) : toActionError(r.error);
    },
  }),
  renew: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }, context) => {
      const r = await renewListing(context.locals.deps, requireUser(context), id);
      return r.ok ? summary(r.value) : toActionError(r.error);
    },
  }),
  remove: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }, context) => {
      const r = await removeListing(context.locals.deps, requireUser(context), id);
      return r.ok ? summary(r.value) : toActionError(r.error);
    },
  }),
};
