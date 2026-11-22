# Apple "App Privacy" and Google Play "Data safety": the answers

*Written 22 November 2026, from the code in this repository (the database tables in `supabase/migrations/`, the app in `apps/mobile/src/`, and the AI function in `supabase/functions/tips-ai/`). If the code changes, these answers must change too.*

The rule I followed: when unsure, declare it. Declaring something you don't collect is harmless. Missing something you do collect can get the app removed.

## What the app actually collects

| What | Where in the code | Who can see it | Kept for |
| --- | --- | --- | --- |
| Parent's phone number | Supabase Auth (sign-in) | That parent. The other parent sees only their role. | Until the account is deleted |
| Family name, who is owner or co-parent, invite codes | `families`, `family_members`, `family_invites` | The family's two parents | Until deletion |
| Each child's first name, birth date, gender, calendar colour, optional nationality group (Kuwaiti / GCC / other) | `children` | The family's two parents | Until deletion |
| Vaccination records: status, date given, clinic name | `child_vaccinations` | The family's two parents | Until deletion |
| **Special needs (optional, sensitive):** list of needs, a note of up to 300 characters, "has a disability card" yes/no | `child_support` | **Only** the family's two parents (database rule). Never sent to the AI. | Until the parent clears it or deletes the account |
| Calendar events: title, time, place, notes, repeat, reminder | `events` | The family's two parents | Until deletion |
| Supplies: item, brand, size, quantity | `supply_items` | The family's two parents | Until deletion |
| Progress in government guides | `guide_progress` | The family's two parents | Until deletion |
| Notification settings, phone's push token, platform (iOS/Android), app language | `notification_settings`, `device_tokens` | Server only | Until deletion, or until the token is replaced |
| Reminders that were sent (title and text) | `notification_log` | Server only (included in "download my data") | Until deletion |
| Times of invite-code attempts | `invite_attempts` (stops guessing of codes) | Server only | Until deletion |
| Times of AI requests | `ai_usage` (20 a day limit) | Server only | 2 days |
| Which privacy notice version the parent agreed to, and when | `families.privacy_version`, `privacy_accepted_at` | Server only | Until deletion |

**What the app does not collect:** location, contacts, photos or files, civil ID or passport numbers, advertising ID, browsing history, purchases, payment details, or crash and analytics data. There is no analytics, ads or crash-reporting SDK in `apps/mobile/package.json`. (If Sentry is added later, add "Crash data" and "Diagnostics" to both forms.)

**Where data goes outside our own server** (these are service providers working for us, not "sharing" in either store's definition):

| Service | What it receives | Why |
| --- | --- | --- |
| SMS provider ([name]) | Phone number and the one-time code | Sign-in |
| Cloudflare Turnstile | IP address and browser/device information, during sign-in only | Bot check |
| Expo push service, Apple (APNs), Google (FCM) | Push token, and the reminder text: the child's first name, the event's title and time, or "vaccination due" | Reminders |
| AI provider, through OmniRoute | The child's age in months, gender, the tip topic and language, and our own published tips. No name, no account ID, nothing about special needs (`supabase/functions/tips-ai/index.ts` only sends general tips: `for_needs=eq.{}`) | "Personalise with AI" |

Nothing is sold, nothing is used for ads, and nothing is used for tracking.

---

## Apple App Store Connect: App Privacy

Go to **App Store Connect > your app > App Privacy > Get Started**.

**"Do you or your third-party partners collect data from this app?"** Yes.

Tick these data types:

| Category | Data type | Tick? | Why |
| --- | --- | --- | --- |
| Contact Info | **Phone Number** | Yes | Sign-in |
| Contact Info | **Name** | Yes | The child's first name and the family name |
| Contact Info | Email, Physical Address, Other | No | |
| Health & Fitness | **Health** | Yes | Vaccination records, special needs |
| Health & Fitness | Fitness | No | |
| Financial Info | all | No | |
| Location | all | No | The event "place" is free text the parent types. It's counted under User Content, not Location. |
| Sensitive Info | **Sensitive Info** | Yes | Apple lists disability here. The special needs profile is disability data. |
| Contacts | | No | |
| User Content | **Other User Content** | Yes | Calendar, supplies, guide progress, birth date, gender, nationality group |
| User Content | Emails or Text Messages, Photos or Videos, Audio, Gameplay, Customer Support | No | |
| Browsing History, Search History | | No | |
| Identifiers | User ID | No | The account ID is internal and never shown or shared. If you'd rather be extra safe, ticking it does no harm. |
| Identifiers | **Device ID** | Yes | The push notification token |
| Purchases | | No | |
| Usage Data | **Product Interaction** | Yes | Times of AI requests and invite attempts (limits against abuse) |
| Usage Data | Advertising Data, Other Usage Data | No | |
| Diagnostics | Crash Data, Performance Data, Other | No | No crash reporting yet |
| Other Data | | No | |

For **every** ticked type, answer the same three questions:

1. **Purpose:** App Functionality only. (Not Analytics, not Product Personalisation, not Advertising.)
   - For Product Interaction you can also tick "Other Purposes" and write "abuse prevention". App Functionality alone is also correct.
2. **Is this data linked to the user's identity?** Yes. Everything is stored under the parent's account.
3. **Is this data used for tracking?** No.

The result Apple shows on the store page will be: *"Data Linked to You: Contact Info, Health & Fitness, Sensitive Info, User Content, Identifiers, Usage Data"*, with nothing under "Data Used to Track You".

The privacy manifest in `apps/mobile/app.json` (`ios.privacyManifests`) now lists the same seven types, so the build and the form agree.

---

## Google Play Console: Data safety

Go to **Play Console > your app > Policy and programs > App content > Data safety**.

### Data collection and security

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only. Android blocks plain HTTP: `usesCleartextTraffic: false`. The production server must be HTTPS, launch list item 6.) |
| Which account creation methods does your app support? | **Username and other authentication** (phone number with a one-time code). Not "OAuth", not "username and password". |
| Add a link that users can use to request account and data deletion | `https://[your domain]/privacy#delete` |
| Do you provide a way for users to request that some or all of their data is deleted, without deleting their account? | **Yes**. Parents can delete children, events, supplies and the special needs profile one by one in the app. |

### Data types

Tick these. For each one Google asks four questions; the answers are in the columns.

| Category | Data type | Collected | Shared | Processed only on the device (ephemeral) | Required or optional | Purposes |
| --- | --- | --- | --- | --- | --- | --- |
| Personal info | **Name** | Yes | No | No | Required (the child's first name) | App functionality |
| Personal info | **Phone number** | Yes | No | No | Required | App functionality, Account management, Fraud prevention, security and compliance |
| Personal info | **Other info** | Yes | No | No | Required (birth date, gender), optional (nationality group) | App functionality |
| Personal info | Email, Address, User IDs, Race and ethnicity, Political or religious beliefs, Sexual orientation | No | | | | |
| Health and fitness | **Health info** | Yes | No | No | **Optional** (vaccination records come from the schedule but the parent chooses to mark them; special needs is optional) | App functionality |
| Health and fitness | Fitness info | No | | | | |
| App activity | **App interactions** | Yes | No | No | Required | Fraud prevention, security and compliance (AI and invite-code limits) |
| App activity | **Other user-generated content** | Yes | No | No | Optional | App functionality (calendar, supplies, guide progress) |
| App activity | In-app search history, Installed apps, Other actions | No | | | | |
| Device or other IDs | **Device or other IDs** | Yes | No | No | Optional (only if the parent allows notifications) | App functionality (push token) |
| Location, Financial info, Messages, Photos and videos, Audio, Files and docs, Calendar, Contacts, Web browsing, App info and performance | all | No | | | | |

Notes on the choices:

- **"Shared" is No everywhere.** Google doesn't count sending data to a service provider that processes it for you (SMS, push, AI, bot check) as sharing.
- **"Calendar" is No.** Google's "Calendar events" type means reading the phone's own calendar. Yahal has its own calendar and never touches the phone's. Our events are "Other user-generated content".
- **"Race and ethnicity" is No.** The nationality group (Kuwaiti / GCC / other) is only used to show the right government guides. It's declared under "Other info". If the lawyer prefers, ticking "Race and ethnicity" as optional is the cautious choice.
- **Cloudflare Turnstile** uses the IP address and browser information during the sign-in bot check. Google doesn't list "IP address" as a type on its own. It's covered by "Fraud prevention" on Phone number. The privacy policy names Turnstile.

### Other Play Console forms you'll meet

- **Target audience and content:** 18 and over only.
- **Health apps declaration:** the app has health features (vaccination schedule and reminders, general health tips, a special needs profile). Pick the options in Google's list that match those, and answer that it is **not** a medical device and doesn't diagnose or treat. Google changes this form's wording often, so pick from what it shows on the day rather than from a fixed list here.
- **Ads:** No ads.
- **Government apps:** No. It links to government guides but isn't made by a government.
- **Financial features:** None.
- **Account deletion:** in the app (Family > Privacy and your data) plus the web link above.

---

## What to recheck before submitting

1. Fill in every [bracket] in the privacy policy, and make the hosting really in Kuwait before the store text says so.
2. If you add crash reporting (Sentry), analytics, ads, payments, photos or location, update both forms and the policy first.
3. Have the lawyer read this file together with the privacy policy.
