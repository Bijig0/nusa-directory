import { signal, computed } from '@preact/signals';
import { actions } from 'astro:actions';
import { me, loadMe } from '../../../lib/me';

export interface Contact {
  phone: string;
  phoneDisplay: string;
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

export type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'revealed'; contact: Contact; via: string }
  | { kind: 'insufficient'; balance: number; freeUsed: boolean }
  | { kind: 'error'; message: string };

/** One shared state per listing so the sidebar box and the sticky mobile CTA stay in sync. */
const states = new Map<string, ReturnType<typeof createState>>();

const createState = (listingId: string) => {
  const phase = signal<Phase>({ kind: 'idle' });
  const modalOpen = signal(false);
  const isRevealed = computed(() => phase.value.kind === 'revealed');

  const reveal = async (): Promise<void> => {
    if (phase.value.kind === 'loading' || phase.value.kind === 'revealed') return;
    phase.value = { kind: 'loading' };
    const { data, error } = await actions.reveal.reveal({ listingId });
    if (error) {
      phase.value = { kind: 'error', message: error.code === 'TOO_MANY_REQUESTS' ? 'rate_limited' : 'error' };
      return;
    }
    if (data.status === 'revealed') {
      phase.value = { kind: 'revealed', contact: data.contact, via: data.kind };
      if (me.value) me.value = { ...me.value, balance: data.balance, revealedListingIds: [...new Set([...me.value.revealedListingIds, listingId])] };
      modalOpen.value = false;
    } else {
      phase.value = { kind: 'insufficient', balance: data.balance, freeUsed: data.freeUsed };
      modalOpen.value = true;
    }
  };

  /** On mount: if this device already revealed the listing, fetch the contact silently. */
  const hydrate = async (): Promise<void> => {
    const m = await loadMe();
    if (m?.revealedListingIds.includes(listingId)) await reveal();
  };

  return { phase, modalOpen, isRevealed, reveal, hydrate };
};

export const stateFor = (listingId: string) => {
  const existing = states.get(listingId);
  if (existing) return existing;
  const s = createState(listingId);
  states.set(listingId, s);
  return s;
};
