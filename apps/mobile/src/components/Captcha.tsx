// Bot check on the sign-in screen (Cloudflare Turnstile), so nobody can make
// our server send thousands of SMS codes automatically.
// It only appears when EXPO_PUBLIC_TURNSTILE_SITE_KEY is set (production).
// The matching secret key lives only in the Supabase server settings.
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

export const captchaSiteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';
// Turnstile checks which website the widget runs on; this must be one of the
// hostnames allowed for the site key in the Cloudflare dashboard.
const baseUrl = process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL ?? 'https://yahal.app';

export function Captcha({ onToken, locale }: { onToken: (token: string | null) => void; locale: 'ar' | 'en' }) {
  if (!captchaSiteKey) return null;
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></head>
<body style="margin:0;display:flex;justify-content:center;background:transparent">
<div class="cf-turnstile" data-sitekey="${captchaSiteKey}" data-language="${locale}"
  data-callback="ok" data-expired-callback="gone" data-error-callback="gone"></div>
<script>
function ok(t){window.ReactNativeWebView.postMessage(t)}
function gone(){window.ReactNativeWebView.postMessage('')}
</script></body></html>`;
  return (
    <View style={{ height: 70 }}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl }}
        onMessage={(e) => onToken(e.nativeEvent.data || null)}
        style={{ backgroundColor: 'transparent' }}
        scrollEnabled={false}
      />
    </View>
  );
}
