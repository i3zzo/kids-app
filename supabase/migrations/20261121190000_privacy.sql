-- =============================================================================
-- Step 8: privacy — export your data, delete your account
-- =============================================================================
-- Plain-language summary
--   * Any parent can download everything Yahal holds about them and their
--     family, as one file (JSON), from Family > Privacy and your data.
--   * Any parent can permanently delete their account.
--       - Family owner: the whole family is deleted with it (children,
--         calendar, vaccinations, supplies, guide progress, invites). The
--         other parent keeps their login but loses access to the family.
--       - Co-parent: only their own account and settings are deleted; the
--         family stays with the owner.
--   * Deleting is immediate and can't be undone. Server backups age out on
--     the hosting provider's backup schedule (see docs/explain/08-privacy.md).
--   * Staff accounts can't delete themselves here: a super admin removes
--     staff first, so the team can't be locked out by mistake.
-- =============================================================================

-- Everything we hold about the signed-in parent and their family.
-- Each part is filtered to this parent or their family explicitly.
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

-- Permanently delete the signed-in parent's account (and, for the owner, the
-- family). The app asks the parent to type a confirmation word; the database
-- also requires it, so a stray call can't delete anything.
create or replace function public.delete_my_account(confirm text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if confirm is distinct from 'DELETE' then
    raise exception 'confirmation missing' using errcode = '22023';
  end if;
  if exists (select 1 from public.staff where user_id = uid) then
    raise exception 'staff accounts are removed by a super admin first' using errcode = '42501';
  end if;
  -- Owner: the family and everything in it (cascades to children, events,
  -- vaccinations, supplies, guide progress, invites, the co-parent's membership).
  delete from public.families f
  using public.family_members m
  where m.family_id = f.id and m.user_id = uid and m.role = 'owner';
  -- The account itself: profile, membership, devices, settings, notification
  -- history and AI usage all cascade from here. Signing in again with the same
  -- phone starts a brand-new, empty account.
  delete from auth.users where id = uid;
end;
$$;
revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
