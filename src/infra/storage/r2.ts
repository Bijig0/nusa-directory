import { AwsClient } from 'aws4fetch';

export type PhotoVariant = 'thumb' | 'card' | 'full';
export const PHOTO_VARIANTS: readonly PhotoVariant[] = ['thumb', 'card', 'full'];

export const photoKey = (listingId: string, photoId: string, variant: PhotoVariant): string =>
  `photos/${listingId}/${photoId}/${variant}.jpg`;

/** Every stored object of one photo (one key per variant). */
export const photoObjectKeys = (listingId: string, photoId: string): string[] => PHOTO_VARIANTS.map((v) => photoKey(listingId, photoId, v));

export interface StoredObject {
  body: ReadableStream<Uint8Array> | Uint8Array;
  contentType: string;
  etag?: string;
}

export interface PhotoStore {
  put: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  get: (key: string) => Promise<StoredObject | null>;
  delete: (keys: readonly string[]) => Promise<void>;
  /** Creates the bucket when it does not exist (S3 only; no-op locally). */
  ensureBucket: () => Promise<'created' | 'exists' | 'noop'>;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Cloudflare R2 through its S3-compatible API, signed with SigV4 (works on Vercel, Node and edge). */
export const s3PhotoStore = (cfg: R2Config, fetchImpl: typeof fetch = fetch): PhotoStore => {
  const client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: 's3', region: 'auto' });
  const bucketUrl = `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}`;
  const objectUrl = (key: string) => `${bucketUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const signed = async (url: string, init: RequestInit) => {
    const req = await client.sign(url, init);
    return fetchImpl(req);
  };
  return {
    put: async (key, bytes, contentType) => {
      const res = await signed(objectUrl(key), { method: 'PUT', body: bytes as unknown as BodyInit, headers: { 'content-type': contentType, 'cache-control': IMMUTABLE, 'content-length': String(bytes.byteLength) } });
      if (!res.ok) throw new Error(`r2_put_${res.status}: ${(await res.text()).slice(0, 200)}`);
    },
    get: async (key) => {
      const res = await signed(objectUrl(key), { method: 'GET' });
      if (res.status === 404) return null;
      if (!res.ok || !res.body) throw new Error(`r2_get_${res.status}`);
      return { body: res.body, contentType: res.headers.get('content-type') ?? 'image/jpeg', etag: res.headers.get('etag') ?? undefined };
    },
    delete: async (keys) => {
      await Promise.all(keys.map((key) => signed(objectUrl(key), { method: 'DELETE' })));
    },
    ensureBucket: async () => {
      const head = await signed(bucketUrl, { method: 'HEAD' });
      if (head.ok) return 'exists';
      const created = await signed(bucketUrl, { method: 'PUT' });
      if (created.ok) return 'created';
      if (created.status === 409) return 'exists';
      throw new Error(`r2_create_bucket_${created.status}: ${(await created.text()).slice(0, 200)}`);
    },
  };
};

/** Local-disk store for development when no R2 credentials are configured. */
export const localPhotoStore = (root: string): PhotoStore => {
  const fs = () => import('node:fs/promises');
  const path = (key: string) => `${root}/${key}`;
  return {
    put: async (key, bytes) => {
      const f = await fs();
      await f.mkdir(path(key).replace(/[^/]+$/, ''), { recursive: true });
      await f.writeFile(path(key), bytes);
    },
    get: async (key) => {
      try {
        const f = await fs();
        const data = await f.readFile(path(key));
        return { body: new Uint8Array(data), contentType: 'image/jpeg' };
      } catch {
        return null;
      }
    },
    delete: async (keys) => {
      const f = await fs();
      await Promise.all(keys.map((k) => f.rm(path(k), { force: true })));
    },
    ensureBucket: async () => 'noop',
  };
};
