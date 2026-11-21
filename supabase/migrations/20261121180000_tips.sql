-- =============================================================================
-- Step 7: tips library per age, and AI personalisation
-- =============================================================================
-- Plain-language summary
--   * A reviewed library of short tips by age band (0–3 months ... 7–10 years)
--     and section (sleep, feeding, activities, learning, health). It is health
--     content: only a health reviewer can publish a tip.
--   * The app shows a "tip of the day" for each child and the full list.
--   * Optional "personalise with AI": a server function rewrites the reviewed
--     tips for one child. It sends the AI only the child's age in months and
--     gender, never the name or anything else, and parents cannot type free
--     text into it. Each parent can use it at most 20 times a day.
-- =============================================================================

create table public.tips (
  id              uuid primary key default gen_random_uuid(),
  section         text not null check (section in ('sleep', 'feeding', 'activities', 'learning', 'health')),
  min_age_months  int not null check (min_age_months between 0 and 131),
  max_age_months  int not null check (max_age_months between 0 and 131),
  only_gender     text check (only_gender in ('girl', 'boy')),
  title_ar        text not null check (char_length(title_ar) between 1 and 120),
  title_en        text not null check (char_length(title_en) between 1 and 120),
  body_ar         text not null check (char_length(body_ar) between 1 and 800),
  body_en         text not null check (char_length(body_en) between 1 and 800),
  source          text check (char_length(source) <= 200),
  sort_order      int not null default 0,
  status          text not null default 'draft' check (status in ('draft', 'in_review', 'published')),
  reviewed_by     uuid references auth.users (id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (min_age_months <= max_age_months)
);
create index tips_age_idx on public.tips (min_age_months, max_age_months, section) where status = 'published';

alter table public.tips enable row level security;
revoke all on public.tips from anon, authenticated;
grant select, insert, update, delete on public.tips to authenticated;
grant select on public.tips to anon;
revoke update (reviewed_by, reviewed_at) on public.tips from authenticated;
create policy tips_read on public.tips for select to anon, authenticated using (status = 'published');
create policy tips_staff_read on public.tips for select to authenticated using ((select public.staff_role()) is not null);
create policy tips_staff_insert on public.tips for insert to authenticated with check ((select public.staff_role()) is not null);
create policy tips_staff_update on public.tips for update to authenticated
  using ((select public.staff_role()) is not null) with check ((select public.staff_role()) is not null);
create policy tips_staff_delete on public.tips for delete to authenticated using ((select public.staff_role()) is not null);
create trigger tips_touch before update on public.tips for each row execute function public.touch_updated_at();
create trigger tips_review before insert or update on public.tips for each row execute function public.content_review_guard('health');
create trigger tips_audit after insert or update or delete on public.tips for each row execute function public.audit_change('id');

-- -----------------------------------------------------------------------------
-- AI use limit: 20 personalised answers per parent per day
-- -----------------------------------------------------------------------------
create table public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  at       timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage (user_id, at);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Called by the AI server function with the parent's own login. Returns true
-- and records the use, or false when today's limit is reached.
create or replace function public.claim_ai_request()
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if (select count(*) from public.ai_usage where user_id = uid and at > now() - interval '1 day') >= 20 then
    return false;
  end if;
  insert into public.ai_usage (user_id) values (uid);
  -- keep the table small
  delete from public.ai_usage where user_id = uid and at < now() - interval '2 days';
  return true;
end;
$$;
revoke execute on function public.claim_ai_request() from public, anon;
grant execute on function public.claim_ai_request() to authenticated;
