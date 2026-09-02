import type { Locale } from '../../site.config';

/**
 * Title / description / H1 / intro templates. Placeholders:
 * {brand} {city} {category} {area} {count} {month} {year} {areas} {topAreas}
 */
export interface SeoTemplate {
  title: string;
  description: string;
  h1: string;
  intro: string;
}

type Kind = 'city' | 'category' | 'area' | 'listing';

const id: Record<Kind, SeoTemplate> = {
  city: {
    title: 'Pendamping, Pijat & Layanan Dewasa di {city} — {count} Iklan {month} {year} | {brand}',
    description: 'Iklan pendamping, pijat panggilan, dan layanan dewasa terbaru di {city}. {count} iklan aktif di {areas}. Hubungi langsung via WhatsApp.',
    h1: 'Iklan pendamping & pijat di {city}',
    intro: 'Temukan {count} iklan aktif di {city}, termasuk area {topAreas}. Semua iklan dipasang langsung oleh pengiklan; buka nomor telepon untuk menghubungi via WhatsApp.',
  },
  category: {
    title: '{category} di {city} — {count} Iklan Terbaru {month} {year} | {brand}',
    description: '{count} iklan {category} di {city} diperbarui {month} {year}. Foto asli, tarif jelas, kontak WhatsApp langsung. Area: {areas}.',
    h1: '{category} di {city}',
    intro: 'Lihat {count} iklan {category} terbaru di {city}. Saring berdasarkan area seperti {topAreas}, usia, tarif, dan layanan. Iklan berlabel Verified telah memverifikasi nomor teleponnya.',
  },
  area: {
    title: '{category} di {area}, {city} — {count} Iklan {month} {year} | {brand}',
    description: '{count} iklan {category} di area {area}, {city}. Diperbarui {month} {year}. Kontak WhatsApp langsung, tanpa perantara.',
    h1: '{category} di {area}, {city}',
    intro: '{count} iklan {category} aktif di {area}, {city}. Cocok untuk Anda yang berada di sekitar {area}; lihat juga area lain di {city}.',
  },
  listing: {
    title: '{title} — {category} {area}{city} | {brand}',
    description: '{excerpt}',
    h1: '{title}',
    intro: '',
  },
};

const en: Record<Kind, SeoTemplate> = {
  city: {
    title: 'Escorts, Massage & Adult Services in {city} — {count} Ads {month} {year} | {brand}',
    description: 'Latest escort, outcall massage and adult service ads in {city}. {count} active ads across {areas}. Contact directly on WhatsApp.',
    h1: 'Escort & massage ads in {city}',
    intro: 'Browse {count} active ads in {city}, including {topAreas}. Every ad is posted by the provider themselves; unlock the phone number to contact them on WhatsApp.',
  },
  category: {
    title: '{category} in {city} — {count} Latest Ads {month} {year} | {brand}',
    description: '{count} {category} ads in {city}, updated {month} {year}. Real photos, clear rates, direct WhatsApp contact. Areas: {areas}.',
    h1: '{category} in {city}',
    intro: 'See the {count} newest {category} ads in {city}. Filter by area such as {topAreas}, age, rates and services. Verified ads have confirmed their phone number.',
  },
  area: {
    title: '{category} in {area}, {city} — {count} Ads {month} {year} | {brand}',
    description: '{count} {category} ads in the {area} area of {city}. Updated {month} {year}. Direct WhatsApp contact, no middlemen.',
    h1: '{category} in {area}, {city}',
    intro: '{count} active {category} ads in {area}, {city}. Ideal if you are staying near {area}; see other areas in {city} too.',
  },
  listing: {
    title: '{title} — {category} {area}{city} | {brand}',
    description: '{excerpt}',
    h1: '{title}',
    intro: '',
  },
};

export const seoTemplate = (locale: Locale, kind: Kind): SeoTemplate => (locale === 'en' ? en[kind] : id[kind]);

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (locale: Locale, date: Date): string => (locale === 'en' ? MONTHS_EN : MONTHS_ID)[date.getMonth()]!;
