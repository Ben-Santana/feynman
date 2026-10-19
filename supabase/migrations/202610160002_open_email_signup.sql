begin;

-- Open email signup while retaining the separate WPI SSO admission path.
create function public.signup_allowed(email text, provider text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (provider = 'azure' and email ~* '^[^@[:space:]]+@wpi[.]edu$')
    or (provider = 'email' and public.get_account_auth_mode() = 'email'
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and char_length(email) <= 254), false);
$$;
revoke all on function public.signup_allowed(text, text) from public, anon, authenticated;

create or replace function public.before_wpi_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.signup_allowed(event->'user'->>'email', event->'user'->'app_metadata'->>'provider') then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Use a valid email and the enabled sign-in method.'));
  end if;
  return '{}'::jsonb;
end;
$$;

create function public.enforce_account_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.signup_allowed(new.email, new.raw_app_meta_data->>'provider') then
    raise exception 'Use a valid email and the enabled sign-in method.' using errcode = '23514';
  end if;
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'invite_code';
  return new;
end;
$$;
revoke all on function public.enforce_account_signup() from public, anon, authenticated;
drop trigger require_signup_invite on auth.users;
create trigger require_account_signup before insert on auth.users for each row execute function public.enforce_account_signup();
drop function public.enforce_signup_invite();
drop function public.signup_allowed(text, text, text);
-- The former invite table remains private and unused; no account data is deleted.

create or replace function public.account_allowed() returns boolean
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

commit;
