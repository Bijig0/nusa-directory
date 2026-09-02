import { newToken } from './ids';
import { sha256Hex } from './crypto';

export const SESSION_COOKIE = 'sid';
const DAY_MS = 24 * 3600 * 1000;
export const SESSION_TTL_MS = 30 * DAY_MS;
export const SESSION_REFRESH_THRESHOLD_MS = 15 * DAY_MS;

export interface NewSession {
  token: string;
  id: string;
  expiresAt: Date;
}

export const createSessionToken = async (now: Date): Promise<NewSession> => {
  const token = newToken(32);
  return { token, id: await sha256Hex(token), expiresAt: new Date(now.getTime() + SESSION_TTL_MS) };
};

export const sessionIdFromToken = (token: string): Promise<string> => sha256Hex(token);

export const isSessionValid = (expiresAt: Date, now: Date): boolean => expiresAt.getTime() > now.getTime();

/** Sliding expiry: extend when less than half the lifetime remains. */
export const shouldRefreshSession = (expiresAt: Date, now: Date): boolean =>
  expiresAt.getTime() - now.getTime() < SESSION_REFRESH_THRESHOLD_MS;

export const refreshedExpiry = (now: Date): Date => new Date(now.getTime() + SESSION_TTL_MS);
