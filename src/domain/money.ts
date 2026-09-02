/** Formats integer rupiah as "Rp 25.000" (id) or "Rp 25,000" (en). */
export const formatIdr = (amount: number, locale: 'id' | 'en' = 'id'): string => {
  const separator = locale === 'id' ? '.' : ',';
  const digits = Math.round(Math.abs(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return `${amount < 0 ? '-' : ''}Rp ${grouped}`;
};

/** Compact form for cards: "Rp 500rb" / "Rp 1,5jt" (id) or "Rp 500k" / "Rp 1.5M" (en). */
export const formatIdrCompact = (amount: number, locale: 'id' | 'en' = 'id'): string => {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const value = Number.isInteger(millions) ? millions.toString() : millions.toFixed(1);
    const localized = locale === 'id' ? value.replace('.', ',') : value;
    return `Rp ${localized}${locale === 'id' ? 'jt' : 'M'}`;
  }
  if (amount >= 1_000) {
    const thousands = Math.round(amount / 1_000);
    return `Rp ${thousands}${locale === 'id' ? 'rb' : 'k'}`;
  }
  return formatIdr(amount, locale);
};

/** Midtrans wants gross_amount as a string with two decimals, e.g. "25000.00". */
export const toMidtransAmount = (amount: number): string => `${Math.round(amount)}.00`;
