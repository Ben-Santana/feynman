begin;

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
  -- Accept only the two public signup roles, once at account creation.
  -- Later metadata edits and sign-ins cannot change an assigned role.
  insert into public.user_roles(user_id, role)
  values (new.id, case
    when TG_OP = 'INSERT' and new.raw_user_meta_data->>'role' = 'instructor'
      then 'instructor'::public.account_role
    else 'student'::public.account_role
  end) on conflict do nothing;
  return new;
end;
$$;

commit;
