begin;

-- An admin can set an account up before its owner has ever signed in. The first
-- sign-in creates the account as usual, then takes the role, approval and name
-- recorded here, and the preset is removed.
create table public.account_presets (
  email text primary key check (email = lower(email) and char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  role public.account_role not null,
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  -- An admin preset is only ever applied to a WPI single sign-on, whose email is verified.
  constraint admin_preset_requires_wpi check (role <> 'admin' or email ~ '@wpi[.]edu$')
);
alter table public.account_presets enable row level security;
revoke all on public.account_presets from public, anon, authenticated;
grant select, insert, update, delete on public.account_presets to service_role;

create function public.apply_account_preset() returns trigger
language plpgsql security definer set search_path = '' as $$
declare preset public.account_presets; previous public.account_role;
begin
  select * into preset from public.account_presets where email = lower(new.email) for update;
  if not found then return new; end if;
  -- A password signup does not prove who owns the address, so it can never claim admin.
  if preset.role = 'admin' and coalesce(new.raw_app_meta_data->>'provider', '') <> 'azure' then return new; end if;
  select role into previous from public.user_roles where user_id = new.id;
  if previous is null then return new; end if;
  if previous <> preset.role then
    update public.user_roles set role = preset.role where user_id = new.id;
    insert into public.role_audit(actor_id, target_id, old_role, new_role) values (preset.created_by, new.id, previous, preset.role);
  end if;
  update public.profiles set approved = true, wpi_role_choice_pending = false, instructor_application_pending = false,
    display_name = case when preset.display_name <> '' then preset.display_name else display_name end
    where id = new.id;
  delete from public.account_presets where email = preset.email;
  return new;
end;
$$;
revoke all on function public.apply_account_preset() from public, anon, authenticated;
-- Named to run after wpi_profile_created, which creates the profile and default role.
create trigger wpi_profile_preset after insert on auth.users for each row execute function public.apply_account_preset();

create function public.admin_list_account_presets(actor_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_roles where user_id = actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('email', email, 'role', role, 'display_name', display_name, 'created_at', created_at) order by created_at desc, email) from public.account_presets), '[]'::jsonb);
end;
$$;

create function public.admin_save_account_preset(actor_id uuid, preset_email text, preset_role public.account_role, preset_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare address text := lower(btrim(coalesce(preset_email, ''))); result public.account_presets;
begin
  if not exists (select 1 from public.user_roles where user_id = actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if exists (select 1 from auth.users where lower(email) = address) then
    raise exception 'Account exists' using errcode = '23505';
  end if;
  insert into public.account_presets(email, role, display_name, created_by)
    values (address, preset_role, btrim(coalesce(preset_name, '')), actor_id)
    on conflict (email) do update set role = excluded.role, display_name = excluded.display_name, created_by = excluded.created_by
    returning * into result;
  return jsonb_build_object('email', result.email, 'role', result.role, 'display_name', result.display_name, 'created_at', result.created_at);
end;
$$;

create function public.admin_delete_account_preset(actor_id uuid, preset_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_roles where user_id = actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  delete from public.account_presets where email = lower(btrim(coalesce(preset_email, '')));
end;
$$;

revoke all on function public.admin_list_account_presets(uuid), public.admin_save_account_preset(uuid, text, public.account_role, text), public.admin_delete_account_preset(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_list_account_presets(uuid), public.admin_save_account_preset(uuid, text, public.account_role, text), public.admin_delete_account_preset(uuid, text) to service_role;

commit;
