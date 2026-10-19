begin;

-- A single protected setting drives the login screen, API, and every RLS policy.
create table public.account_auth_settings (
  singleton boolean primary key default true check (singleton),
  mode text not null check (mode in ('email', 'wpi'))
);
insert into public.account_auth_settings(mode) values ('email');
alter table public.account_auth_settings enable row level security;
revoke all on public.account_auth_settings from public, anon, authenticated;
grant select, update on public.account_auth_settings to service_role;

create function public.get_account_auth_mode() returns text
language sql stable security definer set search_path = '' as $$
  select mode from public.account_auth_settings where singleton;
$$;
revoke all on function public.get_account_auth_mode() from public;
grant execute on function public.get_account_auth_mode() to anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.account_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u where u.id = auth.uid()
      and u.email ~* '^[^@[:space:]]+@wpi[.]edu$'
      and u.email_confirmed_at is not null
      and coalesce(u.raw_app_meta_data->>'provider', '') in ('email', 'azure')
      and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider not in ('email', 'azure'))
      and (
        (public.get_account_auth_mode() = 'email' and exists (
          select 1 from auth.identities i where i.user_id = u.id and i.provider in ('email', 'azure')
        ))
        or (public.get_account_auth_mode() = 'wpi'
          and coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"oauth"}]'::jsonb
          and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'azure'))
      )
  );
$$;

-- Keep the existing hook name so installations that already enabled it upgrade
-- without reconfiguring their hook. It rejects email signups after SSO cutover.
create or replace function public.before_wpi_user_created(event jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare provider text := coalesce(event->'user'->'app_metadata'->>'provider', '');
begin
  if coalesce(event->'user'->>'email', '') !~* '^[^@[:space:]]+@wpi[.]edu$'
    or not (provider = 'azure' or (provider = 'email' and public.get_account_auth_mode() = 'email')) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Use the enabled sign-in method with your WPI email address.'));
  end if;
  return '{}'::jsonb;
end;
$$;

create or replace function public.sync_wpi_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.email, '') !~* '^[^@[:space:]]+@wpi[.]edu$'
    or coalesce(new.raw_app_meta_data->>'provider', '') not in ('email', 'azure')
    or (tg_op = 'INSERT' and new.raw_app_meta_data->>'provider' = 'email' and public.get_account_auth_mode() is distinct from 'email') then
    raise exception 'Use the enabled sign-in method with your WPI email address.' using errcode = '23514';
  end if;
  -- Updates must still work for existing email accounts during identity linking.
  -- Profile/role IDs remain unchanged when Azure is added to an existing user.
  insert into public.profiles(id, email, display_name, last_login_at)
  values (new.id, lower(new.email), left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)), 100), new.last_sign_in_at)
  on conflict (id) do update set email = excluded.email, last_login_at = excluded.last_login_at, updated_at = now();
  insert into public.user_roles(user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

commit;
