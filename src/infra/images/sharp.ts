import sharp from 'sharp';
import type { ImageProcessor, ProcessedVariant } from './processor';
import { VARIANTS } from '../../domain/images';

const JPEG_QUALITY = 82;

const watermarkSvg = (text: string, width: number, height: number): Buffer => {
  const fontSize = Math.max(20, Math.round(width * 0.04));
  const margin = Math.round(width * 0.03);
  const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <text x="${width - margin}" y="${height - margin}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fontSize}"
        fill="#ffffff" fill-opacity="0.85" stroke="#000000" stroke-opacity="0.55" stroke-width="${Math.max(1, Math.round(fontSize / 12))}" paint-order="stroke">${escaped}</text>
    </svg>`,
  );
};

/**
 * libvips-based processor. `.rotate()` applies the EXIF orientation, re-encoding drops all
 * metadata (EXIF/GPS/ICC), and the watermark is composited on the largest variant so the
 * smaller ones inherit it.
 */
export const sharpProcessor: ImageProcessor = {
  process: async ({ bytes, watermarkText }) => {
    const [full, ...rest] = VARIANTS;
    const base = await sharp(Buffer.from(bytes)).rotate().resize({ width: full!.maxEdge, height: full!.maxEdge, fit: 'inside', withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
    const stamped = await sharp(base.data).composite([{ input: watermarkSvg(watermarkText, base.info.width, base.info.height), gravity: 'southeast' }]).jpeg({ quality: JPEG_QUALITY }).toBuffer({ resolveWithObject: true });
    const results: ProcessedVariant[] = [{ name: full!.name, bytes: new Uint8Array(stamped.data), width: stamped.info.width, height: stamped.info.height }];
    for (const variant of rest) {
      const small = await sharp(stamped.data).resize({ width: variant.maxEdge, height: variant.maxEdge, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: JPEG_QUALITY }).toBuffer({ resolveWithObject: true });
      results.push({ name: variant.name, bytes: new Uint8Array(small.data), width: small.info.width, height: small.info.height });
    }
    return results;
  },
};
