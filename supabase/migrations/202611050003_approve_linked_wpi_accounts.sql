begin;

-- A password account can gain a WPI identity after its profile already exists.
create function public.approve_linked_wpi_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p set approved = true
  from auth.users u
  where p.id = new.user_id and u.id = p.id and not p.approved
    and u.email ~* '^[^@[:space:]]+@wpi[.]edu$';
  return new;
end;
$$;
revoke all on function public.approve_linked_wpi_account() from public, anon, authenticated;
create trigger approve_linked_wpi_account after insert on auth.identities
for each row when (new.provider = 'azure')
execute function public.approve_linked_wpi_account();

-- Catch accounts that linked WPI after the original approval migration ran.
update public.profiles p set approved = true
from auth.users u
where p.id = u.id and not p.approved
  and u.email ~* '^[^@[:space:]]+@wpi[.]edu$'
  and exists (
    select 1 from auth.identities i where i.user_id = u.id and i.provider = 'azure'
  );

commit;
