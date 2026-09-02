import type { Deps } from '../infra/env';
import type { Principal } from './device.service';
import { err, ok, type Result } from '../domain/result';
import { newId } from '../domain/ids';
import { findListingById } from '../infra/db/repos/listings';
import { countReportsToday, hasReviewed, insertReport, insertReview, findReview, replyToReview } from '../infra/db/repos/moderation';
import { DAY } from '../infra/ratelimit';
import type { ReportReason } from '../infra/db/schema';

export const submitReport = async (deps: Deps, p: Principal, listingId: string, reason: ReportReason, details: string | undefined, ip: string): Promise<Result<void, 'not_found' | 'rate_limited'>> => {
  const listing = await findListingById(deps.db, listingId);
  if (!listing) return err('not_found');
  const now = deps.clock.now();
  const ipHash = await deps.hashForAbuse(ip);
  const limit = await deps.rateLimiter.hit(`report:${ipHash}`, 10, DAY, now);
  const already = await countReportsToday(deps.db, ipHash, new Date(now.getTime() - DAY * 1000));
  if (!limit.allowed || already >= 10) return err('rate_limited');
  await insertReport(deps.db, { id: newId(now.getTime()), listingId, walletId: p.walletId ?? null, reason, details: details?.slice(0, 1000) ?? null, ipHash, status: 'open', createdAt: now });
  return ok(undefined);
};

export const submitReview = async (deps: Deps, p: Principal, listingId: string, rating: number, body: string, ip: string): Promise<Result<void, 'not_found' | 'already' | 'rate_limited' | 'own_listing'>> => {
  const listing = await findListingById(deps.db, listingId);
  if (!listing || listing.status !== 'active') return err('not_found');
  if (!p.walletId) return err('rate_limited');
  if (p.user && p.user.id === listing.ownerUserId) return err('own_listing');
  if (await hasReviewed(deps.db, p.walletId, listingId)) return err('already');
  const now = deps.clock.now();
  const ipHash = await deps.hashForAbuse(ip);
  const limit = await deps.rateLimiter.hit(`review:${ipHash}`, 5, DAY, now);
  if (!limit.allowed) return err('rate_limited');
  await insertReview(deps.db, { id: newId(now.getTime()), listingId, walletId: p.walletId, rating, body: body.trim().slice(0, 1000), status: 'pending', createdAt: now });
  return ok(undefined);
};

export const posterReply = async (deps: Deps, userId: string, reviewId: string, reply: string): Promise<Result<void, 'not_found' | 'forbidden'>> => {
  const review = await findReview(deps.db, reviewId);
  if (!review) return err('not_found');
  const listing = await findListingById(deps.db, review.listingId);
  if (!listing || listing.ownerUserId !== userId) return err('forbidden');
  await replyToReview(deps.db, reviewId, reply.trim().slice(0, 500), deps.clock.now());
  return ok(undefined);
};
