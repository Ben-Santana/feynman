begin;

alter table public.account_auth_settings drop constraint account_auth_settings_mode_check;
alter table public.account_auth_settings add constraint account_auth_settings_mode_check
  check (mode in ('email', 'wpi', 'both'));

create or replace function public.signup_allowed(email text, provider text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (provider = 'azure' and email ~* '^[^@[:space:]]+@wpi[.]edu$')
    or (provider = 'email' and public.get_account_auth_mode() in ('email', 'both')
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and char_length(email) <= 254), false);
$$;

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

  insert into public.user_roles(user_id, role)
  values (new.id, case
    when public.get_account_auth_mode() = 'both' and new.raw_app_meta_data->>'provider' = 'email'
      then 'instructor'::public.account_role
    when public.get_account_auth_mode() = 'email' and tg_op = 'INSERT'
      and new.raw_app_meta_data->>'provider' = 'email' and new.raw_user_meta_data->>'role' = 'instructor'
      then 'instructor'::public.account_role
    else 'student'::public.account_role
  end) on conflict do nothing;
  return new;
end;
$$;

drop function public.set_pending_account_role(public.account_role);

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
        or (public.get_account_auth_mode() in ('wpi', 'both')
          and u.email_confirmed_at is not null
          and u.email ~* '^[^@[:space:]]+@wpi[.]edu$'
          and coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"oauth"}]'::jsonb
          and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'azure'))
        or (public.get_account_auth_mode() = 'both'
          and u.raw_app_meta_data->>'provider' = 'email'
          and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
          and exists (select 1 from public.user_roles r where r.user_id = u.id and r.role in ('instructor', 'admin'))
          and exists (
            select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) method
            where method->>'method' in ('password', 'recovery', 'email/signup')
          ))
      )
  );
$$;

-- WPI-only projects already have SSO configured. Turn on the second path.
update public.account_auth_settings set mode = 'both' where singleton and mode = 'wpi';

commit;
