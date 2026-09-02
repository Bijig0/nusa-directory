/** Port for the photo pipeline: decode, upright, resize, watermark, encode variants. */
export interface ProcessedVariant {
  name: 'full' | 'card' | 'thumb';
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface ProcessInput {
  bytes: Uint8Array;
  /** Degrees clockwise to make the image upright (from EXIF). */
  rotate: 0 | 90 | 180 | 270;
  watermarkText: string;
}

export interface ImageProcessor {
  process: (input: ProcessInput) => Promise<readonly ProcessedVariant[]>;
}
