import { actions } from 'astro:actions';
import type { ProductCode } from '../../../infra/db/schema';

export interface CheckoutLabels {
  paymentUnavailable: string;
  paymentFailed: string;
  waiting: string;
}

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks: { onSuccess?: () => void; onPending?: () => void; onError?: () => void; onClose?: () => void }) => void };
  }
}

let snapLoading: Promise<void> | null = null;
const loadSnap = (src: string, clientKey: string): Promise<void> => {
  if (window.snap) return Promise.resolve();
  if (snapLoading) return snapLoading;
  snapLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.dataset.clientKey = clientKey;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('snap_load_failed'));
    document.head.appendChild(script);
  });
  return snapLoading;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls the order until it is paid (or times out). Never trusts the client callback alone. */
const waitForPayment = async (orderId: string, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await actions.checkout.orderStatus({ orderId });
    if (data?.status === 'paid') return true;
    if (data?.status === 'failed' || data?.status === 'expired') return false;
    await sleep(2000);
  }
  return false;
};

export type CheckoutOutcome = 'paid' | 'closed' | string;

/**
 * Creates an order, opens the Midtrans Snap popup and resolves when the order is
 * confirmed paid by the server (webhook) or the popup is closed.
 */
export const startCheckout = async (p: { productCode: string; listingId?: string; labels: CheckoutLabels }): Promise<CheckoutOutcome> => {
  const { data, error } = await actions.checkout.createOrder({ productCode: p.productCode as ProductCode, listingId: p.listingId });
  if (error || !data) return error?.code === 'BAD_REQUEST' ? p.labels.paymentUnavailable : p.labels.paymentFailed;
  if (data.devAutoPaid) return 'paid';
  try {
    await loadSnap(data.snapJsUrl, data.clientKey);
  } catch {
    return p.labels.paymentUnavailable;
  }
  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    const finish = (v: CheckoutOutcome) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const confirm = async () => finish((await waitForPayment(data.orderId, 90_000)) ? 'paid' : p.labels.waiting);
    window.snap!.pay(data.snapToken, {
      onSuccess: () => void confirm(),
      onPending: () => void confirm(),
      onError: () => finish(p.labels.paymentFailed),
      onClose: () => void (async () => finish((await waitForPayment(data.orderId, 4_000)) ? 'paid' : 'closed'))(),
    });
  });
};
