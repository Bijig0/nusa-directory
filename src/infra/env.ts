import { waitUntil as vercelWaitUntil } from '@vercel/functions';
import { makeDb, type Db } from './db/client';
import { systemClock, type Clock } from './clock';
import { d1RateLimiter, type RateLimiter } from './ratelimit';
import { abuseHash } from '../domain/crypto';
import { consoleEmailSender, consoleOtpSender, type EmailSender, type OtpSender } from './messaging/senders';
import { fonnteSender } from './messaging/fonnte';
import { resendSender } from './messaging/resend';
import { s3PhotoStore, localPhotoStore, type PhotoStore } from './storage/r2';
import { hasR2, type AppEnv } from './config';

/**
 * Everything a service needs, built once per request from the environment.
 * Services never read `process.env` directly, which keeps them testable with fakes.
 */
export interface Deps {
  db: Db;
  env: AppEnv;
  clock: Clock;
  waitUntil: (p: Promise<unknown>) => void;
  isDev: boolean;
  siteUrl: string;
  rateLimiter: RateLimiter;
  /** Daily-rotating hash of an IP / UA for abuse windows. */
  hashForAbuse: (value: string) => Promise<string>;
  otpSender: OtpSender;
  emailSender: EmailSender;
  photos: PhotoStore;
}

const backgroundTask = (p: Promise<unknown>): void => {
  const guarded = p.catch((e) => console.error('[background]', e));
  try {
    vercelWaitUntil(guarded);
  } catch {
    // Outside Vercel (local dev, scripts) the promise simply runs to completion.
  }
};

let dbSingleton: { url: string; db: Db } | undefined;
const dbFor = (env: AppEnv): Db => {
  if (!dbSingleton || dbSingleton.url !== env.TURSO_DATABASE_URL) dbSingleton = { url: env.TURSO_DATABASE_URL, db: makeDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN) };
  return dbSingleton.db;
};

export const makeDeps = (env: AppEnv, clock: Clock = systemClock): Deps => {
  const db = dbFor(env);
  return {
    db,
    env,
    clock,
    waitUntil: backgroundTask,
    isDev: env.ENVIRONMENT === 'development',
    siteUrl: env.PUBLIC_SITE_URL,
    rateLimiter: d1RateLimiter(db),
    hashForAbuse: (value) => abuseHash(env.DEVICE_SECRET, value, clock.now().toISOString().slice(0, 10)),
    otpSender: env.FONNTE_TOKEN ? fonnteSender(env.FONNTE_TOKEN) : consoleOtpSender,
    emailSender: env.RESEND_API_KEY ? resendSender(env.RESEND_API_KEY, env.EMAIL_FROM || 'no-reply@example.com') : consoleEmailSender,
    photos: hasR2(env)
      ? s3PhotoStore({ accountId: env.R2_ACCOUNT_ID!, accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY!, bucket: env.R2_BUCKET! })
      : localPhotoStore('.data/photos'),
  };
};
