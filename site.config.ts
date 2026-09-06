/**
 * Single place for brand/placeholder configuration.
 * Everything user-visible about the brand flows from here.
 */
/**
 * Public origin of the deployment. `PUBLIC_SITE_URL` (Vercel project settings, or `.env`)
 * wins so canonical links, hreflang, sitemaps and robots.txt follow the deployed host;
 * the placeholder only applies when nothing is configured (local dev, tests).
 */
const configuredUrl =
  (typeof process !== 'undefined' ? process.env.PUBLIC_SITE_URL : undefined)?.trim().replace(/\/$/, '') ||
  'https://example.com';

const host = new URL(configuredUrl).hostname;
/** vercel.app previews and the placeholder are not a brand domain; don't print them on photos. */
const isBrandDomain = host !== 'example.com' && !host.endsWith('.vercel.app') && host !== 'localhost';
const env = (key: string): string | undefined => (typeof process !== 'undefined' ? process.env[key]?.trim() || undefined : undefined);

export const site = {
  name: 'Nusa Directory',
  shortName: 'Nusa',
  url: configuredUrl,
  domain: host,
  /** Text stamped on uploaded photos: the brand domain once there is one, otherwise the brand name. */
  watermark: isBrandDomain ? host : 'Nusa Directory',
  /** Optional; the footer omits the mailto link until SUPPORT_EMAIL is configured. */
  supportEmail: env('SUPPORT_EMAIL'),
  supportWhatsApp: env('SUPPORT_WHATSAPP'),
  /** Optional; renders <meta name="google-site-verification"> when GOOGLE_SITE_VERIFICATION is set. */
  googleSiteVerification: env('GOOGLE_SITE_VERIFICATION'),
  defaultCitySlug: 'batam',
  locales: ['id', 'en'] as const,
  defaultLocale: 'id' as const,
  /** Used for `og:image` when a page has no cover. */
  defaultOgImagePath: '/og-default.png',
  /** Contact declarations version; bump when the poster declaration text changes. */
  declarationVersion: 1,
  listingLifetimeDays: 30,
  renewalReminderDaysBefore: 3,
  freeActiveListings: 3,
  photoLimits: { standard: 8, vip: 12 },
} as const;

export type SiteConfig = typeof site;
export type Locale = (typeof site.locales)[number];
