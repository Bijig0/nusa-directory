/// <reference types="node" />
/**
 * Verifies R2 access with the R2_* environment variables: creates the bucket if needed,
 * then writes, reads and deletes a probe object. Usage: bun run r2:setup
 */
import { s3PhotoStore } from '../src/infra/storage/r2';

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k}`);
  return v;
};
const store = s3PhotoStore({ accountId: need('R2_ACCOUNT_ID'), accessKeyId: need('R2_ACCESS_KEY_ID'), secretAccessKey: need('R2_SECRET_ACCESS_KEY'), bucket: need('R2_BUCKET') });
console.log('bucket:', await store.ensureBucket());
const key = `probe/${Date.now()}.txt`;
await store.put(key, new TextEncoder().encode('ok'), 'text/plain');
const back = await store.get(key);
console.log('round-trip:', back ? 'ok' : 'MISSING');
await store.delete([key]);
console.log('R2 is ready');
