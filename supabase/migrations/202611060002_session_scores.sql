begin;

-- Reports saved before session scoring have no score block, so they keep their
-- original final percentage.
create or replace function public.completed_topic_score(target_student uuid, target_session uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((report->'score'->>'percent')::numeric, (report->'final'->>'percent')::numeric) from public.topic_report_snapshots
    where student_id = target_student and session_id = target_session and finish_mode = 'completed'
    order by watermark desc, created_at desc, id limit 1;
$$;

notify pgrst, 'reload schema';
commit;
