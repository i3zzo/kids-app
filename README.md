# Yahal · ياهل

A family organiser for parents in Kuwait: each child's profile, a shared
calendar, and the Ministry of Health vaccination schedule, in Arabic and
English. See [`docs/PRD.md`](docs/PRD.md) and [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md).

![Home, calendar, vaccinations and family screens](docs/screenshots/overview.webp)

## What's in this repository

```
kids-app/
├── apps/
│   └── mobile/                 The phone app (React Native + Expo, TypeScript)
│       ├── src/app/            Screens. Every file here is one screen.
│       │   ├── (auth)/         Language → phone number → SMS code
│       │   ├── (onboarding)/   Create or join a family → add the first child
│       │   ├── (tabs)/         The bottom tabs: Home, Calendar, Supplies, Explore, Family
│       │   ├── child/          Add / edit a child
│       │   ├── event/          Add / edit a calendar event
│       │   ├── vaccines/       A child's full vaccination schedule
│       │   └── dose/           One vaccine dose: mark given / change date
│       ├── src/components/     Shared pieces (buttons, fields, date picker, forms)
│       ├── src/lib/            Supabase connection, all database calls (api.ts),
│       │                       Arabic/English text (i18n/strings.ts), helpers
│       ├── assets/             App icon and logo
│       └── .env.example        The two PUBLIC settings the app needs
│   └── admin/                  The team's admin panel (Next.js, static site)
│       ├── src/app/            One folder per page (directory, offers, guides…)
│       ├── src/components/     Sign-in, the content editor with review workflow
│       └── .env.example        The same two PUBLIC settings
├── supabase/                   The server side
│   ├── migrations/             Database tables + all security rules (SQL)
│   ├── tests/                  Security tests: one family can't see another
│   ├── perf/                   Query-plan check with 5,000 test families
│   └── config.toml             Local Supabase settings (phone sign-in on)
└── docs/                       Product doc, build plan, brand, explanations
    └── explain/                Plain-language notes on each part that's built
```

## How it is secured

- **Sign-in:** Supabase Auth with the parent's phone number and a one-time SMS
  code. There is no password system of our own.
- **Permissions live in the database.** Every table has Row Level Security
  rules (`supabase/migrations/`). A parent can only ever read or change their
  own family's rows, even if the app had a bug. `supabase/tests/security.test.sql`
  proves it with 33 checks.
- **No secrets in the app.** The app only gets the Supabase URL and the public
  "anon" key, from environment variables. The service key, database password
  and SMS provider token stay on the server.
- **Children's data is basic only:** first name, birth date, gender, optional
  nationality group and a calendar colour. No civil ID or passport numbers.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20+ and [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
# 1. Start a local Supabase (database + sign-in) and load the tables
cp supabase/.env.example supabase/.env
npx supabase start          # prints the API URL and the anon key

# 2. Start the app
cd apps/mobile
cp .env.example .env        # paste the anon key from step 1
npm install
npx expo start              # press "w" for web, or scan the QR code with Expo Go
```

Sign in with the test number **5000 0001** (or 5000 0002 / 5000 0003) and the
code **123456**. Test numbers only work on the local server; no SMS is sent.

### Checks

```bash
npx supabase test db                      # security tests (from the repo root)
cd apps/mobile && npm run typecheck && npm test
```

## Run the admin panel

```bash
cd apps/admin
cp .env.example .env.local     # the same URL and anon key as the app
npm install
npm run dev                    # http://localhost:3001
```

The first super admin is added once with SQL (see `docs/explain/06-admin.md`). After that, the super admin adds the team from the Staff page.

## Run the AI tips function

```bash
cp supabase/functions/.env.example supabase/functions/.env   # fill in the OmniRoute URL, key and model
npx supabase functions serve --env-file supabase/functions/.env
node --test --experimental-strip-types supabase/functions/_shared/*.test.ts
```

In production: `npx supabase secrets set --env-file supabase/functions/.env`. The key stays on the server and never goes in the app.

## Where each build step is explained

- [Step 1: sign-in, family, children, calendar and vaccinations](docs/explain/01-family-children-calendar.md)
- [Step 2: security fixes before launch](docs/explain/02-security-hardening.md)
- [Step 3: reminders, repeating events and notification settings](docs/explain/03-reminders.md)
- [Step 4: supplies tracker and suggested items by age](docs/explain/04-supplies.md)
- [Step 5: Explore — government guides, directory and offers](docs/explain/05-explore.md)
- [Step 6: admin panel, roles and review before publishing](docs/explain/06-admin.md)
- [Step 7: tips by age, and AI personalisation](docs/explain/07-tips.md)
- [Step 8: privacy — export your data, delete your account](docs/explain/08-privacy.md)
- [Step 9: getting ready to go live (speed, store builds, what only Ezzo can do)](docs/explain/09-launch.md)
