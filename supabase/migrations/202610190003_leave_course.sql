begin;

create function public.leave_course(target_course uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_allowed() or not exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'student'
  ) then
    raise exception 'Student access required.' using errcode = '42501';
  end if;
  -- Serialize with joins, enrollment decisions, pins, and course deletion.
  perform 1 from public.courses where id = target_course for update;
  delete from public.course_enrollments
    where course_id = target_course and student_id = auth.uid() and status in ('enrolled', 'pending');
  if not found then
    -- Keep rejected requests so leaving cannot bypass an instructor's decision.
    raise exception 'Active enrollment or pending request required.' using errcode = '42501';
  end if;
  delete from public.course_pins where course_id = target_course and user_id = auth.uid();
  -- Keep assignment links and sessions for resuming after re-enrollment.
  -- Existing enrollment checks prevent module starts, saves, and chat while away.
end;
$$;

revoke all on function public.leave_course(uuid) from public, anon;
grant execute on function public.leave_course(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
