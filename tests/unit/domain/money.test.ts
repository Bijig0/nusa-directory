import { describe, expect, it } from 'vitest';
import { formatIdr, formatIdrCompact, toMidtransAmount } from '@/domain/money';

describe('money', () => {
  it('formats rupiah with locale separators', () => {
    expect(formatIdr(25000)).toBe('Rp 25.000');
    expect(formatIdr(1500000, 'en')).toBe('Rp 1,500,000');
  });
  it('formats compact amounts', () => {
    expect(formatIdrCompact(500000)).toBe('Rp 500rb');
    expect(formatIdrCompact(1500000)).toBe('Rp 1,5jt');
    expect(formatIdrCompact(1500000, 'en')).toBe('Rp 1.5M');
    expect(formatIdrCompact(800)).toBe('Rp 800');
  });
  it('formats midtrans gross amounts', () => {
    expect(toMidtransAmount(25000)).toBe('25000.00');
  });
});
