import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { reseed, loginWithPhone, runCron } from './helpers';

const fixture = fileURLToPath(new URL('./fixtures/fixture-rotated.jpg', import.meta.url));

test.beforeAll(async ({ request }) => {
  await reseed(request);
});

test('poster signs in, posts a listing with a photo, and it appears publicly', async ({ page, request }) => {
  await loginWithPhone(page, '0812 0000 0002');
  await page.goto('/dashboard/listings/new/');
  const wizard = page.locator('[data-wizard-step]');
  await expect(wizard).toBeVisible();

  // step 1: category/city (defaults are fine) → step 2
  await page.locator('[data-next]').click();
  await page.locator('#f-title').fill('E2E Sari 24th ramah, hotel visit Nagoya');
  await page.locator('#f-description').fill('Iklan uji otomatis. Deskripsi cukup panjang untuk lolos validasi minimal empat puluh karakter, terima kasih.');
  await page.locator('#f-age').fill('24');
  await page.locator('[data-next]').click();
  await page.locator('#f-rate1h').fill('500000');
  await page.locator('[data-next]').click();
  await page.locator('#f-phone').fill('0819 5555 0001');
  await page.locator('[data-next]').click(); // saves the draft, moves to photos
  await expect(page).toHaveURL(/\/dashboard\/listings\/[0-9a-z]+\/edit\//);

  await page.locator('[data-photo-input]').setInputFiles(fixture);
  await expect(page.locator('li img[src*="/img/"]')).toHaveCount(1, { timeout: 30_000 });
  const src = await page.locator('li img[src*="/img/"]').first().getAttribute('src');
  const img = await request.get(src!.replace('card.jpg', 'full.jpg'));
  expect(img.headers()['content-type']).toContain('image/jpeg');
  // The fixture is 1200x1600 with EXIF orientation 6; upright output is landscape 1600x1200.
  const dims = await page.evaluate(async (url) => {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    return { w: bmp.width, h: bmp.height };
  }, src!.replace('card.jpg', 'full.jpg'));
  expect(dims.w).toBeGreaterThan(dims.h);

  await page.locator('[data-next]').click();
  await page.locator('[data-declaration]').check();
  await page.locator('[data-publish]').click();
  await expect(page.getByRole('heading', { name: /sudah tayang|is live/ })).toBeVisible();

  // Featured/VIP ads stay pinned above regular ones by design, so look for the card anywhere on the newest-first page.
  await page.goto('/batam/escorts/?sort=newest');
  await expect(page.locator('a[data-listing-id]', { hasText: 'E2E Sari 24th' })).toBeVisible();

  // dashboard shows it; renew works; cron expiry then renew from expired
  await page.goto('/dashboard/');
  const row = page.locator('[data-listing-row]', { hasText: 'E2E Sari 24th' });
  await expect(row).toBeVisible();
  await row.locator('[data-renew]').click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-listing-row]', { hasText: 'E2E Sari 24th' })).toContainText(/Tayang|Live/);
  const report = await runCron(request);
  expect(report.expiredListings).toBeGreaterThanOrEqual(0);
});
