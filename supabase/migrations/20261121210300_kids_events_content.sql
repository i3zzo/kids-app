-- Kids' and family events from public sources, checked 21 November 2026.
-- verified_on stays null until the team confirms the dates with the organiser.
-- Winter Wonderland season 5 (2026/27) is not listed: its dates and prices
-- had not been announced when checked.
insert into public.kids_events (ref, title_ar, title_en, venue_ar, venue_en, governorate, area_ar, area_en, description_ar, description_en,
  starts_on, ends_on, hours_ar, hours_en, url, source_url, source_checked_on, status) values
  ('kuwait-international-book-fair-2026', 'معرض الكويت الدولي للكتاب الـ 49', '49th Kuwait International Book Fair',
   'أرض المعارض الدولية (القاعات 5 و6 و7)', 'Kuwait International Fairground (Halls 5, 6 and 7)', 'hawalli', 'مشرف', 'Mishref',
   'معرض الكتاب السنوي، وفيه كتب للأطفال. الكتب الإنجليزية في القاعة 6.', 'The yearly book fair, with children''s books. English books are in Hall 6.',
   '2026-11-18', '2026-11-28',
   'يومياً 9:00–13:00 و16:30–22:00، الجمعة 15:30–22:00، السبت 10:00–22:00', 'Daily 9:00–13:00 and 16:30–22:00, Fri 15:30–22:00, Sat 10:00–22:00',
   'https://bookfair.nccal.gov.kw/en/', 'https://248am.com/mark/shopping/your-guide-to-english-books-at-the-kuwait-book-fair-2/', '2026-11-21', 'published');
