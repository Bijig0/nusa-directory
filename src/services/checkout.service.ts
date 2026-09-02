import type { Deps } from '../infra/env';
import type { Principal } from './device.service';
import { site } from '../../site.config';
import { err, ok, type Result } from '../domain/result';
import { newId, newOrderId } from '../domain/ids';
import { applyBoost, ORDER_TTL_MINUTES } from '../domain/boost';
import { isMidtransNotification, mapTransactionStatus, verifySignature, type MidtransNotification } from '../domain/midtrans';
import { midtransClient } from '../infra/payments/midtrans';
import { findProductByCode } from '../infra/db/repos/products';
import { findOrder, insertOrder, recordPaymentEvent, updateOrder } from '../infra/db/repos/orders';
import { addLedger, creditWallet } from '../infra/db/repos/wallets';
import { findListingById } from '../infra/db/repos/listings';
import { insertBoost, updateListing } from '../infra/db/repos/listing-write';
import { identitiesOf } from '../infra/db/repos/auth';
import type { Order, ProductCode } from '../infra/db/schema';

export type CheckoutError = 'payments_unavailable' | 'product_unavailable' | 'listing_required' | 'forbidden' | 'gateway_error';

export interface CreatedOrder {
  orderId: string;
  snapToken: string;
  snapJsUrl: string;
  clientKey: string;
  /** Development only: orders auto-complete so the flow can be exercised without Midtrans. */
  devAutoPaid: boolean;
}

const gateway = (deps: Deps) => {
  const { MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_ENV } = deps.env;
  if (!MIDTRANS_SERVER_KEY || !MIDTRANS_CLIENT_KEY) return undefined;
  return midtransClient(MIDTRANS_ENV === 'production' ? 'production' : 'sandbox', MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY);
};

const isPlaceholderKey = (key: string | undefined): boolean => !key || /xxxx/i.test(key);

/** Creates a pending order and a Snap token. Boost products require a listing the principal owns. */
export const createOrder = async (deps: Deps, p: Principal, productCode: ProductCode, listingId: string | undefined, locale: 'id' | 'en'): Promise<Result<CreatedOrder, CheckoutError>> => {
  const product = await findProductByCode(deps.db, productCode);
  if (!product || !product.isActive) return err('product_unavailable');
  if (!p.walletId) return err('forbidden');
  let listing = listingId ? await findListingById(deps.db, listingId) : undefined;
  if (product.kind === 'boost') {
    if (!listing) return err('listing_required');
    if (!p.user || (listing.ownerUserId !== p.user.id && !p.isAdmin)) return err('forbidden');
  } else if (listing && (listing.status !== 'active' || listing.moderation === 'hidden')) {
    listing = undefined;
  }
  const now = deps.clock.now();
  const order: Order = {
    id: newOrderId(), walletId: p.walletId, userId: p.user?.id ?? null, productId: product.id, productCode: product.code, listingId: listing?.id ?? null,
    amountIdr: product.priceIdr, credits: product.credits, status: 'pending', snapToken: null, snapRedirectUrl: null, midtransTransactionId: null, paymentType: null,
    paidAt: null, fulfilledAt: null, expiresAt: new Date(now.getTime() + ORDER_TTL_MINUTES * 60_000), createdAt: now, updatedAt: now,
  };

  const devMode = deps.isDev && isPlaceholderKey(deps.env.MIDTRANS_SERVER_KEY);
  if (devMode) {
    await insertOrder(deps.db, { ...order, snapToken: 'dev' });
    await fulfillOrder(deps, order.id, { transactionId: `dev-${order.id}`, paymentType: 'dev' });
    return ok({ orderId: order.id, snapToken: 'dev', snapJsUrl: '', clientKey: '', devAutoPaid: true });
  }

  const client = gateway(deps);
  if (!client) return err('payments_unavailable');
  await insertOrder(deps.db, order);
  const ids = p.user ? await identitiesOf(deps.db, p.user.id) : [];
  try {
    const snap = await client.createSnapTransaction({
      orderId: order.id, grossAmount: product.priceIdr, itemId: product.code, itemName: locale === 'en' ? product.nameEn : product.nameId,
      expiryMinutes: ORDER_TTL_MINUTES, finishUrl: `${deps.siteUrl}/dashboard/orders/`,
      customerEmail: ids.find((i) => i.provider === 'email')?.providerId, customerPhone: ids.find((i) => i.provider === 'phone')?.providerId,
    });
    await updateOrder(deps.db, order.id, { snapToken: snap.token, snapRedirectUrl: snap.redirectUrl, updatedAt: now });
    return ok({ orderId: order.id, snapToken: snap.token, snapJsUrl: client.snapJsUrl, clientKey: client.clientKey, devAutoPaid: false });
  } catch (error) {
    console.error('[checkout] snap failed', error);
    await updateOrder(deps.db, order.id, { status: 'failed', updatedAt: now });
    return err('gateway_error');
  }
};

/**
 * Marks an order paid and delivers what was bought — exactly once. The guarded
 * UPDATE (status = pending) makes duplicate webhook deliveries harmless.
 */
export const fulfillOrder = async (deps: Deps, orderId: string, payment: { transactionId: string; paymentType: string }): Promise<'fulfilled' | 'already' | 'not_found'> => {
  const now = deps.clock.now();
  const claimed = await deps.db.run(
    (await import('drizzle-orm')).sql`UPDATE orders SET status = 'paid', paid_at = ${now.getTime()}, midtrans_transaction_id = ${payment.transactionId}, payment_type = ${payment.paymentType}, updated_at = ${now.getTime()} WHERE id = ${orderId} AND status = 'pending'`,
  );
  if (Number(claimed.meta.changes ?? 0) !== 1) return (await findOrder(deps.db, orderId)) ? 'already' : 'not_found';
  const order = (await findOrder(deps.db, orderId))!;

  if (order.credits && order.credits > 0) {
    await creditWallet(deps.db, order.walletId, order.credits, now);
    await addLedger(deps.db, { walletId: order.walletId, delta: order.credits, reason: 'purchase', refType: 'order', refId: order.id }, now);
  } else if (order.listingId) {
    const product = await findProductByCode(deps.db, order.productCode as ProductCode);
    const listing = await findListingById(deps.db, order.listingId);
    const patch = product && listing ? applyBoost(product, listing, now) : undefined;
    if (patch) {
      await updateListing(deps.db, listing!.id, { bumpedAt: patch.bumpedAt, ...(patch.featuredUntil ? { featuredUntil: patch.featuredUntil } : {}), ...(patch.vipUntil ? { vipUntil: patch.vipUntil } : {}), updatedAt: now });
      await insertBoost(deps.db, { id: newId(now.getTime()), listingId: listing!.id, orderId: order.id, type: patch.type, startsAt: now, endsAt: patch.endsAt, createdAt: now });
    }
  }
  await updateOrder(deps.db, order.id, { fulfilledAt: now, updatedAt: now });
  return 'fulfilled';
};

export type WebhookOutcome = { status: number; body: string };

/** Handles a Midtrans HTTP notification. Always 200 for authentic notifications so Midtrans stops retrying. */
export const handleMidtransNotification = async (deps: Deps, payload: unknown): Promise<WebhookOutcome> => {
  if (!isMidtransNotification(payload)) return { status: 400, body: 'bad_payload' };
  const n: MidtransNotification = payload;
  const serverKey = deps.env.MIDTRANS_SERVER_KEY ?? '';
  const valid = await verifySignature(n, serverKey);
  const now = deps.clock.now();
  if (!valid) {
    console.warn('[webhook] rejected notification with bad signature', n.order_id, n.transaction_id);
    return { status: 403, body: 'bad_signature' };
  }
  // Only authentic deliveries count towards idempotency, so a forged attempt can never shadow the real one.
  const fresh = await recordPaymentEvent(deps.db, {
    id: newId(now.getTime()), orderId: n.order_id, provider: 'midtrans', transactionId: n.transaction_id, transactionStatus: n.transaction_status,
    statusCode: n.status_code, fraudStatus: n.fraud_status ?? null, signatureValid: true, payload: JSON.stringify(payload).slice(0, 8000), receivedAt: now,
  });
  if (!fresh) return { status: 200, body: 'duplicate' };
  const mapped = mapTransactionStatus(n.transaction_status, n.fraud_status);
  const order = await findOrder(deps.db, n.order_id);
  if (!order) return { status: 200, body: 'unknown_order' };
  if (mapped === 'paid') {
    if (String(order.amountIdr) !== n.gross_amount.split('.')[0]) {
      console.error('[webhook] amount mismatch', order.id, order.amountIdr, n.gross_amount);
      return { status: 200, body: 'amount_mismatch' };
    }
    const outcome = await fulfillOrder(deps, order.id, { transactionId: n.transaction_id, paymentType: n.payment_type ?? 'unknown' });
    return { status: 200, body: outcome };
  }
  if (mapped && mapped !== 'pending' && order.status === 'pending') {
    await updateOrder(deps.db, order.id, { status: mapped, midtransTransactionId: n.transaction_id, updatedAt: now });
  }
  return { status: 200, body: mapped ?? 'ignored' };
};

export const orderStatusFor = async (deps: Deps, p: Principal, orderId: string): Promise<{ status: Order['status'] } | undefined> => {
  const order = await findOrder(deps.db, orderId);
  if (!order || order.walletId !== p.walletId) return undefined;
  return { status: order.status };
};

export const boostProducts = async (deps: Deps) => (await import('../infra/db/repos/products')).activeProducts(deps.db).then((rows) => rows.filter((r) => r.kind === 'boost'));

export const siteName = site.name;
