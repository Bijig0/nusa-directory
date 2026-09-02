import { describe, expect, it } from 'vitest';
import { signDeviceId, verifyDeviceCookie } from '@/domain/devices';
import { expectedSignature, verifySignature, mapTransactionStatus } from '@/domain/midtrans';
import { hashOtp, verifyOtpHash, decideOtpThrottle } from '@/domain/otp';
import { createSessionToken, sessionIdFromToken, shouldRefreshSession } from '@/domain/session';

describe('device cookie', () => {
  it('round-trips a signed id and rejects tampering', async () => {
    const id = '01j8z3k9x2abcdefghjkmn';
    const cookie = await signDeviceId('secret', id);
    expect(await verifyDeviceCookie('secret', cookie)).toBe(id);
    expect(await verifyDeviceCookie('other', cookie)).toBeUndefined();
    expect(await verifyDeviceCookie('secret', `${id}.${'0'.repeat(32)}`)).toBeUndefined();
    expect(await verifyDeviceCookie('secret', 'garbage')).toBeUndefined();
  });
});

describe('midtrans', () => {
  const n = { order_id: 'ORD-1', status_code: '200', gross_amount: '25000.00', transaction_status: 'settlement', transaction_id: 'tx', signature_key: '' };
  it('verifies the documented sha512 signature', async () => {
    const sig = await expectedSignature(n, 'SB-key');
    expect(sig).toHaveLength(128);
    expect(await verifySignature({ ...n, signature_key: sig }, 'SB-key')).toBe(true);
    expect(await verifySignature({ ...n, signature_key: sig }, 'wrong')).toBe(false);
    expect(await verifySignature({ ...n, signature_key: sig.slice(1) }, 'SB-key')).toBe(false);
  });
  it('maps statuses', () => {
    expect(mapTransactionStatus('capture', 'accept')).toBe('paid');
    expect(mapTransactionStatus('capture', 'challenge')).toBe('pending');
    expect(mapTransactionStatus('settlement')).toBe('paid');
    expect(mapTransactionStatus('expire')).toBe('expired');
    expect(mapTransactionStatus('deny')).toBe('failed');
    expect(mapTransactionStatus('refund')).toBe('refunded');
    expect(mapTransactionStatus('weird')).toBeUndefined();
  });
});

describe('otp', () => {
  const now = new Date('2026-09-02T00:00:00Z');
  it('verifies hashes with attempt and expiry rules', async () => {
    const hash = await hashOtp('123456', 'pepper', 'otp1');
    const row = { codeHash: hash, expiresAt: new Date(now.getTime() + 1000), consumedAt: null, attempts: 0 };
    expect(verifyOtpHash(row, await hashOtp('123456', 'pepper', 'otp1'), now)).toBe('ok');
    expect(verifyOtpHash(row, await hashOtp('123456', 'pepper', 'otp2'), now)).toBe('mismatch');
    expect(verifyOtpHash({ ...row, attempts: 5 }, hash, now)).toBe('too_many_attempts');
    expect(verifyOtpHash({ ...row, expiresAt: now }, hash, now)).toBe('expired');
    expect(verifyOtpHash({ ...row, consumedAt: now }, hash, now)).toBe('consumed');
  });
  it('throttles in priority order', () => {
    expect(decideOtpThrottle({ perDestination15m: 0, perDestinationDay: 0, perIpDay: 0 })).toBe('ok');
    expect(decideOtpThrottle({ perDestination15m: 3, perDestinationDay: 3, perIpDay: 0 })).toBe('destination_cooldown');
    expect(decideOtpThrottle({ perDestination15m: 0, perDestinationDay: 10, perIpDay: 0 })).toBe('destination_daily');
    expect(decideOtpThrottle({ perDestination15m: 0, perDestinationDay: 0, perIpDay: 30 })).toBe('ip_daily');
  });
});

describe('session', () => {
  it('derives ids from tokens and refreshes late in life', async () => {
    const now = new Date('2026-09-02T00:00:00Z');
    const s = await createSessionToken(now);
    expect(await sessionIdFromToken(s.token)).toBe(s.id);
    expect(shouldRefreshSession(s.expiresAt, now)).toBe(false);
    expect(shouldRefreshSession(s.expiresAt, new Date(now.getTime() + 20 * 86400_000))).toBe(true);
  });
});
