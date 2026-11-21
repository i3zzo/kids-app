# Step 3 explained: reminders, repeating events and notification settings

*Written for Ezzo, in plain language. Date: 21 November 2026.*

## What a parent can do now

- **Repeating events.** When adding an activity, pick *Once*, *Daily*, *Weekly* or *Monthly*, and optionally an end date. "Swimming every Tuesday at 4 pm" is saved once and shows on every Tuesday in the calendar and on Home. A ↻ mark shows it repeats.
- **A reminder per event.** *None*, *At start*, *15 min before*, *1 hour before* (the default) or *1 day before*. A 🔔 mark shows it has one.
- **Vaccination reminders.** These arrive at 9 am Kuwait time, a set number of days before (1, 3 or 7 days; 3 by default) and again on the day. They say only "Noor has a vaccination in 3 days" and don't name the vaccine, so nothing medical shows on a locked screen.
- **Both parents get them.** Each parent chooses their own settings: vaccine reminders on or off, activity reminders on or off, and quiet hours (22:00 to 07:00 by default). During quiet hours a reminder still arrives, but without sound.
- **Turn on reminders card.** The phone asks for notification permission only when the parent taps *Turn on reminders* (on Home, or Family → Notifications). There's no surprise pop-up at first launch. If they said no before, the card links to the phone's settings.
- **Tapping a reminder** opens that event or that vaccine dose in the app.
- **Language.** Reminders are written in the language the parent uses in the app.

## How it works (the short version)

1. The phone gets a "push address" from Expo (Expo's free push service, which passes messages on to Apple and Google) and gives it to our database. A parent can only see or remove their own phones, and an account can have at most 5 phones.
2. Every 5 minutes, the database itself runs a job (`pg_cron`). The job finds reminders that are due, writes each one once into an outbox (`notification_log`), and sends the batch to Expo (`pg_net`). The app is not involved, so reminders arrive even if nobody has opened the app for weeks.
3. On sign-out, the app removes this phone from the account first, so a shared or sold phone stops getting the family's reminders.

All of the rules (who gets what, which language, quiet hours, never twice) run on the server, as you asked. The app only shows settings and passes on the push address.

| Part | Where |
| --- | --- |
| Tables, reminder job, sending | `supabase/migrations/20261121140000_reminders.sql` |
| Database tests (16 new, 63 in total) | `supabase/tests/reminders.test.sql` |
| Asking permission, push address, tap to open | `apps/mobile/src/lib/notifications.ts` |
| Working out the dates of repeating events | `apps/mobile/src/lib/recurrence.ts` (+ 6 unit tests) |
| Settings screen | `apps/mobile/src/app/settings/notifications.tsx` |
| Event form (repeat + reminder) | `apps/mobile/src/components/EventForm.tsx` |

## How it was checked

- **Database tests: 63 of 63 pass.** They check that:
  - repeating dates are worked out correctly, including "monthly on the 31st", which falls on the last day of shorter months;
  - an event reminder goes to both parents, each in their own language;
  - vaccine reminders name the child but not the vaccine;
  - running the job again sends nothing twice;
  - junk push addresses are refused;
  - a parent can't see the other parent's phones;
  - a parent can't run the job themselves.
- **App unit tests:** 10 of 10 pass, including the repeating-event dates.
- **Click-through on the web preview:**
  - created a weekly event with a 1-hour reminder, and it appeared on all 4 remaining Saturdays in the month view;
  - changed the vaccine reminder to 1 week before and saved, and the setting was stored in the database;
  - no errors in the console.
- **Android build check:** the build adds only the notification permission, plus "restart reminders after the phone reboots", from the notifications library. The earlier blocks (files, drawing over apps) are still in place.

**Not tested yet:** a real push arriving on a phone. That needs your Expo project ID (below) and a real phone, because simulators and the web preview can't receive pushes.

## What you need to do (can't be done in code)

1. **Expo project ID:** run `npx eas init` once in `apps/mobile` with your Expo account. It adds `extra.eas.projectId` to `app.json`. Until then, the app says reminders aren't available and everything else works.
2. **iPhone push key:** on your first `eas build -p ios`, let EAS create the Apple push key (it asks). You need your Apple Developer account for this.
3. **Android:** on your first `eas build -p android`, upload the Firebase (FCM) key in the Expo dashboard. Expo's guide is "Push notifications setup → Android FCM credentials".
4. **Optional, recommended:** create an Expo access token with "enhanced push security" turned on. Store it in the server's Vault under the name `expo_access_token`. It's never put in the code.
5. **Testing on your phone:** Expo Go on Android can't receive remote pushes. Use a development build (`eas build --profile development`) to test reminders.
