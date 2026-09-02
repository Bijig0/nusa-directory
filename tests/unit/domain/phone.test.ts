import { describe, expect, it } from 'vitest';
import { normalizeIdPhone, normalizePhone, whatsappLink, maskPhone, formatPhone } from '@/domain/phone';

describe('normalizeIdPhone', () => {
  it.each([
    ['0812-3456-7890', '+6281234567890'],
    ['+62 812 3456 7890', '+6281234567890'],
    ['6281234567890', '+6281234567890'],
    ['(0812) 3456.7890', '+6281234567890'],
    ['081234567', '+6281234567'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeIdPhone(input)).toEqual({ ok: true, value: expected });
  });
  it.each(['0212345678', '812', '+6512345678', 'abc', '08123456789012345'])('rejects %s', (input) => {
    expect(normalizeIdPhone(input).ok).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('accepts foreign E.164', () => {
    expect(normalizePhone('+65 9123 4567')).toEqual({ ok: true, value: '+6591234567' });
  });
  it('falls back to Indonesian rules', () => {
    expect(normalizePhone('08123456789')).toEqual({ ok: true, value: '+628123456789' });
  });
});

describe('formatting', () => {
  it('builds wa.me links', () => {
    expect(whatsappLink('+6281234567890')).toBe('https://wa.me/6281234567890');
    expect(whatsappLink('+6281234567890', 'Halo')).toBe('https://wa.me/6281234567890?text=Halo');
  });
  it('masks and formats', () => {
    expect(maskPhone('+6281234567890')).toBe('+62 812-xxxx-xxxx');
    expect(formatPhone('+6281234567890')).toBe('+62 812-3456-7890');
  });
});
