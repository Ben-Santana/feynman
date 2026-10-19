begin;

-- Preserve access for existing accounts; all future profiles start pending.
alter table public.profiles add column approved boolean not null default false;
update public.profiles set approved = true;

create or replace function public.account_signed_in() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u where u.id = auth.uid()
      and u.email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and coalesce(u.raw_app_meta_data->>'provider', '') in ('email', 'azure')
      and (u.raw_app_meta_data->>'provider' <> 'azure' or u.email ~* '^[^@[:space:]]+@wpi[.]edu$')
      and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider not in ('email', 'azure'))
      and (
        (public.get_account_auth_mode() = 'email' and exists (
          select 1 from auth.identities i where i.user_id = u.id and i.provider in ('email', 'azure')))
        or (public.get_account_auth_mode() = 'wpi'
          and u.email_confirmed_at is not null
          and u.email ~* '^[^@[:space:]]+@wpi[.]edu$'
          and coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"oauth"}]'::jsonb
          and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'azure'))
      )
  );
$$;

revoke all on function public.account_signed_in() from public, anon;
grant execute on function public.account_signed_in() to authenticated, service_role;

create or replace function public.account_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.account_signed_in() and exists (
    select 1 from public.profiles where id = auth.uid() and approved
  );
$$;

-- Pending accounts can read only their own identity and approval status.
alter policy own_profile on public.profiles using (id = auth.uid() and public.account_signed_in());
alter policy own_role on public.user_roles using (user_id = auth.uid() and public.account_signed_in());

create function public.admin_approve_account(actor_id uuid, target_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = actor_id and r.role = 'admin' and p.approved
  ) then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  update public.profiles set approved = true where id = target_id;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', target_id, 'approved', true);
end;
$$;
revoke all on function public.admin_approve_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_account(uuid, uuid) to service_role;

commit;
