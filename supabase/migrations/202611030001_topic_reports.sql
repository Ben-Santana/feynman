begin;

create table public.research_participants (
  student_id uuid primary key references public.profiles(id),
  research_code uuid not null unique default gen_random_uuid()
);
create table public.topic_score_topics (
  student_id uuid not null references public.profiles(id),
  session_id uuid not null,
  configuration jsonb not null,
  legacy_document jsonb,
  session_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key(student_id,session_id)
);
create table public.topic_assessment_events (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  student_id uuid not null,
  session_id uuid not null,
  event_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(student_id,session_id) references public.topic_score_topics(student_id,session_id),
  unique(student_id,session_id,event_key)
);
create table public.topic_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  session_id uuid not null,
  watermark bigint not null,
  finish_mode text not null check(finish_mode in ('completed','early')),
  report jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(student_id,session_id) references public.topic_score_topics(student_id,session_id),
  unique(student_id,session_id,watermark,finish_mode)
);

-- All mutations pass through server-only RPCs. Browser document saves cannot
-- overwrite scores, participant codes, first attempts, or report snapshots.
alter table public.research_participants enable row level security;
alter table public.topic_score_topics enable row level security;
alter table public.topic_assessment_events enable row level security;
alter table public.topic_report_snapshots enable row level security;
revoke all on public.research_participants, public.topic_score_topics, public.topic_assessment_events, public.topic_report_snapshots from public,anon,authenticated,service_role;
grant select on public.research_participants, public.topic_score_topics, public.topic_assessment_events, public.topic_report_snapshots to service_role;

create function public.topic_score_context(actor_id uuid,target_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare source jsonb; config jsonb; linked public.course_modules; topic public.topic_score_topics; old_concept jsonb; next_concept jsonb; learning_level text; session_created timestamptz;
begin
  if not exists(select 1 from public.profiles where id=actor_id and approved) then
    raise exception 'Approved account required.' using errcode='42501'; end if;
  if exists(select 1 from public.profiles p where p.id=actor_id and p.consent_required)
    and not exists(select 1 from public.signed_consents where user_id=actor_id) then
    raise exception 'Consent required.' using errcode='42501'; end if;
  select s.document->'session',s.created_at into source,session_created from public.learning_sessions s where s.owner_id=actor_id and s.id=target_session;
  if source is null then raise exception 'Session not found.' using errcode='42501'; end if;
  select m.* into linked from public.course_assignments a join public.course_modules m on m.id=a.module_id
    where a.student_id=actor_id and a.session_id=target_session;
  if linked.id is not null then
    if not exists(select 1 from public.course_enrollments where course_id=linked.course_id and student_id=actor_id and status='enrolled') then
      raise exception 'Course enrollment required.' using errcode='42501'; end if;
    config := linked.document->'session' || jsonb_build_object('assignment',jsonb_build_object('courseId',linked.course_id,'moduleId',linked.id));
  else config := source;
  end if;
  config := public.assignment_configuration(config);
  insert into public.research_participants(student_id) values(actor_id) on conflict do nothing;
  insert into public.topic_score_topics(student_id,session_id,configuration,legacy_document,session_created_at)
    values(actor_id,target_session,config,case when exists(
      select 1 from jsonb_array_elements(source->'concepts') c cross join lateral jsonb_array_elements(coalesce(c->'messages','[]')) m where m->>'role'='user'
    ) then source else null end,session_created) on conflict do nothing;
  select * into topic from public.topic_score_topics where student_id=actor_id and session_id=target_session for update;
  if topic.configuration->'assignment'->>'courseId' is not null and not exists(
    select 1 from public.course_enrollments where course_id=(topic.configuration->'assignment'->>'courseId')::uuid and student_id=actor_id and status='enrolled'
  ) then raise exception 'Course enrollment required.' using errcode='42501'; end if;
  -- Personal sessions may extend their target, as the existing Continue action
  -- permits. Previously scored goals remain fixed; assigned topics never change.
  if linked.id is null and topic.configuration->'assignment'->>'courseId' is null and topic.configuration is distinct from config then
    if topic.configuration->>'learningType' is distinct from config->>'learningType' then
      raise exception 'Start a new session to change the learning type.' using errcode='23514'; end if;
    for old_concept in select value from jsonb_array_elements(topic.configuration->'concepts') loop
      select value into next_concept from jsonb_array_elements(config->'concepts') where value->>'id'=old_concept->>'id';
      if next_concept is null or next_concept->>'name' is distinct from old_concept->>'name'
        or array_position(array['remember','understand','apply','analyze'],next_concept->>'target') < array_position(array['remember','understand','apply','analyze'],old_concept->>'target') then
        raise exception 'Start a new session to change scored goals.' using errcode='23514'; end if;
      foreach learning_level in array (array['remember','understand','apply','analyze'])[1:array_position(array['remember','understand','apply','analyze'],old_concept->>'target')] loop
        if old_concept->'rubric'->>learning_level is distinct from next_concept->'rubric'->>learning_level then
          raise exception 'Start a new session to change scored goals.' using errcode='23514'; end if;
      end loop;
    end loop;
    update public.topic_score_topics set configuration=config where student_id=actor_id and session_id=target_session returning * into topic;
  end if;
  return jsonb_build_object('configuration',topic.configuration,'legacyDocument',topic.legacy_document,'createdAt',topic.session_created_at,'trackingStartedAt',topic.created_at,
    'researchCode',(select research_code from public.research_participants where student_id=actor_id),
    'events',coalesce((select jsonb_agg(to_jsonb(e) - 'student_id' order by sequence) from public.topic_assessment_events e where student_id=actor_id and session_id=target_session),'[]'::jsonb),
    'snapshots',coalesce((select jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at,'watermark',watermark,'finishMode',finish_mode) order by created_at desc,id) from public.topic_report_snapshots where student_id=actor_id and session_id=target_session),'[]'::jsonb));
end;
$$;

create function public.append_topic_assessment(actor_id uuid,target_session uuid,request_key text,event_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result public.topic_assessment_events;
begin
  perform public.topic_score_context(actor_id,target_session);
  event_payload := jsonb_set(event_payload,'{goals}',(
    select coalesce(jsonb_agg(g.value || jsonb_build_object('attempt',
      (select count(*) from public.topic_assessment_events e cross join lateral jsonb_array_elements(e.payload->'goals') prior
        where e.student_id=actor_id and e.session_id=target_session and prior->>'id'=g.value->>'id' and prior->>'firstEligible'='true')
      + case when g.value->>'firstEligible'='true' then 1 else 0 end) order by g.ordinal),'[]'::jsonb)
    from jsonb_array_elements(event_payload->'goals') with ordinality as g(value,ordinal)
  ));
  insert into public.topic_assessment_events(student_id,session_id,event_key,payload) values(actor_id,target_session,request_key,event_payload)
    on conflict do nothing returning * into result;
  if result.id is null then select * into result from public.topic_assessment_events where student_id=actor_id and session_id=target_session and event_key=request_key; end if;
  return to_jsonb(result) - 'student_id';
end;
$$;

create function public.save_topic_report(actor_id uuid,target_session uuid,expected_watermark bigint,mode text,report_document jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result public.topic_report_snapshots;
begin
  perform public.topic_score_context(actor_id,target_session);
  if expected_watermark <> coalesce((select max(sequence) from public.topic_assessment_events where student_id=actor_id and session_id=target_session),0) then
    raise exception 'Assessment changed. Retry saving the report.' using errcode='40001'; end if;
  insert into public.topic_report_snapshots(student_id,session_id,watermark,finish_mode,report)
    values(actor_id,target_session,expected_watermark,mode,report_document) on conflict do nothing returning * into result;
  if result.id is null then select * into result from public.topic_report_snapshots where student_id=actor_id and session_id=target_session and watermark=expected_watermark and finish_mode=mode; end if;
  return jsonb_build_object('id',result.id,'createdAt',result.created_at,'report',result.report);
end;
$$;

create function public.read_topic_report(actor_id uuid,target_session uuid,snapshot_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.topic_score_context(actor_id,target_session);
  return (select jsonb_build_object('id',id,'createdAt',created_at,'report',report) from public.topic_report_snapshots
    where student_id=actor_id and session_id=target_session and id=snapshot_id);
end;
$$;

-- Export only participants with a signed agreement; exempt accounts may still
-- use the student report without silently entering the research dataset.
create function public.topic_research_export(actor_id uuid,target_course uuid,roster boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.user_roles where user_id=actor_id and role='admin') then
    raise exception 'Admin access required.' using errcode='42501'; end if;
  if roster then
    return coalesce((select jsonb_agg(jsonb_build_object('researchCode',r.research_code,'name',p.display_name,'email',p.email))
      from public.research_participants r join public.profiles p on p.id=r.student_id
      where exists(select 1 from public.signed_consents where user_id=r.student_id)
      and exists(select 1 from public.topic_score_topics t where t.student_id=r.student_id and t.configuration->'assignment'->>'courseId'=target_course::text)),'[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('snapshotId',s.id,'createdAt',s.created_at,'report',s.report) order by s.created_at,s.id)
    from public.topic_report_snapshots s join public.topic_score_topics t using(student_id,session_id)
    where t.configuration->'assignment'->>'courseId'=target_course::text
      and exists(select 1 from public.signed_consents where user_id=s.student_id)),'[]'::jsonb);
end;
$$;

revoke all on function public.topic_score_context(uuid,uuid),public.append_topic_assessment(uuid,uuid,text,jsonb),public.save_topic_report(uuid,uuid,bigint,text,jsonb),public.read_topic_report(uuid,uuid,uuid),public.topic_research_export(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.topic_score_context(uuid,uuid),public.append_topic_assessment(uuid,uuid,text,jsonb),public.save_topic_report(uuid,uuid,bigint,text,jsonb),public.read_topic_report(uuid,uuid,uuid),public.topic_research_export(uuid,uuid,boolean) to service_role;
commit;
