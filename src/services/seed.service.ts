import { sql } from 'drizzle-orm';
import type { Deps } from '../infra/env';
import { areas, categories, cities, identities, listingPhotos, listingServices, listings, products, reviews, servicesCatalog, users, wallets, type Gender } from '../infra/db/schema';
import { citySeeds } from '../data/cities';
import { categorySeeds } from '../data/categories';
import { serviceSeeds, NATIONALITIES, ETHNICITIES, BODY_TYPES } from '../data/services';
import { productSeeds } from '../data/products';
import { newId, newShortId } from '../domain/ids';
import { slugify } from '../domain/slug';
import { expiryFrom } from '../domain/listing';

/** Deterministic PRNG so seeded content is stable between runs. */
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const NAMES = ['Sari', 'Dewi', 'Putri', 'Ayu', 'Nadia', 'Rina', 'Maya', 'Vina', 'Cindy', 'Bella', 'Jessica', 'Angel', 'Tasya', 'Kezia', 'Mira', 'Lina', 'Sinta', 'Anisa', 'Rara', 'Cantika', 'Rio', 'Kevin', 'Dion', 'Gilang', 'Vanessa', 'Michelle', 'Yuki', 'Mei', 'Ling', 'Anya'];
const TITLE_BITS: Record<string, string[]> = {
  cat_escorts: ['Cantik & ramah, siap temani dinner', 'Fresh, sabar, bisa hotel visit', 'Real pic 100%, no tipu-tipu', 'Bisa jalan & travel, ramah', 'Slim putih mulus, open 24 jam', 'Teman kencan elegan, private'],
  cat_massage: ['Pijat panggilan hotel & apartemen', 'Terapis pijat sensual profesional', 'Pijat relaksasi + lulur, panggilan 24 jam', 'Massage full body, tenaga terapis muda', 'Spa panggilan, alat lengkap'],
  cat_fetish: ['Mistress berpengalaman, private dungeon', 'Roleplay & domination, aman & bersih', 'Foot fetish & bondage, by appointment', 'Sub obedient, hotel only'],
  cat_trans: ['Trans cantik, real pic, hotel visit', 'Waria ramah & sabar, bisa 24 jam', 'Trans feminine, open couple', 'TS elegan, private apartment'],
};
const DESCRIPTIONS = [
  'Halo, saya {name}, {age} tahun. Foto asli tanpa edit, ramah dan tidak buru-buru. Bisa hotel visit atau apartemen pribadi di area {area}. Silakan hubungi via WhatsApp untuk jadwal dan tarif. Mohon sopan dan serius.',
  'Hi, {name} di sini. Usia {age}, tinggi {height} cm. Melayani dengan sepenuh hati, higienis dan diskret. Lokasi sekitar {area}, {city}. Chat WA dulu ya untuk booking. No drama, no perantara.',
  'Perkenalkan {name}, {age} th, {city}. Menerima panggilan hotel bintang 3 ke atas di sekitar {area}. Tersedia paket 1 jam, 2 jam, dan menginap. Booking minimal 1 jam sebelumnya. Terima kasih.',
];
const REVIEWS = ['Ramah dan sesuai foto, recommended.', 'Pelayanan oke, tepat waktu.', 'Sesuai deskripsi, tempatnya bersih.', 'Sangat sabar dan sopan. Akan kembali lagi.'];
const COLORS = ['#f472b6', '#c084fc', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#2dd4bf'];

const pick = <T>(rnd: () => number, list: readonly T[]): T => list[Math.floor(rnd() * list.length)]!;

export interface SeedSummary {
  cities: number;
  areas: number;
  listings: number;
  users: number;
}

/** Production-safe: inserts cities, areas, categories, services and products only when those tables are empty. */
export const seedTaxonomyIfEmpty = async (deps: Deps): Promise<{ seeded: boolean; cities: number; areas: number }> => {
  const { db } = deps;
  const now = deps.clock.now();
  const existing = await db.select({ id: cities.id }).from(cities).limit(1);
  if (existing.length > 0) return { seeded: false, cities: 0, areas: 0 };
  const chunk = <T>(rows: readonly T[], size: number): T[][] => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
  type Insertable = { values: (rows: never) => { run: () => Promise<unknown> } };
  const insertAll = async (table: Insertable, rows: readonly unknown[], columns: number) => {
    for (const part of chunk(rows, Math.max(1, Math.floor(95 / columns)))) await table.values(part as never).run();
  };
  await insertAll(db.insert(categories), categorySeeds.map((c) => ({ id: c.id, slug: c.slug, nameId: c.nameId, nameEn: c.nameEn, descId: c.descId, descEn: c.descEn, sortOrder: c.sortOrder })), 7);
  await insertAll(db.insert(cities), citySeeds.map((c) => ({ id: c.id, slug: c.slug, nameId: c.nameId, nameEn: c.nameEn ?? c.nameId, province: c.province, lat: c.lat, lng: c.lng, sortOrder: c.sortOrder, isActive: true })), 9);
  await insertAll(db.insert(areas), citySeeds.flatMap((c) => c.areas.map((a, i) => ({ id: `area_${c.slug}_${a.slug}`.replaceAll('-', '_'), cityId: c.id, slug: a.slug, nameId: a.nameId, nameEn: a.nameEn ?? a.nameId, sortOrder: i, isActive: true }))), 7);
  await insertAll(db.insert(servicesCatalog), serviceSeeds.map((s) => ({ id: s.id, slug: s.slug, nameId: s.nameId, nameEn: s.nameEn, categoryScope: s.scope ? [...s.scope] : null, sortOrder: s.sortOrder })), 6);
  await insertAll(db.insert(products), productSeeds.map((p) => ({ ...p, isActive: true, updatedAt: now })), 10);
  return { seeded: true, cities: citySeeds.length, areas: citySeeds.reduce((n, c) => n + c.areas.length, 0) };
};

export const runSeed = async (deps: Deps): Promise<SeedSummary> => {
  const { db } = deps;
  const now = deps.clock.now();
  const rnd = mulberry32(20260902);

  // Wipe everything (dev only) — order matters for FKs; PRAGMA foreign_keys is on in D1.
  for (const table of ['reviews', 'reports', 'favorites', 'reveals', 'wallet_ledger', 'orders', 'payment_events', 'boosts', 'listing_stats_daily', 'listing_services', 'listing_photos', 'listings', 'phone_claims', 'otp_codes', 'sessions', 'identities', 'devices', 'users', 'wallets', 'services_catalog', 'areas', 'cities', 'categories', 'products', 'rate_windows', 'audit_log']) {
    await db.run(sql.raw(`DELETE FROM ${table}`));
  }

  // D1 allows at most 100 bound parameters per statement, so every bulk insert is chunked.
  const chunk = <T>(rows: readonly T[], size: number): T[][] => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
  type Insertable = { values: (rows: never) => { run: () => Promise<unknown> } };
  const insertAll = async (table: Insertable, rows: readonly unknown[], columns: number) => {
    const size = Math.max(1, Math.floor(95 / columns));
    for (const part of chunk(rows, size)) await table.values(part as never).run();
  };

  await insertAll(db.insert(categories), categorySeeds.map((c) => ({ id: c.id, slug: c.slug, nameId: c.nameId, nameEn: c.nameEn, descId: c.descId, descEn: c.descEn, sortOrder: c.sortOrder })), 7);
  await insertAll(db.insert(cities), citySeeds.map((c) => ({ id: c.id, slug: c.slug, nameId: c.nameId, nameEn: c.nameEn ?? c.nameId, province: c.province, lat: c.lat, lng: c.lng, sortOrder: c.sortOrder, isActive: true })), 9);
  await insertAll(db.insert(areas), citySeeds.flatMap((c) => c.areas.map((a, i) => ({ id: `area_${c.slug}_${a.slug}`.replaceAll('-', '_'), cityId: c.id, slug: a.slug, nameId: a.nameId, nameEn: a.nameEn ?? a.nameId, sortOrder: i, isActive: true }))), 7);
  await insertAll(db.insert(servicesCatalog), serviceSeeds.map((s) => ({ id: s.id, slug: s.slug, nameId: s.nameId, nameEn: s.nameEn, categoryScope: s.scope ? [...s.scope] : null, sortOrder: s.sortOrder })), 6);
  await insertAll(db.insert(products), productSeeds.map((p) => ({ ...p, isActive: true, updatedAt: now })), 10);

  // Users: 1 admin (matches ADMIN_IDENTITIES default) + 2 posters.
  // One admin, two named posters used by the tests, plus anonymous posters so nobody exceeds the free active cap.
  const userDefs = [
    { id: 'user_admin', name: 'Admin', phone: '+6281200000001', email: 'admin@example.com' },
    { id: 'user_poster1', name: 'Sari Agency', phone: '+6281200000002', email: 'poster1@example.com' },
    { id: 'user_poster2', name: 'Dewi', phone: '+6281200000003', email: 'poster2@example.com' },
    ...Array.from({ length: 20 }, (_, i) => ({ id: `user_seed${i + 1}`, name: `Poster ${i + 1}`, phone: `+62812000001${String(i).padStart(2, '0')}`, email: `seed${i + 1}@example.com` })),
  ];
  await insertAll(db.insert(wallets), userDefs.map((u) => ({ id: `wallet_${u.id}`, kind: 'user' as const, balance: 0, createdAt: now, updatedAt: now })), 5);
  await insertAll(db.insert(users), userDefs.map((u) => ({ id: u.id, displayName: u.name, walletId: `wallet_${u.id}`, createdAt: now, status: 'active' as const })), 6);
  await insertAll(
    db.insert(identities),
    userDefs.flatMap((u) => [
      { id: `id_${u.id}_phone`, userId: u.id, provider: 'phone' as const, providerId: u.phone, verifiedAt: now, createdAt: now },
      { id: `id_${u.id}_email`, userId: u.id, provider: 'email' as const, providerId: u.email, email: u.email, verifiedAt: now, createdAt: now },
    ]),
    7,
  );

  // Listings: heavy on Batam, a spread across other cities.
  const cityWeights: [string, number][] = [['batam', 22], ['jakarta', 12], ['bali', 8], ['surabaya', 5], ['bandung', 4], ['medan', 3], ['bintan', 3], ['yogyakarta', 2], ['makassar', 1]];
  const catWeights: [string, number][] = [['cat_escorts', 6], ['cat_massage', 3], ['cat_trans', 1], ['cat_fetish', 1]];
  const weighted = <T>(pairs: readonly [T, number][]): T => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = rnd() * total;
    for (const [v, w] of pairs) {
      r -= w;
      if (r <= 0) return v;
    }
    return pairs[0]![0];
  };
  const plan = cityWeights.flatMap(([slug, n]) => Array.from({ length: n }, () => slug));

  const listingRows: (typeof listings.$inferInsert)[] = [];
  const photoRows: (typeof listingPhotos.$inferInsert)[] = [];
  const serviceRows: (typeof listingServices.$inferInsert)[] = [];
  const reviewRows: (typeof reviews.$inferInsert)[] = [];
  let phoneCounter = 100;

  plan.forEach((citySlug, index) => {
    const city = citySeeds.find((c) => c.slug === citySlug)!;
    const catId = weighted(catWeights);
    const area = pick(rnd, city.areas);
    const name = pick(rnd, NAMES);
    const age = 19 + Math.floor(rnd() * 14);
    const height = 150 + Math.floor(rnd() * 25);
    const gender: Gender = catId === 'cat_trans' ? 'trans' : catId === 'cat_fetish' && rnd() < 0.3 ? 'female' : rnd() < 0.9 ? 'female' : 'male';
    const bit = pick(rnd, TITLE_BITS[catId]!);
    const title = `${name} ${age}th ${bit}`.slice(0, 90);
    const description = pick(rnd, DESCRIPTIONS)
      .replaceAll('{name}', name).replaceAll('{age}', String(age)).replaceAll('{height}', String(height))
      .replaceAll('{area}', area.nameId).replaceAll('{city}', city.nameId);
    const id = newId(now.getTime() - index * 1000);
    const shortId = newShortId();
    const publishedAt = new Date(now.getTime() - Math.floor(rnd() * 20) * 86_400_000 - Math.floor(rnd() * 86_400_000));
    const bumpedAt = new Date(publishedAt.getTime() + Math.floor(rnd() * 3) * 3_600_000);
    const roll = rnd();
    const vipUntil = roll < 0.08 ? new Date(now.getTime() + 20 * 86_400_000) : null;
    const featuredUntil = !vipUntil && roll < 0.2 ? new Date(now.getTime() + 5 * 86_400_000) : null;
    const expired = index % 17 === 16; // a few expired listings for 410 testing
    const photoCount = 1 + Math.floor(rnd() * 5);
    const rate1h = catId === 'cat_massage' ? 250_000 + Math.floor(rnd() * 6) * 50_000 : 500_000 + Math.floor(rnd() * 20) * 100_000;
    const owner = index < 2 ? 'user_poster1' : index < 4 ? 'user_poster2' : `user_seed${(index % 20) + 1}`;
    const photoIds = Array.from({ length: photoCount }, () => newId());
    listingRows.push({
      id, shortId, ownerUserId: owner, categoryId: catId, cityId: city.id, areaId: `area_${city.slug}_${area.slug}`.replaceAll('-', '_'),
      slug: slugify(title), title, description, age, gender,
      nationality: rnd() < 0.85 ? 'Indonesia' : pick(rnd, NATIONALITIES), ethnicity: pick(rnd, ETHNICITIES), heightCm: height, bodyType: pick(rnd, BODY_TYPES),
      languages: rnd() < 0.5 ? ['id', 'en'] : ['id'],
      rate1h, rate2h: Math.round(rate1h * 1.8), rateOvernight: rnd() < 0.7 ? rate1h * 4 : null,
      incall: rnd() < 0.6, outcall: rnd() < 0.8,
      availability: { days: [0, 1, 2, 3, 4, 5, 6], from: '10:00', to: '02:00', allDay: rnd() < 0.3 },
      phoneE164: `+62812${String(phoneCounter++).padStart(4, '0')}${String(index).padStart(4, '0')}`.slice(0, 14),
      whatsappE164: null, telegramHandle: rnd() < 0.3 ? `${name.toLowerCase()}${index}` : null,
      status: expired ? 'expired' : 'active', moderation: index % 11 === 10 ? 'pending' : 'approved', verified: rnd() < 0.35,
      photoCount, coverPhotoId: photoIds[0]!, bumpedAt, featuredUntil, vipUntil, publishedAt,
      expiresAt: expired ? new Date(now.getTime() - 86_400_000) : expiryFrom(publishedAt),
      declarationAcceptedAt: publishedAt, declarationVersion: 1, createdAt: publishedAt, updatedAt: bumpedAt,
    });
    photoIds.forEach((pid, position) => {
      const portrait = rnd() < 0.7;
      photoRows.push({ id: pid, listingId: id, position, storage: 'placeholder', width: portrait ? 800 : 1200, height: portrait ? 1200 : 800, colorHex: pick(rnd, COLORS), createdAt: publishedAt });
    });
    const eligible = serviceSeeds.filter((s) => s.scope === null || s.scope.includes(catId));
    const chosen = new Set<string>();
    for (let i = 0; i < 3; i++) chosen.add(pick(rnd, eligible).id);
    for (const sid of chosen) serviceRows.push({ listingId: id, serviceId: sid });
    if (rnd() < 0.4) {
      reviewRows.push({ id: newId(), listingId: id, walletId: 'wallet_user_admin', rating: 4 + Math.floor(rnd() * 2), body: pick(rnd, REVIEWS), status: 'approved', createdAt: now, moderatedAt: now, moderatedBy: 'user_admin' });
    }
  });

  await insertAll(db.insert(listings), listingRows, 46);
  await insertAll(db.insert(listingPhotos), photoRows, 9);
  await insertAll(db.insert(listingServices), serviceRows, 2);
  if (reviewRows.length) await insertAll(db.insert(reviews), reviewRows, 12);

  return { cities: citySeeds.length, areas: citySeeds.reduce((n, c) => n + c.areas.length, 0), listings: listingRows.length, users: userDefs.length };
};
