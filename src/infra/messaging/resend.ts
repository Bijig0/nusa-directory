import type { EmailSender } from './senders';

/** Resend transactional email (https://resend.com/docs/api-reference/emails/send-email). */
export const resendSender = (apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailSender => ({
  send: async (m) => {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
    });
    if (!res.ok) throw new Error(`resend_http_${res.status}`);
  },
});
