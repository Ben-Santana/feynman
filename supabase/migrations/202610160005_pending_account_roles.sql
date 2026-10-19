begin;

create function public.set_pending_account_role(new_role public.account_role)
returns public.account_role
language plpgsql security definer set search_path = '' as $$
declare
  is_approved boolean;
begin
  if not public.account_signed_in() then
    raise exception 'Sign in to your account.' using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('student', 'instructor') then
    raise exception 'Choose Instructor or Student.' using errcode = '23514';
  end if;
  -- Serialize with admin approval so a role cannot change after approval.
  select approved into is_approved from public.profiles
    where id = auth.uid() for update;
  if not found or is_approved then
    raise exception 'Only pending accounts can change their account type.' using errcode = '42501';
  end if;
  update public.user_roles set role = new_role
    where user_id = auth.uid() and role in ('student', 'instructor');
  if not found then
    raise exception 'Could not update your account type.' using errcode = '42501';
  end if;
  return new_role;
end;
$$;

revoke all on function public.set_pending_account_role(public.account_role) from public, anon;
grant execute on function public.set_pending_account_role(public.account_role) to authenticated;

commit;
