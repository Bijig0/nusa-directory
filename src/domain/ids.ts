const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

const randomBytes = (n: number): Uint8Array => {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
};

const toCrockford = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => CROCKFORD[b % 32]!).join('');

/** Time-sortable 26-char id: 10 chars of ms timestamp (base32) + 16 random chars. */
export const newId = (now: number = Date.now()): string => {
  let ts = now;
  const time = Array.from({ length: 10 }, () => {
    const c = CROCKFORD[ts % 32]!;
    ts = Math.floor(ts / 32);
    return c;
  })
    .reverse()
    .join('');
  return time + toCrockford(randomBytes(16));
};

/** 7-char public short id used in listing URLs (`<slug>-<shortId>`). ~34 bits of entropy. */
export const SHORT_ID_LENGTH = 7;
export const newShortId = (): string => toCrockford(randomBytes(SHORT_ID_LENGTH));
export const isShortId = (value: string): boolean =>
  new RegExp(`^[${CROCKFORD}]{${SHORT_ID_LENGTH}}$`).test(value);

/** Order ids are shown to Midtrans and customers; keep them readable. */
export const newOrderId = (): string => `ORD-${toCrockford(randomBytes(10)).toUpperCase()}`;

/** URL-safe random token (base64url), used for sessions and magic links. */
export const newToken = (bytes = 32): string => {
  const raw = randomBytes(bytes);
  let binary = '';
  for (const b of raw) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

export const randomDigits = (n: number): string =>
  Array.from(randomBytes(n), (b) => String(b % 10)).join('');
