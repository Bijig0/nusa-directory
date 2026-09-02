import { err, ok, type Result } from './result';

/**
 * Normalizes an Indonesian mobile number into E.164 (+628xxxxxxxxx).
 * Accepts: 08xx, 628xx, +628xx, with spaces/dashes/dots/parentheses.
 */
export const normalizeIdPhone = (raw: string): Result<string, 'invalid_phone'> => {
  const digits = raw.replace(/[^\d+]/g, '');
  const withoutPlus = digits.startsWith('+') ? digits.slice(1) : digits;
  const national = withoutPlus.startsWith('62')
    ? withoutPlus.slice(2)
    : withoutPlus.startsWith('0')
      ? withoutPlus.slice(1)
      : withoutPlus;
  // Indonesian mobiles start with 8 and have 8–12 digits after the country code.
  if (!/^8\d{7,11}$/.test(national)) return err('invalid_phone');
  return ok(`+62${national}`);
};

/** Any E.164 number (for foreign posters), falling back to Indonesian rules for local formats. */
export const normalizePhone = (raw: string): Result<string, 'invalid_phone'> => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+') && !trimmed.startsWith('+62')) {
    const digits = trimmed.replace(/[^\d]/g, '');
    return /^\d{8,15}$/.test(digits) ? ok(`+${digits}`) : err('invalid_phone');
  }
  return normalizeIdPhone(trimmed);
};

export const isE164 = (value: string): boolean => /^\+[1-9]\d{7,14}$/.test(value);

/** wa.me deep link; optional prefilled text. */
export const whatsappLink = (e164: string, text?: string): string => {
  const base = `https://wa.me/${e164.replace('+', '')}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
};

export const telegramLink = (handle: string): string => `https://t.me/${handle.replace(/^@/, '')}`;

/** Human-friendly display: +62 812-3456-7890 */
export const formatPhone = (e164: string): string => {
  if (!e164.startsWith('+62')) return e164;
  const national = e164.slice(3);
  const groups = [national.slice(0, 3), national.slice(3, 7), national.slice(7)].filter(Boolean);
  return `+62 ${groups.join('-')}`;
};

/** Mask everything except the country code and first 3 digits: +62 812-xxxx-xxxx */
export const maskPhone = (e164: string): string => {
  if (!e164.startsWith('+62')) return `${e164.slice(0, 4)}xxxxxxx`;
  return `+62 ${e164.slice(3, 6)}-xxxx-xxxx`;
};
