# The Explore directory now has 148 real places in Kuwait

## What changed for parents

Explore → Directory used to list 6 government hospitals. It now lists **148 places** across all seven sections and all six governorates. Each card shows:

- the name, governorate and area, plus the street address when a source gives one;
- the **price** when a public source shows it (for example "KD 2,400 a year" or "KD 14 entry"), or "Price not published";
- a short note about the price, such as "fees vary by grade, check with the school" or "from an undated blog";
- "From a public source checked on 21 November 2026";
- the existing warning, "Details not yet confirmed by our team".

The Map button now works for every place: it opens the place's own map link, or a Google Maps search for its name and area.

## Where the data came from

Nothing was made up. Every listing has its source link and the date it was checked, which is stored with the row and visible in the admin panel.

| Section | Main sources |
| --- | --- |
| Hospitals | e.gov.kw list of government hospitals (phone numbers), Wikipedia list of hospitals in Kuwait, UK government list of medical facilities |
| Paediatricians | The hospitals' own paediatrics pages (New Mowasat, Kuwait Hospital), Al Mulla Group (Royale Hayat), daleeeel.com, zavis.ai |
| Nurseries and schools | edarabia.com school and nursery lists (fees and addresses) |
| Activities | ootlah.com, kuwaitexpat.com, Kuwait Times, hilitehomes.com |
| Toy stores | LEGO and Alshaya store locators, Retail Times (Hamleys) |
| Kids' clothing | Alshaya store locators (Mothercare, Next), Al Tayer (Mamas & Papas) |

Rules I followed:

- **Prices** are entered only when a source shows them. School fees are the yearly figure edarabia shows (fees vary by grade). Nursery fees on edarabia don't say the period, so the app shows the amount without "a year". No hospital or clinic publishes consultation fees, so those say "not published".
- **Phone numbers** are copied only from a source, and only if they fit the +965 8-digit format. Short numbers like 1826666 were left out.
- Discount prices from deal sites (for example "Future Kid from 1.5 KD on ootlah") go in the note, not as the price.
- Mothercare stores that the store locator no longer lists (Rawda, Salwa, Mubarak Al-Kabeer/Qurain) were left out. A 2012 Toys R Us address was left out because I couldn't confirm the store is still open.
- Governorates follow the official areas (for example The Avenues in Al-Rai is in Farwaniya, South Surra and Salwa are in Hawalli).

## How complete it is

| | Capital | Hawalli | Farwaniya | Mubarak Al-Kabeer | Ahmadi | Jahra | Total | With a price | With a phone |
|---|---|---|---|---|---|---|---|---|---|
| Hospitals | 5 | 3 | 1 | – | 1 | 1 | 11 | 0 | 8 |
| Paediatricians | 1 | 3 | – | 1 | 1 | 1 | 7 | 0 | 5 |
| Nurseries | 10 | 14 | – | 1 | 7 | – | 32 | 13 | 0 |
| Schools | 1 | 15 | 14 | 4 | 11 | 2 | 47 | 34 | 0 |
| Activities | 8 | 6 | 6 | 3 | 8 | 4 | 35 | 6 | 6 |
| Toy stores | – | – | 3 | – | – | – | 3 | 0 | 2 |
| Kids' clothing | 2 | 6 | 2 | – | 3 | – | 13 | 0 | 13 |
| **Total** | 27 | 47 | 26 | 9 | 31 | 8 | **148** | 53 | 34 |

This is a strong start, not a complete directory. The biggest gaps:

- **Toy stores:** only the three at The Avenues. Most toy shops in Kuwait have no public store list online.
- **Nurseries in Farwaniya and Jahra:** none found in public lists.
- **Mubarak Al-Kabeer and Jahra:** thin in every section.
- **Paediatricians:** these are hospital paediatrics departments, not individual doctors, and no fees are published.
- **Schools in the Capital:** edarabia lists many schools without an area, and those were skipped rather than guessed.
- Arabic names are my transliterations of the English names. Please check them.
- Government schools and Ministry of Health clinics aren't included yet.

## What the team should do next

1. In the admin panel (Directory), open each place, call or visit, correct anything wrong, then set **Verified on**. The "not yet confirmed" warning disappears for that place.
2. Fill the gaps above. When you add a price, add the source link and the date you checked; the database refuses a price without them.
3. To change many rows at once, edit `supabase/directory/places.csv` and run `node scripts/directory-csv-to-sql.mjs` to produce a new migration. Rows are matched by their `ref`, so this updates places instead of adding copies, and keeps the team's status and "Verified on".

If you would rather parents only see places the team has confirmed, one line of SQL can set all unconfirmed places to "In review", which hides them until they are checked.

## Speed

Measured on the local database with 20,000 published places (about 100× today), as a visitor so RLS is included, 3 runs each (`supabase/perf/directory.sql`):

| Directory query | Before | After |
| --- | --- | --- |
| One section, one governorate, page 3 | uses the existing index | 0.09–0.16 ms (unchanged index) |
| One section, all governorates, page 3 | 5.6–7.2 ms (reads every row, then sorts) | 0.05–0.08 ms (new index) |
| One section, name search | – | 3.7–8.5 ms |

The new `places (category, name_en, id)` index serves "All governorates". Name search still scans the section; a trigram index would speed it up but adds write cost and an extension, and isn't needed at today's size. Pages are still 20 places, ordered by name then id. Nothing here was measured on a phone or with network throttling: the change adds 7 columns to the same single request.
