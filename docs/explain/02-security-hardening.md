# Step 2 explained: security fixes before launch

*Written for Ezzo, in plain language. Date: 21 November 2026.*

These are the fixes from the security review (`docs/security/Yahal-Security-Review-2026-11-21.md` in the project files).

## What changed

| Problem found in the review | What I did | Where |
| --- | --- | --- |
| The login "ticket" was saved on the phone without encryption, and Android copied it into Google Drive backups | The ticket is now encrypted (AES-256). The key to unlock it sits in the phone's secure chip area (iPhone Keychain / Android Keystore) and never leaves the phone. Android backups are switched off. | `apps/mobile/src/lib/secureSessionStore.ts`, `app.json` |
| Only the app checked that the phone number is Kuwaiti, so someone could make our server send SMS abroad and we would pay ("SMS pumping") | The sign-in server itself now refuses any number that isn't a Kuwaiti mobile (+965 starting with 4, 5, 6 or 9). Tested: a UK number and a Kuwaiti landline are refused. | `supabase/migrations/20261121130000_security_hardening.sql`, `supabase/config.toml` |
| No bot check on sign-in | A Cloudflare Turnstile check appears on the sign-in screen once you add its key. It stays off on your computer. | `apps/mobile/src/components/Captcha.tsx` |
| Android asked for permissions the app doesn't use (files, drawing over other apps) | Removed. The app asks only for internet. Vibration stays for the coming notifications. | `app.json` |
| Nothing forced HTTPS | A release build refuses to start if the server address isn't `https://`. Android release builds also block plain HTTP. | `apps/mobile/src/lib/supabase.ts`, `app.json` |
| The privacy consent accepted any text | It must now name a privacy-notice version we actually published. | migration, `privacy_versions` table |
| Unrealistic dates were accepted (a vaccine given in 1900, an event in 9999) | Doses must be between birth and today; due dates up to age 20; events within 5 years of today. | migration |
| One account could add unlimited data | At most 15 children per family and 200 new events per day. | migration |
| Invisible "flip text direction" characters were allowed in names | Refused in names, titles, places and notes. | migration |
| Invite codes could be guessed at high speed | 10 wrong codes per hour, then a one-hour pause. | migration |
| The app could pick its own record ids | It can now only fill the columns it needs. | migration |
| Android's "always light" setting didn't work without a helper library | Added `expo-system-ui`, so night mode on Android leaves the app light, as on iPhone. | `package.json` |

## How it was checked

- 47 database tests pass (33 earlier ones + 14 new ones for these rules).
- I sent real sign-in requests to the local server: UK and landline numbers are refused, Kuwaiti mobiles work.
- I built the Android project and read its manifest. It has internet, vibration, no backups and no plain HTTP.
- The full click-through (sign in, family, child, event, vaccines, invite, second parent) still passes with no errors.

## What you need to do at launch (can't be done in code)

1. **Cloudflare Turnstile:** create a free site key. Put the site key in the app's `EXPO_PUBLIC_TURNSTILE_SITE_KEY` and the secret key in the server's environment.
2. **SMS provider:** in Twilio (or the Kuwaiti provider), allow sending to Kuwait only and set a monthly spending cap.
3. **Server:** put the self-hosted Supabase behind HTTPS (TLS 1.2+). Only port 443 should be open to the internet.
4. **Test numbers:** make sure the production server has no test phone numbers (`GOTRUE_SMS_TEST_OTP` empty).
