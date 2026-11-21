# Step 4 explained: supplies tracker and suggested items by age

*Written for Ezzo, in plain language. Date: 21 November 2026.*

## What a parent can do now

- **A new Supplies tab**, between Calendar and Family. Each child has their own list, grouped into feeding, diapering, health, teeth, learning and play, and clothing. Both parents share it.
- **Quick − / + buttons** change the quantity right away. If the internet drops, the number goes back and a message appears.
- **A "low" level for each item.** When the quantity reaches it, the item shows **Running low**. At zero it shows **Finished**. These items also appear on Home under "Running low".
- **Suggested list for the child's age.** Tap *Suggested list* for a list matched to the child's age. Add items one by one, or all at once with one tap.
  - As you decided, gender changes only the clothing, milk and diaper suggestions. Everything else is the same for boys and girls.
- **Brands sold in Kuwait.** Diapers, wipes, formula and baby-care items list brands from the big supermarkets, in alphabetical order with no ranking or promotion. When adding an item, these brands appear as quick choices.
- **Infant formula rule.** Every formula suggestion says "Breastfeeding is best where possible. Ask your paediatrician before choosing or changing formula." It has no offers or promotions.
- **Reminder at 6 pm.** Once a day, if something is low or finished, each parent gets one reminder per child, for example "Noor: 3 items are running low or finished." Tapping it opens Supplies. A parent can switch this off in Family → Notifications.

## How it's built

| Part | Where |
| --- | --- |
| Supplies tables, security rules, 6 pm reminder | `supabase/migrations/20261121150000_supplies.sql` |
| Starter suggestions (38 items, Arabic and English) and brands (17) | `supabase/migrations/20261121150100_supply_content.sql` |
| Database tests (14 new, 77 in total) | `supabase/tests/supplies.test.sql` |
| Supplies tab | `apps/mobile/src/app/(tabs)/supplies.tsx` |
| Add / edit an item | `apps/mobile/src/components/SupplyForm.tsx`, `src/app/supply/` |
| Suggested list | `apps/mobile/src/app/supplies/suggestions.tsx` |

- **Security:**
  - Only the family's two parents can see or change its supplies, as with the calendar.
  - Brands and suggestions are our own content. Parents can read the published ones but can't change them. Our team edits them in the admin panel, which comes in a later step.
  - A child can have at most 300 items.
  - Names can't contain hidden direction-flipping characters.
- **Speed:**
  - The supplies list and the "running low" list each use their own index.
  - "Add all" sends one request for all the items, not one per item.
  - The suggestions screen loads the child, the suggestions, the brands and the existing list in parallel.

## How it was checked

- **Database tests: 77 of 77 pass.** They check that:
  - the "running low" flag follows the quantity;
  - quantities can't go below zero;
  - another family can't see the supplies or add to them, even with the ids;
  - parents can't add brands;
  - a boy gets no girls-only suggestions;
  - every formula suggestion has the notice;
  - the 6 pm reminder is sent once per child per day.
- **Click-through on the web preview** (Arabic, a 7-month-old boy):
  - the suggested list showed 22 items, with the boys' clothing item, no girls' item, and the formula notice;
  - "Add all" added them in one go;
  - adding "night diapers" with the Pampers chip and then pressing + twice saved 5 in the database;
  - Home showed the "Running low" section;
  - no console errors.

## What you need to do (can't be done in code)

1. **Store check of the brands.** The 17 brands are examples from the PRD. Someone should confirm each one on the shelf at The Sultan Center, LuLu, Carrefour and a co-op. Each brand has a "needs store check" flag for this, which the admin panel will let you clear.
2. **Health review.** A paediatrician should read the health, feeding and teeth hints (for example the fever medicine and toothpaste notes) before launch.
3. **Formula marketing rules.** Before adding any offers near formula, check Kuwait's rules on marketing breast-milk substitutes. The app currently shows none.
