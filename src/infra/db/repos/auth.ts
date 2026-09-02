import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { identities, otpCodes, sessions, users, wallets, devices, reveals, favorites, reviews, walletLedger, type Identity, type Session, type User } from '../schema';
import { newId } from '../../../domain/ids';

export const findUser = (db: Db, id: string): Promise<User | undefined> => db.select().from(users).where(eq(users.id, id)).get();

export const findIdentity = (db: Db, provider: Identity['provider'], providerId: string): Promise<Identity | undefined> =>
  db.select().from(identities).where(and(eq(identities.provider, provider), eq(identities.providerId, providerId))).get();

export const identitiesOf = (db: Db, userId: string): Promise<Identity[]> => db.select().from(identities).where(eq(identities.userId, userId));

/** Creates a user with a fresh wallet and first identity, atomically. */
export const createUserWithIdentity = async (db: Db, now: Date, identity: { provider: Identity['provider']; providerId: string; email?: string }, displayName?: string): Promise<User> => {
  const walletId = newId(now.getTime());
  const user: User = { id: newId(now.getTime()), displayName: displayName ?? null, status: 'active', bannedReason: null, walletId, createdAt: now, lastLoginAt: now };
  await db.batch([
    db.insert(wallets).values({ id: walletId, kind: 'user', balance: 0, createdAt: now, updatedAt: now }),
    db.insert(users).values(user),
    db.insert(identities).values({ id: newId(now.getTime()), userId: user.id, provider: identity.provider, providerId: identity.providerId, email: identity.email ?? null, verifiedAt: now, createdAt: now }),
  ]);
  return user;
};

export const addIdentity = (db: Db, now: Date, userId: string, identity: { provider: Identity['provider']; providerId: string; email?: string }) =>
  db.insert(identities).values({ id: newId(now.getTime()), userId, provider: identity.provider, providerId: identity.providerId, email: identity.email ?? null, verifiedAt: now, createdAt: now });

export const touchLogin = (db: Db, userId: string, now: Date) => db.update(users).set({ lastLoginAt: now }).where(eq(users.id, userId));

// --- OTP ---

export const insertOtp = (db: Db, row: typeof otpCodes.$inferInsert) => db.insert(otpCodes).values(row);
export const findOtp = (db: Db, id: string) => db.select().from(otpCodes).where(eq(otpCodes.id, id)).get();
export const findOtpByLinkToken = (db: Db, hash: string) => db.select().from(otpCodes).where(eq(otpCodes.linkTokenHash, hash)).get();
export const bumpOtpAttempts = (db: Db, id: string) => db.update(otpCodes).set({ attempts: sql`${otpCodes.attempts} + 1` }).where(eq(otpCodes.id, id));
export const consumeOtp = (db: Db, id: string, now: Date) => db.update(otpCodes).set({ consumedAt: now }).where(eq(otpCodes.id, id));
/** Invalidate older unconsumed challenges for the same destination. */
export const expireOtpsFor = (db: Db, destination: string, now: Date) =>
  db.update(otpCodes).set({ expiresAt: now }).where(and(eq(otpCodes.destination, destination), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, now)));

// --- Sessions ---

export const insertSession = (db: Db, row: typeof sessions.$inferInsert) => db.insert(sessions).values(row);
export const findSessionWithUser = async (db: Db, id: string): Promise<{ session: Session; user: User } | undefined> => {
  const row = await db.select({ session: sessions, user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.id, id)).get();
  return row ?? undefined;
};
export const refreshSession = (db: Db, id: string, expiresAt: Date, now: Date) => db.update(sessions).set({ expiresAt, lastSeenAt: now }).where(eq(sessions.id, id));
export const deleteSession = (db: Db, id: string) => db.delete(sessions).where(eq(sessions.id, id));
export const deleteSessionsOfUser = (db: Db, userId: string) => db.delete(sessions).where(eq(sessions.userId, userId));

// --- Device → user wallet merge ---

/**
 * Moves everything an anonymous device earned into the user's wallet, atomically:
 * balance, reveals, favorites and reviews. The device keeps its free-reveal flag.
 */
export const mergeDeviceIntoUser = async (db: Db, deviceId: string, deviceWalletId: string, user: User, now: Date): Promise<void> => {
  if (deviceWalletId === user.walletId) return;
  const ts = now.getTime();
  await db.batch([
    db.run(sql`UPDATE wallets SET balance = balance + (SELECT balance FROM wallets WHERE id = ${deviceWalletId}), updated_at = ${ts} WHERE id = ${user.walletId}`),
    db.run(sql`INSERT INTO wallet_ledger (id, wallet_id, delta, reason, ref_type, ref_id, created_at)
               SELECT ${newId(ts)}, ${user.walletId}, balance, 'merge_in', 'wallet', ${deviceWalletId}, ${ts} FROM wallets WHERE id = ${deviceWalletId} AND balance > 0`),
    db.run(sql`INSERT INTO wallet_ledger (id, wallet_id, delta, reason, ref_type, ref_id, created_at)
               SELECT ${newId(ts + 1)}, ${deviceWalletId}, -balance, 'merge_out', 'wallet', ${user.walletId}, ${ts} FROM wallets WHERE id = ${deviceWalletId} AND balance > 0`),
    db.run(sql`INSERT OR IGNORE INTO reveals (id, wallet_id, listing_id, kind, created_at)
               SELECT lower(hex(randomblob(13))), ${user.walletId}, listing_id, 'merged', created_at FROM reveals WHERE wallet_id = ${deviceWalletId}`),
    db.run(sql`INSERT OR IGNORE INTO favorites (wallet_id, listing_id, created_at) SELECT ${user.walletId}, listing_id, created_at FROM favorites WHERE wallet_id = ${deviceWalletId}`),
    db.run(sql`UPDATE OR IGNORE reviews SET wallet_id = ${user.walletId} WHERE wallet_id = ${deviceWalletId}`),
    db.run(sql`UPDATE wallets SET balance = 0, merged_into_wallet_id = ${user.walletId}, updated_at = ${ts} WHERE id = ${deviceWalletId}`),
    db.update(devices).set({ walletId: user.walletId, userId: user.id, lastSeenAt: now }).where(eq(devices.id, deviceId)),
  ]);
};

export const banUser = (db: Db, userId: string, reason: string) => db.update(users).set({ status: 'banned', bannedReason: reason }).where(eq(users.id, userId));
export const unbanUser = (db: Db, userId: string) => db.update(users).set({ status: 'active', bannedReason: null }).where(eq(users.id, userId));
export const setDisplayName = (db: Db, userId: string, name: string | null) => db.update(users).set({ displayName: name }).where(eq(users.id, userId));

export { reveals, favorites, reviews, walletLedger };
