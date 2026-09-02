/** Pure parsers for the few image header facts the upload pipeline needs. */
export type ImageFormat = 'jpeg' | 'png' | 'webp';

export interface ImageInfo {
  format: ImageFormat;
  width: number;
  height: number;
}

const u16be = (b: Uint8Array, i: number): number => (b[i]! << 8) | b[i + 1]!;
const u16le = (b: Uint8Array, i: number): number => b[i]! | (b[i + 1]! << 8);
const u32be = (b: Uint8Array, i: number): number => ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
const u32le = (b: Uint8Array, i: number): number => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
const u24le = (b: Uint8Array, i: number): number => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);

export const sniffFormat = (b: Uint8Array): ImageFormat | undefined => {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return undefined;
};

/** Walks JPEG segments; calls `visit(marker, offset, length)` for each until it returns true. */
const walkJpeg = (b: Uint8Array, visit: (marker: number, payloadStart: number, payloadLength: number) => boolean): void => {
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return;
    const marker = b[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return; // EOI / start of scan
    const len = u16be(b, i + 2);
    if (visit(marker, i + 4, len - 2)) return;
    i += 2 + len;
  }
};

const jpegDims = (b: Uint8Array): { width: number; height: number } | undefined => {
  let dims: { width: number; height: number } | undefined;
  walkJpeg(b, (marker, start) => {
    const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (!isSof) return false;
    dims = { height: u16be(b, start + 1), width: u16be(b, start + 3) };
    return true;
  });
  return dims;
};

/** EXIF orientation tag (1–8) from the APP1 segment; 1 when absent. */
export const readJpegOrientation = (b: Uint8Array): number => {
  let orientation = 1;
  walkJpeg(b, (marker, start, len) => {
    if (marker !== 0xe1 || len < 14) return false;
    // "Exif\0\0" then TIFF header
    if (!(b[start] === 0x45 && b[start + 1] === 0x78 && b[start + 2] === 0x69 && b[start + 3] === 0x66)) return false;
    const tiff = start + 6;
    const little = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
    const rd16 = little ? u16le : u16be;
    const rd32 = little ? u32le : u32be;
    const ifd0 = tiff + rd32(b, tiff + 4);
    if (ifd0 + 2 > b.length) return true;
    const entries = rd16(b, ifd0);
    for (let e = 0; e < entries; e++) {
      const entry = ifd0 + 2 + e * 12;
      if (entry + 12 > b.length) break;
      if (rd16(b, entry) === 0x0112) {
        const value = rd16(b, entry + 8);
        if (value >= 1 && value <= 8) orientation = value;
        break;
      }
    }
    return true;
  });
  return orientation;
};

const pngDims = (b: Uint8Array): { width: number; height: number } | undefined =>
  b.length >= 24 ? { width: u32be(b, 16), height: u32be(b, 20) } : undefined;

const webpDims = (b: Uint8Array): { width: number; height: number } | undefined => {
  if (b.length < 30) return undefined;
  const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
  if (chunk === 'VP8 ') return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = u32le(b, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  return undefined;
};

export const readImageInfo = (b: Uint8Array): ImageInfo | undefined => {
  const format = sniffFormat(b);
  if (!format) return undefined;
  const dims = format === 'jpeg' ? jpegDims(b) : format === 'png' ? pngDims(b) : webpDims(b);
  return dims && dims.width > 0 && dims.height > 0 ? { format, ...dims } : undefined;
};

/** Rotation (degrees clockwise) needed to display an image upright given its EXIF orientation. */
export const rotationFor = (orientation: number): 0 | 90 | 180 | 270 =>
  orientation === 3 ? 180 : orientation === 6 ? 90 : orientation === 8 ? 270 : 0;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PIXELS = 12_000_000;

export interface VariantSpec {
  name: 'full' | 'card' | 'thumb';
  maxEdge: number;
}
export const VARIANTS: readonly VariantSpec[] = [
  { name: 'full', maxEdge: 1600 },
  { name: 'card', maxEdge: 800 },
  { name: 'thumb', maxEdge: 400 },
];

/** Target size keeping aspect ratio; never upscales. */
export const fitWithin = (width: number, height: number, maxEdge: number): { width: number; height: number } => {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

/** Bottom-right watermark placement with a margin relative to the image width. */
export const watermarkPlacement = (imageWidth: number, imageHeight: number, wmWidth: number, wmHeight: number, marginRatio = 0.03): { x: number; y: number } => {
  const margin = Math.round(imageWidth * marginRatio);
  return { x: Math.max(0, imageWidth - wmWidth - margin), y: Math.max(0, imageHeight - wmHeight - margin) };
};
