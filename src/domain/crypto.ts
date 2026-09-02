/** WebCrypto helpers shared by sessions, OTPs, device cookies and webhook signatures. */
const encoder = new TextEncoder();

export const toHex = (bytes: ArrayBuffer | Uint8Array): string =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

export const sha256Hex = async (input: string): Promise<string> => toHex(await crypto.subtle.digest('SHA-256', encoder.encode(input)));
export const sha512Hex = async (input: string): Promise<string> => toHex(await crypto.subtle.digest('SHA-512', encoder.encode(input)));

export const hmacSha256Hex = async (secret: string, message: string): Promise<string> => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
};

/** Constant-time string comparison (both sides hex/base64 of equal expected length). */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/** Daily-rotating hash for IPs / user agents used only in abuse windows (never stored raw). */
export const abuseHash = async (secret: string, value: string, day: string): Promise<string> =>
  (await hmacSha256Hex(secret, `${day}:${value}`)).slice(0, 32);
