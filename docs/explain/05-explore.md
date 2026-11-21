# Step 5 explained: Explore — government guides, directory and offers

*Written for Ezzo, in plain language. Date: 21 November 2026.*

## What a parent can do now

A new **Explore** tab, between Supplies and Family, has three parts.

**1. Government guides** (7 guides). Each one has steps, the documents to bring, and a link to the official site:
- Birth certificate
- Civil ID for your baby
- Child's passport, with a version for Kuwaiti families and one for residents
- Residency for your child (residents)
- Registering at the health centre
- Kindergarten and school registration

The app picks the right guides from the child's nationality group:
- **Kuwaiti:** Kuwaiti and general guides.
- **GCC / other:** resident and general guides.
- **Not set:** all guides.

Parents tick off each step for each child, and both parents see the ticks. Every guide shows a yellow warning, "Not yet checked against the official source", until someone verifies it and records the date.

**2. Directory.** Places are grouped into hospitals, paediatricians, nurseries, schools, activities, toy stores and kids' clothing.
- Parents can filter by governorate and search by name, in Arabic or English.
- Each place has **Call**, **WhatsApp**, **Map** and **Website** buttons, shown only when we have that detail.
- Results load 20 at a time, with *Show more*.
- It starts with 6 government hospitals that have children's departments. These have map links only, no phone numbers, until our team confirms them.

**3. Offers.** Toy and kids' clothing offers, which parents can filter by child so they see only offers for that child's age and gender. It's empty at the start: our team adds real offers, and I didn't invent any. **Formula offers are impossible.** The database only accepts the "toys" and "clothing" categories.

## How it's built

| Part | Where |
| --- | --- |
| Tables and security rules | `supabase/migrations/20261121160000_explore.sql` |
| Starter guides and hospitals | `supabase/migrations/20261121160100_explore_content.sql` |
| Database tests (10 new, 87 in total) | `supabase/tests/explore.test.sql` |
| Explore tab | `apps/mobile/src/app/(tabs)/explore.tsx` |
| Guide screen with tick boxes | `apps/mobile/src/app/guide/[id].tsx` |
| Which guides fit which child | `apps/mobile/src/lib/guides.ts` (+ 3 unit tests) |

**Security**
- Guides, places and offers are our content. Anyone can read the published ones, and parents can't change them.
- Only the family can see its guide progress.
- Links must be `https://`, phones must be +965 numbers, and Instagram must be a plain username. This stops harmful links being added, even by mistake.

**Speed**
- A guide and all its steps load in one request.
- The directory loads 20 places at a time through an index, and search waits until typing pauses before it runs.
- Ticking a step is instant. It goes back if saving fails.

## How it was checked

- **Database tests: 87 of 87 pass.** The new tests check that:
  - offers can't be for formula;
  - non-https links and non-Kuwaiti phones are refused;
  - visitors see published content but not drafts;
  - parents can't write guides;
  - another family can't see guide progress.
- **App tests: 13 of 13 pass.**
- **Click-through on the web preview** (Arabic, a 4-year-old Kuwaiti girl):
  - the resident-only guides were hidden;
  - ticking a step was saved;
  - all 6 hospitals showed, and search found "Jahra" and "Adan";
  - a test offer for ages 2–8 showed;
  - the 320 px small screen fits.
  - There were no console errors.
- **Small-screen fix:** with 5 tabs, "المستلزمات" was cut off on a 320 px screen, so the tab now says "اللوازم". The screen title stays "المستلزمات".

## What you need to do (can't be done in code)

1. **Check every guide** against PACI, the Ministry of Health, the Ministry of Interior and the Ministry of Education. Then set "last checked" in the admin panel (next step). The text is general on purpose: it tells parents to confirm current documents and fees.
2. **Fill the directory.** Your team confirms each place by phone or a visit (phone, WhatsApp, hours, age range), then marks it confirmed.
3. **Offers:** add real offers from stores you talk to.
