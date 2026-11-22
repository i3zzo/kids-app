-- Gives one account full access to the admin panel on the TEST server.
-- 1. Sign in once in the test app with that number (so the account exists).
-- 2. In Supabase > SQL Editor, replace the number below (965 + 8 digits, no +) and run.
-- The first super admin can then add other staff from the admin panel's Staff page.
insert into public.staff (user_id, role, display_name)
select id, 'super_admin', 'Ezzo' from auth.users where phone = '96550000101'
on conflict (user_id) do update set role = 'super_admin', active = true;
-- Should return one row:
select s.role, s.display_name, u.phone from public.staff s join auth.users u on u.id = s.user_id;
