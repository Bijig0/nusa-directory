# Nusa Directory (placeholder brand)

Indonesian adult-services classifieds directory: Astro 7 (SSR) on Vercel, Turso (libSQL) + Cloudflare R2, Preact islands, Tailwind 4.
Indonesian at `/`, English at `/en/`. Viewers unlock contact numbers with paid *reveals* (first one free per device, no account needed);
posters post for free and pay for boosts (bump / featured / VIP). Payments via Midtrans Snap.

The brand, domain and support contacts live in one file: [`site.config.ts`](site.config.ts).

## Architecture

```
src/domain/      pure functions (ids, slugs, phones, money, reveal ledger, listing rules, search, SEO, Midtrans signature, OTP, sessions, image headers)
src/infra/       adapters: libSQL via Drizzle (db/repos/*), R2 over S3 (or local disk), sharp image processing, rate limiter, Fonnte/Resend senders, Midtrans client, Google OAuth
src/services/    use-cases composing domain + infra (auth, reveal, checkout, listing, photo, browse, moderation, admin, cron, seed, sitemap)
src/actions/     Astro Actions (typed RPC for islands + HTML form actions for the admin panel)
src/pages/       routes (SSR), API endpoints (/api/*, incl. the Vercel cron target), image proxy (/img/*), sitemaps, robots
src/views/       page bodies shared by the `/` and `/en/` route files
src/components/  astro/ (server-rendered) and islands/ (Preact, rendered client-only with server fallbacks)
src/i18n/        id.json / en.json dictionaries + SEO title templates
src/data/        seed taxonomy: 34 cities with areas, 4 categories, services, products
src/content/     blog guides and policy pages (markdown, per locale)
migrations/      drizzle-kit SQL + hand-written FTS5 migration (applied with scripts/migrate.ts)
tests/           vitest unit tests (domain) and Playwright E2E
```

Rules: `domain/` imports nothing from `infra/` or Astro. Services receive a per-request `Deps` object (`src/infra/env.ts`,
configuration from `src/infra/config.ts`) built in middleware. Pages and actions only call services.

## Local development

Requirements: Bun ≥ 1.3, Node ≥ 22.12 (Astro), a Chromium for Playwright.

```bash
bun install
cp .env.example .env                     # local settings; placeholders are fine
bun run db:migrate                       # creates .data/dev.db (embedded SQLite) and applies migrations
bun run dev                              # http://localhost:4321
bun run seed                             # seeds cities, categories, products, 60 fake listings, admin + posters
```

Photos are stored under `.data/photos/` unless the `R2_*` variables are set. Dev conveniences (only when `ENVIRONMENT=development`):
- OTP codes are logged to the console and, with `DEV_EXPOSE_OTP=true`, returned by the `auth.requestOtp` action.
- Orders auto-complete when the Midtrans keys are placeholders, so reveal packs and boosts can be exercised without a gateway.
- `POST /api/dev/seed` and `POST /api/dev/cron` (header `x-seed-token: $SEED_TOKEN`) reseed the DB / run the maintenance job.
- Seeded accounts: admin `+6281200000001` / `admin@example.com`, posters `+6281200000002`, `+6281200000003`.

Checks:

```bash
bun run test        # vitest (domain)
bun run check       # astro check (TypeScript 6.x is pinned)
bun run build       # produces .vercel/output
CHROME_PATH=/path/to/chrome bun run e2e   # Playwright; starts `bun run dev` itself, or set E2E_BASE_URL for a running server
```

## Deploying to Vercel

1. **Turso database** (free tier is enough to start):
   ```bash
   turso db create nusa-directory
   turso db show nusa-directory --url        # → TURSO_DATABASE_URL (libsql://…)
   turso db tokens create nusa-directory     # → TURSO_AUTH_TOKEN
   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… bun run db:migrate
   ```
2. **R2 bucket**: Cloudflare dashboard → R2 → *Manage R2 API tokens* → token with *Object Read & Write*. Note the account id, access key id and secret.
   Then `R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=escort-directory-photos bun run r2:setup` creates the bucket and verifies a round-trip.
3. **Import the repo in Vercel** (Add New → Project → your GitHub repo). Framework preset: Astro. Root directory: the folder containing this README if it is inside a monorepo. Build command `bun run build`, install command `bun install` (or leave the defaults; Vercel detects Bun from `bun.lock`). Node.js version 22.
4. **Environment variables** (Project → Settings → Environment Variables), copy the names from `.env.example`:
   `ENVIRONMENT=production`, `PUBLIC_SITE_URL=https://your-domain`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `DEVICE_SECRET`, `OTP_PEPPER`, `CRON_SECRET` (random strings), `ADMIN_IDENTITIES`, `MIDTRANS_ENV`,
   `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `FONNTE_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
   Do **not** set `SEED_TOKEN` or `DEV_EXPOSE_OTP` in production.
5. **Deploy**: every push to the connected branch deploys. Attach your domain under Project → Settings → Domains and set `PUBLIC_SITE_URL` to it.
6. **Midtrans**: dashboard → Settings → Configuration → *Payment Notification URL* = `https://your-domain/api/webhooks/midtrans`, *Finish redirect URL* = `https://your-domain/dashboard/orders/`. Sandbox and production keys are separate.
7. **Fonnte**: connect a WhatsApp number and paste the account token as `FONNTE_TOKEN` (without it, WhatsApp sign-in cannot deliver codes).
8. **Resend**: verify your sending domain, create an API key, set `EMAIL_FROM` to an address on that domain.
9. **Google** (optional): OAuth 2.0 Web client with authorised redirect URI `https://your-domain/auth/google/callback`.
10. **Admins**: `ADMIN_IDENTITIES` is a comma-separated list of E.164 phone numbers and/or emails; anyone signing in with one of them gets `/admin/`.
11. **Cron**: `vercel.json` schedules `/api/cron` daily at 20:00 UTC (03:00 WIB). Vercel Hobby only allows daily crons; on Pro change it to `0 * * * *` for hourly expiry and reminders. The endpoint requires `Authorization: Bearer $CRON_SECRET`, which Vercel adds automatically.
12. **Seed the production taxonomy** (cities, areas, categories, services, products) once: temporarily set `ENVIRONMENT=development` and `SEED_TOKEN` on a preview deployment, run `BASE_URL=https://<preview-url> SEED_TOKEN=… bun run seed`, then remove them. The seed wipes every table, so never run it against a live database with real data.
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
