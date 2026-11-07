begin;

alter table public.profiles add column instructor_application_pending boolean not null default false;

create function public.apply_as_instructor() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_allowed() then
    raise exception 'Sign in to your student account.' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = auth.uid() and approved for update;
  if not found then
    raise exception 'Sign in to your student account.' using errcode = '42501';
  end if;

  perform 1 from public.user_roles where user_id = auth.uid() and role = 'student' for update;
  if not found then
    raise exception 'Only students can apply to be a professor.' using errcode = '42501';
  end if;

  update public.profiles set instructor_application_pending = true
    where id = auth.uid() and not instructor_application_pending;
end;
$$;

revoke all on function public.apply_as_instructor() from public, anon;
grant execute on function public.apply_as_instructor() to authenticated;

create or replace function public.admin_approve_account(actor_id uuid, target_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  application_pending boolean;
begin
  if not exists (
    select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = actor_id and r.role = 'admin' and p.approved
  ) then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  select instructor_application_pending into application_pending
    from public.profiles where id = target_id for update;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
  if application_pending then
    update public.user_roles set role = 'instructor'
      where user_id = target_id and role = 'student';
    if found then
      insert into public.role_audit(actor_id, target_id, old_role, new_role)
        values (actor_id, target_id, 'student', 'instructor');
    end if;
  end if;

  update public.profiles set approved = true, instructor_application_pending = false
    where id = target_id;
  return jsonb_build_object('id', target_id, 'approved', true)
    || case when application_pending then jsonb_build_object(
      'instructor_application_pending', false,
      'role', (select role from public.user_roles where user_id = target_id)
    ) else '{}'::jsonb end;
end;
$$;

create or replace function public.admin_instructor_inbox(actor_id uuid, page_number integer, target_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  total bigint;
  items jsonb;
begin
  if not exists (
    select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = actor_id and r.role = 'admin' and p.approved
  ) then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if page_number is null or page_number < 1 or page_number > 100000 then
    raise exception 'Invalid page';
  end if;

  with matching as (
    select p.*, r.role
    from public.profiles p join public.user_roles r on r.user_id = p.id
    where case when target_id is null then (not p.approved and r.role = 'instructor')
      or (p.instructor_application_pending and r.role = 'student')
      else p.id = target_id end
  )
  select (select count(*) from matching),
    coalesce(jsonb_agg(items_row order by items_row.created_at desc, items_row.id), '[]'::jsonb)
  into total, items
  from (
    select * from matching order by created_at desc, id
    limit 25 offset (page_number - 1) * 25
  ) items_row;

  return jsonb_build_object('users', items, 'total', total, 'page', page_number, 'pageSize', 25);
end;
$$;

commit;
