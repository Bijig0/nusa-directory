# Nusa Directory (placeholder brand)

Indonesian adult-services classifieds directory: Astro 7 (SSR) on Cloudflare Workers, D1 + R2, Preact islands, Tailwind 4.
Indonesian at `/`, English at `/en/`. Viewers unlock contact numbers with paid *reveals* (first one free per device, no account needed);
posters post for free and pay for boosts (bump / featured / VIP). Payments via Midtrans Snap.

The brand, domain and support contacts live in one file: [`site.config.ts`](site.config.ts).

## Architecture

```
src/domain/      pure functions (ids, slugs, phones, money, reveal ledger, listing rules, search, SEO, Midtrans signature, OTP, sessions, image headers)
src/infra/       adapters: D1 via Drizzle (db/repos/*), R2, photon image processing, rate limiter, Fonnte/Resend senders, Midtrans client, Google OAuth
src/services/    use-cases composing domain + infra (auth, reveal, checkout, listing, photo, browse, moderation, admin, cron, seed, sitemap)
src/actions/     Astro Actions (typed RPC for islands + HTML form actions for the admin panel)
src/pages/       routes (SSR), API endpoints (/api/*), image proxy (/img/*), sitemaps, robots
src/views/       page bodies shared by the `/` and `/en/` route files
src/components/  astro/ (server-rendered) and islands/ (Preact, rendered client-only with server fallbacks)
src/i18n/        id.json / en.json dictionaries + SEO title templates
src/data/        seed taxonomy: 34 cities with areas, 4 categories, services, products
src/content/     blog guides and policy pages (markdown, per locale)
migrations/      drizzle-kit SQL + hand-written FTS5 migration
tests/           vitest unit tests (domain) and Playwright E2E
```

Rules: `domain/` imports nothing from `infra/`, Astro or `cloudflare:workers`. Services receive a per-request `Deps` object
(`src/infra/env.ts`) built in middleware. Pages and actions only call services.

## Local development

Requirements: Bun ≥ 1.3, Node ≥ 22.12 (Astro), a Chromium for Playwright.

```bash
bun install
cp .dev.vars.example .dev.vars          # dev secrets (placeholders are fine locally)
bun run types                            # generates worker-configuration.d.ts from wrangler.jsonc
bun run db:migrate:local                 # applies migrations to the local D1
bun run dev                              # http://localhost:4321 (runs inside workerd)
bun run seed                             # seeds cities, categories, products, 60 fake listings, admin + posters
```

Dev conveniences (only when `ENVIRONMENT=development`):
- OTP codes are logged to the console and, with `DEV_EXPOSE_OTP=true`, returned by the `auth.requestOtp` action.
- Orders auto-complete when the Midtrans keys are placeholders, so reveal packs and boosts can be exercised without a gateway.
- `POST /api/dev/seed` and `POST /api/dev/cron` (header `x-seed-token: $SEED_TOKEN`) reseed the DB / run the hourly job.
- Seeded accounts: admin `+6281200000001` / `admin@example.com`, posters `+6281200000002`, `+6281200000003`.

Checks:

```bash
bun run test        # vitest (domain)
bun run check       # astro check (needs TypeScript 6.x, pinned)
bun run build && bun run preview
CHROME_PATH=/path/to/chrome bun run e2e   # Playwright against the preview server (or E2E_BASE_URL=... for a running server)
```

Note for `astro dev`: every server-side npm dependency is listed in `astro.config.ts` → `environments.ssr.optimizeDeps.include`.
The workerd module runner cannot survive Vite discovering a new dependency mid-session, so add new runtime deps there.

## Deploying to Cloudflare

1. **Create resources**
   ```bash
   wrangler d1 create escort-directory          # copy database_id into wrangler.jsonc
   wrangler r2 bucket create escort-directory-photos
   ```
2. **Configure** `wrangler.jsonc`: set `database_id`, update `vars.PUBLIC_SITE_URL` to `https://your-domain`, `vars.ENVIRONMENT` to `production`,
   `vars.MIDTRANS_ENV` to `production` when going live, remove `DEV_EXPOSE_OTP`. Photo processing runs in WASM and needs the **Workers Paid** plan
   (30 s CPU); the free plan's 10 ms CPU limit is not enough for uploads.
3. **Secrets** (`wrangler secret put NAME` for each): `DEVICE_SECRET`, `OTP_PEPPER`, `ADMIN_IDENTITIES`, `MIDTRANS_SERVER_KEY`,
   `MIDTRANS_CLIENT_KEY`, `FONNTE_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. `SEED_TOKEN` is not needed in production.
4. **Migrate**: `bun run db:migrate:remote`.
5. **Build & deploy**: `bun run build && wrangler deploy`. Attach your custom domain in the Cloudflare dashboard (Workers → Domains & Routes).
6. **Midtrans**: in the dashboard set *Settings → Configuration → Payment Notification URL* to `https://your-domain/api/webhooks/midtrans`
   and *Finish redirect URL* to `https://your-domain/dashboard/orders/`. Sandbox and production keys are separate.
7. **Fonnte**: connect a WhatsApp number and paste the account token as `FONNTE_TOKEN`. Without it OTPs are only logged (users cannot sign in by WhatsApp).
8. **Resend**: verify your sending domain, create an API key, set `EMAIL_FROM` to an address on that domain.
9. **Google**: create an OAuth 2.0 Web client; authorised redirect URI `https://your-domain/auth/google/callback`. Optional; the button is hidden without keys.
10. **Admins**: `ADMIN_IDENTITIES` is a comma-separated list of E.164 phone numbers and/or emails. Anyone signing in with one of them gets `/admin/`.
11. **Cron**: the `0 * * * *` trigger in `wrangler.jsonc` is registered on deploy; it expires listings/boosts/orders, sends renewal reminders and purges OTPs/sessions.
12. **Seed production taxonomy**: cities/categories/products come from the seed. Run the seed once against a fresh production DB by temporarily setting
    `ENVIRONMENT=development` + `SEED_TOKEN`, calling `POST /api/dev/seed`, then reverting — it wipes all tables, so never run it on live data.
    (Alternatively insert the rows from `src/data/*.ts` by hand.)
13. **Search Console**: submit `https://your-domain/sitemap-index.xml`.

## Monetisation defaults (editable in Admin → Pricing)

| Product | Price |
|---|---|
| 5 / 15 / 50 reveals | Rp 25.000 / 60.000 / 150.000 |
| Bump | Rp 15.000 |
| Featured 7 days | Rp 75.000 |
| VIP 30 days (carousel + 12 photos) | Rp 250.000 |

Free: 3 active listings per account, 8 photos per listing, first reveal per device.

## Safety & compliance features

18+ interstitial, mandatory poster declaration (recorded with version), cross-account phone deduplication, anonymous reports on every listing,
admin review queue (new / reported / edited), account bans that hide all listings, audit log, EXIF/GPS stripping and watermarking of photos,
policy pages (terms, privacy, content, anti-trafficking with hotlines).
