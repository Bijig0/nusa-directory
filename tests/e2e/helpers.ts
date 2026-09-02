import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4321';
export const SEED_TOKEN = process.env.SEED_TOKEN ?? 'dev-seed-token';

/** Reseeds the local database (dev only). */
export const reseed = async (request: APIRequestContext): Promise<void> => {
  const res = await request.post(`${BASE}/api/dev/seed`, { headers: { 'x-seed-token': SEED_TOKEN, 'content-type': 'application/json', origin: BASE }, data: {} });
  expect(res.ok(), await res.text()).toBeTruthy();
};

export const runCron = async (request: APIRequestContext): Promise<Record<string, number>> => {
  const res = await request.post(`${BASE}/api/dev/cron`, { headers: { 'x-seed-token': SEED_TOKEN, 'content-type': 'application/json', origin: BASE }, data: {} });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Record<string, number>;
};

/** Signs in through the real UI using the dev-exposed OTP code. */
export const loginWithPhone = async (page: Page, phone: string): Promise<void> => {
  await page.goto('/auth/login/');
  await page.getByLabel(/WhatsApp|Nomor WhatsApp/).fill(phone);
  await page.getByRole('button', { name: /Kirim kode|Send code/ }).click();
  const code = await page.locator('[data-dev-code]').getAttribute('data-dev-code');
  expect(code).toMatch(/^\d{6}$/);
  await page.locator('#otp-code').fill(code!);
  await page.getByRole('button', { name: /^Masuk$|^Sign in$/ }).click();
  await page.waitForURL(/\/dashboard\//);
};

export const acceptAgeGate = async (page: Page): Promise<void> => {
  const gate = page.locator('#age-gate');
  if (await gate.isVisible()) await page.locator('#age-gate-enter').click();
};

/** First listing link on a category page. */
export const firstListingHref = async (page: Page, categoryPath: string): Promise<string> => {
  await page.goto(categoryPath);
  const href = await page.locator('a[data-listing-id]').first().getAttribute('href');
  expect(href).toBeTruthy();
  return href!;
};
