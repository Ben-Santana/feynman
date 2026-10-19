begin;

create function public.delete_course_module(target_module uuid, expected_revision bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare target_course uuid; current_revision bigint;
begin
  select course_id into target_course from public.course_modules where id = target_module;
  -- Match course deletion's lock order. Module starts and publishes must finish
  -- before its assignment links and learning sessions are removed together.
  perform 1 from public.courses where id = target_course for update;
  if not public.course_instructor(target_course) then
    raise exception 'Instructor access required.' using errcode = '42501';
  end if;
  select revision into current_revision from public.course_modules where id = target_module for update;
  if current_revision is distinct from expected_revision or current_revision is null then
    raise exception 'Module changed on another device. Reload before deleting.' using errcode = '40001';
  end if;
  with removed as (
    delete from public.course_assignments where module_id = target_module
      returning student_id, session_id
  )
  delete from public.learning_sessions s using removed r
    where s.owner_id = r.student_id and s.id = r.session_id;
  delete from public.course_modules where id = target_module;
end;
$$;

revoke all on function public.delete_course_module(uuid, bigint) from public, anon;
grant execute on function public.delete_course_module(uuid, bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
