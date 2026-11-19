begin;

-- Lets a course instructor read one enrolled student's session for a published
-- topic: per-concept rubric judgments and the chat transcript. Drafts and queued
-- messages are left out.
create or replace function public.course_student_session(target_course uuid, target_module uuid, target_student uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode = '42501'; end if;
  select jsonb_build_object('sessionId', s.id, 'updatedAt', s.updated_at,
    'concepts', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c->>'id', 'name', c->>'name', 'target', c->>'target', 'rubric', c->'rubric',
        'passed', coalesce(c->'passed', '0'::jsonb), 'stageStart', coalesce(c->'stageStart', '0'::jsonb),
        'finalSummary', c->'finalSummary', 'assessment', c->'assessment', 'assessments', c->'assessments',
        'messages', coalesce(c->'messages', '[]'::jsonb))), '[]'::jsonb)
      from jsonb_array_elements(coalesce(s.document->'session'->'concepts', '[]'::jsonb)) c))
    into result
    from public.course_enrollments e
    join public.course_modules m on m.course_id = e.course_id and m.id = target_module and m.published_at is not null
    join public.course_assignments a on a.module_id = m.id and a.student_id = e.student_id
    join public.learning_sessions s on s.id = a.session_id and s.owner_id = e.student_id
    where e.course_id = target_course and e.student_id = target_student and e.status = 'enrolled';
  return result;
end;
$$;

revoke all on function public.course_student_session(uuid, uuid, uuid) from public, anon;
grant execute on function public.course_student_session(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
