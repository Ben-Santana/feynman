begin;

-- A preset can also name courses. At the first sign-in a student is enrolled in
-- them and an instructor or admin becomes one of their teachers. Until then the
-- person has no account, so they do not appear in the course's People tab.
alter table public.account_presets add column course_ids uuid[] not null default '{}' check (cardinality(course_ids) <= 20);

create or replace function public.apply_account_preset() returns trigger
language plpgsql security definer set search_path = '' as $$
declare preset public.account_presets; previous public.account_role; inviter uuid;
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
  -- Courses deleted since the preset was made are skipped.
  if preset.role = 'student' then
    insert into public.course_enrollments(course_id, student_id, status)
      select c.id, new.id, 'enrolled' from public.courses c where c.id = any(preset.course_ids)
      on conflict (course_id, student_id) do update set status = 'enrolled';
  else
    select id into inviter from public.profiles where id = preset.created_by;
    insert into public.course_teachers(course_id, teacher_id, status, invited_by)
      select c.id, new.id, 'active', inviter from public.courses c where c.id = any(preset.course_ids)
      on conflict (course_id, teacher_id) do update set status = 'active';
  end if;
  delete from public.account_presets where email = preset.email;
  return new;
end;
$$;

create or replace function public.admin_list_account_presets(actor_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_roles where user_id = actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('email', p.email, 'role', p.role, 'display_name', p.display_name, 'created_at', p.created_at,
      'courses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name) from public.courses c where c.id = any(p.course_ids)), '[]'::jsonb))
    order by p.created_at desc, p.email) from public.account_presets p), '[]'::jsonb);
end;
$$;

-- Every course an admin can pick for a preset.
create function public.admin_preset_course_options(actor_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_roles where user_id = actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name) from (select id, name from public.courses order by name limit 1000) listed), '[]'::jsonb);
end;
$$;

drop function public.admin_save_account_preset(uuid, text, public.account_role, text);
create function public.admin_save_account_preset(actor_id uuid, preset_email text, preset_role public.account_role, preset_name text, preset_courses uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare address text := lower(btrim(coalesce(preset_email, ''))); chosen uuid[];
begin
  if not exists (select 1 from public.user_roles where user_id = actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if exists (select 1 from auth.users where lower(email) = address) then
    raise exception 'Account exists' using errcode = '23505';
  end if;
  select coalesce(array_agg(distinct course), '{}') into chosen from unnest(coalesce(preset_courses, '{}')) course;
  if exists (select 1 from unnest(chosen) course where not exists (select 1 from public.courses c where c.id = course)) then
    raise exception 'Course not found' using errcode = '23503';
  end if;
  insert into public.account_presets(email, role, display_name, created_by, course_ids)
    values (address, preset_role, btrim(coalesce(preset_name, '')), actor_id, chosen)
    on conflict (email) do update set role = excluded.role, display_name = excluded.display_name, created_by = excluded.created_by, course_ids = excluded.course_ids;
  return (select value from jsonb_array_elements(public.admin_list_account_presets(actor_id)) value where value->>'email' = address);
end;
$$;

revoke all on function public.admin_preset_course_options(uuid), public.admin_save_account_preset(uuid, text, public.account_role, text, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_preset_course_options(uuid), public.admin_save_account_preset(uuid, text, public.account_role, text, uuid[]) to service_role;

commit;
