-- =============================================================================
-- Special needs support, across the app
-- =============================================================================
-- What this adds:
--   * child_support: an optional, private part of a child's profile (needs,
--     a short note, and whether the child has a disability card). Only the
--     child's own family can read or change it. It is never sent to the AI.
--   * A "therapy" kind for calendar events, so sessions get reminders.
--   * A "disability" topic for government guides, with three starter guides
--     about the Public Authority for Disabled Affairs (PADA) services.
--   * for_needs on supply suggestions and tips: items and tips that are only
--     shown to children with one of those needs. Empty = every child.
--   * export_my_data() now includes child_support. Deleting a child or the
--     family deletes it too (foreign key cascade).
-- The places directory (therapy centres, accessibility) is a separate change.
-- =============================================================================

-- The allowed needs, in one place, so the table and content use the same list.
create or replace function public.is_valid_needs(n text[])
returns boolean
language sql immutable set search_path = ''
as $$
  select n <@ array['autism', 'adhd', 'speech', 'hearing', 'visual', 'physical', 'learning',
                    'down_syndrome', 'developmental_delay', 'chronic', 'other']::text[]
         and cardinality(n) <= 11
$$;

-- -----------------------------------------------------------------------------
-- child_support: one row per child, only when the parent fills it in
-- -----------------------------------------------------------------------------
create table public.child_support (
  child_id       uuid primary key,
  family_id      uuid not null references public.families (id) on delete cascade,
  needs          text[] not null default '{}' check (public.is_valid_needs(needs)),
  notes          text check (char_length(notes) <= 300 and notes !~ '[[:cntrl:]]'),
  has_pada_card  boolean,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- the child must belong to the same family (the composite key stops a
  -- parent attaching a row to another family's child)
  constraint child_support_child_fkey foreign key (child_id, family_id)
    references public.children (id, family_id) on delete cascade
);
create index child_support_family_idx on public.child_support (family_id);
create trigger child_support_touch before update on public.child_support
  for each row execute function public.touch_updated_at();

alter table public.child_support enable row level security;
revoke all on public.child_support from anon, authenticated;
grant select, insert, delete on public.child_support to authenticated;
grant update (needs, notes, has_pada_card) on public.child_support to authenticated;
create policy child_support_select on public.child_support for select to authenticated
  using (family_id = (select public.my_family_id()));
create policy child_support_insert on public.child_support for insert to authenticated
  with check (family_id = (select public.my_family_id()));
create policy child_support_update on public.child_support for update to authenticated
  using (family_id = (select public.my_family_id()))
  with check (family_id = (select public.my_family_id()));
create policy child_support_delete on public.child_support for delete to authenticated
  using (family_id = (select public.my_family_id()));

-- Save (or clear) a child's profile in one call. SECURITY INVOKER: RLS still
-- decides which children the caller can see, and the family comes from the
-- child row, never from the app.
create or replace function public.save_child_support(p_child uuid, p_needs text[], p_notes text, p_has_pada_card boolean)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  fid uuid;
  clean_notes text := nullif(btrim(p_notes), '');
begin
  select c.family_id into fid from public.children c where c.id = p_child;
  if fid is null then
    raise exception 'child not found' using errcode = 'P0002';
  end if;
  if coalesce(cardinality(p_needs), 0) = 0 and clean_notes is null and p_has_pada_card is null then
    delete from public.child_support where child_id = p_child;
    return;
  end if;
  insert into public.child_support (child_id, family_id, needs, notes, has_pada_card)
  values (p_child, fid, coalesce(p_needs, '{}'), clean_notes, p_has_pada_card)
  on conflict (child_id) do update
    set needs = excluded.needs, notes = excluded.notes, has_pada_card = excluded.has_pada_card;
end;
$$;
revoke execute on function public.save_child_support(uuid, text[], text, boolean) from public, anon;
grant execute on function public.save_child_support(uuid, text[], text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Calendar: therapy sessions
-- -----------------------------------------------------------------------------
alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check
  check (kind in ('activity', 'training', 'class', 'appointment', 'therapy', 'other'));

-- -----------------------------------------------------------------------------
-- Guides: disability topic
-- -----------------------------------------------------------------------------
alter table public.guides drop constraint guides_topic_check;
alter table public.guides add constraint guides_topic_check
  check (topic in ('birth', 'civil_id', 'passport', 'residency', 'health', 'education', 'travel', 'disability'));

-- -----------------------------------------------------------------------------
-- Content shown only to children with certain needs
-- -----------------------------------------------------------------------------
alter table public.supply_suggestions add column for_needs text[] not null default '{}'
  check (public.is_valid_needs(for_needs));
alter table public.tips add column for_needs text[] not null default '{}'
  check (public.is_valid_needs(for_needs));

-- Home: today's tips for each child, now including tips for the child's needs.
-- SECURITY INVOKER, so RLS limits it to the caller's own children.
create or replace function public.my_children_tips()
returns table (child_id uuid, id uuid, section text, title_ar text, title_en text, body_ar text, body_en text)
language sql stable security invoker set search_path = ''
as $$
  select c.id, t.id, t.section, t.title_ar, t.title_en, t.body_ar, t.body_en
  from public.children c
  left join public.child_support s on s.child_id = c.id
  cross join lateral (
    select (extract(year from age((now() at time zone 'Asia/Kuwait')::date, c.birth_date)) * 12
          + extract(month from age((now() at time zone 'Asia/Kuwait')::date, c.birth_date)))::int as months
  ) a
  join public.tips t on t.status = 'published'
    and a.months between t.min_age_months and t.max_age_months
    and (t.only_gender is null or t.only_gender = c.gender)
    and (t.for_needs = '{}' or t.for_needs && coalesce(s.needs, '{}'))
  order by c.id, t.sort_order, t.id
$$;

-- -----------------------------------------------------------------------------
-- Export: same as before, plus child_support
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fid uuid := public.my_family_id();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (
      select jsonb_build_object('phone', '+' || u.phone, 'signed_up_at', u.created_at,
                                'display_name', p.display_name, 'language', p.locale)
      from auth.users u left join public.profiles p on p.id = u.id where u.id = uid),
    'family', (
      select jsonb_build_object('name', f.name, 'created_at', f.created_at,
                                'privacy_notice_version', f.privacy_version, 'privacy_accepted_at', f.privacy_accepted_at,
                                'my_role', m.role)
      from public.families f join public.family_members m on m.family_id = f.id and m.user_id = uid
      where f.id = fid),
    'parents', coalesce((
      select jsonb_agg(jsonb_build_object('role', m.role, 'display_name', p.display_name, 'joined_at', m.joined_at, 'is_me', m.user_id = uid) order by m.joined_at)
      from public.family_members m left join public.profiles p on p.id = m.user_id where m.family_id = fid), '[]'),
    'children', coalesce((
      select jsonb_agg(to_jsonb(c) - 'family_id' order by c.birth_date) from public.children c where c.family_id = fid), '[]'),
    'child_support', coalesce((
      select jsonb_agg(to_jsonb(cs) - 'family_id' order by cs.child_id) from public.child_support cs where cs.family_id = fid), '[]'),
    'calendar_events', coalesce((
      select jsonb_agg(to_jsonb(e) - 'family_id' - 'created_by' order by e.starts_at) from public.events e where e.family_id = fid), '[]'),
    'vaccinations', coalesce((
      select jsonb_agg(jsonb_build_object('child_id', cv.child_id, 'vaccine', d.name_en, 'vaccine_ar', d.name_ar, 'dose', d.dose_label_en,
                                          'due_date', cv.due_date, 'status', cv.status, 'done_on', cv.done_on, 'clinic', cv.clinic)
                       order by cv.due_date)
      from public.child_vaccinations cv join public.vaccine_doses d on d.id = cv.dose_id where cv.family_id = fid), '[]'),
    'supplies', coalesce((
      select jsonb_agg(to_jsonb(s) - 'family_id' - 'created_by' - 'suggestion_id' order by s.child_id, s.category, s.name)
      from public.supply_items s where s.family_id = fid), '[]'),
    'guide_progress', coalesce((
      select jsonb_agg(jsonb_build_object('child_id', gp.child_id, 'guide', g.title_en, 'step', st.title_en, 'done_at', gp.done_at) order by gp.done_at)
      from public.guide_progress gp join public.guide_steps st on st.id = gp.step_id join public.guides g on g.id = st.guide_id
      where gp.family_id = fid), '[]'),
    'notification_settings', (
      select to_jsonb(ns) - 'user_id' from public.notification_settings ns where ns.user_id = uid),
    'devices', coalesce((
      -- The push token itself is a secret for sending to the phone, so it's left out.
      select jsonb_agg(jsonb_build_object('platform', d.platform, 'language', d.locale, 'last_seen', d.updated_at))
      from public.device_tokens d where d.user_id = uid), '[]'),
    'notifications_sent', coalesce((
      select jsonb_agg(jsonb_build_object('kind', n.kind, 'title', n.title, 'body', n.body, 'for', n.occurrence) order by n.occurrence desc)
      from public.notification_log n where n.user_id = uid), '[]'),
    'ai_requests', coalesce((
      select jsonb_agg(a.at order by a.at desc) from public.ai_usage a where a.user_id = uid), '[]')
  );
end;
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- =============================================================================
-- Starter content (drafts written for launch; see docs/explain/10-special-needs.md)
--   * Guides: last_verified_on stays empty until someone checks every step
--     with PADA. The app shows each guide's official link.
--   * Tips and supplies for needs are health content: a paediatrician or a
--     specialist must read them before launch (the admin panel only lets a
--     health reviewer publish changes).
-- =============================================================================

with g as (insert into public.guides (slug, topic, audience, title_ar, title_en, summary_ar, summary_en, source_url, sort_order, status) values ('disability-card', 'disability', 'all', 'ملف الإعاقة والبطاقة', 'Disability file and card', 'فتح ملف لدى الهيئة العامة لشؤون ذوي الإعاقة، والتقييم الطبي، واستلام بطاقة الإعاقة التي تفتح باب الخدمات.', 'Opening a file with the Public Authority for Disabled Affairs (PADA), the medical assessment, and the disability card that opens the door to services.', 'https://e.gov.kw/sites/kgoEnglish/Pages/Services/GODP/MedicalFile.aspx', 80, 'published') returning id)
insert into public.guide_steps (guide_id, position, title_ar, title_en, body_ar, body_en, documents_ar, documents_en, link_url) values
  ((select id from g), 1, 'اجمع التقارير الطبية', 'Gather the medical reports', 'اطلب من الطبيب المعالج تقريراً حديثاً يوضح التشخيص وحالة الطفل. التقارير من المستشفيات والمراكز الحكومية هي الأسهل قبولاً. تحقق من الموقع الرسمي من المستندات الحالية قبل الذهاب.', 'Ask the treating doctor for a recent report that explains the diagnosis and the child''s condition. Reports from government hospitals and centres are the easiest to get accepted. Check the official site for the current documents before you go.', array['تقرير طبي حديث','البطاقة المدنية للطفل','البطاقة المدنية للوالدين','شهادة الميلاد']::text[], array['A recent medical report','Child''s civil ID','Parents'' civil IDs','Birth certificate']::text[], null),
  ((select id from g), 2, 'افتح الملف الطبي', 'Open the medical file', 'قدّم طلب فتح الملف عبر الخدمة الإلكترونية للهيئة أو في مقرها. الخدمات الكاملة للكويتيين، وبعضها متاح لأبناء الكويتيات وللمقيمين، فاسأل عن حالتك.', 'Apply to open the file online or at a PADA office. The full services are for Kuwaiti citizens; some are open to children of Kuwaiti mothers and to residents, so ask about your case.', '{}'::text[], '{}'::text[], 'https://e.gov.kw/sites/kgoEnglish/Pages/Services/GODP/MedicalFile.aspx'),
  ((select id from g), 3, 'موعد اللجنة الطبية', 'The medical committee appointment', 'تقيّم لجنة طبية حالة الطفل وتحدد نوع الإعاقة ودرجتها. أحضر كل التقارير والفحوصات السابقة، ودوّن أسئلتك قبل الموعد.', 'A medical committee assesses the child and decides the type and level of disability. Bring every report and past test result, and write down your questions before the appointment.', array['كل التقارير والفحوصات السابقة']::text[], array['All past reports and test results']::text[], null),
  ((select id from g), 4, 'استلم البطاقة واحفظ موعد التجديد', 'Collect the card and note the renewal', 'بعد القرار تصدر بطاقة الإعاقة. أضف تاريخ انتهائها إلى تقويم يهل حتى تصلك تذكرة قبل التجديد.', 'After the decision, the disability card is issued. Add its expiry date to the Yahal calendar so you get a reminder before it needs renewing.', '{}'::text[], '{}'::text[], null);

with g as (insert into public.guides (slug, topic, audience, title_ar, title_en, summary_ar, summary_en, source_url, sort_order, status) values ('disability-services', 'disability', 'all', 'خدمات ومزايا ذوي الإعاقة', 'Disability services and benefits', 'أهم الخدمات بعد بطاقة الإعاقة: الأجهزة التعويضية، وملصق مواقف ذوي الإعاقة، وخدمات المرافق والراعي.', 'Key services once you have the disability card: assistive devices, the disabled parking permit, and caregiver services.', 'https://e.gov.kw/sites/kgoEnglish/Pages/Services/GODP/ProstheticDevices.aspx', 81, 'published') returning id)
insert into public.guide_steps (guide_id, position, title_ar, title_en, body_ar, body_en, documents_ar, documents_en, link_url) values
  ((select id from g), 1, 'الأجهزة التعويضية والمساعدة', 'Assistive and prosthetic devices', 'يمكن طلب أجهزة مثل الكراسي المتحركة والسماعات وغيرها حسب حالة الطفل، بناء على وصفة أو تقرير من الطبيب.', 'You can apply for devices such as wheelchairs, hearing aids and others, depending on the child''s needs, based on a doctor''s prescription or report.', array['بطاقة الإعاقة','وصفة أو تقرير طبي بالجهاز المطلوب']::text[], array['Disability card','A doctor''s prescription or report for the device']::text[], 'https://e.gov.kw/sites/kgoEnglish/Pages/Services/GODP/ProstheticDevices.aspx'),
  ((select id from g), 2, 'ملصق مواقف ذوي الإعاقة', 'Disabled parking permit', 'يُصرف ملصق للسيارة التي تنقل الطفل، للوقوف في المواقف المخصصة.', 'A permit is issued for the car that drives the child, for parking in the reserved spaces.', array['بطاقة الإعاقة','دفتر السيارة']::text[], array['Disability card','Car registration']::text[], 'https://e.gov.kw/sites/kgoEnglish/Pages/Services/GODP/TrafficPanel.aspx'),
  ((select id from g), 3, 'خدمات الراعي والمرافق', 'Caregiver services', 'هناك خدمات خاصة بمن يرعى الطفل، تختلف حسب درجة الإعاقة والجنسية. اسأل الهيئة عما ينطبق على أسرتك.', 'There are services for the person who cares for the child, depending on the level of disability and nationality. Ask PADA what applies to your family.', '{}'::text[], '{}'::text[], 'https://e.gov.kw/sites/kgoEnglish/Pages/Services/GODP/Caregiver.aspx');

with g as (insert into public.guides (slug, topic, audience, title_ar, title_en, summary_ar, summary_en, source_url, sort_order, status) values ('disability-school-support', 'disability', 'all', 'الدعم التعليمي والتدخل المبكر', 'School support and early intervention', 'من التدخل المبكر في السنوات الأولى إلى الدعم في المدرسة: من أين تبدأ.', 'From early intervention in the first years to support at school: where to start.', 'https://e.gov.kw/sites/kgoEnglish/Pages/Services/GODP/EducationalSupport.aspx', 82, 'published') returning id)
insert into public.guide_steps (guide_id, position, title_ar, title_en, body_ar, body_en, documents_ar, documents_en, link_url) values
  ((select id from g), 1, 'ابدأ مبكراً', 'Start early', 'إذا لاحظت تأخراً في الكلام أو الحركة أو التواصل، تحدث مع طبيب الأطفال في المركز الصحي. التدخل المبكر قبل عمر المدرسة يصنع فرقاً كبيراً، ولا تحتاج بطاقة إعاقة لتبدأ العلاج.', 'If you notice delays in speech, movement or social skills, talk to the paediatrician at your health centre. Early intervention before school age makes a big difference, and you don''t need a disability card to start therapy.', '{}'::text[], '{}'::text[], null),
  ((select id from g), 2, 'الدعم التعليمي من الهيئة', 'Educational support from PADA', 'تقدم الهيئة دعماً تعليمياً لحاملي البطاقة حسب الحالة. قدّم الطلب عبر الخدمة الإلكترونية واسأل عن المدارس والبرامج المناسبة.', 'PADA offers educational support for card holders depending on the case. Apply online and ask about suitable schools and programmes.', array['بطاقة الإعاقة','آخر تقرير مدرسي إن وجد']::text[], array['Disability card','Latest school report, if any']::text[], 'https://e.gov.kw/sites/kgoEnglish/Pages/Services/GODP/EducationalSupport.aspx'),
  ((select id from g), 3, 'تحدث مع المدرسة', 'Talk to the school', 'اطلب اجتماعاً مع إدارة المدرسة والأخصائي الاجتماعي أو النفسي لوضع خطة تناسب طفلك (مثل وقت إضافي في الاختبارات أو معلم ظل). احتفظ بنسخة من كل تقرير.', 'Ask for a meeting with the school leadership and the social worker or psychologist to agree a plan for your child (such as extra exam time or a shadow teacher). Keep a copy of every report.', '{}'::text[], '{}'::text[], null);

-- Supplies that only show for children with these needs.
insert into public.supply_suggestions (category, name_ar, name_en, hint_ar, hint_en, min_age_months, max_age_months, default_unit, default_low, sort_order, status, for_needs) values
  ('play', 'بطاقات الجدول المصوّر', 'Visual schedule cards', 'صور بسيطة لخطوات اليوم تساعد الطفل على معرفة ما سيأتي وتقلل القلق.', 'Simple pictures of the day''s steps help the child know what comes next and feel less anxious.', 24, 131, 'packs', 0, 200, 'published', array['autism','adhd','learning','speech','developmental_delay']),
  ('play', 'بطاقات التواصل بالصور', 'Picture communication cards', 'تساعد الطفل على التعبير عن احتياجاته قبل أو مع الكلام. اسأل أخصائي النطق عن الأنسب.', 'Help the child say what they need before or alongside speech. Ask the speech therapist which suit your child.', 18, 131, 'packs', 0, 201, 'published', array['speech','autism','developmental_delay','down_syndrome']),
  ('health', 'سماعات عازلة للضوضاء للأطفال', 'Kids'' noise-reducing ear defenders', 'مفيدة في الأماكن المزدحمة والصاخبة مثل المجمعات والحفلات.', 'Useful in busy, noisy places like malls and parties.', 24, 131, 'pcs', 0, 202, 'published', array['autism','adhd']),
  ('play', 'ألعاب حسية وألعاب للتركيز', 'Sensory and fidget toys', 'تساعد على الهدوء والتركيز. اختر ألعاباً كبيرة لا تُبلع ومناسبة لعمر الطفل.', 'Help with calming and focus. Choose toys too big to swallow and right for the child''s age.', 24, 131, 'pcs', 0, 203, 'published', array['autism','adhd','developmental_delay']),
  ('health', 'بطاريات احتياطية لسماعات الأذن', 'Spare hearing aid batteries', 'احتفظ بعلبة في البيت وأخرى في الحقيبة، وأبعدها عن متناول الأطفال لأن بلعها خطر.', 'Keep a pack at home and one in the bag, out of children''s reach: swallowing them is dangerous.', 0, 131, 'packs', 1, 204, 'published', array['hearing']),
  ('health', 'علبة تجفيف لسماعات الأذن', 'Hearing aid drying kit', 'تحمي السماعات من رطوبة الجو في الكويت.', 'Protects the hearing aids from Kuwait''s humidity.', 0, 131, 'pcs', 0, 205, 'published', array['hearing']),
  ('play', 'كتب بخط كبير أو ملموسة', 'Large-print or touch-and-feel books', 'كتب بألوان قوية وخط كبير أو بأسطح يمكن لمسها.', 'Books with strong colours and big print, or textures to touch.', 6, 131, 'pcs', 0, 206, 'published', array['visual']),
  ('feeding', 'ملعقة وكوب مكيّفان', 'Adaptive spoon and cup', 'مقابض أسهل ومانع للانزلاق تساعد الطفل على الأكل بنفسه. اسأل أخصائي العلاج الوظيفي.', 'Easier grips and non-slip bases help the child eat independently. Ask the occupational therapist.', 6, 131, 'pcs', 0, 207, 'published', array['physical','down_syndrome','developmental_delay']),
  ('diapering', 'حفاضات أو سراويل تدريب بمقاس كبير', 'Larger diapers or pull-ups', 'بعض الأطفال يحتاجونها بعد عمر المعتاد. توجد مقاسات للأطفال الأكبر في الصيدليات.', 'Some children need them for longer than usual. Pharmacies carry sizes for older children.', 36, 131, 'packs', 1, 208, 'published', array['physical','developmental_delay','down_syndrome','autism']),
  ('health', 'منظّم الأدوية', 'Medicine organiser', 'علبة بأيام الأسبوع تقلل نسيان الجرعات. أضف المواعيد كتذكير في تقويم يهل.', 'A box with the days of the week makes missed doses less likely. Add the times as reminders in the Yahal calendar.', 0, 131, 'pcs', 0, 209, 'published', array['chronic']),
  ('health', 'سوار تعريف طبي', 'Medical ID bracelet', 'يكتب عليه اسم الطفل وحالته ورقم ولي الأمر، مفيد إذا ضاع أو احتاج إسعافاً.', 'Shows the child''s name, condition and a parent''s number: useful if they get lost or need first aid.', 24, 131, 'pcs', 0, 210, 'published', array['chronic','autism','hearing','down_syndrome']);

-- Tips that only show for children with these needs.
insert into public.tips (section, min_age_months, max_age_months, title_ar, title_en, body_ar, body_en, source, sort_order, status, for_needs) values
  ('learning', 24, 131, 'جدول يومي بالصور', 'A picture schedule', 'ضع صور خطوات اليوم بالترتيب (استيقاظ، فطور، مدرسة...) في مكان يراه طفلك. معرفة ما سيأتي تقلل نوبات الغضب عند الانتقال من نشاط لآخر.', 'Put pictures of the day''s steps in order (wake up, breakfast, school...) where your child can see them. Knowing what comes next makes changes between activities easier.', 'General guidance; pending specialist review', 200, 'published', array['autism','learning','developmental_delay']),
  ('activities', 24, 131, 'خروج بهدوء', 'Calmer outings', 'اختر أوقاتاً أقل ازدحاماً للمجمعات والحدائق، واحمل سماعات عازلة ولعبة مفضلة. بعض الأماكن في الكويت تخصص أوقاتاً هادئة، فاسأل قبل الذهاب.', 'Pick quieter times for malls and parks, and bring ear defenders and a favourite toy. Some places in Kuwait offer quiet hours, so ask before you go.', 'General guidance; pending specialist review', 201, 'published', array['autism','adhd']),
  ('sleep', 24, 131, 'نوم منتظم', 'Steady sleep', 'موعد ثابت للنوم والاستيقاظ، وغرفة مظلمة وهادئة، وإبعاد الشاشات قبل ساعة. لا تعطِ أي دواء أو مكمل للنوم إلا بوصفة من الطبيب.', 'A fixed bedtime and wake-up time, a dark quiet room, and no screens for an hour before bed. Don''t give any sleep medicine or supplement unless a doctor prescribes it.', 'General guidance; pending specialist review', 202, 'published', array['autism','adhd']),
  ('learning', 48, 131, 'مهام قصيرة وحركة', 'Short tasks and movement', 'قسّم الواجبات إلى أجزاء قصيرة مع استراحة حركة بينها، وامدح الجهد فور حدوثه. التعليمات الواضحة خطوة بخطوة أفضل من قائمة طويلة.', 'Break homework into short chunks with a movement break between, and praise effort straight away. Clear step-by-step instructions work better than a long list.', 'General guidance; pending specialist review', 203, 'published', array['adhd','learning']),
  ('learning', 12, 131, 'تكلّم وانتظر ثم زِد', 'Talk, wait, then add', 'قل كلمة واضحة وانتظر ردّه، ثم أضف كلمة: "كرة" ثم "كرة حمراء". تابع مع أخصائي النطق ومارس تمارينه كل يوم في البيت.', 'Say one clear word and wait for a reply, then add a word: "ball", then "red ball". Keep up with the speech therapist and practise their exercises at home every day.', 'General guidance; pending specialist review', 204, 'published', array['speech','developmental_delay','down_syndrome','autism']),
  ('learning', 0, 131, 'وجهك أمامه', 'Face your child', 'تكلم وأنت مواجه لطفلك وفي إضاءة جيدة، وقلل الضوضاء حولكما. افحص السماعات والبطاريات كل صباح.', 'Talk face to face in good light, and cut background noise. Check the hearing aids and batteries every morning.', 'General guidance; pending specialist review', 205, 'published', array['hearing']),
  ('activities', 0, 131, 'صف ما حوله', 'Describe the world around', 'صف لطفلك ما يحدث حوله، وأبقِ الأثاث والأشياء في أماكن ثابتة، واستخدم ألعاباً بأصوات وملمس مختلف.', 'Describe what''s happening around your child, keep furniture and things in the same places, and use toys with different sounds and textures.', 'General guidance; pending specialist review', 206, 'published', array['visual']),
  ('activities', 0, 131, 'تمارين كل يوم', 'Exercises every day', 'كرر تمارين العلاج الطبيعي التي وصفها الأخصائي يومياً بشكل ممتع. في الصيف اشرب الماء كثيراً وتجنب الحر، خصوصاً مع الكرسي المتحرك.', 'Repeat the physiotherapist''s exercises every day and make them fun. In summer, drink plenty of water and avoid the heat, especially in a wheelchair.', 'General guidance; pending specialist review', 207, 'published', array['physical']),
  ('health', 0, 131, 'فحوصات دورية', 'Regular check-ups', 'يحتاج الأطفال المصابون بمتلازمة داون عادة إلى فحوصات منتظمة للقلب والغدة الدرقية والسمع والنظر. اسأل طبيبك عن جدول الفحوصات المناسب.', 'Children with Down syndrome usually need regular heart, thyroid, hearing and eye checks. Ask your doctor which check-up schedule is right.', 'General guidance; pending specialist review', 208, 'published', array['down_syndrome']),
  ('health', 0, 71, 'التدخل المبكر', 'Early intervention', 'كلما بدأ العلاج (نطق، وظيفي، طبيعي) مبكراً كانت النتائج أفضل. لا تنتظر التشخيص النهائي لتبدأ، واسأل طبيب الأطفال عن التحويل.', 'The earlier therapy (speech, occupational, physical) starts, the better. Don''t wait for a final diagnosis to begin: ask your paediatrician for a referral.', 'General guidance; pending specialist review', 209, 'published', array['developmental_delay','speech','autism','down_syndrome','physical']),
  ('health', 0, 131, 'خطة للمدرسة والطوارئ', 'A plan for school and emergencies', 'اكتب ورقة قصيرة بالأدوية ومواعيدها وما يجب فعله في الطوارئ، وأعط نسخة للمدرسة. أضف مواعيد الأدوية والمراجعات إلى تقويم يهل.', 'Write a short sheet with medicines, times and what to do in an emergency, and give a copy to the school. Add medicine times and check-ups to the Yahal calendar.', 'General guidance; pending specialist review', 210, 'published', array['chronic']),
  ('activities', 0, 131, 'جلسات العلاج في التقويم', 'Therapy sessions in the calendar', 'أضف جلسات العلاج كنوع "علاج" في التقويم مع التكرار الأسبوعي، فتصلك تذكرة قبل كل جلسة ويراها الوالد الآخر.', 'Add therapy sessions as the "Therapy" kind in the calendar with a weekly repeat, so you get a reminder before each one and the other parent sees it too.', 'General guidance', 211, 'published', array['autism','adhd','speech','hearing','visual','physical','learning','down_syndrome','developmental_delay','chronic','other']),
  ('health', 0, 131, 'اعتنِ بنفسك أيضاً', 'Look after yourself too', 'رعاية طفل باحتياجات خاصة متعبة. شارك المهام مع الوالد الآخر، وتواصل مع أسر أخرى أو مجموعات دعم، واطلب المساعدة عندما تحتاجها.', 'Caring for a child with extra needs is tiring. Share tasks with the other parent, connect with other families or support groups, and ask for help when you need it.', 'General guidance', 212, 'published', array['autism','adhd','speech','hearing','visual','physical','learning','down_syndrome','developmental_delay','chronic','other']);
