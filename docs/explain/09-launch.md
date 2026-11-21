# Step 9 explained: getting ready to go live

*Written for Ezzo, in plain language. Date: 21 November 2026.*

The app's features are all built. This step checks that it stays fast with many families, prepares the store builds, and lists every remaining task that needs a person (you, a doctor, a lawyer, or a supplier). I can't do those tasks myself, and I haven't pretended to.

## 1. Speed with many families (measured)

I loaded the local database with **20,000 families**, which is 4 times the 5,000 in the cost plan. That meant 30,000 parents, 30,000 children, 795,000 vaccination rows, 400,000 calendar events, 750,000 supply items and 300,000 past notifications.

Then I timed what the app and the server jobs actually run, as a real parent, so the security rules were included. Each was run 3 times. The scripts are in `supabase/perf/` and anyone can run them again with `supabase/perf/run.sh`.

| What | Before | After |
| --- | --- | --- |
| Home: this week's events | 0.2–0.6 ms | 0.2–0.3 ms |
| Home: next vaccinations | 0.4–0.5 ms | 0.4 ms |
| Home: running low | 0.2–0.4 ms | 0.2–0.3 ms |
| Supplies tab (one child) | 0.4–0.7 ms | 0.4–0.5 ms |
| Download my data | 32–40 ms | **6–7 ms** |
| Reminder job (runs every 5 minutes) | 406–523 ms | **206–246 ms** |
| "Running low" job, first run at 6 pm | 959–1,145 ms | 955–1,038 ms |
| "Running low" job, the other 71 runs that evening | 959–1,145 ms **each** | **0.2 ms** |
| Delete a family | 130–180 ms | **86–96 ms** |

What changed:
- **The reminder job** used to read every vaccination row and every past event every 5 minutes. Now it only looks at vaccinations due in the next 14 days and skips past one-off events. Most of the 0.2 s that remains is repeating events (20,000 of them in the test), and that is fine at this size.
- **The 6 pm supplies job** was running its full check every 5 minutes until midnight. Now it does the work once a day.
- **Download and delete** now find a family's supply items with an index instead of searching all 750,000.

## 2. Speed on a slow phone connection (measured)

I tested the web preview with Chrome's **Slow 4G** setting (1.6 Mbit/s, 0.56 s per round trip) and the **CPU slowed down 4 times**.

| What | Before | After |
| --- | --- | --- |
| Opening Home again (the data loads fresh) | 1,249–1,267 ms | **694–725 ms** |
| Web preview, cold start (downloads the whole app first) | 6,513–7,180 ms | 6,578–6,639 ms |

- **Why Home got faster:** it needed the children's ages before it could ask for their tips, which meant two trips to the server. Now the database works out each child's tips in the same request, so it's one trip.
- **What the cold start means:** the 6.6 s is only for the web preview, which downloads 450 KB (compressed) of app code first. On a phone that code is already installed. The phone's equivalent is the Home row above.
- **Not measured yet:** a real mid-range Android phone. The target is "Home usable in under 3 seconds on 4G". Please time it on a real phone with the first store test build. The phone test list already covers this.

## 3. Store builds (prepared)

- `apps/mobile/eas.json` sets up **preview** (test builds you install directly) and **production** (store builds; the build number goes up by itself).
- Each build reads the Supabase URL and public key from **EAS environment variables**, one set for preview and one for production. No secret is in the code.
- `app.json` now has:
  - the app description;
  - the "no special encryption" answer Apple asks for;
  - Apple's **privacy manifest** (phone number, child's name, vaccination records, calendar and supplies, push token, with no tracking);
  - a runtime version for future over-the-air fixes.
- `docs/launch/store-listing.md` has the store texts in Arabic and English, keywords, the screenshot list, the privacy-label answers, and how to give Apple and Google a review login.

## 4. Checked

- **Database tests: 130 of 130 pass.** The 5 new ones check that:
  - every table has security rules switched on;
  - the new tips request only sees your own children;
  - the 6 pm job runs once a day.
- App type check and unit tests pass. The web click-through has no errors.

## 5. What only you (or someone you hire) can do

Grouped by who does it. The code is ready for each of these, and each doc listed explains how.

**Accounts and money**
1. Apple Developer account (99 USD a year) and Google Play developer account (25 USD once). Use a company account if Yahal will be a company.
2. Expo account. Then run `npx eas init` in `apps/mobile` (this adds the project ID) and set the EAS environment variables `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_TURNSTILE_SITE_KEY`.
3. A domain (for example `yahal.kw`), plus a support email and a privacy email.
4. Check whether "Yahal / ياهل" is free to use as a trademark in Kuwait, and register it.

**Server in Kuwait** (`docs/BUILD-PLAN.md` section 5)
5. Choose the hosting (the Google Cloud or Azure Kuwait region, or a local data centre), and confirm it's live.
6. Install self-hosted Supabase:
   - HTTPS only, with only port 443 open;
   - daily backups kept in Kuwait;
   - a monthly test that a backup can be restored.

   Tell me how many days backups are kept: the privacy notice needs that number.
7. Run the migrations on the server. Make sure `pg_cron` and `pg_net` are on, so reminders run.
8. Remove all test phone numbers on the server, except one App Review number while the stores review the app.
9. Error monitoring, for example Sentry's free tier. Send me the DSN and I'll connect it.

**Sign-in, reminders, AI**
10. SMS provider for Kuwait (Twilio or a local one): Kuwait-only sending and a monthly spending cap (`02-security-hardening.md`).
11. Cloudflare Turnstile keys, for the bot check at sign-in (`02-security-hardening.md`).
12. Push notifications:
    - the Apple push key, created by EAS on your first iOS build;
    - the Firebase (FCM) key, uploaded in the Expo dashboard;
    - optionally, an Expo access token in the server's Vault (`03-reminders.md`).
13. OmniRoute key, plus one fixed AI model from a provider that doesn't train on API data (`07-tips.md`).

**People who must review content**
14. **A paediatrician** with the "health reviewer" role in the admin panel, to read:
    - the 40 tips;
    - the supply hints (fever medicine, toothpaste, formula);
    - the vaccination schedule against the current MOH schedule.

    They sign it off in the admin panel (`04`, `06`, `07`).
15. **A lawyer**, to review the privacy notice against CITRA's Data Privacy Protection Regulation and fill in the [brackets] (`08-privacy.md`). Then publish it on your website too, because the stores need a privacy URL.
16. **Your team:**
    - check the 17 brands on the shelf at The Sultan Center, LuLu, Carrefour and a co-op (`04`);
    - check the 7 government guides against PACI, MOH, MOI and MOE (`05`);
    - phone or visit each directory place (`05`);
    - add real offers (`05`);
    - check Kuwait's rules on marketing formula before any offer goes near formula (`04`).
17. Make yourself the first super admin with the one SQL line in `06-admin.md`, then add the team from the Staff page.

**Store submission**
18. Store screenshots with a made-up demo family (`docs/launch/store-listing.md`).
19. Fill in Apple's "App Privacy" and Google's "Data safety" forms with the answers in that file.
20. Run the phone test checklist on a real iPhone and Android phone with a preview build, and send me anything that's wrong.
