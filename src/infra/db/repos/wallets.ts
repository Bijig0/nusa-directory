import { eq, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { devices, reveals, wallets, walletLedger, favorites, type Device, type Wallet } from '../schema';
import { newId } from '../../../domain/ids';

export const findWallet = (db: Db, id: string): Promise<Wallet | undefined> => db.select().from(wallets).where(eq(wallets.id, id)).get();
export const findDevice = (db: Db, id: string): Promise<Device | undefined> => db.select().from(devices).where(eq(devices.id, id)).get();

export const createDeviceWithWallet = async (db: Db, now: Date, meta: { ipHash?: string; uaHash?: string }): Promise<Device> => {
  const walletId = newId(now.getTime());
  const device: Device = {
    id: newId(now.getTime()), walletId, userId: null, freeRevealUsedAt: null,
    ipHashFirst: meta.ipHash ?? null, uaHash: meta.uaHash ?? null, createdAt: now, lastSeenAt: now,
  };
  await db.batch([
    db.insert(wallets).values({ id: walletId, kind: 'device', balance: 0, createdAt: now, updatedAt: now }),
    db.insert(devices).values(device),
  ]);
  return device;
};

export const touchDevice = (db: Db, id: string, now: Date) => db.update(devices).set({ lastSeenAt: now }).where(eq(devices.id, id));

export const revealedListingIds = async (db: Db, walletId: string, limit = 500): Promise<string[]> => {
  const rows = await db.select({ id: reveals.listingId }).from(reveals).where(eq(reveals.walletId, walletId)).orderBy(sql`${reveals.createdAt} DESC`).limit(limit);
  return rows.map((r) => r.id);
};

export const favoriteListingIds = async (db: Db, walletId: string): Promise<string[]> => {
  const rows = await db.select({ id: favorites.listingId }).from(favorites).where(eq(favorites.walletId, walletId)).orderBy(sql`${favorites.createdAt} DESC`).limit(500);
  return rows.map((r) => r.id);
};

export const hasReveal = async (db: Db, walletId: string, listingId: string): Promise<boolean> =>
  Boolean(await db.select({ id: reveals.id }).from(reveals).where(sql`${reveals.walletId} = ${walletId} AND ${reveals.listingId} = ${listingId}`).get());

/** Inserts a reveal row; returns false when this wallet already revealed the listing. */
export const insertRevealIfNew = async (db: Db, id: string, walletId: string, listingId: string, kind: 'free' | 'credit' | 'owner' | 'admin' | 'merged', now: Date): Promise<boolean> => {
  const r = await db.run(sql`INSERT OR IGNORE INTO reveals (id, wallet_id, listing_id, kind, created_at) VALUES (${id}, ${walletId}, ${listingId}, ${kind}, ${now.getTime()})`);
  return Number(r.meta.changes ?? 0) === 1;
};

export const deleteReveal = (db: Db, id: string) => db.delete(reveals).where(eq(reveals.id, id));

/** Atomically spends one credit; false when the balance was already zero. */
export const spendCredit = async (db: Db, walletId: string, now: Date): Promise<boolean> => {
  const r = await db.run(sql`UPDATE wallets SET balance = balance - 1, updated_at = ${now.getTime()} WHERE id = ${walletId} AND balance >= 1`);
  return Number(r.meta.changes ?? 0) === 1;
};

export const markFreeRevealUsed = async (db: Db, deviceId: string, now: Date): Promise<boolean> => {
  const r = await db.run(sql`UPDATE devices SET free_reveal_used_at = ${now.getTime()} WHERE id = ${deviceId} AND free_reveal_used_at IS NULL`);
  return Number(r.meta.changes ?? 0) === 1;
};

export const addLedger = (db: Db, entry: { walletId: string; delta: number; reason: (typeof walletLedger.$inferInsert)['reason']; refType?: string; refId?: string }, now: Date) =>
  db.insert(walletLedger).values({ id: newId(now.getTime()), walletId: entry.walletId, delta: entry.delta, reason: entry.reason, refType: entry.refType ?? null, refId: entry.refId ?? null, createdAt: now });

export const creditWallet = (db: Db, walletId: string, credits: number, now: Date) =>
  db.update(wallets).set({ balance: sql`${wallets.balance} + ${credits}`, updatedAt: now }).where(eq(wallets.id, walletId));

export const toggleFavorite = async (db: Db, walletId: string, listingId: string, now: Date): Promise<boolean> => {
  const deleted = await db.run(sql`DELETE FROM favorites WHERE wallet_id = ${walletId} AND listing_id = ${listingId}`);
  if (Number(deleted.meta.changes ?? 0) === 1) return false;
  await db.insert(favorites).values({ walletId, listingId, createdAt: now });
  return true;
};
