begin;

create table public.course_pins (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  primary key (user_id, course_id)
);
alter table public.course_pins enable row level security;
create policy own_course_pins on public.course_pins for select to authenticated
  using (user_id = auth.uid() and public.account_allowed());
revoke all on public.course_pins from public, anon, authenticated;
grant select on public.course_pins to authenticated;
grant all on public.course_pins to service_role;

create function public.set_course_pin(target_course uuid, pinned boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.courses where id = target_course for update;
  if not (public.course_instructor(target_course) or public.course_requested(target_course)) then
    raise exception 'Course access required.' using errcode = '42501';
  end if;
  if pinned is null then raise exception 'Choose a valid pin setting.' using errcode = '23514'; end if;
  if pinned then
    insert into public.course_pins(user_id, course_id) values (auth.uid(), target_course) on conflict do nothing;
  else
    delete from public.course_pins where user_id = auth.uid() and course_id = target_course;
  end if;
end;
$$;

create function public.delete_course(target_course uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.courses where id = target_course for update;
  if not public.course_instructor(target_course) then
    raise exception 'Instructor access required.' using errcode = '42501';
  end if;
  -- Lock modules before removing assignment links so concurrent starts cannot
  -- leave a partially deleted course. All changes commit together.
  perform 1 from public.course_modules where course_id = target_course for update;
  with removed as (
    delete from public.course_assignments a using public.course_modules m
      where a.module_id = m.id and m.course_id = target_course
      returning a.student_id, a.session_id
  )
  delete from public.learning_sessions s using removed r
    where s.owner_id = r.student_id and s.id = r.session_id;
  delete from public.course_modules where course_id = target_course;
  delete from public.course_enrollments where course_id = target_course;
  delete from public.courses where id = target_course;
end;
$$;

revoke all on function public.set_course_pin(uuid, boolean), public.delete_course(uuid) from public, anon;
grant execute on function public.set_course_pin(uuid, boolean), public.delete_course(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
