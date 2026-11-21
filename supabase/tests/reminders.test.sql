-- Reminders: repeating events, push tokens, outbox, privacy of tokens.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- next_occurrence
select is(public.next_occurrence('2026-11-01 13:00+00', 'weekly', null, '2026-11-20 00:00+00'),
          '2026-11-22 13:00+00'::timestamptz, 'weekly event: next one after the 20th is the 22nd');
select is(public.next_occurrence('2026-11-01 13:00+00', 'daily', null, '2026-11-20 14:00+00'),
          '2026-11-21 13:00+00'::timestamptz, 'daily event: next one is tomorrow');
select is(public.next_occurrence('2026-01-31 13:00+00', 'monthly', null, '2026-03-05 00:00+00'),
          '2026-03-31 13:00+00'::timestamptz, 'monthly event: same day each month');
select is(public.next_occurrence('2026-11-01 13:00+00', 'weekly', '2026-11-10', '2026-11-20 00:00+00'),
          null, 'repeating event that has ended has no next one');
select is(public.next_occurrence('2026-11-01 13:00+00', 'none', null, '2026-11-20 00:00+00'),
          null, 'a past one-off event has no next one');
select ok(public.in_quiet_hours('22:00', '07:00', '23:30'), 'quiet hours across midnight');
select ok(not public.in_quiet_hours('22:00', '07:00', '12:00'), 'midday is not quiet');

insert into auth.users (id, phone, aud, role) values
  ('66666666-6666-6666-6666-666666666666', '96599990006', 'authenticated', 'authenticated'),
  ('77777777-7777-7777-7777-777777777777', '96599990007', 'authenticated', 'authenticated');
update public.profiles set locale = 'en' where id = '77777777-7777-7777-7777-777777777777';

select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('Reem', 'privacy-2026-11-draft');
-- a child whose 2-month doses are due exactly 3 days from today (Kuwait date)
insert into public.children (family_id, first_name, birth_date, gender)
values (public.my_family_id(), 'Lulu',
        ((now() at time zone 'Asia/Kuwait')::date + 3 - interval '2 months')::date, 'girl');
-- an event starting in 30 minutes with a 1-hour reminder, and one without
insert into public.events (family_id, title, starts_at, remind_minutes_before)
values (public.my_family_id(), 'Swim', now() + interval '30 minutes', 60),
       (public.my_family_id(), 'No reminder', now() + interval '30 minutes', null);
select lives_ok($$ select public.register_device('ExponentPushToken[abc123]', 'ios', 'ar') $$, 'phone registers for notifications');
select throws_ok($$ select public.register_device('not-a-token', 'ios', 'ar') $$, '23514', null, 'junk tokens are refused');
select throws_ok($$ select public.queue_due_reminders() $$, '42501', null, 'parents cannot run the reminder job');
create temp table fam on commit drop as select public.my_family_id() as id;
grant select on fam to authenticated;

-- second parent (English) joins
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
reset role;
insert into public.family_members (family_id, user_id, role) select id, '77777777-7777-7777-7777-777777777777', 'co_parent' from fam;
set local role authenticated;
select public.register_device('ExponentPushToken[def456]', 'android', 'en');
select is((select count(*)::int from public.device_tokens), 1, 'a parent sees only their own phones');

reset role;
-- pretend it's after 09:00 in Kuwait for the vaccine part by calling the job; the event part doesn't depend on time
select ok(public.queue_due_reminders() >= 2, 'reminders are queued');
select is((select count(*)::int from public.notification_log where kind = 'event'), 2,
  'the event reminder goes to both parents, the event without a reminder to nobody');
select is((select count(*)::int from public.notification_log
           where kind = 'vaccine_soon' and body like '%Lulu%' and body not like '%Hepatitis%' and body not like '%الكبد%')
          , case when (now() at time zone 'Asia/Kuwait')::time >= '09:00' then 8 else 0 end,
  'vaccine reminders name the child but not the vaccine (4 doses x 2 parents, after 09:00 Kuwait time)');
select is(public.queue_due_reminders(), 0, 'running the job again sends nothing twice');
select is((select body from public.notification_log where kind = 'event'
           and user_id = '77777777-7777-7777-7777-777777777777'), 'Starts at ' || to_char((select starts_at from public.events where title = 'Swim') at time zone 'Asia/Kuwait', 'HH24:MI'),
  'English parent gets English text');

select * from finish();
rollback;
