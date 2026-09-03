import type { Deps } from '../infra/env';
import { sql } from 'drizzle-orm';
import { newId } from '../domain/ids';
import { applyBoost } from '../domain/boost';
import { findListingById } from '../infra/db/repos/listings';
import { updateListing, insertBoost } from '../infra/db/repos/listing-write';
import { purgeListingPhotos } from './listing.service';
import { audit, moderateReview, resolveReport, resolveReportsForListing, updateProductPrice, setAreaActive, setCityActive, upsertArea } from '../infra/db/repos/moderation';
import { banUser, unbanUser, deleteSessionsOfUser, findUser } from '../infra/db/repos/auth';
import { addLedger, creditWallet } from '../infra/db/repos/wallets';
import { findProductByCode } from '../infra/db/repos/products';
import { slugify, isSafeAreaSlug } from '../domain/slug';
import { reservedTopLevelSlugs } from '../data/cities';
import type { Listing, ProductCode } from '../infra/db/schema';

export type ListingAdminAction = 'approve' | 'hide' | 'unhide' | 'remove' | 'verify' | 'unverify' | 'grant_featured' | 'grant_vip';

const patchFor = (action: ListingAdminAction): Partial<Listing> | undefined => {
  switch (action) {
    case 'approve': return { moderation: 'approved', editedAt: null };
    case 'hide': return { moderation: 'hidden' };
    case 'unhide': return { moderation: 'approved' };
    case 'remove': return { status: 'removed', removedReason: 'admin' };
    case 'verify': return { verified: true };
    case 'unverify': return { verified: false };
    default: return undefined;
  }
};

export const adminListingAction = async (deps: Deps, adminId: string, listingId: string, action: ListingAdminAction): Promise<Listing | undefined> => {
  const l = await findListingById(deps.db, listingId);
  if (!l) return undefined;
  const now = deps.clock.now();
  if (action === 'grant_featured' || action === 'grant_vip') {
    const product = await findProductByCode(deps.db, (action === 'grant_vip' ? 'vip_30d' : 'featured_7d') as ProductCode);
    const patch = product ? applyBoost(product, l, now) : undefined;
    if (patch) {
      await updateListing(deps.db, l.id, { bumpedAt: patch.bumpedAt, ...(patch.featuredUntil ? { featuredUntil: patch.featuredUntil } : {}), ...(patch.vipUntil ? { vipUntil: patch.vipUntil } : {}), updatedAt: now });
      await insertBoost(deps.db, { id: newId(now.getTime()), listingId: l.id, orderId: null, type: patch.type, startsAt: now, endsAt: patch.endsAt, createdAt: now });
    }
  } else {
    const patch = patchFor(action);
    if (!patch) return l;
    await updateListing(deps.db, l.id, { ...patch, updatedAt: now });
    if (action === 'remove') await purgeListingPhotos(deps, l.id);
    if (action === 'approve' || action === 'remove' || action === 'hide') await resolveReportsForListing(deps.db, l.id, adminId, now);
  }
  await audit(deps.db, { actorUserId: adminId, actorType: 'admin', action: `listing.${action}`, targetType: 'listing', targetId: l.id, before: { status: l.status, moderation: l.moderation, verified: l.verified } }, now);
  return findListingById(deps.db, l.id);
};

export const adminUserAction = async (deps: Deps, adminId: string, userId: string, action: 'ban' | 'unban' | 'add_credits', reason?: string): Promise<boolean> => {
  const user = await findUser(deps.db, userId);
  if (!user) return false;
  const now = deps.clock.now();
  if (action === 'ban') {
    await banUser(deps.db, userId, reason ?? 'admin');
    await deleteSessionsOfUser(deps.db, userId);
    await deps.db.run(sql`UPDATE listings SET moderation = 'hidden', updated_at = ${now.getTime()} WHERE owner_user_id = ${userId} AND status = 'active'`);
  } else if (action === 'unban') {
    await unbanUser(deps.db, userId);
  } else {
    await creditWallet(deps.db, user.walletId, 5, now);
    await addLedger(deps.db, { walletId: user.walletId, delta: 5, reason: 'admin_adjust', refType: 'admin', refId: adminId }, now);
  }
  await audit(deps.db, { actorUserId: adminId, actorType: 'admin', action: `user.${action}`, targetType: 'user', targetId: userId, after: { reason } }, now);
  return true;
};

export const adminReportAction = (deps: Deps, adminId: string, reportId: string, status: 'resolved' | 'dismissed') =>
  resolveReport(deps.db, reportId, status, adminId, deps.clock.now());

export const adminReviewAction = (deps: Deps, adminId: string, reviewId: string, status: 'approved' | 'rejected') =>
  moderateReview(deps.db, reviewId, status, adminId, deps.clock.now());

export const adminSetPrice = async (deps: Deps, adminId: string, code: string, priceIdr: number, isActive: boolean): Promise<void> => {
  const now = deps.clock.now();
  await updateProductPrice(deps.db, code, priceIdr, isActive, now);
  await audit(deps.db, { actorUserId: adminId, actorType: 'admin', action: 'product.price', targetType: 'product', targetId: code, after: { priceIdr, isActive } }, now);
};

export const adminAddArea = async (deps: Deps, adminId: string, cityId: string, nameId: string, nameEn: string): Promise<'ok' | 'bad_slug'> => {
  const slug = slugify(nameId, 40);
  if (!isSafeAreaSlug(slug) || reservedTopLevelSlugs.has(slug)) return 'bad_slug';
  await upsertArea(deps.db, { id: `area_${cityId.replace('city_', '')}_${slug}`.replaceAll('-', '_'), cityId, slug, nameId, nameEn: nameEn || nameId });
  await audit(deps.db, { actorUserId: adminId, actorType: 'admin', action: 'area.upsert', targetType: 'area', targetId: slug, after: { cityId, nameId, nameEn } }, deps.clock.now());
  return 'ok';
};

export const adminToggleArea = (deps: Deps, id: string, isActive: boolean) => setAreaActive(deps.db, id, isActive);
export const adminToggleCity = (deps: Deps, id: string, isActive: boolean) => setCityActive(deps.db, id, isActive);
