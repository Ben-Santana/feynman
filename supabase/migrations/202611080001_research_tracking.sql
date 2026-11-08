begin;

-- Pre-topic self-assessment for instructor-assigned topics. One answer set per
-- student and topic, captured before the first attempt starts. Restarts reuse it.
create table public.topic_prequestionnaires (
  student_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.course_modules(id) on delete cascade,
  course_id uuid not null,
  -- The first attempt's session, filled in when the topic starts.
  session_id uuid,
  topic_title text not null,
  concepts jsonb not null check (jsonb_typeof(concepts) = 'array'),
  prior_exposure text not null check (prior_exposure in ('none', 'this_course', 'elsewhere')),
  expected_score integer not null check (expected_score between 0 and 100 and expected_score % 10 = 0),
  concept_ratings jsonb not null check (jsonb_typeof(concept_ratings) = 'object'),
  version text not null default 'pre-topic-v1',
  submitted_at timestamptz not null default now(),
  primary key (student_id, module_id)
);
create index topic_prequestionnaires_course on public.topic_prequestionnaires(course_id);

-- Student activity for engagement and retention. 'active' is one row per minute
-- of visible, recently used app time; other events mark discrete actions.
create table public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event text not null check (event in ('app_open', 'topic_open', 'active', 'report_view')),
  session_id uuid,
  course_id uuid,
  module_id uuid,
  occurred_at timestamptz not null default now()
);
create index activity_events_user_time on public.activity_events(user_id, occurred_at);
create index activity_events_time on public.activity_events(occurred_at);

alter table public.topic_prequestionnaires enable row level security;
alter table public.activity_events enable row level security;
revoke all on public.topic_prequestionnaires, public.activity_events from public, anon, authenticated;
grant select on public.topic_prequestionnaires, public.activity_events to service_role;

create function public.submit_topic_prequestionnaire(target_module uuid, prior text, expected integer, ratings jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare module public.course_modules; concept jsonb; rating jsonb; concept_count integer;
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  select * into module from public.course_modules where id = target_module;
  if module.published_at is null or not public.course_student(module.course_id) then raise exception 'Course enrollment required.' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  if exists(select 1 from public.topic_prequestionnaires where student_id = auth.uid() and module_id = target_module) then
    return jsonb_build_object('moduleId', target_module, 'submitted', true);
  end if;
  if exists(select 1 from public.course_assignments where student_id = auth.uid() and module_id = target_module) then
    raise exception 'This topic has already started.' using errcode = '23514';
  end if;
  if prior is null or prior not in ('none', 'this_course', 'elsewhere') then raise exception 'Choose whether you have studied this topic before.' using errcode = '23514'; end if;
  if expected is null or expected not between 0 and 100 or expected % 10 <> 0 then raise exception 'Choose your expected score.' using errcode = '23514'; end if;
  if jsonb_typeof(ratings) is distinct from 'object' then raise exception 'Rate every concept.' using errcode = '23514'; end if;
  select count(*) into concept_count from jsonb_array_elements(module.document->'session'->'concepts');
  if (select count(*) from jsonb_object_keys(ratings)) <> concept_count then raise exception 'Rate every concept.' using errcode = '23514'; end if;
  for concept in select value from jsonb_array_elements(module.document->'session'->'concepts') loop
    rating := ratings->(concept->>'id');
    if jsonb_typeof(rating) is distinct from 'number' or (rating #>> '{}') !~ '^[1-5]$' then raise exception 'Rate every concept.' using errcode = '23514'; end if;
  end loop;
  insert into public.research_participants(student_id) values(auth.uid()) on conflict do nothing;
  insert into public.topic_prequestionnaires(student_id, module_id, course_id, topic_title, concepts, prior_exposure, expected_score, concept_ratings)
    values(auth.uid(), module.id, module.course_id, module.title,
      (select coalesce(jsonb_agg(jsonb_build_object('id', value->'id', 'name', value->'name', 'target', value->'target') order by ordinal), '[]'::jsonb)
        from jsonb_array_elements(module.document->'session'->'concepts') with ordinality as c(value, ordinal)),
      prior, expected, ratings);
  return jsonb_build_object('moduleId', target_module, 'submitted', true);
end;
$$;

-- Same as before, except a first start requires the pre-topic questions and
-- links them to the new session. Restarts skip the check.
create or replace function public.start_course_module(target_module uuid) returns public.learning_sessions
language plpgsql security definer set search_path = '' as $$
declare module public.course_modules; course public.courses; result public.learning_sessions; existing uuid; concepts jsonb; assignment jsonb;
begin
  select * into module from public.course_modules where id = target_module;
  if module.published_at is null or not public.course_student(module.course_id) then raise exception 'Course enrollment required.' using errcode = '42501'; end if;
  -- Serializes starts for this student, including starts on another device.
  perform 1 from public.profiles where id = auth.uid() for update;
  select session_id into existing from public.course_assignments where student_id = auth.uid() and module_id = target_module;
  if existing is not null then select * into result from public.learning_sessions where owner_id = auth.uid() and id = existing; return result; end if;
  if coalesce(current_setting('feynman.restarting_module', true), '') <> target_module::text
    and not exists(select 1 from public.topic_prequestionnaires where student_id = auth.uid() and module_id = target_module) then
    raise exception 'Answer the pre-topic questions first.' using errcode = 'FA010';
  end if;
  select * into course from public.courses where id = module.course_id;
  assignment := jsonb_build_object('courseId',course.id,'courseName',course.name,'moduleId',module.id);
  select jsonb_agg(value || jsonb_build_object('passed',0,'stageStart',0,'messages',jsonb_build_array(jsonb_build_object('role','assistant','content','Teach me about ' || (value->>'name') || '.')),'draft','','assessment',null,'assessments','{}'::jsonb,'expression','attentive')) into concepts
    from jsonb_array_elements(module.document->'session'->'concepts');
  insert into public.learning_sessions(owner_id,id,title,document) values(auth.uid(),gen_random_uuid(),module.title,
    jsonb_build_object('version',1,'session',jsonb_build_object('title',module.title,'started',true,'learningType',module.document->'session'->>'learningType','concepts',concepts,'activeId',concepts->0->>'id','files','[]'::jsonb,'assignment',assignment))) returning * into result;
  update public.learning_sessions set document = jsonb_set(document,'{session,id}',to_jsonb(result.id::text)) where owner_id = auth.uid() and id = result.id returning * into result;
  insert into public.course_assignments values(auth.uid(),module.id,result.id);
  update public.topic_prequestionnaires set session_id = result.id where student_id = auth.uid() and module_id = module.id and session_id is null;
  return result;
end;
$$;

create or replace function public.restart_course_module(target_module uuid, previous_session uuid) returns public.learning_sessions
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
  -- A restart is not a first attempt, so it never asks the pre-topic questions.
  perform set_config('feynman.restarting_module', target_module::text, true);
  result := public.start_course_module(target_module);
  perform set_config('feynman.restarting_module', '', true);
  return result;
end;
$$;

create function public.log_activity(event_name text, target_session uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare linked public.course_modules; window_seconds integer;
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  if event_name is null or event_name not in ('app_open', 'topic_open', 'active', 'report_view') then raise exception 'Choose a valid activity.' using errcode = '23514'; end if;
  if not exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'student') then return; end if;
  if target_session is not null and not exists(select 1 from public.learning_sessions where owner_id = auth.uid() and id = target_session) then target_session := null; end if;
  -- Repeated calls from reloads, several tabs, or retries count once.
  window_seconds := case event_name when 'active' then 50 else 300 end;
  if exists(select 1 from public.activity_events where user_id = auth.uid() and event = event_name
    and session_id is not distinct from (case when event_name = 'active' then session_id else target_session end)
    and occurred_at > now() - make_interval(secs => window_seconds)) then return; end if;
  select m.* into linked from public.course_assignments a join public.course_modules m on m.id = a.module_id
    where a.student_id = auth.uid() and a.session_id = target_session;
  insert into public.research_participants(student_id) values(auth.uid()) on conflict do nothing;
  insert into public.activity_events(user_id, event, session_id, course_id, module_id)
    values(auth.uid(), event_name, target_session, linked.course_id, linked.id);
end;
$$;

-- Research population: approved students with a signed agreement, optionally
-- limited to one course's enrolled students.
create function public.research_population(target_course uuid) returns table(user_id uuid)
language sql stable security definer set search_path = '' as $$
  select r.user_id from public.user_roles r join public.profiles p on p.id = r.user_id
  where r.role = 'student' and p.approved and exists(select 1 from public.signed_consents c where c.user_id = r.user_id)
    and (target_course is null or exists(select 1 from public.course_enrollments e where e.course_id = target_course and e.student_id = r.user_id and e.status = 'enrolled'));
$$;

-- Latest completed report for a session, or null while unfinished.
create function public.completed_topic_report(target_student uuid, target_session uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select report || jsonb_build_object('savedAt', created_at) from public.topic_report_snapshots
    where student_id = target_student and session_id = target_session and finish_mode = 'completed'
    order by watermark desc, created_at desc, id limit 1;
$$;

create function public.assert_research_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.account_allowed() or not exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
end;
$$;

create function public.admin_research_analytics(window_days integer default 30, target_course uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; today date := (now() at time zone 'UTC')::date; start_day date;
begin
  perform public.assert_research_admin();
  if window_days not in (7, 30, 90) then raise exception 'Choose a valid date range.' using errcode = '22023'; end if;
  start_day := today - (window_days - 1);
  with pop as (select user_id from public.research_population(target_course)),
  acts as (select a.* from public.activity_events a join pop using(user_id)),
  recent as (select * from acts where (occurred_at at time zone 'UTC')::date >= start_day),
  daily as (
    select day::date as date, count(distinct r.user_id) as students, count(r.id) filter (where r.event = 'active') as minutes
    from generate_series(start_day, today, interval '1 day') day
    left join recent r on (r.occurred_at at time zone 'UTC')::date = day::date group by day
  ),
  per_student as (
    select user_id, count(distinct (occurred_at at time zone 'UTC')::date) as days, count(*) filter (where event = 'active') as minutes
    from recent group by user_id
  ),
  firsts as (select user_id, min(date_trunc('week', occurred_at at time zone 'UTC'))::date as cohort from acts group by user_id),
  weeks as (select distinct user_id, date_trunc('week', occurred_at at time zone 'UTC')::date as week from acts),
  cohorts as (select cohort, count(*) as size from firsts where cohort >= date_trunc('week', today::timestamp)::date - 7 * 7 group by cohort),
  retention as (
    select c.cohort, c.size, k.offset_week,
      case when c.cohort + k.offset_week * 7 > today then null else
        (select count(*) from firsts f join weeks w on w.user_id = f.user_id and w.week = c.cohort + k.offset_week * 7 where f.cohort = c.cohort) end as active
    from cohorts c cross join generate_series(0, 4) k(offset_week)
  ),
  completed as (
    select count(distinct (s.student_id, s.session_id)) as topics from public.topic_report_snapshots s join pop on pop.user_id = s.student_id
      join public.topic_score_topics t using(student_id, session_id)
    where s.finish_mode = 'completed' and (s.created_at at time zone 'UTC')::date >= start_day
      and t.configuration->'assignment'->>'courseId' is not null
      and (target_course is null or t.configuration->'assignment'->>'courseId' = target_course::text)
  ),
  pq as (
    select q.*, public.completed_topic_report(q.student_id, q.session_id) as report
    from public.topic_prequestionnaires q join pop on pop.user_id = q.student_id
    where target_course is null or q.course_id = target_course
  ),
  scored as (select pq.*, coalesce((report->'score'->>'percent')::numeric, (report->'final'->>'percent')::numeric) as actual from pq where report is not null),
  ratings as (
    select (r.value #>> '{}')::int as rating, (select (c->>'percent')::numeric from jsonb_array_elements(pq.report->'concepts') c where c->>'id' = r.key) as score
    from pq cross join lateral jsonb_each(pq.concept_ratings) r
  ),
  topics as (
    select pq.module_id, max(pq.topic_title) as title, max(co.name) as course, count(*) as responses, count(s.actual) as completed,
      avg(pq.expected_score) as expected, avg(s.actual) as actual
    from pq left join scored s using(student_id, module_id) left join public.courses co on co.id = pq.course_id
    group by pq.module_id
  )
  select jsonb_build_object(
    'days', window_days, 'generatedAt', now(),
    'engagement', jsonb_build_object(
      'participants', (select count(*) from pop),
      'everActive', (select count(distinct user_id) from acts),
      'active', (select count(*) from per_student),
      'returning', (select count(*) from per_student where days >= 2),
      'minutes', (select coalesce(sum(minutes), 0) from per_student),
      'medianMinutes', (select percentile_cont(.5) within group (order by minutes) from per_student),
      'topicOpens', (select count(*) from recent where event = 'topic_open'),
      'topicsCompleted', (select topics from completed),
      'trackingStartedAt', (select min(occurred_at) from public.activity_events),
      'daily', (select coalesce(jsonb_agg(daily order by date), '[]'::jsonb) from daily),
      'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('week', cohort, 'size', size, 'active', active) order by cohort desc), '[]'::jsonb)
        from (select cohort, size, jsonb_agg(active order by offset_week) as active from retention group by cohort, size) grouped)
    ),
    'prequestionnaire', jsonb_build_object(
      'responses', (select count(*) from pq),
      'students', (select count(distinct student_id) from pq),
      'completed', (select count(*) from scored),
      'expected', (select avg(expected_score) from pq),
      'actual', (select avg(actual) from scored),
      'gap', (select avg(expected_score - actual) from scored),
      'points', (select coalesce(jsonb_agg(jsonb_build_object('expected', expected_score, 'actual', actual, 'title', topic_title)), '[]'::jsonb) from scored where actual is not null),
      'ratings', (select jsonb_agg(jsonb_build_object('rating', level, 'count', (select count(*) from ratings where rating = level),
        'scored', (select count(score) from ratings where rating = level), 'score', (select avg(score) from ratings where rating = level)) order by level) from generate_series(1, 5) level),
      'prior', (select jsonb_build_object('none', count(*) filter (where prior_exposure = 'none'), 'this_course', count(*) filter (where prior_exposure = 'this_course'), 'elsewhere', count(*) filter (where prior_exposure = 'elsewhere')) from pq),
      'topics', (select coalesce(jsonb_agg(jsonb_build_object('moduleId', module_id, 'title', title, 'course', course, 'responses', responses, 'completed', completed, 'expected', expected, 'actual', actual) order by course, title), '[]'::jsonb) from topics)
    )
  ) into result;
  return result;
end;
$$;

-- Courses with published topics, for the analytics course filter.
create function public.admin_research_courses() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_research_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name, c.id), '[]'::jsonb)
    from public.courses c where exists(select 1 from public.course_modules m where m.course_id = c.id and m.published_at is not null));
end;
$$;

-- Row exports use participant codes, never names or emails.
create function public.admin_research_rows(kind text, target_course uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_research_admin();
  insert into public.research_participants(student_id) select user_id from public.research_population(target_course) on conflict do nothing;
  if kind = 'prequestionnaire' then
    return (with pq as (
      select q.*, r.research_code, public.completed_topic_report(q.student_id, q.session_id) as report
      from public.topic_prequestionnaires q join public.research_population(target_course) pop on pop.user_id = q.student_id
        join public.research_participants r on r.student_id = q.student_id
      where target_course is null or q.course_id = target_course
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'participant_code', pq.research_code, 'course_id', pq.course_id, 'module_id', pq.module_id, 'topic_title', pq.topic_title, 'session_id', pq.session_id,
      'questionnaire_version', pq.version, 'submitted_at', pq.submitted_at, 'prior_exposure', pq.prior_exposure, 'expected_score', pq.expected_score,
      'concept_id', c.value->>'id', 'concept_name', c.value->>'name', 'concept_target', c.value->>'target', 'self_rating', (pq.concept_ratings->>(c.value->>'id'))::int,
      'topic_completed', pq.report is not null, 'report_saved_at', pq.report->>'savedAt',
      'topic_score', coalesce(pq.report->'score'->>'percent', pq.report->'final'->>'percent'),
      'concept_score', (select x->>'percent' from jsonb_array_elements(pq.report->'concepts') x where x->>'id' = c.value->>'id'),
      'research_first_score', pq.report->'first'->>'percent', 'research_final_score', pq.report->'final'->>'percent'
    ) order by pq.submitted_at, pq.research_code, c.ordinal), '[]'::jsonb)
    from pq cross join lateral jsonb_array_elements(pq.concepts) with ordinality as c(value, ordinal));
  elsif kind = 'activity' then
    return (select coalesce(jsonb_agg(jsonb_build_object('participant_code', r.research_code, 'event', a.event, 'occurred_at', a.occurred_at,
      'session_id', a.session_id, 'course_id', a.course_id, 'module_id', a.module_id) order by a.occurred_at, a.id), '[]'::jsonb)
      from public.activity_events a join public.research_population(target_course) pop on pop.user_id = a.user_id
        join public.research_participants r on r.student_id = a.user_id);
  elsif kind = 'activity_summary' then
    return (select coalesce(jsonb_agg(jsonb_build_object(
      'participant_code', r.research_code,
      'first_active_at', s.first_at, 'last_active_at', s.last_at,
      'active_days', coalesce(s.days, 0), 'active_weeks', coalesce(s.weeks, 0), 'active_minutes', coalesce(s.minutes, 0),
      'app_opens', coalesce(s.opens, 0), 'topic_opens', coalesce(s.topic_opens, 0), 'report_views', coalesce(s.report_views, 0),
      'assigned_topics_started', (select count(*) from public.course_assignments a join public.course_modules m on m.id = a.module_id
        where a.student_id = pop.user_id and (target_course is null or m.course_id = target_course)),
      'assigned_topics_completed', (select count(distinct t.session_id) from public.topic_score_topics t
        where t.student_id = pop.user_id and t.configuration->'assignment'->>'courseId' is not null
          and (target_course is null or t.configuration->'assignment'->>'courseId' = target_course::text)
          and exists(select 1 from public.topic_report_snapshots x where x.student_id = t.student_id and x.session_id = t.session_id and x.finish_mode = 'completed'))
    ) order by r.research_code), '[]'::jsonb)
    from public.research_population(target_course) pop join public.research_participants r on r.student_id = pop.user_id
    left join lateral (
      select min(occurred_at) as first_at, max(occurred_at) as last_at,
        count(distinct (occurred_at at time zone 'UTC')::date) as days, count(distinct date_trunc('week', occurred_at at time zone 'UTC')) as weeks,
        count(*) filter (where event = 'active') as minutes, count(*) filter (where event = 'app_open') as opens,
        count(*) filter (where event = 'topic_open') as topic_opens, count(*) filter (where event = 'report_view') as report_views
      from public.activity_events e where e.user_id = pop.user_id
    ) s on true);
  end if;
  raise exception 'Choose a valid export.' using errcode = '22023';
end;
$$;

-- The roster also covers participants who only have pre-topic answers or
-- activity, so every code in the tracking exports can be matched.
create or replace function public.topic_research_export(actor_id uuid,target_course uuid,roster boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.user_roles where user_id=actor_id and role='admin') then
    raise exception 'Admin access required.' using errcode='42501'; end if;
  if roster then
    insert into public.research_participants(student_id) select user_id from public.research_population(target_course) on conflict do nothing;
    return coalesce((select jsonb_agg(jsonb_build_object('researchCode',r.research_code,'name',p.display_name,'email',p.email) order by p.display_name, r.research_code)
      from public.research_participants r join public.profiles p on p.id=r.student_id
      where exists(select 1 from public.signed_consents where user_id=r.student_id)
      and (exists(select 1 from public.topic_score_topics t where t.student_id=r.student_id and t.configuration->'assignment'->>'courseId'=target_course::text)
        or exists(select 1 from public.research_population(target_course) pop where pop.user_id=r.student_id))),'[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('snapshotId',s.id,'createdAt',s.created_at,'report',s.report) order by s.created_at,s.id)
    from public.topic_report_snapshots s join public.topic_score_topics t using(student_id,session_id)
    where t.configuration->'assignment'->>'courseId'=target_course::text
      and exists(select 1 from public.signed_consents where user_id=s.student_id)),'[]'::jsonb);
end;
$$;

revoke all on function public.submit_topic_prequestionnaire(uuid, text, integer, jsonb), public.log_activity(text, uuid),
  public.research_population(uuid), public.completed_topic_report(uuid, uuid), public.assert_research_admin(),
  public.admin_research_analytics(integer, uuid), public.admin_research_rows(text, uuid), public.admin_research_courses() from public, anon, authenticated;
grant execute on function public.submit_topic_prequestionnaire(uuid, text, integer, jsonb), public.log_activity(text, uuid),
  public.admin_research_analytics(integer, uuid), public.admin_research_rows(text, uuid), public.admin_research_courses() to authenticated;

notify pgrst, 'reload schema';
commit;
