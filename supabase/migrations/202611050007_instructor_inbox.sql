begin;

create function public.admin_instructor_inbox(actor_id uuid, page_number integer, target_id uuid default null)
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
    where case when target_id is null then not p.approved and r.role = 'instructor'
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

revoke all on function public.admin_instructor_inbox(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.admin_instructor_inbox(uuid, integer, uuid) to service_role;

commit;
