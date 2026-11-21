# Step 1 explained: sign-in, family, children, calendar and vaccinations

*Written for Ezzo, in plain language. Date: 21 November 2026.*

## What a parent can do now

1. **Choose Arabic or English.** Arabic is the default, and the whole screen
   flips right-to-left. You can switch at any time in Family → Settings, and it
   changes instantly.
2. **Sign in with a Kuwaiti mobile number.** The app sends a 6-digit code by
   SMS. There is no password.
3. **Create a family** and accept the privacy notice, **or join** the other
   parent's family with an 8-letter invite code.
4. **Add children** with first name, birth date, gender, and optionally
   nationality group and a colour for the calendar.
5. **See each child's vaccination schedule.** It is created automatically from
   the birth date, using the Kuwait MOH schedule. Mark a dose as given (with
   the date and health centre), undo it, or move it to another date. For an
   older child there's one button to mark all past doses as given.
6. **Use the calendar.** A month view with a coloured dot for each child.
   Tap a day to see its events and vaccines. The orange + button adds
   training, classes, appointments or any activity, for one child or the
   whole family. Filter by child at the top.
7. **Home** shows today's events, the next vaccine for each child (with
   "Overdue" in red when it's late), and the next 7 days.
8. **Invite the second parent** from the Family tab. Both parents then see
   and edit the same children and calendar.

## How the pieces fit together

Think of it as three layers:

| Layer | Where | What it does |
| --- | --- | --- |
| **The app** | `apps/mobile/` | Screens and buttons. It asks the server for data and shows it. It makes **no** security decisions. |
| **Sign-in** | Supabase Auth | Checks the phone number with an SMS code and gives the app a signed "ticket" that says who you are. |
| **The database** | `supabase/migrations/` | Stores everything, and checks the ticket on every request. Its rules decide what each parent may see or change. |

### Your four rules, and where each one is enforced

| Your rule | How it is done |
| --- | --- |
| Clear structure, screens, explanation after each part | Folders above; this document; one file per screen in `src/app/`. |
| Reliable login service, no home-made passwords | Supabase Auth phone sign-in (`supabase/config.toml`, `src/app/(auth)/`). |
| All permission checks on the server and database | Row Level Security rules in `supabase/migrations/20261121120000_family_children_calendar.sql`. Actions like "create family" and "join with invite" are database functions that check everything themselves. |
| Keys in environment variables, no secret key in the app | The app reads only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env`. The anon key is public by design. Real `.env` files are ignored by git. The SMS provider's token is read from `supabase/.env` on the server. |

### What the database stores (tables)

- `profiles`: one row per parent (display name, language).
- `families` and `family_members`: who belongs to which family, as owner or co-parent. Also when the privacy notice was accepted.
- `family_invites`: the one-time codes for the second parent (valid 7 days).
- `children`: first name, birth date, gender, nationality group, colour.
- `vaccine_schedule_versions` and `vaccine_doses`: the MOH schedule, which anyone can read.
- `child_vaccinations`: each child's own doses (due date, given or not, date given, health centre).
- `events`: calendar entries.

### What the security tests prove

`supabase/tests/security.test.sql` creates three parents and checks 33 things,
for example:

- Sara (another family) sees **zero** of Amal's children, events, vaccines or invite codes.
- Sara cannot add a child or an event to Amal's family, even if she knows its ID.
- Sara's attempts to rename or delete Amal's child do nothing.
- A family can't be created without accepting the privacy notice.
- Only the owner can create invite codes; a wrong or used code is rejected.
- A visitor who isn't signed in can read the public vaccine schedule and nothing else.
- Adding a girl generates her schedule, including the girls-only dose.

## Things you should know

1. **The vaccination schedule needs a health reviewer.** The Ministry's 2025
   schedule file couldn't be downloaded while building (the site blocked the
   download). The app uses the **MOH 2019 schedule**, copied from a copy of the
   official document hosted on another site. The app shows this source and a "pending review"
   note to parents. Before launch, someone qualified should compare it with
   the 2025 schedule. Fixing it means adding a new version to the database,
   with no app changes.
2. **SMS costs money in production.** On your computer, test numbers work for free.
   For real users we need an SMS provider account (Twilio or a Kuwaiti
   provider). Its keys go in the server's environment variables, never in the app.
3. **The privacy notice text is a placeholder.** The checkbox records which
   version was accepted (`privacy-2026-11-draft`). The real notice needs legal review.
4. **Reminders (push notifications) are not in this step.** Due dates are
   stored, so the reminder job in the next step can use them.
5. **Repeating events** (e.g. "every Sunday") come in the next step too.
6. **Arabic layout:** we flip the layout ourselves so the language can change
   instantly without a restart. The one side effect: on phones, the small
   "back" arrow in the top bar stays on the left in Arabic.

## Speed checks (performance standard)

- **Database:** with 5,000 test families (10,000 children, 265,000 vaccine
  records, 100,000 events), every screen's query uses an index and runs in
  under 1 ms. The check caught one slow query, the children list, which took
  **78.9 ms**. A change to the security rules fixed it, and it now takes
  **0.15 ms**. You can re-run the check with `supabase/perf/query-plans.sql`.
- **Fewer round trips:** each screen sends its requests at the same time. The
  vaccine name comes in the same request as the dose, not one request per row.
- **No flashing:** grey loading placeholders appear only if loading takes
  longer than 0.4 s.
- **Saving a vaccine dose is not "optimistic":** it's a health record, so the
  button shows "saving" and the screen only closes after the server confirms.
- **Web preview, first load** (Chromium, DevTools "Slow 4G" values: 562.5 ms
  latency and 180 KB/s down, plus 4x CPU slowdown, cache off, 3 runs): first
  screen visible in 6.47–6.57 s, largest paint 6.24–6.38 s, 377 KB transferred.
  This is the first measurement, so there is nothing earlier to compare it to.
  It is the **web preview only**. The phone app loads its code from the
  phone, so it needs its own measurement on a real low-end Android phone.
  That hasn't been done yet.

## What's next (build plan)

- Reminders for vaccines and events (server-scheduled push notifications).
- Repeating events.
- Supplies tracker (step 4 of the plan).
- Deploying Supabase on a Kuwait-region server.
