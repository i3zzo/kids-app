// Kuwaiti mobile numbers: 8 digits, starting with 4, 5, 6 or 9.
// We accept spaces, a leading 00965/+965, and Arabic-Indic digits (٠١٢…).

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
const persianDigits = '۰۱۲۳۴۵۶۷۸۹';

export function normaliseDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (c) => {
    const a = arabicDigits.indexOf(c);
    return String(a >= 0 ? a : persianDigits.indexOf(c));
  });
}

/** Returns "+965XXXXXXXX" or null if it isn't a valid Kuwaiti mobile number. */
export function toKuwaitE164(input: string): string | null {
  let digits = normaliseDigits(input).replace(/[^\d]/g, '');
  if (digits.startsWith('00965')) digits = digits.slice(5);
  else if (digits.startsWith('965') && digits.length === 11) digits = digits.slice(3);
  if (!/^[4569]\d{7}$/.test(digits)) return null;
  return `+965${digits}`;
}
