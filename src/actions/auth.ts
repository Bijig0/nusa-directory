import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { requestOtp, verifyOtp, startSession, safeNext } from '../services/auth.service';
import { clientIp } from '../services/device.service';
import { setDisplayName } from '../infra/db/repos/auth';

export const auth = {
  requestOtp: defineAction({
    input: z.object({ channel: z.enum(['wa', 'email']), destination: z.string().min(3).max(120), link: z.boolean().optional() }),
    handler: async ({ channel, destination, link }, context) => {
      const { deps, locale, user } = context.locals;
      const result = await requestOtp(deps, { channel, destination, ip: clientIp(context.request), locale, linkUserId: link && user ? user.id : undefined });
      if (!result.ok) throw new ActionError({ code: result.error === 'throttled' ? 'TOO_MANY_REQUESTS' : 'BAD_REQUEST', message: result.error });
      return result.value;
    },
  }),
  verifyOtp: defineAction({
    input: z.object({ otpId: z.string().min(10), code: z.string().regex(/^\d{6}$/), next: z.string().optional() }),
    handler: async ({ otpId, code, next }, context) => {
      const { deps, user } = context.locals;
      const result = await verifyOtp(deps, otpId, code);
      if (!result.ok) throw new ActionError({ code: 'BAD_REQUEST', message: result.error });
      if (!result.value.linked || !user) await startSession(deps, context.cookies, context.request, result.value.user);
      return { redirect: safeNext(next), isNew: result.value.isNew, linked: result.value.linked };
    },
  }),
  updateProfile: defineAction({
    input: z.object({ displayName: z.string().trim().max(40) }),
    handler: async ({ displayName }, context) => {
      const { deps, user } = context.locals;
      if (!user) throw new ActionError({ code: 'UNAUTHORIZED' });
      await setDisplayName(deps.db, user.id, displayName || null).run();
      return { ok: true };
    },
  }),
};
