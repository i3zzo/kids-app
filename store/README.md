# Store submission package

Everything the App Store and Google Play ask for, ready to upload. Made on 22 November 2026.

| Need | Where |
| --- | --- |
| Names, subtitles, short and long descriptions, keywords (Arabic and English) | [`docs/launch/store-listing.md`](../docs/launch/store-listing.md) |
| Screenshot sizes for each store, and the captions | [`docs/launch/store-listing.md`](../docs/launch/store-listing.md) section 6 |
| Captioned screenshots, iPhone 6.9" (1320 × 2868) | [`screenshots/ios-6.9/ar`](screenshots/ios-6.9/ar), [`screenshots/ios-6.9/en`](screenshots/ios-6.9/en) |
| Captioned screenshots, Android phone (1080 × 1920) | [`screenshots/android-phone/ar`](screenshots/android-phone/ar), [`screenshots/android-phone/en`](screenshots/android-phone/en) |
| Google Play feature graphic (1024 × 500) | [`screenshots/android-feature-graphic`](screenshots/android-feature-graphic) |
| App Store icon (1024 × 1024) | [`icons/ios/app-store-icon-1024.png`](icons/ios/app-store-icon-1024.png) |
| All iOS icon sizes (Xcode `AppIcon.appiconset`, 20 to 1024 px) | [`icons/ios/AppIcon.appiconset`](icons/ios/AppIcon.appiconset) |
| Google Play icon (512 × 512) | [`icons/android/play-store-icon-512.png`](icons/android/play-store-icon-512.png) |
| Android launcher icons, adaptive layers (foreground, background, monochrome) and round icons, mdpi to xxxhdpi | [`icons/android`](icons/android) |
| Privacy policy (draft for the lawyer) | [`docs/launch/privacy-policy.md`](../docs/launch/privacy-policy.md) |
| Privacy policy web page to host at `https://[your domain]/privacy` | [`privacy/index.html`](privacy/index.html) |
| Apple App Privacy and Google Data safety answers | [`docs/launch/privacy-labels.md`](../docs/launch/privacy-labels.md) |
| Signed builds (EAS, .ipa and .aab) and submitting | [`docs/launch/build-and-submit.md`](../docs/launch/build-and-submit.md) |

## Icons and splash: what the app build uses

The build itself only needs the masters in `apps/mobile/assets/`. Expo makes every native size from them when it builds:

| File | Size | Used for |
| --- | --- | --- |
| `icon.png` | 1024 × 1024, no transparency | iOS icon (iOS rounds the corners itself) |
| `android-icon-foreground.png` | 512 × 512, transparent | Android adaptive icon, front layer (the face sits inside the 66% safe zone) |
| `android-icon-background.png` | 512 × 512 | Android adaptive icon, back layer (teal #0E7C86) |
| `android-icon-monochrome.png` | 512 × 512, white on transparent | Android 13+ themed icons. Redrawn in this change so the eyes and smile show. |
| `splash-logo.png` | 1024 × 1024 | Splash screen, 200 px wide on teal #0E7C86 (set in `app.json`) |

The files in `store/icons/` are the same icon at every size, for the store pages and for anyone who builds with Xcode or Android Studio directly.

## Making them again

After a design change:

```bash
# Icons (needs Python and Pillow)
python3 scripts/store/make-icons.py

# Privacy page (after editing docs/launch/privacy-policy.md)
npx -y -p marked@18 node scripts/store/build-privacy-page.mjs
```

Screenshots are real screens of the app's web build at iPhone size, with a made-up family (Sara, 6 months, and Yousef, 4 years). To make them again:

1. `npx supabase start` (repo root), then in `apps/mobile`: put the local URL and anon key in `.env`, `npx expo export -p web`, and serve `dist/` as a single-page app on port 8081.
2. Sign in on the web build with test number 5000 0001 and code 123456, create a family, and save the browser's signed-in state with Playwright (`context.storageState`).
3. Load the demo family: `psql "$DB_URL" -f scripts/store/demo-family.sql`.
4. `node scripts/store/capture-screens.js ar yahal.locale` with the environment variables listed at the top of that file. For English, rename the family, children, events and supplies to English (as in the English screenshots) and run it again with `en`.
5. `node scripts/store/compose-screenshots.js <captures> store/screenshots <font folder> apps/mobile/assets/icon.png`. The captions are in that script and must match `store-listing.md`.

Never use a real child's name or data in store screenshots.
