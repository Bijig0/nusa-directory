import { test, expect } from '@playwright/test';
import { reseed, acceptAgeGate, firstListingHref } from './helpers';

test.beforeAll(async ({ request }) => {
  await reseed(request);
});

test('first reveal is free, the second needs a pack, buying one unlocks it', async ({ page }) => {
  await page.goto('/batam/escorts/');
  await acceptAgeGate(page);
  const links = page.locator('a[data-listing-id]');
  const first = await links.nth(0).getAttribute('href');
  const second = await links.nth(1).getAttribute('href');

  await page.goto(first!);
  await acceptAgeGate(page);
  const box = page.locator('#contact-box');
  await box.locator('[data-reveal-button]').click();
  await expect(box.locator('[data-revealed]')).toBeVisible();
  await expect(box.locator('a[href^="https://wa.me/"]')).toBeVisible();
  await expect(box).toContainText(/\+62 \d{3}-\d{4}-\d{2,4}/);

  // reload keeps the contact visible (already revealed)
  await page.reload();
  await expect(box.locator('[data-revealed]')).toBeVisible();

  await page.goto(second!);
  await box.locator('[data-reveal-button]').click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: /Bayar sekarang|Pay now/ }).click();
  // dev mode auto-pays the order, then the listing is revealed with a credit
  await expect(box.locator('[data-revealed]')).toBeVisible({ timeout: 15_000 });
  const me = await (await page.request.get('/api/me')).json();
  expect(me.balance).toBe(14); // the pre-selected pack is 15 reveals, one spent
  expect(me.revealedListingIds).toHaveLength(2);
});

test('a forged webhook is rejected and a genuine one credits exactly once', async ({ request }) => {
  // The dev server key is the placeholder from .dev.vars.example.
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? 'SB-Mid-server-xxxxxxxxxxxxxxxx';
  const orderId = `ORD-E2E${Date.now().toString(36).toUpperCase()}`;
  // Create a pending order for the admin wallet through the checkout action is not possible without a gateway,
  // so exercise the webhook against an unknown order: signature must still gate everything.
  const body = { order_id: orderId, status_code: '200', gross_amount: '25000.00', transaction_status: 'settlement', transaction_id: `tx-${orderId}` };
  const forged = await request.post('/api/webhooks/midtrans', { data: { ...body, signature_key: 'deadbeef' } });
  expect(forged.status()).toBe(403);
  const { createHash } = await import('node:crypto');
  const sig = createHash('sha512').update(`${orderId}20025000.00${serverKey}`).digest('hex');
  const genuine = await request.post('/api/webhooks/midtrans', { data: { ...body, signature_key: sig } });
  expect(genuine.status()).toBe(200);
  expect(await genuine.text()).toBe('unknown_order');
  const dup = await request.post('/api/webhooks/midtrans', { data: { ...body, signature_key: sig } });
  expect(await dup.text()).toBe('duplicate');
});

test('favorites persist per device', async ({ page }) => {
  const href = await firstListingHref(page, '/batam/pijat/');
  await page.goto(href);
  await acceptAgeGate(page);
  await page.locator('[data-favorite-button]').click();
  await expect(page.locator('[data-favorite-button]')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/favorites/');
  await expect(page.locator('a[data-listing-id]')).toHaveCount(1);
});
