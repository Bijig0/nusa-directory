import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Conventions: ids are TEXT, timestamps are epoch milliseconds, money is integer IDR,
// booleans are integer 0/1, enums are TEXT with a TypeScript union.

const ts = (name: string) => integer(name, { mode: 'timestamp_ms' });
const bool = (name: string) => integer(name, { mode: 'boolean' });
const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>();

// ---------------------------------------------------------------------------
// Identity & sessions
// ---------------------------------------------------------------------------

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  displayName: text('display_name'),
  status: text('status', { enum: ['active', 'banned'] }).notNull().default('active'),
  bannedReason: text('banned_reason'),
  walletId: text('wallet_id').notNull(),
  createdAt: ts('created_at').notNull(),
  lastLoginAt: ts('last_login_at'),
});

export const identities = sqliteTable(
  'identities',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: ['phone', 'email', 'google'] }).notNull(),
    /** E.164 phone, lowercase email, or Google `sub`. */
    providerId: text('provider_id').notNull(),
    /** Email address for google identities (lets us link by verified email). */
    email: text('email'),
    verifiedAt: ts('verified_at'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [uniqueIndex('identities_provider_uq').on(t.provider, t.providerId), index('identities_user_idx').on(t.userId)],
);

export const otpCodes = sqliteTable(
  'otp_codes',
  {
    id: text('id').primaryKey(),
    channel: text('channel', { enum: ['wa', 'email'] }).notNull(),
    destination: text('destination').notNull(),
    purpose: text('purpose', { enum: ['login', 'link'] }).notNull().default('login'),
    /** When purpose = link: the user the identity will be attached to. */
    linkUserId: text('link_user_id'),
    codeHash: text('code_hash').notNull(),
    linkTokenHash: text('link_token_hash'),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    ipHash: text('ip_hash'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('otp_destination_idx').on(t.destination, t.createdAt), index('otp_expires_idx').on(t.expiresAt)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    /** sha256(token) */
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull(),
    lastSeenAt: ts('last_seen_at').notNull(),
    ipHash: text('ip_hash'),
    uaHash: text('ua_hash'),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
);

// ---------------------------------------------------------------------------
// Wallets, devices, reveals
// ---------------------------------------------------------------------------

export const wallets = sqliteTable('wallets', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['device', 'user'] }).notNull(),
  balance: integer('balance').notNull().default(0),
  mergedIntoWalletId: text('merged_into_wallet_id'),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
});

export const walletLedger = sqliteTable(
  'wallet_ledger',
  {
    id: text('id').primaryKey(),
    walletId: text('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: text('reason', {
      enum: ['purchase', 'reveal', 'free_reveal', 'merge_in', 'merge_out', 'admin_adjust', 'refund'],
    }).notNull(),
    refType: text('ref_type'),
    refId: text('ref_id'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('ledger_wallet_idx').on(t.walletId, t.createdAt)],
);

export const devices = sqliteTable(
  'devices',
  {
    id: text('id').primaryKey(),
    walletId: text('wallet_id').notNull().references(() => wallets.id),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    freeRevealUsedAt: ts('free_reveal_used_at'),
    ipHashFirst: text('ip_hash_first'),
    uaHash: text('ua_hash'),
    createdAt: ts('created_at').notNull(),
    lastSeenAt: ts('last_seen_at').notNull(),
  },
  (t) => [index('devices_wallet_idx').on(t.walletId), index('devices_user_idx').on(t.userId)],
);

export const reveals = sqliteTable(
  'reveals',
  {
    id: text('id').primaryKey(),
    walletId: text('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
    listingId: text('listing_id').notNull(),
    kind: text('kind', { enum: ['free', 'credit', 'owner', 'admin', 'merged'] }).notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [uniqueIndex('reveals_wallet_listing_uq').on(t.walletId, t.listingId), index('reveals_listing_idx').on(t.listingId)],
);

// ---------------------------------------------------------------------------
// Geography & taxonomy
// ---------------------------------------------------------------------------

export const cities = sqliteTable('cities', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameId: text('name_id').notNull(),
  nameEn: text('name_en').notNull(),
  province: text('province').notNull(),
  lat: real('lat'),
  lng: real('lng'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: bool('is_active').notNull().default(true),
});

export const areas = sqliteTable(
  'areas',
  {
    id: text('id').primaryKey(),
    cityId: text('city_id').notNull().references(() => cities.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    nameId: text('name_id').notNull(),
    nameEn: text('name_en').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: bool('is_active').notNull().default(true),
  },
  (t) => [uniqueIndex('areas_city_slug_uq').on(t.cityId, t.slug)],
);

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameId: text('name_id').notNull(),
  nameEn: text('name_en').notNull(),
  descId: text('desc_id').notNull(),
  descEn: text('desc_en').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const servicesCatalog = sqliteTable('services_catalog', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameId: text('name_id').notNull(),
  nameEn: text('name_en').notNull(),
  /** Category ids this service applies to; null = all. */
  categoryScope: json<string[] | null>('category_scope'),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export const LISTING_STATUSES = ['draft', 'active', 'paused', 'expired', 'removed'] as const;
export const MODERATION_STATES = ['pending', 'approved', 'flagged', 'hidden'] as const;
export const GENDERS = ['female', 'male', 'trans', 'couple'] as const;

export interface Availability {
  days: readonly number[]; // 0 = Sunday … 6 = Saturday
  from: string; // 'HH:MM'
  to: string; // 'HH:MM'
  allDay: boolean;
}

export const listings = sqliteTable(
  'listings',
  {
    id: text('id').primaryKey(),
    shortId: text('short_id').notNull().unique(),
    ownerUserId: text('owner_user_id').notNull().references(() => users.id),
    categoryId: text('category_id').notNull().references(() => categories.id),
    cityId: text('city_id').notNull().references(() => cities.id),
    areaId: text('area_id').references(() => areas.id, { onDelete: 'set null' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    age: integer('age').notNull(),
    gender: text('gender', { enum: GENDERS }).notNull(),
    nationality: text('nationality'),
    ethnicity: text('ethnicity'),
    heightCm: integer('height_cm'),
    bodyType: text('body_type'),
    languages: json<string[]>('languages').notNull().default(sql`'[]'`),
    rate1h: integer('rate_1h'),
    rate2h: integer('rate_2h'),
    rateOvernight: integer('rate_overnight'),
    incall: bool('incall').notNull().default(false),
    outcall: bool('outcall').notNull().default(false),
    availability: json<Availability | null>('availability'),
    phoneE164: text('phone_e164').notNull(),
    whatsappE164: text('whatsapp_e164'),
    telegramHandle: text('telegram_handle'),
    status: text('status', { enum: LISTING_STATUSES }).notNull().default('draft'),
    moderation: text('moderation', { enum: MODERATION_STATES }).notNull().default('pending'),
    verified: bool('verified').notNull().default(false),
    photoCount: integer('photo_count').notNull().default(0),
    coverPhotoId: text('cover_photo_id'),
    bumpedAt: ts('bumped_at'),
    featuredUntil: ts('featured_until'),
    vipUntil: ts('vip_until'),
    publishedAt: ts('published_at'),
    expiresAt: ts('expires_at'),
    renewalReminderSentAt: ts('renewal_reminder_sent_at'),
    declarationAcceptedAt: ts('declaration_accepted_at'),
    declarationVersion: integer('declaration_version'),
    removedReason: text('removed_reason'),
    /** Set when content changed after approval; admin queue "edited". */
    editedAt: ts('edited_at'),
    createdAt: ts('created_at').notNull(),
    updatedAt: ts('updated_at').notNull(),
  },
  (t) => [
    index('listings_browse_idx').on(t.cityId, t.categoryId, t.status, t.bumpedAt),
    index('listings_area_idx').on(t.cityId, t.categoryId, t.areaId, t.status),
    index('listings_owner_idx').on(t.ownerUserId, t.status),
    index('listings_expiry_idx').on(t.status, t.expiresAt),
    index('listings_moderation_idx').on(t.moderation, t.updatedAt),
    index('listings_phone_idx').on(t.phoneE164),
  ],
);

export const listingPhotos = sqliteTable(
  'listing_photos',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    storage: text('storage', { enum: ['r2', 'placeholder'] }).notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytesFull: integer('bytes_full'),
    /** Placeholder photos render as a coloured SVG. */
    colorHex: text('color_hex'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('photos_listing_idx').on(t.listingId, t.position)],
);

export const listingServices = sqliteTable(
  'listing_services',
  {
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    serviceId: text('service_id').notNull().references(() => servicesCatalog.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.serviceId] }), index('listing_services_service_idx').on(t.serviceId)],
);

/** Cross-account phone deduplication: one owner per phone number. */
export const phoneClaims = sqliteTable('phone_claims', {
  phoneE164: text('phone_e164').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  claimedAt: ts('claimed_at').notNull(),
});

// ---------------------------------------------------------------------------
// Commerce
// ---------------------------------------------------------------------------

export const PRODUCT_CODES = ['reveal_5', 'reveal_15', 'reveal_50', 'bump', 'featured_7d', 'vip_30d'] as const;
export type ProductCode = (typeof PRODUCT_CODES)[number];

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  code: text('code', { enum: PRODUCT_CODES }).notNull().unique(),
  kind: text('kind', { enum: ['reveal_pack', 'boost'] }).notNull(),
  nameId: text('name_id').notNull(),
  nameEn: text('name_en').notNull(),
  priceIdr: integer('price_idr').notNull(),
  credits: integer('credits'),
  durationDays: integer('duration_days'),
  isActive: bool('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: ts('updated_at').notNull(),
});

export const ORDER_STATUSES = ['pending', 'paid', 'failed', 'expired', 'refunded'] as const;

export const orders = sqliteTable(
  'orders',
  {
    /** Also the Midtrans order_id. */
    id: text('id').primaryKey(),
    walletId: text('wallet_id').notNull().references(() => wallets.id),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    productId: text('product_id').notNull().references(() => products.id),
    productCode: text('product_code').notNull(),
    listingId: text('listing_id').references(() => listings.id, { onDelete: 'set null' }),
    amountIdr: integer('amount_idr').notNull(),
    credits: integer('credits'),
    status: text('status', { enum: ORDER_STATUSES }).notNull().default('pending'),
    snapToken: text('snap_token'),
    snapRedirectUrl: text('snap_redirect_url'),
    midtransTransactionId: text('midtrans_transaction_id'),
    paymentType: text('payment_type'),
    paidAt: ts('paid_at'),
    fulfilledAt: ts('fulfilled_at'),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull(),
    updatedAt: ts('updated_at').notNull(),
  },
  (t) => [index('orders_wallet_idx').on(t.walletId, t.createdAt), index('orders_status_idx').on(t.status, t.expiresAt)],
);

export const paymentEvents = sqliteTable(
  'payment_events',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id').notNull(),
    provider: text('provider').notNull().default('midtrans'),
    transactionId: text('transaction_id').notNull(),
    transactionStatus: text('transaction_status').notNull(),
    statusCode: text('status_code'),
    fraudStatus: text('fraud_status'),
    signatureValid: bool('signature_valid').notNull(),
    payload: text('payload').notNull(),
    receivedAt: ts('received_at').notNull(),
  },
  (t) => [uniqueIndex('payment_events_uq').on(t.provider, t.transactionId, t.transactionStatus)],
);

export const boosts = sqliteTable(
  'boosts',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    orderId: text('order_id'),
    type: text('type', { enum: ['bump', 'featured', 'vip'] }).notNull(),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('boosts_listing_idx').on(t.listingId, t.type, t.endsAt)],
);

// ---------------------------------------------------------------------------
// Engagement & moderation
// ---------------------------------------------------------------------------

export const favorites = sqliteTable(
  'favorites',
  {
    walletId: text('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.walletId, t.listingId] })],
);

export const reviews = sqliteTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    walletId: text('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    body: text('body').notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
    posterReply: text('poster_reply'),
    posterRepliedAt: ts('poster_replied_at'),
    moderatedBy: text('moderated_by'),
    moderatedAt: ts('moderated_at'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [uniqueIndex('reviews_listing_wallet_uq').on(t.listingId, t.walletId), index('reviews_listing_status_idx').on(t.listingId, t.status)],
);

export const REPORT_REASONS = ['scam', 'underage', 'trafficking', 'fake_photos', 'wrong_category', 'offensive', 'other'] as const;

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    walletId: text('wallet_id'),
    reason: text('reason', { enum: REPORT_REASONS }).notNull(),
    details: text('details'),
    ipHash: text('ip_hash'),
    status: text('status', { enum: ['open', 'resolved', 'dismissed'] }).notNull().default('open'),
    resolvedBy: text('resolved_by'),
    resolvedAt: ts('resolved_at'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('reports_listing_idx').on(t.listingId), index('reports_status_idx').on(t.status, t.createdAt)],
);

export const listingStatsDaily = sqliteTable(
  'listing_stats_daily',
  {
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    /** 'YYYY-MM-DD' in Asia/Jakarta. */
    day: text('day').notNull(),
    views: integer('views').notNull().default(0),
    reveals: integer('reveals').notNull().default(0),
    waClicks: integer('wa_clicks').notNull().default(0),
    tgClicks: integer('tg_clicks').notNull().default(0),
    favorites: integer('favorites').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.day] })],
);

/** Fixed-window counters for long rate-limit windows (per day etc.). */
export const rateWindows = sqliteTable(
  'rate_windows',
  {
    key: text('key').notNull(),
    windowStart: integer('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id'),
    actorType: text('actor_type', { enum: ['admin', 'system', 'user'] }).notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    before: text('before'),
    after: text('after'),
    ipHash: text('ip_hash'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('audit_target_idx').on(t.targetType, t.targetId), index('audit_created_idx').on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Identity = typeof identities.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type City = typeof cities.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type ServiceItem = typeof servicesCatalog.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type ListingPhoto = typeof listingPhotos.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Boost = typeof boosts.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type ModerationState = (typeof MODERATION_STATES)[number];
export type Gender = (typeof GENDERS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
