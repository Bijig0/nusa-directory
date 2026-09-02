import { midtransBaseUrls } from '../../domain/midtrans';

export interface SnapTransactionRequest {
  orderId: string;
  grossAmount: number;
  itemName: string;
  itemId: string;
  expiryMinutes: number;
  finishUrl: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface SnapTransaction {
  token: string;
  redirectUrl: string;
}

export interface MidtransClient {
  createSnapTransaction: (req: SnapTransactionRequest) => Promise<SnapTransaction>;
  getTransactionStatus: (orderId: string) => Promise<Record<string, unknown>>;
  snapJsUrl: string;
  clientKey: string;
}

/** Plain-fetch Midtrans Snap client (the official npm client depends on axios and does not run on Workers). */
export const midtransClient = (env: 'sandbox' | 'production', serverKey: string, clientKey: string, fetchImpl: typeof fetch = fetch): MidtransClient => {
  const urls = midtransBaseUrls(env);
  const auth = `Basic ${btoa(`${serverKey}:`)}`;
  const headers = { Authorization: auth, 'content-type': 'application/json', accept: 'application/json' };
  return {
    snapJsUrl: urls.snapJs,
    clientKey,
    createSnapTransaction: async (req) => {
      const body = {
        transaction_details: { order_id: req.orderId, gross_amount: req.grossAmount },
        item_details: [{ id: req.itemId, price: req.grossAmount, quantity: 1, name: req.itemName.slice(0, 50) }],
        expiry: { unit: 'minutes', duration: req.expiryMinutes },
        callbacks: { finish: req.finishUrl },
        ...(req.customerEmail || req.customerPhone ? { customer_details: { email: req.customerEmail, phone: req.customerPhone } } : {}),
      };
      const res = await fetchImpl(`${urls.snap}/snap/v1/transactions`, { method: 'POST', headers, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { token?: string; redirect_url?: string; error_messages?: string[] };
      if (!res.ok || !json.token) throw new Error(`midtrans_snap_${res.status}: ${(json.error_messages ?? []).join('; ')}`);
      return { token: json.token, redirectUrl: json.redirect_url ?? '' };
    },
    getTransactionStatus: async (orderId) => {
      const res = await fetchImpl(`${urls.api}/v2/${encodeURIComponent(orderId)}/status`, { headers });
      return (await res.json()) as Record<string, unknown>;
    },
  };
};
