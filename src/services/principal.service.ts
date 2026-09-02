import type { AstroCookies } from 'astro';
import type { Deps } from '../infra/env';
import { ensureDevice, readDevice, type Principal } from './device.service';
import type { User } from '../infra/db/schema';

interface LocalsLike {
  deps: Deps;
  user?: User;
  isAdmin: boolean;
}

/** Principal for read-only requests: never creates a device. */
export const readPrincipal = async (locals: LocalsLike, cookies: AstroCookies): Promise<Principal> => {
  const device = await readDevice(locals.deps, cookies);
  return { user: locals.user, isAdmin: locals.isAdmin, device, walletId: locals.user?.walletId ?? device?.walletId };
};

/** Principal for mutations: creates the anonymous device (and cookie) when needed. */
export const actingPrincipal = async (locals: LocalsLike, cookies: AstroCookies, request: Request): Promise<Principal> => {
  const device = await ensureDevice(locals.deps, cookies, request);
  return { user: locals.user, isAdmin: locals.isAdmin, device, walletId: locals.user?.walletId ?? device.walletId };
};
