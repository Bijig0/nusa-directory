export type PhotoVariant = 'thumb' | 'card' | 'full';
export const PHOTO_VARIANTS: readonly PhotoVariant[] = ['thumb', 'card', 'full'];

export const photoKey = (listingId: string, photoId: string, variant: PhotoVariant): string =>
  `photos/${listingId}/${photoId}/${variant}.jpg`;

export interface PhotoStore {
  put: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  get: (key: string) => Promise<R2ObjectBody | null>;
  delete: (keys: readonly string[]) => Promise<void>;
}

export const r2PhotoStore = (bucket: R2Bucket): PhotoStore => ({
  put: async (key, bytes, contentType) => {
    await bucket.put(key, bytes, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } });
  },
  get: (key) => bucket.get(key),
  delete: async (keys) => {
    if (keys.length > 0) await bucket.delete([...keys]);
  },
});
