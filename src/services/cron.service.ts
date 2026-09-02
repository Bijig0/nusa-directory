import { and, eq, lt, lte, isNull } from 'drizzle-orm';
import type { Deps } from '../infra/env';
import { changesOf } from '../infra/db/client';
import { listings, otpCodes, sessions } from '../infra/db/schema';
import { expirePendingOrders } from '../infra/db/repos/orders';
import { site } from '../../site.config';
import { needsRenewalReminder } from '../domain/listing';
import { identitiesOf } from '../infra/db/repos/auth';

export interface CronReport {
  expiredListings: number;
  expiredOrders: number;
  reminders: number;
  purgedOtps: number;
  purgedSessions: number;
}

/** Hourly maintenance. Every step is idempotent so overlapping runs are harmless. */
export const runHourly = async (deps: Deps): Promise<CronReport> => {
  const { db } = deps;
  const now = deps.clock.now();
  const ts = now.getTime();

  const expired = await db.update(listings).set({ status: 'expired', updatedAt: now }).where(and(eq(listings.status, 'active'), lte(listings.expiresAt, now))).run();
  await db.update(listings).set({ featuredUntil: null, updatedAt: now }).where(and(lte(listings.featuredUntil, now), isNull(listings.vipUntil))).run();
  const orders = await expirePendingOrders(db, now).run();

  // Renewal reminders: one WhatsApp/email per listing, 3 days before expiry.
  const dueSoon = await db.select().from(listings).where(and(eq(listings.status, 'active'), isNull(listings.renewalReminderSentAt), lte(listings.expiresAt, new Date(ts + site.renewalReminderDaysBefore * 86_400_000))));
  let reminders = 0;
  for (const l of dueSoon.filter((l) => needsRenewalReminder(l, now))) {
    const ids = await identitiesOf(db, l.ownerUserId);
    const phone = ids.find((i) => i.provider === 'phone')?.providerId;
    const email = ids.find((i) => i.provider === 'email')?.providerId;
    const link = `${deps.siteUrl}/dashboard/`;
    const text = `${site.name}: iklan "${l.title}" akan berakhir dalam ${site.renewalReminderDaysBefore} hari. Perpanjang gratis di ${link}`;
    try {
      if (phone) await deps.otpSender.sendText(phone, text);
      else if (email) await deps.emailSender.send({ to: email, subject: `${site.name}: perpanjang iklan Anda`, text, html: `<p>${text}</p>` });
      await db.update(listings).set({ renewalReminderSentAt: now }).where(eq(listings.id, l.id)).run();
      reminders++;
    } catch (error) {
      console.error('[cron] reminder failed', l.id, error);
    }
  }

  const otps = await db.delete(otpCodes).where(lt(otpCodes.expiresAt, new Date(ts - 86_400_000))).run();
  const sess = await db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
  const report = { expiredListings: changesOf(expired), expiredOrders: changesOf(orders), reminders, purgedOtps: changesOf(otps), purgedSessions: changesOf(sess) };
  console.log('[cron]', JSON.stringify(report));
  return report;
};
