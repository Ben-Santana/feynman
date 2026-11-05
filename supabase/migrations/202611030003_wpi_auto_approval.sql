begin;

-- Approval follows the trusted authentication provider, never signup metadata.
create function public.approve_new_wpi_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from auth.users u
    where u.id = new.id
      and u.email ~* '^[^@[:space:]]+@wpi[.]edu$'
      and u.raw_app_meta_data->>'provider' = 'azure'
  ) then
    new.approved := true;
  end if;
  return new;
end;
$$;
revoke all on function public.approve_new_wpi_profile() from public, anon, authenticated;
create trigger approve_new_wpi_profile before insert on public.profiles
for each row execute function public.approve_new_wpi_profile();

-- Include accounts originally created with a password and later linked to WPI.
update public.profiles p set approved = true
where not p.approved and exists (
  select 1 from auth.users u where u.id = p.id
    and u.email ~* '^[^@[:space:]]+@wpi[.]edu$'
    and (u.raw_app_meta_data->>'provider' = 'azure' or exists (
      select 1 from auth.identities i where i.user_id = u.id and i.provider = 'azure'
    ))
);

commit;
