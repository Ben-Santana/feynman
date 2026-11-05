begin;

create function public.restart_course_module(target_module uuid, previous_session uuid) returns public.learning_sessions
language plpgsql security definer set search_path = '' as $$
declare current_session uuid; result public.learning_sessions;
begin
  if not exists(select 1 from public.course_modules m where m.id = target_module and m.published_at is not null and public.course_student(m.course_id)) then
    raise exception 'Course enrollment required.' using errcode = '42501';
  end if;

  -- Use the same lock as start_course_module so retries and concurrent starts
  -- all see the same active attempt.
  perform 1 from public.profiles where id = auth.uid() for update;
  select session_id into current_session from public.course_assignments where student_id = auth.uid() and module_id = target_module;
  if current_session is null or not exists(
    select 1 from public.learning_sessions where owner_id = auth.uid() and id = previous_session
      and document->'session'->'assignment'->>'moduleId' = target_module::text
  ) then raise exception 'Assigned session not found.' using errcode = '42501'; end if;

  if current_session = previous_session then
    if not exists(select 1 from public.topic_report_snapshots where student_id = auth.uid() and session_id = previous_session) then
      raise exception 'Save the topic report before restarting.' using errcode = '23514';
    end if;
    -- Keep the previous chat, assessments and report under their original ID.
    delete from public.course_assignments where student_id = auth.uid() and module_id = target_module;
  end if;
  result := public.start_course_module(target_module);
  return result;
end;
$$;

revoke all on function public.restart_course_module(uuid, uuid) from public, anon;
grant execute on function public.restart_course_module(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
