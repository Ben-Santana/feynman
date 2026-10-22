begin;

-- One survey per student, retained even if the completed session is deleted.
create table public.learning_surveys (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  session_id uuid not null,
  topic_title text not null,
  required_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb,
  version text not null default 'salg-v1',
  check ((submitted_at is null and answers is null) or (submitted_at is not null and answers is not null))
);
alter table public.learning_surveys enable row level security;
revoke all on public.learning_surveys from anon, authenticated;
grant all on public.learning_surveys to service_role;

create function public.survey_topic_complete(document jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(document->'session'->>'started' = 'true'
    and jsonb_array_length(document->'session'->'concepts') > 0
    and not exists (
      select 1 from jsonb_array_elements(document->'session'->'concepts') c
      where coalesce((c->>'passed')::numeric >= case c->>'target'
        when 'remember' then 1 when 'understand' then 2 when 'apply' then 3 when 'analyze' then 4 else 999 end, false) = false
    ), false);
$$;

create function public.enforce_learning_survey() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pending public.learning_surveys;
begin
  if not exists(select 1 from public.user_roles where user_id = new.owner_id and role = 'student') then return new; end if;
  -- Serialize completions and starts across devices before checking the requirement.
  perform 1 from public.profiles where id = new.owner_id for update;
  select * into pending from public.learning_surveys where student_id = new.owner_id;
  if pending.student_id is not null and pending.submitted_at is null and pending.session_id <> new.id then
    raise exception 'Complete the learning survey before your next topic.' using errcode = '42501';
  end if;
  if public.survey_topic_complete(new.document) then
    insert into public.learning_surveys(student_id, session_id, topic_title)
      values(new.owner_id, new.id, new.title) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger learning_survey_gate before insert or update on public.learning_sessions
for each row execute function public.enforce_learning_survey();

-- Include students who completed a topic before the survey was introduced.
insert into public.learning_surveys(student_id,session_id,topic_title,required_at)
select distinct on (s.owner_id) s.owner_id,s.id,s.title,s.updated_at
from public.learning_sessions s join public.user_roles r on r.user_id=s.owner_id and r.role='student'
where public.survey_topic_complete(s.document) order by s.owner_id,s.updated_at,s.id;

create function public.learning_survey_status() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  return (select jsonb_build_object('sessionId',session_id,'topicTitle',topic_title,'submittedAt',submitted_at)
    from public.learning_surveys where student_id=auth.uid());
end;
$$;

create function public.submit_learning_survey(responses jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare key text; value jsonb; expected text[] := array['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','concept_change','skills_developed','most_helpful','20','21'];
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  if jsonb_typeof(responses) is distinct from 'object' then raise exception 'Complete every survey question.' using errcode = '23514'; end if;
  if (select count(*) from jsonb_object_keys(responses)) <> cardinality(expected) then raise exception 'Complete every survey question.' using errcode = '23514'; end if;
  foreach key in array expected loop
    value := responses->key;
    if jsonb_typeof(value) is distinct from 'string' then raise exception 'Complete every survey question.' using errcode = '23514'; end if;
    if key ~ '^[0-9]+$' and key::int <= 19 then
      if key::int <= 15 then
        if not (value #>> '{}') = any(array['No Gains','A Little Gain','Moderate Gain','Good Gain','Great Gain','Not Applicable']) then raise exception 'Choose a valid gains response.' using errcode = '23514'; end if;
      else
        if not (value #>> '{}') = any(array['No Help','A Little Help','Moderate Help','Good Help','Great Help','Not Applicable']) then raise exception 'Choose a valid helpfulness response.' using errcode = '23514'; end if;
      end if;
    elsif length(trim(value #>> '{}')) not between 1 and 5000 then
      raise exception 'Written responses must be between 1 and 5,000 characters.' using errcode = '23514';
    end if;
  end loop;
  perform 1 from public.profiles where id=auth.uid() for update;
  update public.learning_surveys set answers=responses,submitted_at=now()
    where student_id=auth.uid() and submitted_at is null;
  if not found then raise exception 'There is no pending survey.' using errcode = '23514'; end if;
end;
$$;

-- The database verifies admin access for both aggregates and individual exports.
create function public.admin_learning_survey_responses() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_allowed() or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin') then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  return jsonb_build_object('pending',(select count(*) from public.learning_surveys where submitted_at is null),
    'responses',coalesce((select jsonb_agg(jsonb_build_object('studentId',s.student_id,'name',p.display_name,'email',p.email,
      'sessionId',s.session_id,'topicTitle',s.topic_title,'requiredAt',s.required_at,'submittedAt',s.submitted_at,'version',s.version,'answers',s.answers) order by s.submitted_at desc)
      from public.learning_surveys s join public.profiles p on p.id=s.student_id where s.submitted_at is not null),'[]'::jsonb));
end;
$$;
revoke all on function public.survey_topic_complete(jsonb), public.enforce_learning_survey(), public.learning_survey_status(), public.submit_learning_survey(jsonb), public.admin_learning_survey_responses() from public, anon, authenticated;
grant execute on function public.learning_survey_status(), public.submit_learning_survey(jsonb), public.admin_learning_survey_responses() to authenticated;
commit;
