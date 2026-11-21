-- =============================================================================
-- Kuwait MOH childhood immunisation schedule (reference data)
-- =============================================================================
-- Source: "Ministry of Health – State of Kuwait / Kuwait Childhood Immunization
-- Schedule 2019" (the version we could read). MOH has published a 2025 schedule
-- (https://www.moh.gov.kw/UserRefs/PublicHealth/KuwaitImmunization2025En.pdf)
-- that could not be downloaded while building this. A health reviewer MUST
-- compare this list with the 2025 schedule before launch, then publish a new
-- version ('kw-moh-2025') and make it current. Existing children keep the
-- doses they already have; that switch-over will be its own migration.
--
-- Ages are "end of month N" as written by MOH. The pregnant-mother tetanus
-- doses are left out (the app tracks children). Ages above 10 years
-- (16–18 years Td booster) are left out because Yahal covers 0–10.
-- =============================================================================

with v as (
  insert into public.vaccine_schedule_versions
    (code, title_ar, title_en, source_url, review_note_ar, review_note_en, is_current, published_at)
  values (
    'kw-moh-2019',
    'جدول التطعيمات الأساسية للأطفال – وزارة الصحة الكويتية (2019)',
    'Kuwait MOH Childhood Immunization Schedule (2019)',
    'https://www.moh.gov.kw/UserRefs/PublicHealth/KuwaitImmunization2025En.pdf',
    'بانتظار المراجعة مقارنةً بجدول وزارة الصحة 2025.',
    'Pending review against the MOH 2025 schedule.',
    true,
    now()
  )
  returning id
)
insert into public.vaccine_doses
  (version_id, vaccine_code, name_ar, name_en, dose_label_ar, dose_label_en, age_months, only_gender, sort_order)
select v.id, d.vaccine_code, d.name_ar, d.name_en, d.dose_label_ar, d.dose_label_en, d.age_months, d.only_gender, d.sort_order
from v, (values
  -- Birth (within 24 hours)
  ('HBV',     'التهاب الكبد الوبائي (ب)',               'Hepatitis B (HBV)',            'الجرعة الأولى',  'Dose 1',          0.0, null, 10),
  -- End of 2nd month
  ('IPV',     'شلل الأطفال (حقن)',                     'Polio injection (IPV)',        'الجرعة الأولى',  'Dose 1',          2.0, null, 20),
  ('DTP-HBV-Hib', 'الثلاثي البكتيري + الكبد (ب) + المستدمية النزلية', 'DTP + Hepatitis B + Hib', 'الجرعة الأولى', 'Dose 1', 2.0, null, 21),
  ('PCV',     'المكورات الرئوية',                      'Pneumococcal (PCV)',           'الجرعة الأولى',  'Dose 1',          2.0, null, 22),
  ('ROTA',    'فيروس الروتا (فموي)',                   'Rotavirus (oral)',             'الجرعة الأولى',  'Dose 1',          2.0, null, 23),
  -- End of 3rd month
  ('BCG',     'الدرن (BCG)',                           'Tuberculosis (BCG)',           'جرعة واحدة',     'Single dose',     3.0, null, 30),
  -- End of 4th month
  ('IPV',     'شلل الأطفال (حقن)',                     'Polio injection (IPV)',        'الجرعة الثانية', 'Dose 2',          4.0, null, 40),
  ('DTP-HBV-Hib', 'الثلاثي البكتيري + الكبد (ب) + المستدمية النزلية', 'DTP + Hepatitis B + Hib', 'الجرعة الثانية', 'Dose 2', 4.0, null, 41),
  ('PCV',     'المكورات الرئوية',                      'Pneumococcal (PCV)',           'الجرعة الثانية', 'Dose 2',          4.0, null, 42),
  ('ROTA',    'فيروس الروتا (فموي)',                   'Rotavirus (oral)',             'الجرعة الثانية', 'Dose 2',          4.0, null, 43),
  -- End of 6th month
  ('IPV',     'شلل الأطفال (حقن)',                     'Polio injection (IPV)',        'الجرعة الثالثة', 'Dose 3',          6.0, null, 60),
  ('DTP-HBV-Hib', 'الثلاثي البكتيري + الكبد (ب) + المستدمية النزلية', 'DTP + Hepatitis B + Hib', 'الجرعة الثالثة', 'Dose 3', 6.0, null, 61),
  ('PCV',     'المكورات الرئوية',                      'Pneumococcal (PCV)',           'الجرعة الثالثة', 'Dose 3',          6.0, null, 62),
  ('ROTA',    'فيروس الروتا (فموي)',                   'Rotavirus (oral)',             'الجرعة الثالثة (عند استخدام RV5)', 'Dose 3 (only if RV5 is used)', 6.0, null, 63),
  -- End of 12 months
  ('OPV',     'شلل الأطفال (فموي)',                    'Polio drops (OPV)',            'الجرعة الأولى',  'Dose 1',         12.0, null, 120),
  ('MMR',     'الحصبة والنكاف والحصبة الألمانية',       'Measles, Mumps, Rubella (MMR)', 'الجرعة الأولى', 'Dose 1',         12.0, null, 121),
  ('VAR',     'جدري الماء',                            'Chickenpox (Varicella)',       'الجرعة الأولى',  'Dose 1',         12.0, null, 122),
  ('MEN',     'الحمى الشوكية المقترن',                  'Meningococcal conjugate',      'جرعة واحدة',     'Single dose',    12.0, null, 123),
  -- 18 months
  ('OPV',     'شلل الأطفال (فموي)',                    'Polio drops (OPV)',            'الجرعة الثانية', 'Dose 2',         18.0, null, 180),
  ('DTP-HBV-Hib', 'الثلاثي البكتيري + الكبد (ب) + المستدمية النزلية', 'DTP + Hepatitis B + Hib', 'جرعة منشطة', 'Booster', 18.0, null, 181),
  ('PCV',     'المكورات الرئوية',                      'Pneumococcal (PCV)',           'جرعة منشطة',     'Booster',        18.0, null, 182),
  -- End of 2 years
  ('MMR',     'الحصبة والنكاف والحصبة الألمانية',       'Measles, Mumps, Rubella (MMR)', 'الجرعة الثانية', 'Dose 2',        24.0, null, 240),
  ('VAR',     'جدري الماء',                            'Chickenpox (Varicella)',       'الجرعة الثانية', 'Dose 2',         24.0, null, 241),
  -- End of 3.5 years
  ('OPV',     'شلل الأطفال (فموي)',                    'Polio drops (OPV)',            'جرعة منشطة',     'Booster',        42.0, null, 420),
  ('DTP',     'الثلاثي البكتيري',                      'DTP',                          'جرعة منشطة',     'Booster',        42.0, null, 421),
  -- 10–12 years (at school)
  ('MMR',     'الحصبة والنكاف والحصبة الألمانية',       'Measles, Mumps, Rubella (MMR)', 'جرعة منشطة (للإناث)', 'Booster (girls)', 120.0, 'girl', 1200),
  ('Td',      'الكزاز والدفتيريا',                     'Tetanus + Diphtheria (Td)',    'جرعة منشطة',     'Booster',       120.0, null, 1201)
) as d(vaccine_code, name_ar, name_en, dose_label_ar, dose_label_en, age_months, only_gender, sort_order);
