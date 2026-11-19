begin;

-- Co-teachers share a course with its owner (courses.instructor_id). A teacher's
-- invitation waits for the invitee to accept it; an admin's assignment is active
-- at once.
create table public.course_teachers (
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('invited','active')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (course_id, teacher_id)
);
create index course_teachers_teacher on public.course_teachers(teacher_id, status);

create function public.course_owner(target_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.account_allowed() and exists (
    select 1 from public.courses c join public.user_roles r on r.user_id = c.instructor_id
    where c.id = target_course and c.instructor_id = auth.uid() and r.role in ('instructor', 'admin')
  );
$$;

-- Every existing teaching permission checks this helper, so active co-teachers
-- receive the owner's access to topics, enrollment, progress, and appearance.
create or replace function public.course_instructor(target_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.course_owner(target_course) or (public.account_allowed() and exists (
    select 1 from public.course_teachers t join public.user_roles r on r.user_id = t.teacher_id
    where t.course_id = target_course and t.teacher_id = auth.uid() and t.status = 'active' and r.role in ('instructor', 'admin')
  ));
$$;

alter table public.course_teachers enable row level security;
create policy visible_course_teachers on public.course_teachers for select to authenticated
  using ((teacher_id = auth.uid() and public.account_allowed()) or public.course_instructor(course_id));
revoke all on public.course_teachers from public, anon, authenticated;
grant select on public.course_teachers to authenticated;
grant all on public.course_teachers to service_role;

-- Shared by teacher invitations and admin assignments.
create function public.course_teacher_candidate(target_course uuid, teacher_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare candidate uuid; owner uuid;
begin
  select instructor_id into owner from public.courses where id = target_course for update;
  if owner is null then raise exception 'Course not found.' using errcode = 'P0002'; end if;
  select p.id into candidate from public.profiles p join public.user_roles r on r.user_id = p.id
    where lower(p.email) = lower(btrim(coalesce(teacher_email, ''))) and p.approved and r.role in ('instructor', 'admin')
    order by p.created_at, p.id limit 1;
  if candidate is null then raise exception 'No teacher account uses that email.' using errcode = 'FA011'; end if;
  if candidate = owner or exists (select 1 from public.course_teachers where course_id = target_course and teacher_id = candidate and status = 'active') then
    raise exception 'That teacher already teaches this course.' using errcode = 'FA012';
  end if;
  if (select count(*) from public.course_teachers where course_id = target_course and teacher_id <> candidate) >= 20 then
    raise exception 'A course can have up to 20 added teachers.' using errcode = 'FA013';
  end if;
  return candidate;
end;
$$;

create function public.invite_course_teacher(target_course uuid, teacher_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare candidate uuid;
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode = '42501'; end if;
  candidate := public.course_teacher_candidate(target_course, teacher_email);
  insert into public.course_teachers(course_id, teacher_id, status, invited_by) values (target_course, candidate, 'invited', auth.uid())
    on conflict do nothing;
end;
$$;

create function public.respond_course_invitation(target_course uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_allowed() or not exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('instructor', 'admin')) then
    raise exception 'Instructor access required.' using errcode = '42501';
  end if;
  if accept then
    update public.course_teachers set status = 'active' where course_id = target_course and teacher_id = auth.uid() and status = 'invited';
  elsif accept is not null then
    delete from public.course_teachers where course_id = target_course and teacher_id = auth.uid() and status = 'invited';
  end if;
  if accept is null or not found then raise exception 'Invitation not found.' using errcode = 'P0002'; end if;
end;
$$;

-- The owner removes anyone, any teacher withdraws a pending invitation, and a
-- co-teacher can leave. The owner is not a row here, so always remains.
create function public.remove_course_teacher(target_course uuid, target_teacher uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  delete from public.course_teachers t where t.course_id = target_course and t.teacher_id = target_teacher
    and (public.course_owner(target_course) or target_teacher = auth.uid() or (t.status = 'invited' and public.course_instructor(target_course)));
  if not found then raise exception 'Teacher not found.' using errcode = 'P0002'; end if;
end;
$$;

create function public.course_invitations() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('courseId', c.id, 'courseName', c.name, 'invitedBy', coalesce(i.display_name, o.display_name))
      order by t.created_at desc, c.id), '[]'::jsonb)
    from public.course_teachers t join public.courses c on c.id = t.course_id
    join public.profiles o on o.id = c.instructor_id left join public.profiles i on i.id = t.invited_by
    where t.teacher_id = auth.uid() and t.status = 'invited'
      and exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('instructor', 'admin')));
end;
$$;

-- Only the owner deletes a course; the original function keeps the deletion steps.
alter function public.delete_course(uuid) rename to delete_owned_course;
revoke all on function public.delete_owned_course(uuid) from public, anon, authenticated;
create function public.delete_course(target_course uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.course_instructor(target_course) and not public.course_owner(target_course) then
    raise exception 'Only the course owner can delete this course.' using errcode = '42501';
  end if;
  perform public.delete_owned_course(target_course);
end;
$$;

-- Students see the active teachers. Teachers also see pending invitations and
-- teacher emails, which they need to manage the team.
create or replace function public.course_people(target_course uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; is_instructor boolean := public.course_instructor(target_course);
begin
  if not is_instructor and not public.course_student(target_course) then
    raise exception 'Course membership required.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.display_name, 'role', member.role,
    'appearance', jsonb_build_object('color', a.appearance->'color', 'shape', a.appearance->'shape', 'accessories', a.appearance->'accessories')
  ) || case when is_instructor and member.role = 'instructor'
    then jsonb_build_object('owner', member.owner, 'invited', member.invited, 'email', p.email) else '{}'::jsonb end
  order by member.role = 'instructor' desc, member.owner desc, member.invited, lower(p.display_name), p.id), '[]'::jsonb) into result
  from (
    select c.instructor_id as id, 'instructor' as role, true as owner, false as invited from public.courses c where c.id = target_course
    union all
    select t.teacher_id, 'instructor', false, t.status = 'invited' from public.course_teachers t
      join public.user_roles r on r.user_id = t.teacher_id and r.role in ('instructor', 'admin')
      where t.course_id = target_course and (t.status = 'active' or is_instructor)
    union all
    select e.student_id, 'student', false, false from public.course_enrollments e
      where e.course_id = target_course and (e.status = 'enrolled' or is_instructor)
  ) member
  join public.profiles p on p.id = member.id
  left join public.user_customizations a on a.user_id = p.id;
  return result;
end;
$$;

-- Administration stays behind the authenticated backend, as in admin_view_course.
create function public.admin_course_teachers(actor_id uuid, target_course uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id where r.user_id = actor_id and r.role = 'admin' and p.approved) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'email', p.email, 'status', member.status)
      order by member.position, lower(p.display_name), p.id), '[]'::jsonb)
    from (
      select c.instructor_id as id, 'owner' as status, 0 as position from public.courses c where c.id = target_course
      union all
      select t.teacher_id, t.status, case t.status when 'active' then 1 else 2 end from public.course_teachers t where t.course_id = target_course
    ) member join public.profiles p on p.id = member.id);
end;
$$;

create function public.admin_assign_course_teacher(actor_id uuid, target_course uuid, teacher_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare candidate uuid;
begin
  if not exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id where r.user_id = actor_id and r.role = 'admin' and p.approved) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  candidate := public.course_teacher_candidate(target_course, teacher_email);
  insert into public.course_teachers(course_id, teacher_id, status, invited_by) values (target_course, candidate, 'active', actor_id)
    on conflict (course_id, teacher_id) do update set status = 'active';
  return public.admin_course_teachers(actor_id, target_course);
end;
$$;

create function public.admin_remove_course_teacher(actor_id uuid, target_course uuid, target_teacher uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id where r.user_id = actor_id and r.role = 'admin' and p.approved) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  delete from public.course_teachers where course_id = target_course and teacher_id = target_teacher;
  if not found then raise exception 'Teacher not found.' using errcode = 'P0002'; end if;
  return public.admin_course_teachers(actor_id, target_course);
end;
$$;

revoke all on function public.course_owner(uuid), public.course_teacher_candidate(uuid, text), public.invite_course_teacher(uuid, text),
  public.respond_course_invitation(uuid, boolean), public.remove_course_teacher(uuid, uuid), public.course_invitations(), public.delete_course(uuid),
  public.admin_course_teachers(uuid, uuid), public.admin_assign_course_teacher(uuid, uuid, text), public.admin_remove_course_teacher(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.course_owner(uuid), public.invite_course_teacher(uuid, text), public.respond_course_invitation(uuid, boolean),
  public.remove_course_teacher(uuid, uuid), public.course_invitations(), public.delete_course(uuid) to authenticated;
grant execute on function public.admin_course_teachers(uuid, uuid), public.admin_assign_course_teacher(uuid, uuid, text),
  public.admin_remove_course_teacher(uuid, uuid, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
