begin;

-- A survey taken by choice, before any topic is completed, has no session.
alter table public.learning_surveys
  alter column session_id drop not null,
  alter column topic_title drop not null;

create or replace function public.submit_learning_survey(responses jsonb) returns void
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
  if found then return; end if;
  -- No completed topic yet: a student may still take the survey by choice.
  if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='student') then
    raise exception 'There is no pending survey.' using errcode = '23514';
  end if;
  insert into public.learning_surveys(student_id,submitted_at,answers)
    values(auth.uid(),now(),responses) on conflict do nothing;
  if not found then raise exception 'You already submitted the learning survey.' using errcode = '23514'; end if;
end;
$$;

create or replace function public.admin_learning_survey_responses() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_allowed() or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin') then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  return jsonb_build_object('pending',(select count(*) from public.learning_surveys where submitted_at is null),
    'responses',coalesce((select jsonb_agg(jsonb_build_object('studentId',s.student_id,'name',p.display_name,'email',p.email,
      'sessionId',coalesce(s.session_id::text,''),'topicTitle',coalesce(s.topic_title,''),'requiredAt',s.required_at,'submittedAt',s.submitted_at,'version',s.version,'answers',s.answers) order by s.submitted_at desc)
      from public.learning_surveys s join public.profiles p on p.id=s.student_id where s.submitted_at is not null),'[]'::jsonb));
end;
$$;
commit;
