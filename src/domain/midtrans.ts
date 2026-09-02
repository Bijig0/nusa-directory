import { sha512Hex, timingSafeEqual } from './crypto';
import type { ORDER_STATUSES } from '../infra/db/schema';

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  transaction_id: string;
  fraud_status?: string;
  payment_type?: string;
}

/** Midtrans: signature_key = sha512(order_id + status_code + gross_amount + ServerKey). */
export const expectedSignature = (n: Pick<MidtransNotification, 'order_id' | 'status_code' | 'gross_amount'>, serverKey: string): Promise<string> =>
  sha512Hex(`${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`);

export const verifySignature = async (n: MidtransNotification, serverKey: string): Promise<boolean> =>
  timingSafeEqual((n.signature_key ?? '').toLowerCase(), await expectedSignature(n, serverKey));

/** Maps a Midtrans transaction status to our order status; undefined = ignore (no state change). */
export const mapTransactionStatus = (transactionStatus: string, fraudStatus?: string): OrderStatus | undefined => {
  switch (transactionStatus) {
    case 'capture':
      return fraudStatus === 'challenge' ? 'pending' : fraudStatus === 'deny' ? 'failed' : 'paid';
    case 'settlement':
      return 'paid';
    case 'pending':
      return 'pending';
    case 'deny':
    case 'cancel':
    case 'failure':
      return 'failed';
    case 'expire':
      return 'expired';
    case 'refund':
    case 'partial_refund':
    case 'chargeback':
    case 'partial_chargeback':
      return 'refunded';
    default:
      return undefined;
  }
};

export const isMidtransNotification = (v: unknown): v is MidtransNotification => {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return ['order_id', 'status_code', 'gross_amount', 'signature_key', 'transaction_status', 'transaction_id'].every((k) => typeof o[k] === 'string');
};

export const midtransBaseUrls = (env: 'sandbox' | 'production') =>
  env === 'production'
    ? { snap: 'https://app.midtrans.com', api: 'https://api.midtrans.com', snapJs: 'https://app.midtrans.com/snap/snap.js' }
    : { snap: 'https://app.sandbox.midtrans.com', api: 'https://api.sandbox.midtrans.com', snapJs: 'https://app.sandbox.midtrans.com/snap/snap.js' };
