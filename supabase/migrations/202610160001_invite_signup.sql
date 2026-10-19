begin;

-- Reusable invitations are managed only through privileged SQL. Store hashes,
-- never the codes themselves, and leave signup closed until a code is added.
create table public.signup_invites (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked boolean not null default false
);
alter table public.signup_invites enable row level security;
revoke all on public.signup_invites from public, anon, authenticated;
grant select, insert, update, delete on public.signup_invites to service_role;

create function public.signup_allowed(email text, provider text, invite_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (provider = 'azure' and email ~* '^[^@[:space:]]+@wpi[.]edu$')
    or (provider = 'email' and public.get_account_auth_mode() = 'email'
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and char_length(email) <= 254
      and char_length(trim(invite_code)) between 1 and 128
      and exists (select 1 from public.signup_invites i
        where i.code_hash = encode(sha256(convert_to(trim(invite_code), 'UTF8')), 'hex')
          and not i.revoked and (i.expires_at is null or i.expires_at > now())))
  , false);
$$;
revoke all on function public.signup_allowed(text, text, text) from public, anon, authenticated;

-- Retain the registered hook name and Azure admission for the future WPI cutover.
create or replace function public.before_wpi_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.signup_allowed(event->'user'->>'email', event->'user'->'app_metadata'->>'provider', event->'user'->'user_metadata'->>'invite_code') then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Use a valid invite code, or sign in with WPI when enabled.'));
  end if;
  return '{}'::jsonb;
end;
$$;

-- Enforce admission even if the Auth hook is disabled or signup is called
-- directly. Remove the submitted code before it is persisted in user metadata.
create function public.enforce_signup_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.signup_allowed(new.email, new.raw_app_meta_data->>'provider', new.raw_user_meta_data->>'invite_code') then
    raise exception 'A valid invite code is required for email signup.' using errcode = '23514';
  end if;
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'invite_code';
  return new;
end;
$$;
revoke all on function public.enforce_signup_invite() from public, anon, authenticated;
create trigger require_signup_invite before insert on auth.users for each row execute function public.enforce_signup_invite();

create or replace function public.sync_wpi_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.email, '') !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    or char_length(new.email) > 254
    or coalesce(new.raw_app_meta_data->>'provider', '') not in ('email', 'azure')
    or (new.raw_app_meta_data->>'provider' = 'azure' and new.email !~* '^[^@[:space:]]+@wpi[.]edu$') then
    raise exception 'Use a valid email and supported sign-in method.' using errcode = '23514';
  end if;
  insert into public.profiles(id, email, display_name, last_login_at)
  values (new.id, lower(new.email), left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)), 100), new.last_sign_in_at)
  on conflict (id) do update set email = excluded.email, last_login_at = excluded.last_login_at, updated_at = now();
  insert into public.user_roles(user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create or replace function public.account_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u where u.id = auth.uid()
      and u.email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and u.email_confirmed_at is not null
      and coalesce(u.raw_app_meta_data->>'provider', '') in ('email', 'azure')
      and (u.raw_app_meta_data->>'provider' <> 'azure' or u.email ~* '^[^@[:space:]]+@wpi[.]edu$')
      and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider not in ('email', 'azure'))
      and (
        (public.get_account_auth_mode() = 'email' and exists (
          select 1 from auth.identities i where i.user_id = u.id and i.provider in ('email', 'azure')))
        or (public.get_account_auth_mode() = 'wpi'
          and u.email ~* '^[^@[:space:]]+@wpi[.]edu$'
          and coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"oauth"}]'::jsonb
          and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'azure'))
      )
  );
$$;

commit;
