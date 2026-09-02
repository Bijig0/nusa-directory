import { test, expect } from '@playwright/test';
import { reseed, loginWithPhone, acceptAgeGate, firstListingHref } from './helpers';

test.beforeAll(async ({ request }) => {
  await reseed(request);
});

test('a reported listing shows in the admin queue and hiding it removes it publicly', async ({ page, browser }) => {
  const href = await firstListingHref(page, '/batam/escorts/');
  await page.goto(href);
  await acceptAgeGate(page);
  await page.locator('[data-report-button]').click();
  await page.locator('[data-report-form] select').selectOption('fake_photos');
  await page.locator('[data-report-form] textarea').fill('E2E report');
  await page.locator('[data-report-form] button[type="submit"]').click();
  await expect(page.locator('[data-report-form]')).toContainText(/Terima kasih|Thank you/);
  const listingId = await page.locator('#contact-box').getAttribute('data-listing-id');

  const admin = await browser.newPage();
  await loginWithPhone(admin, '+6281200000001');
  await admin.goto('/admin/listings/?queue=reported');
  await expect(admin.locator(`[data-admin-listing="${listingId}"]`)).toBeVisible();
  await admin.goto(`/admin/listings/${listingId}/`);
  await admin.getByRole('button', { name: /Sembunyikan|^Hide$/ }).first().click();
  await admin.waitForURL(/done=admin\.listing/);
  const res = await page.request.get(href);
  expect(res.status()).toBe(404);
  await admin.goto('/admin/');
  await expect(admin.locator('[data-kpi]').first()).toBeVisible();
  await admin.close();
});
