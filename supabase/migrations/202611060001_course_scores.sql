begin;

-- Only the score from a finished topic is exposed. Report contents, evidence,
-- and early-finish snapshots stay behind the server-only report RPCs.
create function public.completed_topic_score(target_student uuid, target_session uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select (report->'final'->>'percent')::numeric from public.topic_report_snapshots
    where student_id = target_student and session_id = target_session and finish_mode = 'completed'
    order by watermark desc, created_at desc, id limit 1;
$$;
revoke all on function public.completed_topic_score(uuid, uuid) from public, anon, authenticated;

create function public.own_topic_scores(target_sessions uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('sessionId', session_id, 'score', public.completed_topic_score(auth.uid(), session_id))), '[]'::jsonb)
    from unnest(target_sessions) session_id;
$$;
revoke all on function public.own_topic_scores(uuid[]) from public, anon;
grant execute on function public.own_topic_scores(uuid[]) to authenticated;

-- finalSummary is a flag so teachers see the same completion state as students
-- without receiving the student's summary text.
create or replace function public.course_progress(target_course uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('studentId',p.id,'name',p.display_name,'email',p.email,'status',e.status,
    'modules',(select coalesce(jsonb_agg(jsonb_build_object('moduleId',m.id,'concepts',
      (select coalesce(jsonb_agg(jsonb_build_object('id',config->>'id','name',config->>'name','target',config->>'target','passed',coalesce(progress->'passed','0'::jsonb),'finalSummary',coalesce(progress->>'finalSummary','') <> '')), '[]'::jsonb)
        from jsonb_array_elements(m.document->'session'->'concepts') config
        left join lateral (select value as progress from jsonb_array_elements(coalesce(s.document->'session'->'concepts','[]'::jsonb)) where value->>'id' = config->>'id') cp on true),
      'started',a.session_id is not null,
      'score',public.completed_topic_score(p.id,a.session_id)) order by m.published_at,m.id),'[]'::jsonb)
      from public.course_modules m left join public.course_assignments a on a.module_id=m.id and a.student_id=p.id
      left join public.learning_sessions s on s.id=a.session_id and s.owner_id=p.id
      where m.course_id=target_course and m.published_at is not null and e.status='enrolled')) order by e.created_at,p.id),'[]'::jsonb) into result
    from public.course_enrollments e join public.profiles p on p.id=e.student_id where e.course_id=target_course;
  return result;
end;
$$;

notify pgrst, 'reload schema';
commit;
