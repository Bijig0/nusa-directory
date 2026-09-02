export interface AreaSeed {
  slug: string;
  nameId: string;
  nameEn?: string;
}

export interface CitySeed {
  id: string;
  slug: string;
  nameId: string;
  nameEn?: string;
  province: string;
  lat: number;
  lng: number;
  sortOrder: number;
  areas: readonly AreaSeed[];
}

const a = (slug: string, nameId: string, nameEn?: string): AreaSeed => ({ slug, nameId, nameEn });

export const citySeeds: readonly CitySeed[] = [
  {
    id: 'city_batam', slug: 'batam', nameId: 'Batam', province: 'Kepulauan Riau', lat: 1.0456, lng: 104.0305, sortOrder: 1,
    areas: [a('nagoya', 'Nagoya'), a('batam-centre', 'Batam Centre'), a('harbour-bay', 'Harbour Bay'), a('jodoh', 'Jodoh'), a('batu-aji', 'Batu Aji'), a('sekupang', 'Sekupang'), a('bengkong', 'Bengkong'), a('tiban', 'Tiban'), a('batu-ampar', 'Batu Ampar'), a('lubuk-baja', 'Lubuk Baja'), a('nongsa', 'Nongsa'), a('sagulung', 'Sagulung')],
  },
  {
    id: 'city_jakarta', slug: 'jakarta', nameId: 'Jakarta', province: 'DKI Jakarta', lat: -6.2088, lng: 106.8456, sortOrder: 2,
    areas: [a('jakarta-selatan', 'Jakarta Selatan', 'South Jakarta'), a('jakarta-pusat', 'Jakarta Pusat', 'Central Jakarta'), a('jakarta-barat', 'Jakarta Barat', 'West Jakarta'), a('jakarta-utara', 'Jakarta Utara', 'North Jakarta'), a('jakarta-timur', 'Jakarta Timur', 'East Jakarta'), a('kemang', 'Kemang'), a('scbd', 'SCBD'), a('kuningan', 'Kuningan'), a('senayan', 'Senayan'), a('menteng', 'Menteng'), a('kelapa-gading', 'Kelapa Gading'), a('pik', 'Pantai Indah Kapuk'), a('blok-m', 'Blok M'), a('gatot-subroto', 'Gatot Subroto'), a('thamrin', 'Thamrin')],
  },
  {
    id: 'city_bali', slug: 'bali', nameId: 'Bali', province: 'Bali', lat: -8.6705, lng: 115.2126, sortOrder: 3,
    areas: [a('denpasar', 'Denpasar'), a('kuta', 'Kuta'), a('seminyak', 'Seminyak'), a('canggu', 'Canggu'), a('legian', 'Legian'), a('ubud', 'Ubud'), a('sanur', 'Sanur'), a('nusa-dua', 'Nusa Dua'), a('jimbaran', 'Jimbaran'), a('uluwatu', 'Uluwatu')],
  },
  {
    id: 'city_surabaya', slug: 'surabaya', nameId: 'Surabaya', province: 'Jawa Timur', lat: -7.2575, lng: 112.7521, sortOrder: 4,
    areas: [a('surabaya-pusat', 'Surabaya Pusat'), a('surabaya-barat', 'Surabaya Barat'), a('surabaya-timur', 'Surabaya Timur'), a('surabaya-selatan', 'Surabaya Selatan'), a('surabaya-utara', 'Surabaya Utara'), a('darmo', 'Darmo'), a('tunjungan', 'Tunjungan'), a('gubeng', 'Gubeng')],
  },
  {
    id: 'city_bandung', slug: 'bandung', nameId: 'Bandung', province: 'Jawa Barat', lat: -6.9175, lng: 107.6191, sortOrder: 5,
    areas: [a('dago', 'Dago'), a('pasteur', 'Pasteur'), a('setiabudi', 'Setiabudi'), a('riau', 'Riau'), a('buah-batu', 'Buah Batu'), a('kopo', 'Kopo'), a('cihampelas', 'Cihampelas')],
  },
  {
    id: 'city_medan', slug: 'medan', nameId: 'Medan', province: 'Sumatera Utara', lat: 3.5952, lng: 98.6722, sortOrder: 6,
    areas: [a('medan-kota', 'Medan Kota'), a('medan-baru', 'Medan Baru'), a('polonia', 'Polonia'), a('petisah', 'Petisah'), a('medan-sunggal', 'Medan Sunggal'), a('medan-selayang', 'Medan Selayang')],
  },
  {
    id: 'city_bintan', slug: 'bintan', nameId: 'Bintan', province: 'Kepulauan Riau', lat: 0.9186, lng: 104.4572, sortOrder: 7,
    areas: [a('tanjung-pinang', 'Tanjung Pinang'), a('lagoi', 'Lagoi'), a('tanjung-uban', 'Tanjung Uban'), a('kijang', 'Kijang')],
  },
  {
    id: 'city_makassar', slug: 'makassar', nameId: 'Makassar', province: 'Sulawesi Selatan', lat: -5.1477, lng: 119.4327, sortOrder: 8,
    areas: [a('panakkukang', 'Panakkukang'), a('losari', 'Losari'), a('tamalanrea', 'Tamalanrea'), a('rappocini', 'Rappocini'), a('mariso', 'Mariso')],
  },
  {
    id: 'city_semarang', slug: 'semarang', nameId: 'Semarang', province: 'Jawa Tengah', lat: -6.9932, lng: 110.4203, sortOrder: 9,
    areas: [a('simpang-lima', 'Simpang Lima'), a('semarang-tengah', 'Semarang Tengah'), a('tembalang', 'Tembalang'), a('banyumanik', 'Banyumanik'), a('candisari', 'Candisari')],
  },
  {
    id: 'city_yogyakarta', slug: 'yogyakarta', nameId: 'Yogyakarta', province: 'DI Yogyakarta', lat: -7.7956, lng: 110.3695, sortOrder: 10,
    areas: [a('malioboro', 'Malioboro'), a('sleman', 'Sleman'), a('seturan', 'Seturan'), a('kotabaru', 'Kotabaru'), a('umbulharjo', 'Umbulharjo'), a('bantul', 'Bantul')],
  },
  {
    id: 'city_palembang', slug: 'palembang', nameId: 'Palembang', province: 'Sumatera Selatan', lat: -2.9761, lng: 104.7754, sortOrder: 11,
    areas: [a('ilir-barat', 'Ilir Barat'), a('ilir-timur', 'Ilir Timur'), a('seberang-ulu', 'Seberang Ulu'), a('kemuning', 'Kemuning')],
  },
  {
    id: 'city_pekanbaru', slug: 'pekanbaru', nameId: 'Pekanbaru', province: 'Riau', lat: 0.5071, lng: 101.4478, sortOrder: 12,
    areas: [a('sukajadi', 'Sukajadi'), a('marpoyan', 'Marpoyan Damai'), a('tampan', 'Tampan'), a('senapelan', 'Senapelan'), a('bukit-raya', 'Bukit Raya')],
  },
  {
    id: 'city_balikpapan', slug: 'balikpapan', nameId: 'Balikpapan', province: 'Kalimantan Timur', lat: -1.2379, lng: 116.8529, sortOrder: 13,
    areas: [a('balikpapan-kota', 'Balikpapan Kota'), a('balikpapan-selatan', 'Balikpapan Selatan'), a('balikpapan-utara', 'Balikpapan Utara'), a('balikpapan-tengah', 'Balikpapan Tengah')],
  },
  {
    id: 'city_manado', slug: 'manado', nameId: 'Manado', province: 'Sulawesi Utara', lat: 1.4748, lng: 124.8421, sortOrder: 14,
    areas: [a('wenang', 'Wenang'), a('malalayang', 'Malalayang'), a('sario', 'Sario'), a('tikala', 'Tikala')],
  },
  {
    id: 'city_malang', slug: 'malang', nameId: 'Malang', province: 'Jawa Timur', lat: -7.9666, lng: 112.6326, sortOrder: 15,
    areas: [a('klojen', 'Klojen'), a('lowokwaru', 'Lowokwaru'), a('blimbing', 'Blimbing'), a('sukun', 'Sukun')],
  },
  {
    id: 'city_bogor', slug: 'bogor', nameId: 'Bogor', province: 'Jawa Barat', lat: -6.5971, lng: 106.806, sortOrder: 16,
    areas: [a('bogor-tengah', 'Bogor Tengah'), a('bogor-barat', 'Bogor Barat'), a('bogor-timur', 'Bogor Timur'), a('sentul', 'Sentul'), a('cibinong', 'Cibinong')],
  },
  {
    id: 'city_depok', slug: 'depok', nameId: 'Depok', province: 'Jawa Barat', lat: -6.4025, lng: 106.7942, sortOrder: 17,
    areas: [a('margonda', 'Margonda'), a('beji', 'Beji'), a('cimanggis', 'Cimanggis'), a('sawangan', 'Sawangan')],
  },
  {
    id: 'city_tangerang', slug: 'tangerang', nameId: 'Tangerang', province: 'Banten', lat: -6.1783, lng: 106.6319, sortOrder: 18,
    areas: [a('bsd', 'BSD City'), a('alam-sutera', 'Alam Sutera'), a('gading-serpong', 'Gading Serpong'), a('karawaci', 'Karawaci'), a('bintaro', 'Bintaro'), a('ciledug', 'Ciledug')],
  },
  {
    id: 'city_bekasi', slug: 'bekasi', nameId: 'Bekasi', province: 'Jawa Barat', lat: -6.2383, lng: 106.9756, sortOrder: 19,
    areas: [a('bekasi-kota', 'Bekasi Kota'), a('summarecon', 'Summarecon Bekasi'), a('harapan-indah', 'Harapan Indah'), a('cikarang', 'Cikarang'), a('jatiasih', 'Jatiasih')],
  },
  {
    id: 'city_lombok', slug: 'lombok', nameId: 'Lombok', province: 'Nusa Tenggara Barat', lat: -8.5833, lng: 116.1167, sortOrder: 20,
    areas: [a('mataram', 'Mataram'), a('senggigi', 'Senggigi'), a('kuta-lombok', 'Kuta Lombok'), a('gili-trawangan', 'Gili Trawangan')],
  },
  {
    id: 'city_solo', slug: 'solo', nameId: 'Solo', nameEn: 'Solo (Surakarta)', province: 'Jawa Tengah', lat: -7.5755, lng: 110.8243, sortOrder: 21,
    areas: [a('laweyan', 'Laweyan'), a('banjarsari', 'Banjarsari'), a('jebres', 'Jebres'), a('pasar-kliwon', 'Pasar Kliwon')],
  },
  {
    id: 'city_banjarmasin', slug: 'banjarmasin', nameId: 'Banjarmasin', province: 'Kalimantan Selatan', lat: -3.3194, lng: 114.5908, sortOrder: 22,
    areas: [a('banjarmasin-tengah', 'Banjarmasin Tengah'), a('banjarmasin-utara', 'Banjarmasin Utara'), a('banjarmasin-timur', 'Banjarmasin Timur'), a('banjarbaru', 'Banjarbaru')],
  },
  {
    id: 'city_pontianak', slug: 'pontianak', nameId: 'Pontianak', province: 'Kalimantan Barat', lat: -0.0263, lng: 109.3425, sortOrder: 23,
    areas: [a('pontianak-kota', 'Pontianak Kota'), a('pontianak-selatan', 'Pontianak Selatan'), a('pontianak-barat', 'Pontianak Barat')],
  },
  {
    id: 'city_samarinda', slug: 'samarinda', nameId: 'Samarinda', province: 'Kalimantan Timur', lat: -0.5022, lng: 117.1536, sortOrder: 24,
    areas: [a('samarinda-kota', 'Samarinda Kota'), a('samarinda-ulu', 'Samarinda Ulu'), a('sungai-kunjang', 'Sungai Kunjang')],
  },
  {
    id: 'city_padang', slug: 'padang', nameId: 'Padang', province: 'Sumatera Barat', lat: -0.9471, lng: 100.4172, sortOrder: 25,
    areas: [a('padang-barat', 'Padang Barat'), a('padang-timur', 'Padang Timur'), a('padang-utara', 'Padang Utara'), a('kuranji', 'Kuranji')],
  },
  {
    id: 'city_jambi', slug: 'jambi', nameId: 'Jambi', province: 'Jambi', lat: -1.6101, lng: 103.6131, sortOrder: 26,
    areas: [a('telanaipura', 'Telanaipura'), a('kota-baru', 'Kota Baru'), a('jelutung', 'Jelutung')],
  },
  {
    id: 'city_lampung', slug: 'lampung', nameId: 'Bandar Lampung', province: 'Lampung', lat: -5.3971, lng: 105.2668, sortOrder: 27,
    areas: [a('tanjung-karang', 'Tanjung Karang'), a('teluk-betung', 'Teluk Betung'), a('kedaton', 'Kedaton'), a('way-halim', 'Way Halim')],
  },
  {
    id: 'city_cirebon', slug: 'cirebon', nameId: 'Cirebon', province: 'Jawa Barat', lat: -6.7063, lng: 108.557, sortOrder: 28,
    areas: [a('kejaksan', 'Kejaksan'), a('kesambi', 'Kesambi'), a('harjamukti', 'Harjamukti')],
  },
  {
    id: 'city_tasikmalaya', slug: 'tasikmalaya', nameId: 'Tasikmalaya', province: 'Jawa Barat', lat: -7.3274, lng: 108.2207, sortOrder: 29,
    areas: [a('cihideung', 'Cihideung'), a('tawang', 'Tawang'), a('indihiang', 'Indihiang')],
  },
  {
    id: 'city_serang', slug: 'serang', nameId: 'Serang', province: 'Banten', lat: -6.1149, lng: 106.1502, sortOrder: 30,
    areas: [a('serang-kota', 'Serang Kota'), a('cilegon', 'Cilegon'), a('anyer', 'Anyer')],
  },
  {
    id: 'city_kupang', slug: 'kupang', nameId: 'Kupang', province: 'Nusa Tenggara Timur', lat: -10.1772, lng: 123.607, sortOrder: 31,
    areas: [a('kelapa-lima', 'Kelapa Lima'), a('oebobo', 'Oebobo'), a('kota-raja', 'Kota Raja')],
  },
  {
    id: 'city_batu', slug: 'batu', nameId: 'Batu', province: 'Jawa Timur', lat: -7.8672, lng: 112.5239, sortOrder: 32,
    areas: [a('batu-kota', 'Batu Kota'), a('bumiaji', 'Bumiaji'), a('junrejo', 'Junrejo')],
  },
  {
    id: 'city_karimun', slug: 'karimun', nameId: 'Karimun', nameEn: 'Karimun (Tanjung Balai)', province: 'Kepulauan Riau', lat: 1.0, lng: 103.4, sortOrder: 33,
    areas: [a('tanjung-balai', 'Tanjung Balai Karimun'), a('meral', 'Meral'), a('tebing', 'Tebing')],
  },
  {
    id: 'city_pangkalpinang', slug: 'pangkalpinang', nameId: 'Pangkalpinang', province: 'Bangka Belitung', lat: -2.1316, lng: 106.1169, sortOrder: 34,
    areas: [a('taman-sari', 'Taman Sari'), a('girimaya', 'Girimaya'), a('bukit-intan', 'Bukit Intan')],
  },
] as const;

export const reservedTopLevelSlugs: ReadonlySet<string> = new Set([
  'en', 'id', 'blog', 'admin', 'dashboard', 'auth', 'api', 'img', 'favorites', 'favorit', 'sitemaps', 'sitemap-index.xml', 'robots.txt',
  'syarat', 'privasi', 'kebijakan-konten', 'anti-perdagangan-manusia', 'terms', 'privacy', 'content-policy', 'anti-trafficking', '_astro', '_actions', 'pasang', 'post',
]);
