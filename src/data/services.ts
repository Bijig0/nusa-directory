export interface ServiceSeed {
  id: string;
  slug: string;
  nameId: string;
  nameEn: string;
  /** Category ids the chip is offered for; null = every category. */
  scope: readonly string[] | null;
  sortOrder: number;
}

const s = (slug: string, nameId: string, nameEn: string, scope: readonly string[] | null, sortOrder: number): ServiceSeed => ({
  id: `svc_${slug.replaceAll('-', '_')}`, slug, nameId, nameEn, scope, sortOrder,
});

const ESC = ['cat_escorts', 'cat_trans'] as const;
const MAS = ['cat_massage'] as const;
const FET = ['cat_fetish'] as const;

export const serviceSeeds: readonly ServiceSeed[] = [
  s('dinner-date', 'Teman makan malam', 'Dinner date', ESC, 1),
  s('travel-companion', 'Teman perjalanan', 'Travel companion', ESC, 2),
  s('overnight', 'Menginap', 'Overnight', ESC, 3),
  s('gfe', 'GFE', 'Girlfriend experience', ESC, 4),
  s('party', 'Teman pesta', 'Party companion', ESC, 5),
  s('couples', 'Pasangan', 'Couples', ESC, 6),
  s('duo', 'Duo', 'Duo', ESC, 7),
  s('massage-relax', 'Pijat relaksasi', 'Relaxation massage', [...ESC, ...MAS], 10),
  s('massage-sensual', 'Pijat sensual', 'Sensual massage', [...ESC, ...MAS], 11),
  s('body-scrub', 'Lulur', 'Body scrub', MAS, 12),
  s('reflexology', 'Refleksi', 'Reflexology', MAS, 13),
  s('aromatherapy', 'Aromaterapi', 'Aromatherapy', MAS, 14),
  s('four-hands', 'Empat tangan', 'Four hands', MAS, 15),
  s('domination', 'Dominasi', 'Domination', FET, 20),
  s('submission', 'Submisif', 'Submission', FET, 21),
  s('roleplay', 'Roleplay', 'Roleplay', [...ESC, ...FET], 22),
  s('foot-fetish', 'Foot fetish', 'Foot fetish', FET, 23),
  s('bondage', 'Bondage', 'Bondage', FET, 24),
  s('costume', 'Kostum', 'Costume', [...ESC, ...FET], 25),
  s('hotel-visit', 'Kunjungan hotel', 'Hotel visit', null, 30),
  s('video-call', 'Video call', 'Video call', null, 31),
];

export const NATIONALITIES = ['Indonesia', 'Malaysia', 'Singapura', 'Thailand', 'Vietnam', 'Filipina', 'China', 'Jepang', 'Korea', 'India', 'Rusia', 'Eropa', 'Amerika Latin', 'Lainnya'] as const;
export const NATIONALITIES_EN: Record<(typeof NATIONALITIES)[number], string> = {
  Indonesia: 'Indonesian', Malaysia: 'Malaysian', Singapura: 'Singaporean', Thailand: 'Thai', Vietnam: 'Vietnamese', Filipina: 'Filipino', China: 'Chinese', Jepang: 'Japanese', Korea: 'Korean', India: 'Indian', Rusia: 'Russian', Eropa: 'European', 'Amerika Latin': 'Latin American', Lainnya: 'Other',
};
export const ETHNICITIES = ['Jawa', 'Sunda', 'Batak', 'Melayu', 'Bali', 'Tionghoa', 'Minang', 'Bugis', 'Dayak', 'Papua', 'Campuran', 'Lainnya'] as const;
export const BODY_TYPES = ['slim', 'athletic', 'average', 'curvy', 'bbw', 'muscular'] as const;
export const BODY_TYPE_LABELS: Record<'id' | 'en', Record<(typeof BODY_TYPES)[number], string>> = {
  id: { slim: 'Langsing', athletic: 'Atletis', average: 'Rata-rata', curvy: 'Berisi', bbw: 'Gemuk', muscular: 'Berotot' },
  en: { slim: 'Slim', athletic: 'Athletic', average: 'Average', curvy: 'Curvy', bbw: 'BBW', muscular: 'Muscular' },
};
export const LANGUAGES = ['id', 'en', 'zh', 'ms', 'ja', 'ko', 'ru', 'th'] as const;
export const LANGUAGE_LABELS: Record<'id' | 'en', Record<(typeof LANGUAGES)[number], string>> = {
  id: { id: 'Indonesia', en: 'Inggris', zh: 'Mandarin', ms: 'Melayu', ja: 'Jepang', ko: 'Korea', ru: 'Rusia', th: 'Thai' },
  en: { id: 'Indonesian', en: 'English', zh: 'Mandarin', ms: 'Malay', ja: 'Japanese', ko: 'Korean', ru: 'Russian', th: 'Thai' },
};
export const GENDER_LABELS: Record<'id' | 'en', Record<'female' | 'male' | 'trans' | 'couple', string>> = {
  id: { female: 'Wanita', male: 'Pria', trans: 'Trans', couple: 'Pasangan' },
  en: { female: 'Female', male: 'Male', trans: 'Trans', couple: 'Couple' },
};
