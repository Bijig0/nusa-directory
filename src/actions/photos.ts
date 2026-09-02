import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { deletePhoto, reorderListingPhotos } from '../services/photo.service';

export const photos = {
  reorder: defineAction({
    input: z.object({ listingId: z.string(), orderedIds: z.array(z.string()).max(20) }),
    handler: async ({ listingId, orderedIds }, context) => {
      if (!context.locals.user) throw new ActionError({ code: 'UNAUTHORIZED' });
      const r = await reorderListingPhotos(context.locals.deps, context.locals.user, listingId, orderedIds, context.locals.isAdmin);
      if (!r.ok) throw new ActionError({ code: r.error === 'forbidden' ? 'FORBIDDEN' : 'BAD_REQUEST', message: r.error });
      return { ok: true };
    },
  }),
  delete: defineAction({
    input: z.object({ listingId: z.string(), photoId: z.string() }),
    handler: async ({ listingId, photoId }, context) => {
      if (!context.locals.user) throw new ActionError({ code: 'UNAUTHORIZED' });
      const r = await deletePhoto(context.locals.deps, context.locals.user, listingId, photoId, context.locals.isAdmin);
      if (!r.ok) throw new ActionError({ code: r.error === 'forbidden' ? 'FORBIDDEN' : 'BAD_REQUEST', message: r.error });
      return { ok: true };
    },
  }),
};
