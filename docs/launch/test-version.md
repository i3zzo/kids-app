# Test version: let other people try Yahal from anywhere

*For Ezzo. Written 22 November 2026, checked against the current Supabase docs (testing auth flows, regions) and the Expo EAS steps in `build-and-submit.md`.*

Today the app runs only from your Mac (Expo Go on your Wi-Fi, with a local database), so nobody else can reach it. A test version needs three things on the internet:

| Part | What testers get | Where it runs | Cost |
| --- | --- | --- | --- |
| **Test server** | One shared database with all content (vaccines, tips, guides, 361 places, events) | Supabase cloud, a separate "yahal-test" project | Free plan |
| **The app** | **Web link** (any phone or computer, today) · **Android APK** link · **iPhone** via TestFlight | Netlify or Cloudflare Pages · Expo EAS | Free (iPhone needs the Apple Developer account, 99 USD a year) |
| **Admin panel** | A web link for you and any staff | Same static host as the web app | Free |

Testers sign in with **test numbers**: each tester gets a Kuwaiti-format number and a 6-digit code. No SMS is sent, so you don't need an SMS provider yet, and testers outside Kuwait can sign in too.

Never use the test server's numbers, keys or data for the real launch. The real server comes later (`build-and-submit.md` step 0, item 6).

---

## 1. Test server (Supabase), about 15 minutes

1. Go to **supabase.com > New project**. Name `yahal-test`, choose a strong database password (keep it in your password manager), region **South Asia (Mumbai)**. Supabase has no Middle East region, and Mumbai is the closest to Kuwait.
2. On your Mac, from the repo folder:

   ```bash
   bash scripts/test-env/setup-supabase.sh <project-ref>
   ```

   `<project-ref>` is the part before `.supabase.co` in the project's URL (Project Settings > General > Project ID). This creates every table, security rule and all the content, and deploys the AI tips function. It asks you to log in to Supabase once and for the database password.
3. Three settings in the Supabase dashboard (they can't be set by the script):

   **a. Phone sign-in.** Authentication > Sign In / Providers > **Phone**: turn it on. Choose SMS provider **Twilio** and type `placeholder` in Account SID, Auth Token and Message Service SID. Supabase requires a provider even though test numbers never send an SMS ([Supabase docs](https://supabase.com/docs/guides/auth/testing-auth-flows)). If the dashboard refuses `placeholder`, tell me and we'll use a free Twilio trial account instead.

   **b. Test numbers.** On the same Phone page, in **Test Phone Numbers and OTPs**, paste the line I sent you (or make a new set with `node scripts/test-env/make-test-numbers.mjs 20`, which prints the line to paste and a list for testers). Set **Test OTPs Valid Until** to the end of the test period, e.g. 3 months from today. After that date the numbers stop working.

   **c. Kuwaiti-numbers rule.** Authentication > **Hooks** > Add hook > **Before User Created** > type Postgres, schema `public`, function `hook_before_user_created`. This is the same rule as on your Mac: only Kuwaiti mobile numbers can create an account.
4. Copy the two **public** values from Project Settings > API (or **Connect**): the Project URL and the **anon** (publishable) key. Never copy the `service_role` / secret key anywhere.

## 2. Web link (works on any phone, the fastest way to start), about 10 minutes

1. Create `apps/mobile/.env.test.local` (git ignores it):

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```

2. Build: `bash scripts/test-env/build-web.sh`. That makes the folder `apps/mobile/dist`. Your normal `apps/mobile/.env` for local work isn't touched.
3. Put it online, either way:
   - **Netlify** (simplest): log in at app.netlify.com, open **Sites > Add new site > Deploy manually**, and drag the `dist` folder in. You get a link like `https://yahal-test.netlify.app`. Rename it under Site configuration.
   - **Cloudflare Pages** (you'll use Cloudflare for Turnstile anyway): Workers & Pages > Create > Pages > **Upload assets**, upload `dist`.

   Both read the `_redirects` and `_headers` files that are already in the build. Links like `/child/…` work after a refresh. The app's code and images are cached for a year (their names change with every build), and the page itself is always re-checked, so testers get each new build as soon as you upload it.

What the web version can't do: reminders (push notifications) only work in the phone apps. Everything else is the same.

To update: run step 2 again and drag the new `dist` folder onto the same site (Netlify: **Deploys** tab).

## 3. Android app (APK link anyone can install), about 30 minutes, mostly waiting

From `apps/mobile`:

```bash
npm install
npx eas-cli@latest login                    # free Expo account
npx eas-cli@latest init                     # once; commit the app.json change it makes
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL      --value https://<project-ref>.supabase.co --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>                       --environment preview --visibility plaintext
npx eas-cli@latest build --platform android --profile preview
```

When the build finishes (10 to 30 minutes on the free plan), Expo shows a page with a **link and QR code**. Send the link to testers. They open it on an Android phone, download, and allow "install unknown apps" when Android asks.

Reminders on Android also need the Firebase step (`build-and-submit.md` step 4). Without it the app works fully, but the "Turn on reminders" switch won't deliver notifications.

## 4. iPhone (TestFlight), needs the Apple Developer account

Apple doesn't allow an install link like Android's. TestFlight is the normal way:

```bash
npx eas-cli@latest build  --platform ios --profile testflight
npx eas-cli@latest submit --platform ios --profile testflight --latest
```

The `testflight` profile builds a signed App Store build that uses the **test** server values (the `preview` EAS environment from step 3). The first time, EAS asks you to sign in to Apple and creates the certificates (say yes). About 30 minutes later the build shows in App Store Connect > your app > **TestFlight**. Then:

- **Internal testers** (up to 100 people you add as users in App Store Connect): available at once.
- **External testers** (anyone, by email or a public link, up to 10,000): create a group, add the build, fill in "What to test" and the review notes with one test number and its code. Apple reviews the first build, usually within a day.

Testers install the free **TestFlight** app, then open your invite.

Until the Apple account is ready, iPhone testers can use the web link from step 2.

## 5. Admin panel online, about 10 minutes

```bash
cd apps/admin
npm ci
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key> npm run build
```

Upload the `apps/admin/out` folder as a **second** site on Netlify or Cloudflare Pages (same way as step 2).

To give yourself access: sign in once in the test app with your test number, then run `scripts/test-env/make-admin.sql` in Supabase > **SQL Editor** (change the number in it first). From then on you can add other staff in the admin panel's **Staff** page.

## 6. What to send testers

> Hi! Please help test **Yahal**, a family organiser app for Kuwait.
> - Android: [APK link] (allow "install unknown apps" if asked)
> - iPhone: [TestFlight invite], or use the web version
> - Any phone or computer: [web link]
>
> Sign in with your own test number: **[5000 01NN]**, code **[NNNNNN]**. No SMS is sent; just type the code.
> This is test data only, so please don't enter real health details. Send feedback to [you].

Give **each tester a different number**. Everyone who uses the same number shares one account and one family.

## Good to know

- **AI tips:** the function is deployed but has no key yet, so the app shows the normal tips, and tapping the AI button says "Personalised tips are not available right now". To turn it on later: `npx supabase@3.2.0 secrets set OMNIROUTE_BASE_URL=… OMNIROUTE_API_KEY=…`.
- **Bot check (Turnstile):** left off in the test version, because test numbers never send an SMS. It must be on for the real server.
- **Free plan pauses:** Supabase pauses a free project after a week with no activity. Open the dashboard and press **Restore** if testers say nothing loads.
- **Fixing bugs during the test:** web updates are instant (step 2 again). The Android and iPhone apps need a new build each time (steps 3 and 4). If testing goes on for weeks, adding Expo's over-the-air updates is a good next step so fixes reach phones without reinstalling.
- **Delete testers' data:** each tester can use Settings > Privacy > Delete my account. When the test ends, delete the whole `yahal-test` project.
