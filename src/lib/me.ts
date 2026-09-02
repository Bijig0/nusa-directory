/** Client-side cache of /api/me (per-viewer state) shared by all islands on a page. */
import { signal } from '@preact/signals';

export interface Me {
  user: { id: string; name: string | null } | null;
  isAdmin: boolean;
  balance: number;
  freeRevealAvailable: boolean;
  revealedListingIds: string[];
  favoriteIds: string[];
}

export const me = signal<Me | null>(null);
let inflight: Promise<Me | null> | null = null;

export const loadMe = (force = false): Promise<Me | null> => {
  if (me.value && !force) return Promise.resolve(me.value);
  if (inflight && !force) return inflight;
  inflight = fetch('/api/me', { credentials: 'same-origin', headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
    .then((data) => {
      me.value = data;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export const beacon = (listingId: string, event: 'views' | 'wa_clicks' | 'tg_clicks'): void => {
  const body = JSON.stringify({ listingId, event });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/beacon', new Blob([body], { type: 'application/json' }));
  } else {
    void fetch('/api/beacon', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true });
  }
};
