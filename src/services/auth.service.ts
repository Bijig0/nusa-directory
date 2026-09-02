import type { AstroCookies } from 'astro';
import type { Deps } from '../infra/env';
import { site } from '../../site.config';
import { err, ok, type Result } from '../domain/result';
import { normalizePhone } from '../domain/phone';
import { decideOtpThrottle, generateLinkToken, generateOtpCode, hashLinkToken, hashOtp, isEmail, normalizeEmail, OTP_TTL_MS, verifyOtpHash } from '../domain/otp';
import { createSessionToken, isSessionValid, refreshedExpiry, SESSION_COOKIE, SESSION_TTL_MS, sessionIdFromToken, shouldRefreshSession } from '../domain/session';
import { newId } from '../domain/ids';
import { DAY, QUARTER_HOUR } from '../infra/ratelimit';
import { addIdentity, bumpOtpAttempts, consumeOtp, createUserWithIdentity, deleteSession, expireOtpsFor, findIdentity, findOtp, findOtpByLinkToken, findSessionWithUser, findUser, identitiesOf, insertOtp, insertSession, mergeDeviceIntoUser, refreshSession, touchLogin } from '../infra/db/repos/auth';
import { readDevice } from './device.service';
import type { Identity, Session, User } from '../infra/db/schema';

export type Channel = 'wa' | 'email';
export type Locale = 'id' | 'en';

export interface OtpRequest {
  channel: Channel;
  destination: string;
  ip: string;
  locale: Locale;
  /** When set, the identity is linked to this user instead of signing in. */
  linkUserId?: string;
}

export type OtpRequestError = 'invalid_destination' | 'throttled' | 'send_failed' | 'already_linked';

export interface OtpChallenge {
  otpId: string;
  destination: string;
  channel: Channel;
  /** Only in development with DEV_EXPOSE_OTP=true. */
  devCode?: string;
}

const normalizeDestination = (channel: Channel, raw: string): string | undefined => {
  if (channel === 'email') return isEmail(raw.trim()) ? normalizeEmail(raw) : undefined;
  const r = normalizePhone(raw);
  return r.ok ? r.value : undefined;
};

const emailHtml = (locale: Locale, code: string, link: string): { subject: string; html: string; text: string } => {
  const subject = locale === 'en' ? `${site.name}: your login code ${code}` : `${site.name}: kode masuk Anda ${code}`;
  const text = locale === 'en'
    ? `Your ${site.name} login code is ${code} (valid 10 minutes).\nOr open this link: ${link}`
    : `Kode masuk ${site.name} Anda: ${code} (berlaku 10 menit).\nAtau buka tautan ini: ${link}`;
  const html = `<p>${text.replace('\n', '<br>')}</p><p><a href="${link}">${link}</a></p>`;
  return { subject, html, text };
};

/** Creates and sends a one-time code (and, for email, a magic link). */
export const requestOtp = async (deps: Deps, req: OtpRequest): Promise<Result<OtpChallenge, OtpRequestError>> => {
  const destination = normalizeDestination(req.channel, req.destination);
  if (!destination) return err('invalid_destination');
  const now = deps.clock.now();
  const ipHash = await deps.hashForAbuse(req.ip);
  const [d15, dDay, ipDay] = await Promise.all([
    deps.rateLimiter.peek(`otp:dest15:${destination}`, QUARTER_HOUR, now),
    deps.rateLimiter.peek(`otp:destday:${destination}`, DAY, now),
    deps.rateLimiter.peek(`otp:ipday:${ipHash}`, DAY, now),
  ]);
  if (decideOtpThrottle({ perDestination15m: d15, perDestinationDay: dDay, perIpDay: ipDay }) !== 'ok') return err('throttled');
  if (req.linkUserId) {
    const existing = await findIdentity(deps.db, req.channel === 'wa' ? 'phone' : 'email', destination);
    if (existing && existing.userId !== req.linkUserId) return err('already_linked');
  }
  await Promise.all([
    deps.rateLimiter.hit(`otp:dest15:${destination}`, 999, QUARTER_HOUR, now),
    deps.rateLimiter.hit(`otp:destday:${destination}`, 999, DAY, now),
    deps.rateLimiter.hit(`otp:ipday:${ipHash}`, 999, DAY, now),
  ]);

  const otpId = newId(now.getTime());
  const code = generateOtpCode();
  const linkToken = req.channel === 'email' ? generateLinkToken() : undefined;
  await expireOtpsFor(deps.db, destination, now).run();
  await insertOtp(deps.db, {
    id: otpId, channel: req.channel, destination, purpose: req.linkUserId ? 'link' : 'login', linkUserId: req.linkUserId ?? null,
    codeHash: await hashOtp(code, deps.env.OTP_PEPPER, otpId), linkTokenHash: linkToken ? await hashLinkToken(linkToken, deps.env.OTP_PEPPER) : null,
    attempts: 0, expiresAt: new Date(now.getTime() + OTP_TTL_MS), consumedAt: null, ipHash, createdAt: now,
  }).run();

  try {
    if (req.channel === 'wa') {
      await deps.otpSender.sendOtp({ destination, code, locale: req.locale, brand: site.name });
    } else {
      const link = `${deps.siteUrl}/auth/email/verify?token=${linkToken}`;
      await deps.emailSender.send({ to: destination, ...emailHtml(req.locale, code, link) });
    }
  } catch (error) {
    console.error('[otp] send failed', error);
    return err('send_failed');
  }
  const expose = deps.isDev && deps.env.DEV_EXPOSE_OTP === 'true';
  return ok({ otpId, destination, channel: req.channel, ...(expose ? { devCode: code } : {}) });
};

export type OtpVerifyError = 'not_found' | 'expired' | 'consumed' | 'too_many_attempts' | 'mismatch' | 'already_linked';

export interface SignedIn {
  user: User;
  isNew: boolean;
  linked: boolean;
}

const identityFor = (channel: Channel, destination: string) =>
  channel === 'wa' ? { provider: 'phone' as const, providerId: destination } : { provider: 'email' as const, providerId: destination, email: destination };

/** Resolves (or creates) the user behind a verified identity, or links it to `linkUserId`. */
const resolveUser = async (deps: Deps, identity: { provider: Identity['provider']; providerId: string; email?: string }, now: Date, linkUserId: string | null, displayName?: string): Promise<Result<SignedIn, 'already_linked' | 'not_found'>> => {
  const existing = await findIdentity(deps.db, identity.provider, identity.providerId);
  if (linkUserId) {
    if (existing && existing.userId !== linkUserId) return err('already_linked');
    const user = await findUser(deps.db, linkUserId);
    if (!user) return err('not_found');
    if (!existing) await addIdentity(deps.db, now, linkUserId, identity).run();
    return ok({ user, isNew: false, linked: true });
  }
  if (existing) {
    const user = await findUser(deps.db, existing.userId);
    if (!user) return err('not_found');
    await touchLogin(deps.db, user.id, now).run();
    return ok({ user, isNew: false, linked: false });
  }
  // Google: link by verified email when an email identity exists.
  if (identity.provider === 'google' && identity.email) {
    const byEmail = await findIdentity(deps.db, 'email', identity.email);
    if (byEmail) {
      const user = await findUser(deps.db, byEmail.userId);
      if (user) {
        await addIdentity(deps.db, now, user.id, identity).run();
        return ok({ user, isNew: false, linked: true });
      }
    }
  }
  const user = await createUserWithIdentity(deps.db, now, identity, displayName);
  return ok({ user, isNew: true, linked: false });
};

export const verifyOtp = async (deps: Deps, otpId: string, code: string): Promise<Result<SignedIn, OtpVerifyError>> => {
  const row = await findOtp(deps.db, otpId);
  if (!row) return err('not_found');
  const now = deps.clock.now();
  const outcome = verifyOtpHash(row, await hashOtp(code.trim(), deps.env.OTP_PEPPER, otpId), now);
  if (outcome === 'mismatch') {
    await bumpOtpAttempts(deps.db, otpId).run();
    return err('mismatch');
  }
  if (outcome !== 'ok') return err(outcome);
  await consumeOtp(deps.db, otpId, now).run();
  return resolveUser(deps, identityFor(row.channel, row.destination), now, row.linkUserId);
};

export const verifyMagicLink = async (deps: Deps, token: string): Promise<Result<SignedIn, OtpVerifyError>> => {
  const row = await findOtpByLinkToken(deps.db, await hashLinkToken(token, deps.env.OTP_PEPPER));
  if (!row) return err('not_found');
  const now = deps.clock.now();
  if (row.consumedAt) return err('consumed');
  if (row.expiresAt.getTime() <= now.getTime()) return err('expired');
  await consumeOtp(deps.db, row.id, now).run();
  return resolveUser(deps, identityFor(row.channel, row.destination), now, row.linkUserId);
};

export const signInWithGoogle = (deps: Deps, claims: { sub: string; email?: string; emailVerified: boolean; name?: string }, linkUserId: string | null) =>
  resolveUser(deps, { provider: 'google', providerId: claims.sub, email: claims.emailVerified ? claims.email : undefined }, deps.clock.now(), linkUserId, claims.name);

// --- Sessions ---

const sessionCookieOptions = (deps: Deps, maxAge: number) => ({ httpOnly: true, secure: !deps.isDev, sameSite: 'lax' as const, path: '/', maxAge });

/** Starts a session for the user, sets the cookie and merges the anonymous device wallet. */
export const startSession = async (deps: Deps, cookies: AstroCookies, request: Request, user: User): Promise<void> => {
  const now = deps.clock.now();
  const s = await createSessionToken(now);
  const [ipHash, uaHash] = await Promise.all([
    deps.hashForAbuse(request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0'),
    deps.hashForAbuse(request.headers.get('user-agent') ?? ''),
  ]);
  await insertSession(deps.db, { id: s.id, userId: user.id, expiresAt: s.expiresAt, createdAt: now, lastSeenAt: now, ipHash, uaHash }).run();
  cookies.set(SESSION_COOKIE, s.token, sessionCookieOptions(deps, SESSION_TTL_MS / 1000));
  cookies.set('li', '1', { ...sessionCookieOptions(deps, SESSION_TTL_MS / 1000), httpOnly: false });
  const device = await readDevice(deps, cookies);
  if (device && device.walletId !== user.walletId) await mergeDeviceIntoUser(deps.db, device.id, device.walletId, user, now);
};

export const endSession = async (deps: Deps, cookies: AstroCookies): Promise<void> => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(deps.db, await sessionIdFromToken(token)).run();
  cookies.delete(SESSION_COOKIE, { path: '/' });
  cookies.delete('li', { path: '/' });
};

export interface Resolved {
  user: User;
  session: Session;
  isAdmin: boolean;
}

export const isAdminIdentity = (allowlist: string, ids: readonly Identity[]): boolean => {
  const allowed = new Set(allowlist.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  return ids.some((i) => allowed.has(i.providerId.toLowerCase()) || (i.email !== null && allowed.has(i.email.toLowerCase())));
};

/** Resolves the session cookie into user + admin flag; refreshes the sliding expiry. */
export const resolveSession = async (deps: Deps, cookies: AstroCookies): Promise<Resolved | undefined> => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return undefined;
  const found = await findSessionWithUser(deps.db, await sessionIdFromToken(token));
  const now = deps.clock.now();
  if (!found || !isSessionValid(found.session.expiresAt, now)) {
    cookies.delete(SESSION_COOKIE, { path: '/' });
    return undefined;
  }
  if (found.user.status === 'banned') {
    await deleteSession(deps.db, found.session.id).run();
    cookies.delete(SESSION_COOKIE, { path: '/' });
    return undefined;
  }
  if (shouldRefreshSession(found.session.expiresAt, now)) {
    const expiresAt = refreshedExpiry(now);
    deps.waitUntil(refreshSession(deps.db, found.session.id, expiresAt, now).run());
    cookies.set(SESSION_COOKIE, token, sessionCookieOptions(deps, SESSION_TTL_MS / 1000));
  }
  const ids = await identitiesOf(deps.db, found.user.id);
  return { user: found.user, session: found.session, isAdmin: isAdminIdentity(deps.env.ADMIN_IDENTITIES ?? '', ids) };
};

/** Only allow same-site relative redirects after login. */
export const safeNext = (next: string | null | undefined, fallback = '/dashboard/'): string =>
  next && /^\/(?!\/)[^\s]*$/.test(next) && !next.startsWith('/auth/') ? next : fallback;
