begin;

alter table public.profiles add column wpi_role_choice_pending boolean not null default false;

-- New password accounts are instructors. Existing roles are preserved.
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
    when new.raw_app_meta_data->>'provider' = 'email' then 'instructor'::public.account_role
    else 'student'::public.account_role
  end) on conflict do nothing;
  return new;
end;
$$;

-- Keep password access for accounts created before instructor-only signup.
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
          and exists (
            select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) method
            where method->>'method' in ('password', 'recovery', 'email/signup')
          ))
      )
  );
$$;

create or replace function public.approve_new_wpi_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from auth.users u
    where u.id = new.id
      and u.email ~* '^[^@[:space:]]+@wpi[.]edu$'
      and u.raw_app_meta_data->>'provider' = 'azure'
  ) then
    new.approved := true;
    new.wpi_role_choice_pending := true;
  end if;
  return new;
end;
$$;

-- WPI-created accounts already get initial approval from the profile trigger.
-- Relinking their Azure identity must not approve an instructor application.
create or replace function public.approve_linked_wpi_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p set approved = true
  from auth.users u
  where p.id = new.user_id and u.id = p.id and not p.approved
    and u.raw_app_meta_data->>'provider' = 'email'
    and u.email ~* '^[^@[:space:]]+@wpi[.]edu$';
  return new;
end;
$$;

create function public.choose_wpi_account_role(apply_as_instructor boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  choice_pending boolean;
begin
  if apply_as_instructor is null then
    raise exception 'Choose whether to apply as an instructor.' using errcode = '23514';
  end if;
  if not public.account_signed_in()
    or not coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"oauth"}]'::jsonb
    or not exists (select 1 from auth.identities i where i.user_id = auth.uid() and i.provider = 'azure') then
    raise exception 'Sign in with WPI SSO.' using errcode = '42501';
  end if;

  select wpi_role_choice_pending into choice_pending from public.profiles
    where id = auth.uid() for update;
  if choice_pending is not true then return; end if;

  if apply_as_instructor then
    update public.user_roles set role = 'instructor'
      where user_id = auth.uid() and role = 'student';
    if not found then
      raise exception 'Could not apply as an instructor.' using errcode = '42501';
    end if;
  end if;

  update public.profiles
    set wpi_role_choice_pending = false, approved = approved and not apply_as_instructor
    where id = auth.uid();
end;
$$;
revoke all on function public.choose_wpi_account_role(boolean) from public, anon;
grant execute on function public.choose_wpi_account_role(boolean) to authenticated;

commit;
