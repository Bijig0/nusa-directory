import { makeDb, type Db } from './db/client';
import { systemClock, type Clock } from './clock';

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
}

export const makeDeps = (env: Env, ctx: ExecutionContext | undefined, clock: Clock = systemClock): Deps => ({
  db: makeDb(env.DB),
  env,
  clock,
  waitUntil: (p) => (ctx ? ctx.waitUntil(p) : void p.catch((e) => console.error(e))),
  isDev: env.ENVIRONMENT === 'development',
  siteUrl: env.PUBLIC_SITE_URL,
});
