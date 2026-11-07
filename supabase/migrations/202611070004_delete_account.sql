begin;

-- Signed consents outlive the account as standalone records, so they can no
-- longer restrict profile deletion. The table stays select/insert only.
alter table public.signed_consents drop constraint signed_consents_user_id_fkey;

-- Chats stay retained everywhere except admin_delete_account, which marks its
-- own transaction for the one account it is deleting.
create or replace function public.prevent_learning_session_deletion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('feynman.deleting_account', true) = old.owner_id::text then return old; end if;
  end if;
  raise exception 'Chats are retained and cannot be deleted.' using errcode = '42501';
end;
$$;

create function public.assert_account_deletable(actor_id uuid, target_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.user_roles where user_id = actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if not exists(select 1 from public.profiles where id = target_id) then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  -- Also protects the final admin: the acting admin always remains.
  if actor_id = target_id then
    raise exception 'Cannot delete own account' using errcode = 'FA001';
  end if;
  if exists(select 1 from public.courses where instructor_id = target_id) then
    raise exception 'Account owns courses' using errcode = 'FA002';
  end if;
end;
$$;

-- Storage objects must be removed through the Storage API, so the backend
-- removes these before calling admin_delete_account. A failure stays retryable.
create function public.admin_account_deletion_files(actor_id uuid, target_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_account_deletable(actor_id, target_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'path', o.name))
    from storage.objects o
    where o.bucket_id in ('learning-attachments', 'dashboard-banners')
      and split_part(o.name, '/', 1) = target_id::text
  ), '[]'::jsonb);
end;
$$;

create function public.admin_delete_account(actor_id uuid, target_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  -- Shares admin_set_role's lock so admins cannot delete or demote each other at once.
  perform pg_advisory_xact_lock(6767001);
  perform public.assert_account_deletable(actor_id, target_id);
  perform set_config('feynman.deleting_account', target_id::text, true);
  delete from public.topic_assessment_events where student_id = target_id;
  delete from public.topic_report_snapshots where student_id = target_id;
  delete from public.topic_score_topics where student_id = target_id;
  delete from public.research_participants where student_id = target_id;
  delete from public.course_assignments where student_id = target_id;
  delete from public.course_enrollments where student_id = target_id;
  delete from public.ai_usage_events where user_id = target_id;
  delete from public.role_audit where role_audit.target_id = admin_delete_account.target_id;
  -- Cascades to the profile, chats, survey, points, and customizations.
  delete from auth.users where id = target_id;
  perform set_config('feynman.deleting_account', '', true);
  return jsonb_build_object('id', target_id);
end;
$$;

revoke all on function public.assert_account_deletable(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_account_deletion_files(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_account_deletion_files(uuid, uuid) to service_role;
grant execute on function public.admin_delete_account(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
