import { hmacSha256Hex, timingSafeEqual } from './crypto';

export const DEVICE_COOKIE = 'did';
export const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 3600; // browsers cap at 400 days

/** Cookie value: `<deviceId>.<hmac>`; the signature makes ids unforgeable. */
export const signDeviceId = async (secret: string, deviceId: string): Promise<string> =>
  `${deviceId}.${(await hmacSha256Hex(secret, `device:${deviceId}`)).slice(0, 32)}`;

export const verifyDeviceCookie = async (secret: string, value: string | undefined): Promise<string | undefined> => {
  if (!value) return undefined;
  const dot = value.indexOf('.');
  if (dot <= 0) return undefined;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!/^[0-9a-z]{20,32}$/.test(id) || sig.length !== 32) return undefined;
  const expected = (await hmacSha256Hex(secret, `device:${id}`)).slice(0, 32);
  return timingSafeEqual(sig, expected) ? id : undefined;
};
