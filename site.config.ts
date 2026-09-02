/**
 * Single place for brand/placeholder configuration.
 * Everything user-visible about the brand flows from here.
 */
export const site = {
  name: 'Nusa Directory',
  shortName: 'Nusa',
  url: 'https://example.com',
  domain: 'example.com',
  supportEmail: 'support@example.com',
  supportWhatsApp: '+6281200000000',
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
