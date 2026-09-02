import { and, desc, eq, lt } from 'drizzle-orm';
import type { Db } from '../client';
import { orders, paymentEvents, type Order } from '../schema';

export const insertOrder = (db: Db, row: typeof orders.$inferInsert) => db.insert(orders).values(row);
export const findOrder = (db: Db, id: string): Promise<Order | undefined> => db.select().from(orders).where(eq(orders.id, id)).get();
export const updateOrder = (db: Db, id: string, patch: Partial<typeof orders.$inferInsert>) => db.update(orders).set(patch).where(eq(orders.id, id));
export const ordersOfWallet = (db: Db, walletId: string, limit: number): Promise<Order[]> =>
  db.select().from(orders).where(eq(orders.walletId, walletId)).orderBy(desc(orders.createdAt)).limit(limit);
export const recentOrders = (db: Db, limit: number): Promise<Order[]> => db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
export const expirePendingOrders = (db: Db, now: Date) =>
  db.update(orders).set({ status: 'expired', updatedAt: now }).where(and(eq(orders.status, 'pending'), lt(orders.expiresAt, now)));

/** Records a webhook delivery; returns false when this exact (transaction, status) was already seen. */
export const recordPaymentEvent = async (db: Db, row: typeof paymentEvents.$inferInsert): Promise<boolean> => {
  const r = await db.insert(paymentEvents).values(row).onConflictDoNothing().run();
  return Number(r.meta.changes ?? 0) === 1;
};
