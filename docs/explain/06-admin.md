# Step 6 explained: the admin panel, team roles and review before publishing

*Written for Ezzo, in plain language. Date: 21 November 2026.*

## What your team can do now

There is a website for the Yahal team (`apps/admin`). Staff sign in with their phone and an SMS code, the same way parents do. There are no passwords.

| Page | What it's for |
| --- | --- |
| Overview | What is waiting for review, and what you're allowed to publish |
| Directory | Add and confirm hospitals, doctors, nurseries, schools, activities and stores |
| Offers | Add toy and kids' clothing offers (formula is impossible) |
| Government guides | Edit guides and their steps, and set "last verified on" |
| Brands | The A to Z brand list, plus the "needs store check" flag |
| Suggested supplies | The age-based list. This is health content. |
| Vaccination schedule | Health reviewer: write the note parents see, and mark the schedule as checked |
| Staff | Super admin: add team members and set their roles |
| Audit log | Super admin: every change, who made it and when |

**Content moves draft → in review → published.** "Published" is the only state parents see.

## Roles (checked by the database, not the website)

| Role | Can do |
| --- | --- |
| **Editor** | Write and edit everything. Publish directory, offers, guides and brands. Can't publish health content. If an editor changes something already published in health content, it goes back to "in review" by itself. |
| **Health reviewer** (paediatrician / health advisor) | Everything an editor can, plus publish health content and sign off the vaccination schedule |
| **Super admin** | Add and remove staff, read the audit log, publish non-health content. As your PRD says, a super admin can't publish health content. A super admin also can't change their own role, so you can't lock yourself out by mistake. |

Hiding buttons on the website is only a convenience. The real rules are in the database, so even someone calling the server directly with their own login can't skip them. 16 database tests prove this.

**Staff never see family data.** Being staff gives no access to children, calendars, supplies or anything else that belongs to a family. One test checks this directly.

**Every change is recorded** in the audit log: old value, new value, role and time. Nobody can edit or delete the log, including super admins.

## How it was checked

- **Database tests: 103 of 103 pass.** The 16 new ones check, among other things, that:
  - a parent can't make themselves staff;
  - an editor can't publish health content, and their edit to published health content goes back to review;
  - a health reviewer can publish it again;
  - staff can't see families;
  - the audit log records changes and can't be deleted.
- **Click-through of the real admin website** with three team members:
  1. A phone that isn't staff sees "Not a staff account".
  2. The super admin adds an editor and a health reviewer from the Staff page.
  3. The editor publishes a nursery.
  4. An `http://` website link is refused.
  5. On suggested supplies, the editor gets no Publish button, and their edit goes back to review.
  6. The health reviewer publishes it.
  7. The super admin sees 6 audit entries, and the editor sees none.

  There were no errors.
- The admin site builds to a plain static website. CI now type-checks and builds it on every PR.

## What you need to do

1. **Make yourself the first super admin.** Sign in to the admin panel once with your phone, then run this in the database (Supabase SQL editor, on the server):

   ```sql
   insert into public.staff (user_id, role, display_name)
   select id, 'super_admin', 'Ezzo' from auth.users where phone = '965XXXXXXXX';
   ```

   After that, add the team from the Staff page.
2. **Host the panel** as a static site (the `out/` folder after `npm run build`), on an address such as `admin.yahal.app`. Allow only your team's network or a VPN if you can.
3. **Choose a health reviewer:** a paediatrician who will approve health content and sign off the vaccination schedule.

## Known limits

- The panel is in English. Content is entered in both Arabic and English. An Arabic interface for the panel can come later.
- Changing vaccine doses needs a new schedule version (a database migration), not an edit in the panel. This keeps every family's dose records consistent.
- Adding photos to listings comes later, together with image storage.
