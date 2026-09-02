import { describe, expect, it } from 'vitest';
import { decideReveal } from '@/domain/reveal';

const base = { alreadyRevealed: false, isOwner: false, isAdmin: false, freeRevealUsed: false, balance: 0, freeRevealsFromIpToday: 0 };

describe('decideReveal', () => {
  it('never charges for an already revealed listing', () => {
    expect(decideReveal({ ...base, alreadyRevealed: true, balance: 5 }).kind).toBe('already');
  });
  it('owner and admin are free', () => {
    expect(decideReveal({ ...base, isOwner: true }).kind).toBe('owner');
    expect(decideReveal({ ...base, isAdmin: true }).kind).toBe('admin');
  });
  it('spends credits before the free reveal', () => {
    expect(decideReveal({ ...base, balance: 2 }).kind).toBe('credit');
  });
  it('grants one free reveal per device, bounded per IP per day', () => {
    expect(decideReveal(base).kind).toBe('free');
    expect(decideReveal({ ...base, freeRevealUsed: true }).kind).toBe('insufficient');
    expect(decideReveal({ ...base, freeRevealsFromIpToday: 3 }).kind).toBe('insufficient');
  });
});
