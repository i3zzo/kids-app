-- =============================================================================
-- Starter content: suggested supplies by age, and brands sold in Kuwait
-- =============================================================================
-- Draft content written for launch. Before going live:
--   * Brands: check each one on the shelf at The Sultan Center, LuLu,
--     Carrefour and a co-op, then set needs_store_check = false.
--   * Health items: a paediatrician should read the health and feeding hints.
-- The admin panel (a later step) will let the team edit and re-publish these.
-- =============================================================================

-- Brands, listed alphabetically in the app. No ranking, no paid placement.
insert into public.brands (kind, name_ar, name_en, status) values
  ('diapers', 'بيبي جوي', 'BabyJoy', 'published'),
  ('diapers', 'هجيز', 'Huggies', 'published'),
  ('diapers', 'مولفكس', 'Molfix', 'published'),
  ('diapers', 'بامبرز', 'Pampers', 'published'),
  ('formula', 'أبتاميل', 'Aptamil', 'published'),
  ('formula', 'بيبيلاك', 'Bebelac', 'published'),
  ('formula', 'إنفاميل', 'Enfamil', 'published'),
  ('formula', 'نان', 'NAN', 'published'),
  ('formula', 'إس-٢٦', 'S-26', 'published'),
  ('formula', 'سيميلاك', 'Similac', 'published'),
  ('wipes', 'هجيز', 'Huggies', 'published'),
  ('wipes', 'جونسون', 'Johnson''s', 'published'),
  ('wipes', 'بامبرز', 'Pampers', 'published'),
  ('wipes', 'واتر وايبس', 'WaterWipes', 'published'),
  ('baby_care', 'جونسون', 'Johnson''s', 'published'),
  ('baby_care', 'موستيلا', 'Mustela', 'published'),
  ('baby_care', 'سيباميد', 'Sebamed', 'published');

insert into public.supply_suggestions
  (category, name_ar, name_en, hint_ar, hint_en, min_age_months, max_age_months, only_gender, brand_kind, is_formula, default_unit, default_low, sort_order, status)
values
  -- Feeding
  ('feeding', 'حليب صناعي (المرحلة ١)', 'Infant formula (stage 1)',
   'الرضاعة الطبيعية هي الأفضل متى أمكن. استشر طبيب الأطفال قبل اختيار الحليب الصناعي أو تغييره.',
   'Breastfeeding is best where possible. Ask your paediatrician before choosing or changing formula.',
   0, 5, null, 'formula', true, 'tins', 1, 10, 'published'),
  ('feeding', 'حليب صناعي (المرحلة ٢)', 'Follow-on formula (stage 2)',
   'الرضاعة الطبيعية هي الأفضل متى أمكن. استشر طبيب الأطفال قبل اختيار الحليب الصناعي أو تغييره.',
   'Breastfeeding is best where possible. Ask your paediatrician before choosing or changing formula.',
   6, 11, null, 'formula', true, 'tins', 1, 11, 'published'),
  ('feeding', 'رضّاعات', 'Feeding bottles', null, null, 0, 17, null, null, false, 'pcs', 2, 12, 'published'),
  ('feeding', 'فرشاة تنظيف الرضّاعات', 'Bottle brush', null, null, 0, 17, null, null, false, 'pcs', 0, 13, 'published'),
  ('feeding', 'مرايل (صدريات)', 'Bibs', null, null, 4, 35, null, null, false, 'pcs', 2, 14, 'published'),
  ('feeding', 'أطباق وملاعق للأطفال', 'Baby bowls and spoons',
   'يبدأ الطعام الصلب عادة حوالي ٦ أشهر. اسأل طبيبك متى يناسب طفلك.',
   'Solid food usually starts around 6 months. Ask your doctor when it suits your child.',
   5, 35, null, null, false, 'pcs', 1, 15, 'published'),
  ('feeding', 'كوب تدريب', 'Sippy cup', null, null, 6, 35, null, null, false, 'pcs', 1, 16, 'published'),
  ('feeding', 'علبة طعام للمدرسة', 'Lunch box', null, null, 36, 131, null, null, false, 'pcs', 0, 17, 'published'),
  ('feeding', 'قنينة ماء', 'Water bottle', null, null, 24, 131, null, null, false, 'pcs', 0, 18, 'published'),

  -- Diapering
  ('diapering', 'حفاضات مقاس حديث الولادة', 'Diapers, newborn size',
   'عادة حتى حوالي ٤–٥ كغ. راجع الوزن المكتوب على العبوة.',
   'Usually up to about 4–5 kg. Check the weight on the pack.',
   0, 1, null, 'diapers', false, 'packs', 1, 20, 'published'),
  ('diapering', 'حفاضات مقاس ١–٢', 'Diapers, size 1–2',
   'عادة حوالي ٣–٨ كغ. راجع الوزن المكتوب على العبوة.',
   'Usually about 3–8 kg. Check the weight on the pack.',
   1, 4, null, 'diapers', false, 'packs', 1, 21, 'published'),
  ('diapering', 'حفاضات مقاس ٣–٤', 'Diapers, size 3–4',
   'عادة حوالي ٦–١٤ كغ. إذا صار التسريب متكرراً فقد يحين وقت المقاس التالي.',
   'Usually about 6–14 kg. Frequent leaks can mean it''s time for the next size.',
   4, 17, null, 'diapers', false, 'packs', 1, 22, 'published'),
  ('diapering', 'حفاضات مقاس ٥–٦', 'Diapers, size 5–6',
   'عادة من حوالي ١١ كغ فما فوق.', 'Usually from about 11 kg up.',
   15, 47, null, 'diapers', false, 'packs', 1, 23, 'published'),
  ('diapering', 'مناديل مبللة', 'Baby wipes', null, null, 0, 47, null, 'wipes', false, 'packs', 1, 24, 'published'),
  ('diapering', 'كريم الحفاض', 'Diaper cream', null, null, 0, 35, null, 'baby_care', false, 'pcs', 0, 25, 'published'),
  ('diapering', 'مقعد تدريب على الحمام', 'Potty training seat',
   'يبدأ معظم الأطفال التدريب بين سنتين وثلاث سنوات.', 'Most children start potty training between 2 and 3 years.',
   18, 47, null, null, false, 'pcs', 0, 26, 'published'),

  -- Health
  ('health', 'ميزان حرارة', 'Thermometer', null, null, 0, 131, null, null, false, 'pcs', 0, 30, 'published'),
  ('health', 'شفاط الأنف', 'Nasal aspirator', null, null, 0, 35, null, null, false, 'pcs', 0, 31, 'published'),
  ('health', 'محلول ملحي للأنف', 'Saline nose drops', null, null, 0, 131, null, null, false, 'bottles', 0, 32, 'published'),
  ('health', 'خافض حرارة للأطفال (حسب وصف الطبيب)', 'Children''s fever medicine (as your doctor advises)',
   'اسأل الطبيب أو الصيدلي عن الجرعة المناسبة لوزن طفلك. لا تعطِ أي دواء لطفل دون ٣ أشهر دون استشارة الطبيب.',
   'Ask a doctor or pharmacist for the right dose for your child''s weight. Don''t give any medicine to a baby under 3 months without a doctor.',
   0, 131, null, null, false, 'bottles', 0, 33, 'published'),
  ('health', 'شاش ولاصقات جروح', 'Plasters and gauze', null, null, 12, 131, null, null, false, 'boxes', 0, 34, 'published'),
  ('health', 'واقي شمس للأطفال', 'Children''s sunscreen',
   'للأطفال فوق ٦ أشهر. للأصغر سناً: ظل وملابس خفيفة.', 'For children over 6 months. For younger babies: shade and light clothing.',
   6, 131, null, 'baby_care', false, 'bottles', 0, 35, 'published'),

  -- Teething
  ('teething', 'عضّاضة تسنين', 'Teether', null, null, 3, 23, null, null, false, 'pcs', 0, 40, 'published'),
  ('teething', 'فرشاة أسنان للأطفال', 'Baby toothbrush',
   'ابدأ بتنظيف الأسنان عند ظهور أول سن.', 'Start brushing when the first tooth appears.',
   6, 131, null, null, false, 'pcs', 1, 41, 'published'),
  ('teething', 'معجون أسنان للأطفال', 'Children''s toothpaste',
   'كمية بحجم حبة الأرز تحت ٣ سنوات، وبحجم حبة البازلاء من ٣ سنوات.', 'A rice-grain smear under 3 years, a pea-sized amount from 3 years.',
   6, 131, null, null, false, 'pcs', 0, 42, 'published'),

  -- Learning and play
  ('play', 'ألعاب بالأبيض والأسود وألعاب الهز', 'Black-and-white cards and rattles', null, null, 0, 5, null, null, false, 'pcs', 0, 50, 'published'),
  ('play', 'كتب قماشية أو كرتونية', 'Cloth or board books', null, null, 3, 35, null, null, false, 'pcs', 0, 51, 'published'),
  ('play', 'مكعبات وألعاب ترتيب الأشكال', 'Stacking blocks and shape sorters', null, null, 9, 47, null, null, false, 'pcs', 0, 52, 'published'),
  ('play', 'ألوان شمعية وكراسة تلوين', 'Crayons and colouring book', null, null, 18, 131, null, null, false, 'pcs', 0, 53, 'published'),
  ('play', 'ألعاب تركيب (بازل)', 'Jigsaw puzzles', null, null, 24, 131, null, null, false, 'pcs', 0, 54, 'published'),
  ('play', 'قصص بالعربية', 'Arabic story books', null, null, 24, 131, null, null, false, 'pcs', 0, 55, 'published'),
  ('play', 'حقيبة مدرسية وأدوات قرطاسية', 'School bag and stationery', null, null, 48, 131, null, null, false, 'pcs', 0, 56, 'published'),

  -- Clothing (changes by gender)
  ('clothing', 'ملابس نوم قطنية (بودي)', 'Cotton bodysuits', null, null, 0, 17, null, null, false, 'pcs', 3, 60, 'published'),
  ('clothing', 'فساتين وملابس بنات للمقاس الحالي', 'Girls'' clothes for the current size',
   'المقاسات تكبر بسرعة: تحقق من المقاس كل ٣ أشهر تقريباً.', 'Sizes change fast: check the size about every 3 months.',
   0, 131, 'girl', null, false, 'pcs', 0, 61, 'published'),
  ('clothing', 'ملابس أولاد للمقاس الحالي', 'Boys'' clothes for the current size',
   'المقاسات تكبر بسرعة: تحقق من المقاس كل ٣ أشهر تقريباً.', 'Sizes change fast: check the size about every 3 months.',
   0, 131, 'boy', null, false, 'pcs', 0, 62, 'published'),
  ('clothing', 'جوارب', 'Socks', null, null, 0, 131, null, null, false, 'pcs', 2, 63, 'published'),
  ('clothing', 'قبعة شمس', 'Sun hat', null, null, 0, 131, null, null, false, 'pcs', 0, 64, 'published'),
  ('clothing', 'زي المدرسة', 'School uniform', null, null, 48, 131, null, null, false, 'pcs', 1, 65, 'published');
