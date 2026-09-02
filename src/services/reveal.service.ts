import type { Deps } from '../infra/env';
import type { Principal } from './device.service';
import { decideReveal, MAX_FREE_REVEALS_PER_IP_PER_DAY } from '../domain/reveal';
import { newId } from '../domain/ids';
import { whatsappLink, telegramLink, formatPhone } from '../domain/phone';
import { contactPrefill } from '../domain/listing';
import { findListingById } from '../infra/db/repos/listings';
import { addLedger, deleteReveal, findWallet, hasReveal, insertRevealIfNew, markFreeRevealUsed, spendCredit } from '../infra/db/repos/wallets';
import { incrementStat } from '../infra/db/repos/stats';
import { DAY, HOUR } from '../infra/ratelimit';
import { site } from '../../site.config';
import type { Listing } from '../infra/db/schema';

export interface Contact {
  phone: string;
  phoneDisplay: string;
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

export type RevealResult =
  | { status: 'revealed'; kind: 'already' | 'free' | 'credit' | 'owner' | 'admin'; contact: Contact; balance: number }
  | { status: 'insufficient'; balance: number; freeUsed: boolean }
  | { status: 'rate_limited' }
  | { status: 'not_found' };

const contactOf = (listing: Listing, locale: 'id' | 'en'): Contact => {
  const wa = listing.whatsappE164 ?? listing.phoneE164;
  return {
    phone: listing.phoneE164,
    phoneDisplay: formatPhone(listing.phoneE164),
    whatsappUrl: whatsappLink(wa, contactPrefill(locale, listing.title, site.name)),
    telegramUrl: listing.telegramHandle ? telegramLink(listing.telegramHandle) : null,
  };
};

const visibleTo = (listing: Listing, p: Principal): boolean =>
  (listing.status === 'active' && listing.moderation !== 'hidden') || p.isAdmin || p.user?.id === listing.ownerUserId;

/**
 * Reveals a listing's contact for the principal. Idempotent per wallet+listing;
 * never charges twice; race-safe via the unique reveal row inserted before charging.
 */
export const revealContact = async (deps: Deps, p: Principal, listingId: string, ip: string, locale: 'id' | 'en'): Promise<RevealResult> => {
  const now = deps.clock.now();
  const listing = await findListingById(deps.db, listingId);
  if (!listing || !visibleTo(listing, p)) return { status: 'not_found' };
  const walletId = p.walletId;
  const device = p.device;
  if (!walletId) return { status: 'insufficient', balance: 0, freeUsed: true };

  const ipHash = await deps.hashForAbuse(ip);
  const burst = await deps.rateLimiter.hit(`reveal:ip:${ipHash}`, 60, HOUR, now);
  if (!burst.allowed) return { status: 'rate_limited' };

  const [wallet, already, freeFromIp] = await Promise.all([
    findWallet(deps.db, walletId),
    hasReveal(deps.db, walletId, listingId),
    deps.rateLimiter.peek(`freereveal:ip:${ipHash}`, DAY, now),
  ]);
  const balance = wallet?.balance ?? 0;
  const decision = decideReveal({
    alreadyRevealed: already,
    isOwner: p.user?.id === listing.ownerUserId,
    isAdmin: p.isAdmin,
    freeRevealUsed: device?.freeRevealUsedAt !== null && device?.freeRevealUsedAt !== undefined,
    balance,
    freeRevealsFromIpToday: freeFromIp,
  });

  const contact = contactOf(listing, locale);
  if (decision.kind === 'already') return { status: 'revealed', kind: 'already', contact, balance };
  if (decision.kind === 'insufficient') return { status: 'insufficient', balance, freeUsed: !device || device.freeRevealUsedAt !== null };

  const revealId = newId(now.getTime());
  const inserted = await insertRevealIfNew(deps.db, revealId, walletId, listingId, decision.kind, now);
  if (!inserted) return { status: 'revealed', kind: 'already', contact, balance };

  if (decision.kind === 'credit') {
    const spent = await spendCredit(deps.db, walletId, now);
    if (!spent) {
      await deleteReveal(deps.db, revealId).run();
      return { status: 'insufficient', balance: 0, freeUsed: !device || device.freeRevealUsedAt !== null };
    }
    await addLedger(deps.db, { walletId, delta: -1, reason: 'reveal', refType: 'listing', refId: listingId }, now).run();
    deps.waitUntil(incrementStat(deps.db, listingId, 'reveals', now));
    return { status: 'revealed', kind: 'credit', contact, balance: balance - 1 };
  }

  if (decision.kind === 'free') {
    const marked = device ? await markFreeRevealUsed(deps.db, device.id, now) : false;
    if (!marked) {
      await deleteReveal(deps.db, revealId).run();
      return { status: 'insufficient', balance, freeUsed: true };
    }
    const quota = await deps.rateLimiter.hit(`freereveal:ip:${ipHash}`, MAX_FREE_REVEALS_PER_IP_PER_DAY, DAY, now);
    if (!quota.allowed) {
      // Over the per-IP daily quota: keep the device flag (it is spent) but do not reveal.
      await deleteReveal(deps.db, revealId).run();
      return { status: 'insufficient', balance, freeUsed: true };
    }
    await addLedger(deps.db, { walletId, delta: 0, reason: 'free_reveal', refType: 'listing', refId: listingId }, now).run();
    deps.waitUntil(incrementStat(deps.db, listingId, 'reveals', now));
    return { status: 'revealed', kind: 'free', contact, balance };
  }

  // owner / admin: recorded so the UI stays unlocked, never charged.
  return { status: 'revealed', kind: decision.kind, contact, balance };
};
