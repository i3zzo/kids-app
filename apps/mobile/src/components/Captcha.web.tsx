// The web preview is for development only and has no bot check.
export const captchaSiteKey = '';
export function Captcha(_: { onToken: (token: string | null) => void; locale: 'ar' | 'en' }) {
  return null;
}
