import { PhotonImage, SamplingFilter, resize, rotate, draw_text_with_border } from '@cf-wasm/photon';
import type { ImageProcessor, ProcessedVariant } from './processor';
import { VARIANTS, fitWithin } from '../../domain/images';

const JPEG_QUALITY = 82;

/**
 * WASM image processor that runs identically in workerd (dev, preview, prod).
 * Re-encoding drops EXIF/ICC/GPS; the watermark is drawn as text so no asset is needed.
 */
export const photonProcessor: ImageProcessor = {
  process: async ({ bytes, rotate: deg, watermarkText }) => {
    let img = PhotonImage.new_from_byteslice(bytes);
    try {
      if (deg !== 0) {
        const rotated = rotate(img, deg);
        img.free();
        img = rotated;
      }
      const results: ProcessedVariant[] = [];
      // Largest variant first: it gets the watermark, and smaller variants derive from it.
      const full = VARIANTS[0]!;
      const target = fitWithin(img.get_width(), img.get_height(), full.maxEdge);
      const fullImg = resize(img, target.width, target.height, SamplingFilter.CatmullRom);
      img.free();
      img = fullImg;
      const fontSize = Math.max(18, Math.round(target.width * 0.035));
      const textWidth = Math.round(fontSize * 0.55 * watermarkText.length);
      const margin = Math.round(target.width * 0.03);
      draw_text_with_border(img, watermarkText, Math.max(0, target.width - textWidth - margin), Math.max(0, target.height - fontSize - margin - 4), fontSize);
      results.push({ name: full.name, bytes: img.get_bytes_jpeg(JPEG_QUALITY), width: img.get_width(), height: img.get_height() });
      for (const variant of VARIANTS.slice(1)) {
        const size = fitWithin(img.get_width(), img.get_height(), variant.maxEdge);
        const small = resize(img, size.width, size.height, SamplingFilter.CatmullRom);
        results.push({ name: variant.name, bytes: small.get_bytes_jpeg(JPEG_QUALITY), width: small.get_width(), height: small.get_height() });
        small.free();
      }
      return results;
    } finally {
      img.free();
    }
  },
};
