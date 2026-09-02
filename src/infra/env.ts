import { makeDb, type Db } from './db/client';
import { systemClock, type Clock } from './clock';
import { d1RateLimiter, type RateLimiter } from './ratelimit';
import { abuseHash } from '../domain/crypto';
import { consoleEmailSender, consoleOtpSender, type EmailSender, type OtpSender } from './messaging/senders';
import { fonnteSender } from './messaging/fonnte';
import { resendSender } from './messaging/resend';

/**
 * Everything a service needs, built once per request from the Worker `env`
 * and execution context. Services never touch `cloudflare:workers` directly,
 * which keeps them testable with fakes.
 */
export interface Deps {
  db: Db;
  env: Env;
  clock: Clock;
  waitUntil: (p: Promise<unknown>) => void;
  isDev: boolean;
  siteUrl: string;
  rateLimiter: RateLimiter;
  /** Daily-rotating hash of an IP / UA for abuse windows. */
  hashForAbuse: (value: string) => Promise<string>;
  otpSender: OtpSender;
  emailSender: EmailSender;
}

export const makeDeps = (env: Env, ctx: ExecutionContext | undefined, clock: Clock = systemClock): Deps => {
  const db = makeDb(env.DB);
  return {
    db,
    env,
    clock,
    waitUntil: (p) => (ctx ? ctx.waitUntil(p) : void p.catch((e) => console.error(e))),
    isDev: env.ENVIRONMENT === 'development',
    siteUrl: env.PUBLIC_SITE_URL,
    rateLimiter: d1RateLimiter(db),
    hashForAbuse: (value) => abuseHash(env.DEVICE_SECRET, value, clock.now().toISOString().slice(0, 10)),
    otpSender: env.FONNTE_TOKEN ? fonnteSender(env.FONNTE_TOKEN) : consoleOtpSender,
    emailSender: env.RESEND_API_KEY ? resendSender(env.RESEND_API_KEY, env.EMAIL_FROM || 'no-reply@example.com') : consoleEmailSender,
  };
};
