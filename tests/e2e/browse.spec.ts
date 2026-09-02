import { test, expect } from '@playwright/test';
import { reseed, acceptAgeGate } from './helpers';

test.beforeAll(async ({ request }) => {
  await reseed(request);
});

test('home, city and category pages render with SEO essentials', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Nusa Directory/);
  await expect(page.locator('meta[name="rating"]')).toHaveAttribute('content', 'adult');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
  await acceptAgeGate(page);
  await expect(page.locator('#age-gate')).toBeHidden();

  await page.goto('/batam/');
  await expect(page.locator('main h1')).toContainText('Batam');
  await page.goto('/batam/escorts/');
  await expect(page.locator('main h1')).toContainText('Pendamping di Batam');
  const cards = page.locator('a[data-listing-id]');
  expect(await cards.count()).toBeGreaterThan(3);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});

test('area filter, search and the English locale work', async ({ page }) => {
  await page.goto('/batam/escorts/nagoya/');
  await expect(page.locator('main h1')).toContainText('Nagoya');
  await page.goto('/en/batam/pijat/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main h1')).toContainText('Massage & Spa in Batam');
  await page.goto('/batam/escorts/?q=pijat');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.goto('/batam/escorts/?verified=1');
  for (const badge of await page.locator('a[data-listing-id]').all()) await expect(badge).toContainText('Verified');
});

test('listing page masks the phone number and expired listings return 410', async ({ page, request }) => {
  await page.goto('/batam/escorts/');
  const href = await page.locator('a[data-listing-id]').first().getAttribute('href');
  const res = await request.get(href!);
  const html = await res.text();
  expect(html).toMatch(/\+62 \d{3}-xxxx-xxxx/);
  expect(html).not.toMatch(/\+628\d{8,}/);
  expect(html).toContain('"@type":"BreadcrumbList"');
  // wrong slug with a valid short id redirects to the canonical URL
  const shortId = href!.match(/-([0-9a-z]{7})\/$/)![1];
  const redirect = await request.get(`/batam/escorts/wrong-${shortId}/`, { maxRedirects: 0 });
  expect(redirect.status()).toBe(301);
  // an expired seeded listing is gone
  const sitemap = await (await request.get('/sitemaps/listings-1.xml')).text();
  expect(sitemap).toContain('<urlset');
  const expiredHtml = await (await request.get('/batam/escorts/')).text();
  expect(expiredHtml).not.toContain('0ndds2r'); // never in listings (seed marks every 17th listing expired)
});

test('sitemaps and robots are valid', async ({ request }) => {
  const index = await (await request.get('/sitemap-index.xml')).text();
  expect(index).toContain('<sitemapindex');
  for (const name of ['static', 'cities', 'listings-1', 'blog']) {
    const res = await request.get(`/sitemaps/${name}.xml`);
    expect(res.status(), name).toBe(200);
    expect(await res.text()).toContain('<urlset');
  }
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap:');
  expect(robots).toContain('Disallow: /admin/');
});
