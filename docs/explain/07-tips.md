# Step 7 explained: tips by age, and AI personalisation

*Written for Ezzo, in plain language. Date: 21 November 2026.*

## What parents see now

- **Tip of the day on Home.** Each child gets one tip for their age. It stays the same all day, so both parents see the same one, and it changes the next day. Tapping it opens all tips.
- **A tips page for each child** (Home, or the "Tips" button on the Family tab). It groups tips into sleep, feeding, activities, learning and health, for the child's age right now. A notice at the top says this is general information, not medical advice.
- **"Personalise with AI"** under each section. The AI rewrites the reviewed tips for this child as a few short points, and the answer appears word by word as it's written. The answer is labelled "Personalised by AI and may be wrong. Not medical advice". Parents can stop it at any time.

## The tips library

- There are 40 starter tips: 8 age bands (0–3 months up to 7–10 years) × 5 sections, in Arabic and English. They are based on general WHO and AAP guidance.
- **They still need a paediatrician to read them before launch.** Each tip says so in its "source" field.
- Tips are **health content**. In the admin panel ("Tips library"), only a health reviewer can publish one. If an editor changes a published tip, it goes back to "in review" by itself. The same rules as suggested supplies apply, and they are checked by the database.

## How the AI part is kept safe

| Concern | What we did |
| --- | --- |
| Child's privacy | The server sends the AI **only the age in months and the gender** ("7 months old, girl"). It never sends the name, birth date or anything else. I checked the exact request the AI received. |
| Made-up medical advice | The AI is told to use **only our reviewed tips** for that age and section, never to diagnose, never to name doses, products or brands, and to say "see the doctor" for anything that could be a health problem. Parents can't type free text into it, so it can't be steered. |
| Secret key | The AI key lives only on the server (Supabase secrets). The app never sees it. |
| Someone else's child | The server looks up the child with the parent's own login, so the database rules apply. Asking about another family's child returns "not found". |
| Cost and abuse | Each parent can make at most **20 AI requests a day**. The database counts them. Request 21 gets "You have reached today's limit". |
| AI not set up yet | The app says "Personalised tips are not available right now". The reviewed tips still show. |

## How it was checked

- **Database tests: 109 of 109 pass.** The 6 new ones check that visitors can read the published tips, the right tips come back for a given age, an editor can't publish a tip, a parent can't write one, and the 20-a-day limit.
- **AI prompt tests: 4 of 4 pass**, including that the child's name never reaches the prompt. CI now runs them on every PR.
- **App unit tests: 16 of 16 pass** (3 new, for tip of the day).
- **Click-through in the web preview** in Arabic, with a 7-month-old girl:
  1. Home shows a tip of the day.
  2. The tips page shows all 5 sections.
  3. "Personalise with AI" streams an answer.
  4. There were no errors.
- **Speed, measured.** I used a stand-in AI server on this computer that waits 600 ms before its first word, like a real one.
  - The first words appeared on screen **871 ms** after tapping, so our own part (app, server function, database checks) added about 270 ms.
  - The full answer took 1.6 s.
  - Real speed depends on the AI model you choose. Measure it again with your real key.
- **Daily limit.** Checked against the running server, it returns "daily limit" as expected.

## What you need to do

1. **Get an OmniRoute key and choose a model.** Pick a model from a provider that **doesn't train on API data** and can handle Arabic well. Fix it to that one model, not "auto", so answers stay consistent. Then put the URL, key and model on the server:
   ```bash
   npx supabase secrets set --env-file supabase/functions/.env
   npx supabase functions deploy tips-ai
   ```
2. **Ask a paediatrician to read the 40 tips** in the admin panel. Give them the health reviewer role so they can fix and publish the tips themselves.
3. Try "Personalise with AI" on a phone in Arabic, and tell me if the tone or length needs changing.
