# Special needs support

## What you can do now

- **Tell Yahal about your child's needs (optional).** The child form has a new "Special needs (optional)" part: when you add your first child, add another child, or edit a child. You pick any of 11 needs (autism, ADHD, speech and language, hearing, vision, physical or mobility, learning difficulties, Down syndrome, developmental delay, chronic condition, other). Then you can add a short note and say whether the child has a disability card from the Public Authority for Disabled Affairs (PADA). Pick nothing and nothing is saved.
- **Family tab:** under the child's name you see their needs, for example "Autism · Speech and language".
- **Tips:** the child's tips page and the Home tip now include tips for their needs (13 new tips, for example a picture schedule for autism, or checking hearing aids every morning). A child only sees tips for needs they have.
- **Supplies:** "Suggested list" adds items for their needs (11 new items, such as visual schedule cards, ear defenders, hearing aid batteries, an adaptive spoon and cup, and a medicine organiser).
- **Calendar:** a new event type, "Therapy", so weekly speech or physio sessions repeat and remind both parents.
- **Explore, Government guides:** three new guides from PADA's official services (disability file and card, services and benefits, school support and early intervention). For a child with needs, these come first.
- **Explore, Directory:** when a child in the family has needs, the "Special needs" filter starts switched on, so therapy centres and places that serve these needs show first. You can switch it off. (The directory data itself is the directory work.)

## How the data is protected

This is sensitive health data, so it gets the strictest handling in the app:

- **Only your family can see it.** It sits in its own table with database rules (RLS) that let only the two parents of that family read or change it. A signed-out visitor or another family gets nothing, and a test proves it.
- **The family comes from the child, not the app.** Saving goes through one server function that looks up the child's family itself, so the app can't attach a profile to someone else's child.
- **The AI never sees it.** The AI tips feature sends only the child's age in months and gender, and it is only given the general tips, never the special needs tips. So nothing about a child's needs leaves our servers.
- **It is in "Download my data"**, and it is deleted when you delete the child or your account.
- **No diagnosis papers, no civil ID.** We only keep the need categories, a 300-character note and a yes/no about the card.

## What I tested

- 173 database tests pass, including 22 new ones: the other parent can see the profile, another family can't (by reading, inserting, or through the save function), unknown needs and long notes are refused, deleting the child deletes the profile, the export includes it, a child with autism gets autism tips but not hearing tips, and a child without needs gets only general tips.
- In the browser (Arabic): onboarding with "Autism" and "Speech and language", the Family tab, tips, edit (the choices come back), suggestions, a therapy event, guides order and the directory filter. No errors in the console.
- A bug I caught while testing: saving the profile right after adding the child was refused by the database (the "upsert" needed more rights than we give). I replaced it with the server function above. I also made sure that if the second step ever fails, tapping Save again won't add the child twice.

## Before launch (added to the list in `09-launch.md`)

- A paediatrician or specialist reads the special needs tips and supplies (they are marked "pending specialist review").
- Your team checks the PADA guides with PADA and sets "Last verified".
- The lawyer adds this profile to the privacy notice as sensitive health data. The store "Data safety" answers in `docs/launch/store-listing.md` are already updated.

## Screenshots

`/mnt/project-files/docs/screenshots/special-needs-child-form.png` and `special-needs-family-tips-supplies-guides.png`.

## Also in this PR: a clear message when the account is gone

Found in phone testing: if the account was deleted (for example with "Delete my account" on the other phone, or a test database reset), the phone kept its old session. "Create family" was then refused and the app wrongly said "check your internet connection", with no way out.

Now:
- When the app opens, it asks the sign-in service once whether the account still exists. If the service says it doesn't, the app signs out on this phone.
- If a request is refused in a way that can mean "this account is gone", the app checks again the same way and signs out if needed.
- The sign-in screen then says: "Your session has ended or this account no longer exists. Please sign in again."
- A network problem never signs anyone out. Only a clear answer from the sign-in service does.
- The onboarding screens (create family, first child) now have a "Sign out" link, so nobody gets stuck there.

Tested in the browser: deleting the account while the app is open, deleting it while the app is closed and then reopening, and the new sign-out link.
