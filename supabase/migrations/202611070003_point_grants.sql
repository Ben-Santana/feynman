begin;

-- Each grant is kept, so the table is also the audit trail.
create table public.point_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  points integer not null check(points between 1 and 1000000),
  created_at timestamptz not null default now()
);
create index point_grants_user on public.point_grants(user_id);
alter table public.point_grants enable row level security;
revoke all on public.point_grants from public, anon, authenticated;

create function public.admin_grant_points(actor_id uuid, target_id uuid, amount integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.user_roles where user_id = actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if not exists(select 1 from public.profiles where id = target_id) then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  insert into public.point_grants(user_id,actor_id,points) values(target_id,actor_id,amount);
  return jsonb_build_object('id', target_id, 'points', amount);
end;
$$;
revoke all on function public.admin_grant_points(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_grant_points(uuid, uuid, integer) to service_role;

create or replace function public.cosmetic_wallet() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'points', case when exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then null else
      (select coalesce(sum(points),0) from public.point_awards where student_id = auth.uid())
      + (select coalesce(sum(points),0) from public.point_grants where user_id = auth.uid())
      - (select coalesce(sum(price),0) from public.cosmetic_purchases where user_id = auth.uid()) end,
    'owned', (select coalesce(jsonb_agg(item_id order by item_id),'[]'::jsonb) from public.cosmetic_purchases where user_id = auth.uid()));
end;
$$;

notify pgrst, 'reload schema';
commit;
