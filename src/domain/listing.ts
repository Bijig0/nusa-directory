import { z } from 'zod';
import { site } from '../../site.config';
import { GENDERS } from '../infra/db/schema';
import { normalizePhone } from './phone';

const DAY_MS = 24 * 3600 * 1000;

export type Tier = 'standard' | 'featured' | 'vip';

export interface TierSource {
  featuredUntil: Date | null;
  vipUntil: Date | null;
}

export const isVip = (l: TierSource, now: Date): boolean => l.vipUntil !== null && l.vipUntil.getTime() > now.getTime();
export const isFeatured = (l: TierSource, now: Date): boolean =>
  isVip(l, now) || (l.featuredUntil !== null && l.featuredUntil.getTime() > now.getTime());
export const tierOf = (l: TierSource, now: Date): Tier => (isVip(l, now) ? 'vip' : isFeatured(l, now) ? 'featured' : 'standard');
export const photoLimitFor = (tier: Tier): number => (tier === 'vip' ? site.photoLimits.vip : site.photoLimits.standard);

export const expiryFrom = (publishedAt: Date): Date => new Date(publishedAt.getTime() + site.listingLifetimeDays * DAY_MS);
export const isExpired = (expiresAt: Date | null, now: Date): boolean => expiresAt !== null && expiresAt.getTime() <= now.getTime();
export const daysUntil = (at: Date, now: Date): number => Math.ceil((at.getTime() - now.getTime()) / DAY_MS);
export const needsRenewalReminder = (l: { expiresAt: Date | null; renewalReminderSentAt: Date | null; status: string }, now: Date): boolean =>
  l.status === 'active' &&
  l.expiresAt !== null &&
  l.renewalReminderSentAt === null &&
  l.expiresAt.getTime() - now.getTime() <= site.renewalReminderDaysBefore * DAY_MS;

// ---------------------------------------------------------------------------
// Input validation (posting wizard)
// ---------------------------------------------------------------------------

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const optionalInt = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '' || v === null) return null;
      const n = typeof v === 'number' ? v : Number.parseInt(v, 10);
      return Number.isFinite(n) ? n : NaN;
    })
    .refine((n) => n === null || (Number.isInteger(n) && n >= min && n <= max), { message: `must be between ${min} and ${max}` });

const phoneField = z
  .string()
  .trim()
  .min(6)
  .transform((raw, ctx) => {
    const r = normalizePhone(raw);
    if (!r.ok) {
      ctx.addIssue({ code: 'custom', message: 'invalid_phone' });
      return z.NEVER;
    }
    return r.value;
  });

export const availabilitySchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  from: z.string().regex(/^\d{2}:\d{2}$/).default('10:00'),
  to: z.string().regex(/^\d{2}:\d{2}$/).default('02:00'),
  allDay: z.boolean().default(false),
});

/** Shape accepted from the posting wizard. Everything after the core fields is optional. */
export const listingInputSchema = z.object({
  categoryId: z.string().min(1),
  cityId: z.string().min(1),
  areaId: z.string().optional().transform((v) => (v ? v : null)),
  title: z.string().trim().min(8).max(90),
  description: z.string().trim().min(40).max(4000),
  age: z.coerce.number().int().min(18).max(99),
  gender: z.enum(GENDERS),
  nationality: optionalTrimmed(40),
  ethnicity: optionalTrimmed(40),
  heightCm: optionalInt(120, 230),
  bodyType: optionalTrimmed(20),
  languages: z.array(z.string().max(5)).max(8).default([]),
  serviceIds: z.array(z.string().max(60)).max(20).default([]),
  rate1h: optionalInt(0, 1_000_000_000),
  rate2h: optionalInt(0, 1_000_000_000),
  rateOvernight: optionalInt(0, 1_000_000_000),
  incall: z.boolean().default(false),
  outcall: z.boolean().default(false),
  availability: availabilitySchema.nullable().default(null),
  phone: phoneField,
  whatsapp: z
    .string()
    .trim()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return null;
      const r = normalizePhone(raw);
      if (!r.ok) {
        ctx.addIssue({ code: 'custom', message: 'invalid_phone' });
        return z.NEVER;
      }
      return r.value;
    }),
  telegram: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '') : null))
    .refine((v) => v === null || /^[A-Za-z0-9_]{5,32}$/.test(v), { message: 'invalid_telegram' }),
});

export type ListingInput = z.input<typeof listingInputSchema>;
export type ValidListing = z.output<typeof listingInputSchema>;

/** Placeholder-safe excerpt for meta descriptions. */
export const excerpt = (text: string, max = 155): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 80))}…`;
};

/** Contact text shown as prefilled WhatsApp message. */
export const contactPrefill = (locale: 'id' | 'en', title: string, siteName: string): string =>
  locale === 'id' ? `Halo, saya lihat iklan "${title}" di ${siteName}.` : `Hi, I saw your ad "${title}" on ${siteName}.`;
