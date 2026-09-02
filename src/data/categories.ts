export interface CategorySeed {
  id: string;
  slug: string;
  nameId: string;
  nameEn: string;
  descId: string;
  descEn: string;
  sortOrder: number;
}

export const categorySeeds: readonly CategorySeed[] = [
  {
    id: 'cat_escorts',
    slug: 'escorts',
    nameId: 'Pendamping',
    nameEn: 'Escorts',
    descId: 'Iklan pendamping wanita, pria, dan pasangan untuk menemani acara, makan malam, dan waktu berkualitas.',
    descEn: 'Female, male and couple companions for events, dinners and quality time.',
    sortOrder: 1,
  },
  {
    id: 'cat_massage',
    slug: 'pijat',
    nameId: 'Pijat & Spa',
    nameEn: 'Massage & Spa',
    descId: 'Terapis pijat panggilan, spa, refleksi, dan relaksasi tubuh.',
    descEn: 'Outcall massage therapists, spa, reflexology and body relaxation.',
    sortOrder: 2,
  },
  {
    id: 'cat_fetish',
    slug: 'fetish-bdsm',
    nameId: 'Fetish & BDSM',
    nameEn: 'Fetish & BDSM',
    descId: 'Layanan dominatrix, submisif, dan minat khusus untuk dewasa yang saling setuju.',
    descEn: 'Dominatrix, submissive and special-interest services between consenting adults.',
    sortOrder: 3,
  },
  {
    id: 'cat_trans',
    slug: 'trans',
    nameId: 'Trans',
    nameEn: 'Trans',
    descId: 'Iklan pendamping transgender dan waria di kota Anda.',
    descEn: 'Transgender and trans companion ads in your city.',
    sortOrder: 4,
  },
] as const;
