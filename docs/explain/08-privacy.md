# Step 8 explained: privacy, export your data, delete your account

*Written for Ezzo, in plain language. Date: 21 November 2026.*

## What parents can do now

There is a new page: **Family > Privacy and your data**.

- **Read the privacy notice.** The notice can also be opened from the "create family" screen, *before* the parent agrees to it. Until now, the consent box said "I have read the privacy notice", but there was no notice to read.
- **Download a copy of my data.** One file (JSON) holds everything we keep about this parent and their family:
  - their phone number and profile;
  - the family and both parents' roles;
  - children, calendar events, vaccinations, supplies and guide progress;
  - notification settings and the notifications sent;
  - their phones (platform only);
  - the times they used AI.

  The database builds the file and only includes this family's data. It leaves out:
  - the other parent's phone number;
  - the phone's push token, because it works like a password for sending notifications.
- **Delete my account permanently.** The parent has to type **حذف** (or DELETE in English) before the button works. The database also refuses without the confirmation word, so a stray call can't delete anything.
  - **The family owner:** their account *and the whole family* are deleted, including children, calendar, vaccinations, supplies, guide progress and invites. The other parent keeps their login but loses access to the family. The screen says this clearly before they confirm.
  - **The co-parent:** only their own account and settings are deleted, and the family stays with the owner.
  - **Afterwards:** the app signs out by itself. If the person signs in again with the same phone, they start a new, empty account.
  - **Team (staff) accounts:** these can't delete themselves here. A super admin removes them from the team first, so the team can't lose its last admin by accident.

**A medical note on every health screen.** It reads "General information, not medical advice. Always check with your child's doctor. In an emergency call 112." This is what PRD 10.3 asks for. It appears on:
- the vaccination schedule;
- each vaccine dose;
- suggested supplies;
- tips.

## How it was checked

- **Database tests: 125 of 125 pass.** The 16 new ones prove:
  - the export holds my own phone, my child, my calendar, supplies and vaccinations;
  - it holds nothing from another family, and not the other parent's phone;
  - deleting needs the confirmation word;
  - a co-parent who deletes leaves the family intact;
  - an owner who deletes removes the family, children, calendar and supplies, and other families are untouched;
  - staff can't delete themselves.
- **Click-through in the web preview** in Arabic:
  1. Read the notice before agreeing.
  2. Create a family and a child.
  3. Download the data. The file held the child, 27 vaccination doses and the phone number, and took 54 ms.
  4. The delete button stays disabled until "حذف" is typed.
  5. Delete the account. The app returned to the sign-in screen.
  6. Signing in again with the same phone gave a brand-new account.

  One error was expected: the browser logged a refused "sign out" call, because the account had already been deleted. It doesn't show on phones and has no effect.

## What you need to do

1. **Legal review of the privacy notice** (`apps/mobile/src/lib/i18n/privacyNotice.ts`) against Kuwait's CITRA Data Privacy Protection Regulation. Fill in the parts in [brackets]:
   - the company's legal name;
   - the privacy contact email;
   - the SMS provider;
   - how many days server backups are kept.

   When the final text is approved:
   - add a new version (for example `privacy-2026-12`) to the `privacy_versions` table;
   - set `PRIVACY_VERSION` in `apps/mobile/src/lib/api.ts` to match.
2. **Backups:** ask your Kuwait hosting provider how long database backups are kept. Deleted data stays in backups until they expire, and the notice must give that number.
3. **App stores:** Apple requires in-app account deletion. This is now done. Both stores ask you to fill in a "data safety / privacy nutrition" form, and this file and the notice give you the answers.
