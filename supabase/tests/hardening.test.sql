-- Tests for the security-hardening rules (server-side input checks).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Phone hook: only Kuwaiti mobiles may sign up
select is(public.hook_before_user_created('{"user":{"phone":"96550000001"}}'), '{}'::jsonb, 'Kuwaiti mobile allowed');
select ok(public.hook_before_user_created('{"user":{"phone":"447700900123"}}') ? 'error', 'UK number refused');
select ok(public.hook_before_user_created('{"user":{"phone":"96522223333"}}') ? 'error', 'Kuwaiti landline refused');
select ok(public.hook_before_user_created('{"user":{"email":"a@b.c"}}') ? 'error', 'email sign-up refused');

insert into auth.users (id, phone, aud, role) values
  ('44444444-4444-4444-4444-444444444444', '96599990004', 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', '96599990005', 'authenticated', 'authenticated');

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select public.create_family('X', 'made-up-version') $$, '23503', null,
  'consent must name a published privacy version');
select lives_ok($$ select public.create_family('Hala', 'privacy-2026-11-draft') $$, 'real privacy version accepted');

select throws_ok($$ insert into public.children (family_id, first_name, birth_date, gender)
  values (public.my_family_id(), E'abc‮def', current_date - 30, 'girl') $$, '23514', null,
  'direction-override characters are refused in names');
select throws_ok($$ insert into public.children (id, family_id, first_name, birth_date, gender)
  values (gen_random_uuid(), public.my_family_id(), 'Id', current_date - 30, 'girl') $$, '42501', null,
  'the app cannot choose its own ids');

insert into public.children (family_id, first_name, birth_date, gender)
select public.my_family_id(), 'K' || g, current_date - g, 'boy' from generate_series(1, 15) g;
select throws_ok($$ insert into public.children (family_id, first_name, birth_date, gender)
  values (public.my_family_id(), 'Sixteen', current_date - 3, 'boy') $$, '23514', null,
  'a family can have at most 15 children');

select throws_ok($$ insert into public.events (family_id, title, starts_at)
  values (public.my_family_id(), 'Far', now() + interval '9 years') $$, '22023', null,
  'events more than 5 years away are refused');
select throws_ok($$ update public.child_vaccinations set status = 'done', done_on = '1900-01-01'
  where id = (select id from public.child_vaccinations limit 1) $$, '22023', null,
  'a dose cannot be given before birth');
select throws_ok($$ update public.child_vaccinations set due_date = '2999-01-01'
  where id = (select id from public.child_vaccinations limit 1) $$, '22023', null,
  'a dose cannot be moved past age 20');

-- invite guessing limit
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
do $$ begin for i in 1..10 loop perform public.accept_family_invite('GUESS' || i); end loop; end $$;
select throws_ok($$ select public.accept_family_invite('GUESS11') $$, '54000', null,
  'after 10 wrong invite codes in an hour, more tries are refused');
select throws_ok($$ select count(*) from public.invite_attempts $$, '42501', null,
  'parents cannot read the attempt log');

select * from finish();
rollback;
