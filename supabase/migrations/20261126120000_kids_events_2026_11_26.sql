-- Kids' events found in the weekly refresh, checked 26 November 2026.
-- Added as drafts for the team to review and publish in the admin panel.
-- verified_on stays null until the team confirms the dates with the organiser.
--
-- Trampo Winter Camp runs at two venues, so it has one row per venue.
-- No upper age is published (only "Ages 4+"), so max_age_months keeps the default.
-- The Murouj row has no governorate or area: the page does not give an address
-- for Murouj, so the team should set them when reviewing.
--
-- Not listed: Winter Wonderland season 5 (2026/27), because TEC had not
-- published its opening date or prices when checked.
insert into public.kids_events (ref, title_ar, title_en, venue_ar, venue_en, governorate, area_ar, area_en, description_ar, description_en,
  starts_on, ends_on, hours_ar, hours_en, min_age_months, price_min_kwd, price_max_kwd, price_note_ar, price_note_en,
  url, source_url, source_checked_on, status) values
  ('trampo-winter-camp-2026-jaber-mall', 'مخيم ترامبو الشتوي في جابر مول', 'Trampo Winter Camp at Jaber Mall',
   'ترامبو، جابر مول', 'Trampo, Jaber Mall', 'jahra', 'مدينة جابر الأحمد', 'Jaber Al-Ahmad City',
   'مخيم شتوي للأطفال من عمر 4 سنوات فما فوق، من الأحد إلى الخميس لمدة أربعة أسابيع. يشمل وجبات خفيفة وغداء كل يوم. لم يُذكر حد أعلى للعمر.',
   'A winter camp for children aged 4 and up, Sunday to Thursday for four weeks. Snacks and lunch are included every day. No upper age is published.',
   '2026-12-13', '2027-01-07',
   'من الأحد إلى الخميس 9:00–15:00', 'Sun–Thu 9:00–15:00', 48, 15, 22,
   'يوم واحد 22 د.ك، 5 أيام 90 د.ك، 10 أيام 175 د.ك، 15 يوماً 225 د.ك. خصم 15% للتسجيل المبكر حتى 6 ديسمبر، وخصم 10% للإخوة.',
   '1 day 22 KD, 5 days 90 KD, 10 days 175 KD, 15 days 225 KD. 15% early-bird discount until 6 December, 10% off for siblings.',
   'https://trampo.com.kw/camps/winter', 'https://trampo.com.kw/camps/winter', '2026-11-26', 'draft'),
  ('trampo-winter-camp-2026-murouj', 'مخيم ترامبو الشتوي في المروج', 'Trampo Winter Camp at Murouj',
   'ترامبو، المروج', 'Trampo, Murouj', null, null, null,
   'مخيم شتوي للأطفال من عمر 4 سنوات فما فوق، من الأحد إلى الخميس لمدة أربعة أسابيع. يشمل وجبات خفيفة وغداء كل يوم. لم يُذكر حد أعلى للعمر.',
   'A winter camp for children aged 4 and up, Sunday to Thursday for four weeks. Snacks and lunch are included every day. No upper age is published.',
   '2026-12-13', '2027-01-07',
   'من الأحد إلى الخميس 9:00–15:00', 'Sun–Thu 9:00–15:00', 48, 15, 22,
   'يوم واحد 22 د.ك، 5 أيام 90 د.ك، 10 أيام 175 د.ك، 15 يوماً 225 د.ك. خصم 15% للتسجيل المبكر حتى 6 ديسمبر، وخصم 10% للإخوة.',
   '1 day 22 KD, 5 days 90 KD, 10 days 175 KD, 15 days 225 KD. 15% early-bird discount until 6 December, 10% off for siblings.',
   'https://trampo.com.kw/camps/winter', 'https://trampo.com.kw/camps/winter', '2026-11-26', 'draft')
on conflict (ref) do nothing;
