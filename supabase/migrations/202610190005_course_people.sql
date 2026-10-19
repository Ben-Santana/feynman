begin;

-- Share only course identities and avatar fields; keep profiles and progress private.
create function public.course_people(target_course uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; is_instructor boolean := public.course_instructor(target_course);
begin
  if not is_instructor and not public.course_student(target_course) then
    raise exception 'Course membership required.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.display_name, 'role', member.role,
    'appearance', jsonb_build_object('color', a.appearance->'color', 'shape', a.appearance->'shape', 'accessories', a.appearance->'accessories')
  ) order by member.role = 'instructor' desc, lower(p.display_name), p.id), '[]'::jsonb) into result
  from (
    select c.instructor_id as id, 'instructor' as role from public.courses c where c.id = target_course
    union all
    select e.student_id, 'student' from public.course_enrollments e
      where e.course_id = target_course and (e.status = 'enrolled' or is_instructor)
  ) member
  join public.profiles p on p.id = member.id
  left join public.user_customizations a on a.user_id = p.id;
  return result;
end;
$$;

revoke all on function public.course_people(uuid) from public, anon;
grant execute on function public.course_people(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
