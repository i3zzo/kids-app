# Building the signed store versions and submitting them

*Step by step, for Ezzo. Written 22 November 2026, checked against the current Expo docs (docs.expo.dev: EAS Build, Submit, environment variables, app credentials, push notification setup, local builds).*

You don't need a Mac, Xcode or Android Studio for this. **EAS** (Expo's build service) builds and signs both apps in the cloud. It also creates and stores the signing keys for you. The project is already set up for it: `apps/mobile/eas.json` has a `preview` profile (test builds to install directly) and a `production` profile (store builds).

| You get | Platform | File | Signed with |
| --- | --- | --- | --- |
| Store build | iPhone | `.ipa` | Apple distribution certificate and App Store provisioning profile (EAS makes them) |
| Store build | Android | `.aab` (Android App Bundle) | Upload key (EAS makes it). Google then re-signs for phones with Play App Signing. |
| Test build | Android | `.apk` (`preview` profile) | Same upload key |

## 0. What only you can do first (needs your accounts and money)

| # | What | Cost | Notes |
| --- | --- | --- | --- |
| 1 | **Apple Developer Program** | 99 USD a year | Enrol as an **organisation** if Yahal is a company. That needs a D-U-N-S number, which is free but takes 1 to 2 weeks. |
| 2 | **Google Play developer account** | 25 USD once | Also as an **organisation** if possible. A new **personal** account must run a closed test with at least 12 testers for 14 days before it can publish to everyone. Organisation accounts skip that. |
| 3 | **Expo account** | Free plan is enough to start | expo.dev. The free plan has a monthly build limit and a queue. |
| 4 | **Firebase project** | Free | Needed for Android reminders (FCM). See step 4. |
| 5 | **Domain** | | For the privacy policy, support and account-deletion pages, e.g. `https://[your domain]/privacy` |
| 6 | **Production Supabase in Kuwait**, SMS provider, Turnstile keys | | Already listed in `docs/explain/09-launch.md` items 5 to 11. The store build must point at the real server. |

Please don't send me any of these passwords or keys. The steps below have you type them yourself.

## 1. Install the tools (once)

On your computer, with Node.js 20 or newer:

```bash
cd apps/mobile
npm install
npx eas-cli@latest login            # your Expo account
npx eas-cli@latest init             # links the app to an Expo project; adds "extra.eas.projectId" to app.json
```

Commit the `app.json` change that `init` makes.

## 2. Settings the build needs (EAS environment variables)

These are **public** values. They end up inside the app, which is safe because the database's security rules protect the data. Never put the service key, database password, SMS token or OmniRoute key here.

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL      --value https://[your production supabase] --environment production --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value [production anon key]               --environment production --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_TURNSTILE_SITE_KEY --value [Turnstile site key]               --environment production --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_TURNSTILE_BASE_URL --value https://[your domain]              --environment production --visibility plaintext
```

Do the same with `--environment preview` for test builds (use a staging server if you have one).

Check them with `npx eas-cli@latest env:list --environment production`.

`EXPO_PUBLIC_TURNSTILE_BASE_URL` must be a domain you added to the Turnstile site in Cloudflare. If you don't set it, the code uses `https://yahal.app`.

## 3. Before the first store build

1. **iPad or not.** `app.json` has `"supportsTablet": true`. I recommend `false` for version 1 (see `store-listing.md` section 6).
2. **Make sure the app record names are free.** In App Store Connect create the app (**Apps > + > New App**: platform iOS, name, primary language Arabic, bundle ID `kw.yahal.app`, SKU e.g. `yahal-ios`). In Play Console create the app (**Create app**: name, default language Arabic, App, Free).
3. **Fill in the privacy policy brackets** and publish `store/privacy/index.html` at `https://[your domain]/privacy` (any static host works: GitHub Pages, Netlify, Cloudflare Pages).

## 4. Push notifications (reminders)

**iPhone:** on the first iOS build, EAS asks "Set up Push Notifications for your project?" and offers to generate an Apple Push Notifications key. Answer yes to both. Apple allows 2 keys per account, and they don't expire.

**Android** (needed, otherwise Android phones get no reminders):

1. In the Firebase console, create a project, then add an Android app with package `kw.yahal.app`.
2. Download `google-services.json`. Put it in `apps/mobile/` and add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`. This file is not secret, but if you'd rather keep it out of git, upload it as an EAS file variable named `GOOGLE_SERVICES_JSON` on expo.dev and reference that instead.
3. In Firebase: **Project settings > Service accounts > Generate new private key**. This downloads a JSON key. It **is** secret.
4. Upload it to Expo: `npx eas-cli@latest credentials` → Android → production → Google Service Account → **Manage your Google Service Account Key for Push Notifications (FCM V1)** → **Set up** → **Upload a new service account key**. (Or on expo.dev: Credentials > Android > FCM V1 service account key.)

## 5. Build

From `apps/mobile`:

```bash
npx eas-cli@latest build --platform ios     --profile production
npx eas-cli@latest build --platform android --profile production
```

The first time, EAS asks to:
- **iOS:** sign in to your Apple Developer account, then create the distribution certificate and provisioning profile. Say yes. They're stored on Expo's servers.
- **Android:** generate a new keystore (the upload key). Say yes.

Each build takes about 10 to 30 minutes (longer in the free queue). When it finishes you get a link to download the `.ipa` or `.aab`. Version numbers are handled for you: `version` (1.0.0) comes from `app.json`, and the build number goes up by itself on every production build (`"appVersionSource": "remote"` and `"autoIncrement": true` in `eas.json`).

## 6. Back up the Android upload key (do this once, today)

If this key is lost, Google has to reset it, which takes days. Download a copy:

```bash
npx eas-cli@latest credentials
# Android → production → "credentials.json: Upload/Download credentials between EAS servers and your local json"
# → "Download credentials from EAS to credentials.json"
```

This writes `credentials.json` and the keystore file. Store both in your password manager or another safe place. **Never commit them to git.**

In Play Console, keep **Play App Signing** switched on (it is by default for new apps). Google keeps the real app-signing key, and the EAS key is only the upload key, so a lost upload key can be replaced.

## 7. Test before submitting

```bash
npx eas-cli@latest build --platform android --profile preview   # an .apk you install directly
```

For iPhone, the easiest test is TestFlight: submit the production build (step 8), then install the TestFlight app on your iPhone.

Run the phone test checklist from `docs/explain/09-launch.md` item 20, and time Home on 4G on a real mid-range Android phone (target: under 3 seconds).

## 8. Submit

**iPhone (to TestFlight, then to review):**

```bash
npx eas-cli@latest submit --platform ios --latest
```

EAS asks for your Apple ID and can create an **App Store Connect API key** for you (say yes, it makes later submissions non-interactive). To skip the questions next time, put the app's Apple ID number (App Store Connect > App Information > Apple ID) in `eas.json`:

```json
"submit": { "production": { "ios": { "ascAppId": "1234567890" } } }
```

After it uploads, the build appears in App Store Connect under TestFlight in 10 to 30 minutes. Then:
1. Fill in the listing from `docs/launch/store-listing.md` (both languages) and upload the screenshots from `store/screenshots/ios-6.9/`.
2. Fill in **App Privacy** from `docs/launch/privacy-labels.md`.
3. Add the review account in **App Review Information** (`store-listing.md` section 7).
4. Pick the build, then **Add for Review > Submit**.

**Android:**

1. In Play Console, create a **Google Cloud service account** with access to your app, and download its JSON key (Play Console > Setup > API access). Upload it with `npx eas-cli@latest credentials` → Android → production → Google Service Account → **Manage your Google Service Account Key for Play Store Submissions**.
2. Submit:

   ```bash
   npx eas-cli@latest submit --platform android --latest
   ```

   `eas.json` already sends it to the **internal** testing track. The app stays in draft until the listing is complete. If Google refuses the very first upload through the API, upload that one `.aab` by hand in Play Console (Testing > Internal testing > Create new release); EAS works for every upload after that.
3. Fill in the listing (`store-listing.md`), upload `store/icons/android/play-store-icon-512.png`, the feature graphic and the screenshots from `store/screenshots/android-phone/`.
4. Fill in **App content**: privacy policy URL, Data safety and the other forms (`privacy-labels.md`), App access (the review account).
5. Promote the release from Internal testing to Closed testing (needed for a personal account, see step 0) and then Production.

## 9. Later updates

- **Code-only fixes** (no new native library, no `app.json` change): `npx eas-cli@latest update --channel production` sends them over the air, without store review. `runtimeVersion` is already set to follow the app version.
- **Anything else:** raise `version` in `app.json` (e.g. 1.0.1), then repeat steps 5 and 8.

## Without EAS (if you ever need it)

- **Same steps on your own machine:** `npx eas-cli@latest build --platform android --local` (Linux or macOS, needs the Android SDK and NDK) or `--platform ios --local` (macOS, needs Xcode, fastlane and CocoaPods). It still uses the keys stored on Expo, one platform at a time.
- **Fully by hand:** `npx expo prebuild` creates the `ios/` and `android/` folders. Then:
  - **iPhone:** open `ios/*.xcworkspace` in Xcode, choose your team under Signing & Capabilities, **Product > Archive**, then **Distribute App > App Store Connect**.
  - **Android:** create your own upload key with `keytool -genkeypair -v -storetype PKCS12 -keystore yahal-upload.keystore -alias yahal -keyalg RSA -keysize 2048 -validity 10000`, set it up in `android/gradle.properties` as the React Native docs describe, then `cd android && ./gradlew bundleRelease`. The signed bundle is `android/app/build/outputs/bundle/release/app-release.aab`.

  The repository doesn't keep `ios/` and `android/` (they're generated), so don't commit them. EAS is the simpler path.
