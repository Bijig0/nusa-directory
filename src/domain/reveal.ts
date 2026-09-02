/** Pure decision logic for revealing a listing's contact. */
export interface RevealState {
  alreadyRevealed: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  freeRevealUsed: boolean;
  balance: number;
  /** Abuse guard: free reveals from this IP today. */
  freeRevealsFromIpToday: number;
}

export type RevealDecision =
  | { kind: 'already' }
  | { kind: 'owner' }
  | { kind: 'admin' }
  | { kind: 'free' }
  | { kind: 'credit' }
  | { kind: 'insufficient' };

export const MAX_FREE_REVEALS_PER_IP_PER_DAY = 3;

export const decideReveal = (s: RevealState): RevealDecision => {
  if (s.alreadyRevealed) return { kind: 'already' };
  if (s.isOwner) return { kind: 'owner' };
  if (s.isAdmin) return { kind: 'admin' };
  if (s.balance > 0) return { kind: 'credit' };
  if (!s.freeRevealUsed && s.freeRevealsFromIpToday < MAX_FREE_REVEALS_PER_IP_PER_DAY) return { kind: 'free' };
  return { kind: 'insufficient' };
};

/** Balance after a decision is applied (for optimistic UI). */
export const balanceAfter = (balance: number, d: RevealDecision): number => (d.kind === 'credit' ? balance - 1 : balance);
