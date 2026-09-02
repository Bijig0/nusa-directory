import type { AstroCookies } from 'astro';
import type { Deps } from '../infra/env';
import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, signDeviceId, verifyDeviceCookie } from '../domain/devices';
import { createDeviceWithWallet, findDevice, findWallet, touchDevice } from '../infra/db/repos/wallets';
import type { Device, User } from '../infra/db/schema';

/** Who is acting: a signed-in user (with their wallet) and/or an anonymous device. */
export interface Principal {
  user?: User;
  isAdmin: boolean;
  device?: Device;
  /** The wallet that pays: the user's when signed in, else the device's. */
  walletId?: string;
}

const cookieOptions = (deps: Deps) => ({
  httpOnly: true,
  secure: !deps.isDev,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: DEVICE_COOKIE_MAX_AGE,
});

/** Reads the device cookie without creating anything (safe for cached GET pages). */
export const readDevice = async (deps: Deps, cookies: AstroCookies): Promise<Device | undefined> => {
  const id = await verifyDeviceCookie(deps.env.DEVICE_SECRET, cookies.get(DEVICE_COOKIE)?.value);
  return id ? findDevice(deps.db, id) : undefined;
};

/** Returns the device, creating one (and its wallet) and setting the cookie when missing. Only call from actions/POSTs. */
export const ensureDevice = async (deps: Deps, cookies: AstroCookies, request: Request): Promise<Device> => {
  const existing = await readDevice(deps, cookies);
  const now = deps.clock.now();
  if (existing) {
    deps.waitUntil(touchDevice(deps.db, existing.id, now).run());
    return existing;
  }
  const ip = clientIp(request);
  const ua = request.headers.get('user-agent') ?? '';
  const [ipHash, uaHash] = await Promise.all([deps.hashForAbuse(ip), deps.hashForAbuse(ua)]);
  const device = await createDeviceWithWallet(deps.db, now, { ipHash, uaHash });
  cookies.set(DEVICE_COOKIE, await signDeviceId(deps.env.DEVICE_SECRET, device.id), cookieOptions(deps));
  return device;
};

export const clientIp = (request: Request): string =>
  request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('cf-connecting-ip') ?? '0.0.0.0';

export const walletBalance = async (deps: Deps, walletId: string | undefined): Promise<number> => {
  if (!walletId) return 0;
  const w = await findWallet(deps.db, walletId);
  return w?.balance ?? 0;
};
