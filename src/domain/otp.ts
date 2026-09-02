import { randomDigits, newToken } from './ids';
import { sha256Hex, timingSafeEqual } from './crypto';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export interface OtpThrottleState {
  perDestination15m: number;
  perDestinationDay: number;
  perIpDay: number;
}

export const OTP_LIMITS = { perDestination15m: 3, perDestinationDay: 10, perIpDay: 30 } as const;

export type OtpThrottleDecision = 'ok' | 'destination_cooldown' | 'destination_daily' | 'ip_daily';

export const decideOtpThrottle = (s: OtpThrottleState): OtpThrottleDecision => {
  if (s.perIpDay >= OTP_LIMITS.perIpDay) return 'ip_daily';
  if (s.perDestinationDay >= OTP_LIMITS.perDestinationDay) return 'destination_daily';
  if (s.perDestination15m >= OTP_LIMITS.perDestination15m) return 'destination_cooldown';
  return 'ok';
};

export const generateOtpCode = (): string => randomDigits(6);
export const generateLinkToken = (): string => newToken(32);

/** Hash binds the code to its row id so a code cannot be replayed against another challenge. */
export const hashOtp = (code: string, pepper: string, otpId: string): Promise<string> => sha256Hex(`${code}:${pepper}:${otpId}`);
export const hashLinkToken = (token: string, pepper: string): Promise<string> => sha256Hex(`link:${pepper}:${token}`);

export type OtpVerifyOutcome = 'ok' | 'expired' | 'consumed' | 'too_many_attempts' | 'mismatch';

export const verifyOtpHash = (row: { codeHash: string; expiresAt: Date; consumedAt: Date | null; attempts: number }, candidateHash: string, now: Date): OtpVerifyOutcome => {
  if (row.consumedAt) return 'consumed';
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (row.attempts >= OTP_MAX_ATTEMPTS) return 'too_many_attempts';
  return timingSafeEqual(row.codeHash, candidateHash) ? 'ok' : 'mismatch';
};

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
export const normalizeEmail = (value: string): string => value.trim().toLowerCase();
