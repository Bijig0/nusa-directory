/**
 * Runtime configuration read from environment variables (Vercel project settings, or `.env` locally).
 * Key names are shared with the deployment docs in README.md and `.env.example`.
 */
export interface AppEnv {
  ENVIRONMENT: 'development' | 'production';
  PUBLIC_SITE_URL: string;
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  DEVICE_SECRET: string;
  OTP_PEPPER: string;
  CRON_SECRET?: string;
  SEED_TOKEN?: string;
  DEV_EXPOSE_OTP?: string;
  ADMIN_IDENTITIES: string;
  MIDTRANS_ENV: string;
  MIDTRANS_SERVER_KEY?: string;
  MIDTRANS_CLIENT_KEY?: string;
  FONNTE_TOKEN?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

const read = (key: string): string | undefined => {
  const fromProcess = typeof process !== 'undefined' ? process.env[key] : undefined;
  const fromVite = (import.meta.env as Record<string, string | undefined>)[key];
  const value = fromProcess ?? fromVite;
  return value === '' ? undefined : value;
};

const required = (key: string, fallback?: string): string => {
  const value = read(key) ?? fallback;
  if (value === undefined) throw new Error(`Missing required environment variable ${key}`);
  return value;
};

let cached: AppEnv | undefined;

/** Reads and validates the environment once per process. */
export const loadEnv = (): AppEnv => {
  if (cached) return cached;
  const environment = read('ENVIRONMENT') === 'production' ? 'production' : 'development';
  const insecureDefault = environment === 'development' ? 'dev-secret-not-for-production-0123456789' : undefined;
  cached = {
    ENVIRONMENT: environment,
    PUBLIC_SITE_URL: required('PUBLIC_SITE_URL', 'http://localhost:4321').replace(/\/$/, ''),
    TURSO_DATABASE_URL: required('TURSO_DATABASE_URL', environment === 'development' ? 'file:.data/dev.db' : undefined),
    TURSO_AUTH_TOKEN: read('TURSO_AUTH_TOKEN'),
    R2_ACCOUNT_ID: read('R2_ACCOUNT_ID'),
    R2_ACCESS_KEY_ID: read('R2_ACCESS_KEY_ID'),
    R2_SECRET_ACCESS_KEY: read('R2_SECRET_ACCESS_KEY'),
    R2_BUCKET: read('R2_BUCKET'),
    DEVICE_SECRET: required('DEVICE_SECRET', insecureDefault),
    OTP_PEPPER: required('OTP_PEPPER', insecureDefault),
    CRON_SECRET: read('CRON_SECRET'),
    SEED_TOKEN: read('SEED_TOKEN'),
    DEV_EXPOSE_OTP: read('DEV_EXPOSE_OTP'),
    ADMIN_IDENTITIES: read('ADMIN_IDENTITIES') ?? '',
    MIDTRANS_ENV: read('MIDTRANS_ENV') ?? 'sandbox',
    MIDTRANS_SERVER_KEY: read('MIDTRANS_SERVER_KEY'),
    MIDTRANS_CLIENT_KEY: read('MIDTRANS_CLIENT_KEY'),
    FONNTE_TOKEN: read('FONNTE_TOKEN'),
    RESEND_API_KEY: read('RESEND_API_KEY'),
    EMAIL_FROM: read('EMAIL_FROM'),
    GOOGLE_CLIENT_ID: read('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: read('GOOGLE_CLIENT_SECRET'),
  };
  return cached;
};

export const hasR2 = (env: AppEnv): boolean => Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
