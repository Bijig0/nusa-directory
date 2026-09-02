import type { OtpSender } from './senders';
import { otpText } from './senders';

/**
 * Fonnte WhatsApp gateway (https://fonnte.com). Form-encoded POST with the account
 * token in the Authorization header; `target` is the recipient number, `message` the text.
 */
export const fonnteSender = (token: string, fetchImpl: typeof fetch = fetch): OtpSender => {
  const send = async (target: string, message: string): Promise<void> => {
    const body = new URLSearchParams({ target: target.replace('+', ''), message, countryCode: '62' });
    const res = await fetchImpl('https://api.fonnte.com/send', { method: 'POST', headers: { Authorization: token }, body });
    if (!res.ok) throw new Error(`fonnte_http_${res.status}`);
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; reason?: string };
    if (json.status === false) throw new Error(`fonnte_${json.reason ?? 'rejected'}`);
  };
  return {
    sendOtp: (m) => send(m.destination, otpText(m)),
    sendText: send,
  };
};
