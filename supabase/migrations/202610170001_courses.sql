begin;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  code text not null unique check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  enrollment_mode text not null default 'open' check (enrollment_mode in ('open','approval')),
  created_at timestamptz not null default now()
);
create table public.course_enrollments (
  course_id uuid not null references public.courses(id),
  student_id uuid not null references public.profiles(id),
  status text not null check (status in ('pending','enrolled','rejected')),
  created_at timestamptz not null default now(),
  primary key (course_id, student_id)
);
create index course_enrollments_student on public.course_enrollments(student_id, course_id);
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  title text not null default '' check (char_length(title) <= 120),
  document jsonb not null default '{"version":1,"session":{}}' check (coalesce(document @> '{"version":1}'::jsonb and jsonb_typeof(document->'session') = 'object', false)),
  revision bigint not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index course_modules_course on public.course_modules(course_id, published_at, created_at);
create table public.course_assignments (
  student_id uuid not null,
  module_id uuid not null references public.course_modules(id),
  session_id uuid not null,
  primary key (student_id, module_id),
  unique (student_id, session_id),
  foreign key (student_id, session_id) references public.learning_sessions(owner_id, id)
);

-- Helpers avoid recursive RLS and always check the current approved account/role.
create function public.course_instructor(target_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.account_allowed() and exists (
    select 1 from public.courses c join public.user_roles r on r.user_id = c.instructor_id
    where c.id = target_course and c.instructor_id = auth.uid() and r.role = 'instructor'
  );
$$;
create function public.course_student(target_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.account_allowed() and exists (
    select 1 from public.course_enrollments e join public.user_roles r on r.user_id = e.student_id
    where e.course_id = target_course and e.student_id = auth.uid() and e.status = 'enrolled' and r.role = 'student'
  );
$$;
create function public.course_requested(target_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.account_allowed() and exists (
    select 1 from public.course_enrollments where course_id = target_course and student_id = auth.uid()
  );
$$;
alter table public.courses enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_assignments enable row level security;
create policy visible_courses on public.courses for select to authenticated using (public.course_instructor(id) or public.course_requested(id));
create policy visible_enrollment on public.course_enrollments for select to authenticated using (public.course_instructor(course_id) or (student_id = auth.uid() and public.account_allowed()));
create policy visible_modules on public.course_modules for select to authenticated using (public.course_instructor(course_id) or (published_at is not null and public.course_student(course_id)));
create policy own_assignments on public.course_assignments for select to authenticated using (student_id = auth.uid() and public.account_allowed());
revoke all on public.courses, public.course_enrollments, public.course_modules, public.course_assignments from public, anon, authenticated;
grant select on public.courses, public.course_enrollments, public.course_modules, public.course_assignments to authenticated;
grant all on public.courses, public.course_enrollments, public.course_modules, public.course_assignments to service_role;

create function public.create_course(course_name text, enrollment text default 'open') returns public.courses
language plpgsql security definer set search_path = '' as $$
declare result public.courses; candidate text; alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; random_bits bytea;
begin
  if not public.account_allowed() or not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'instructor') then
    raise exception 'Instructor access required.' using errcode = '42501';
  end if;
  for attempt in 1..20 loop
    random_bits := uuid_send(gen_random_uuid()); candidate := '';
    for position in 0..5 loop
      candidate := candidate || substr(alphabet, (get_byte(random_bits, position) & 31) + 1, 1);
    end loop;
    insert into public.courses(instructor_id, name, code, enrollment_mode) values (auth.uid(), btrim(course_name), candidate, enrollment)
      on conflict (code) do nothing returning * into result;
    if result.id is not null then return result; end if;
  end loop;
  raise exception 'Could not generate a course code. Retry.';
end;
$$;
create function public.join_course(course_code text) returns public.course_enrollments
language plpgsql security definer set search_path = '' as $$
declare course public.courses; result public.course_enrollments;
begin
  if not public.account_allowed() or not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'student') then
    raise exception 'Student access required.' using errcode = '42501';
  end if;
  select * into course from public.courses where code = upper(btrim(course_code)) for update;
  if course.id is null then raise exception 'Course code not found.' using errcode = 'P0002'; end if;
  insert into public.course_enrollments(course_id, student_id, status)
    values (course.id, auth.uid(), case when course.enrollment_mode = 'open' then 'enrolled' else 'pending' end)
    on conflict do nothing;
  select * into result from public.course_enrollments where course_id = course.id and student_id = auth.uid();
  return result;
end;
$$;
create function public.set_course_enrollment(target_course uuid, enrollment text) returns public.courses
language plpgsql security definer set search_path = '' as $$
declare result public.courses;
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode = '42501'; end if;
  select * into result from public.courses where id = target_course for update;
  update public.courses set enrollment_mode = enrollment where id = target_course returning * into result;
  if enrollment = 'open' then update public.course_enrollments set status = 'enrolled' where course_id = target_course and status = 'pending'; end if;
  return result;
end;
$$;
create function public.decide_course_enrollment(target_course uuid, target_student uuid, decision text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode = '42501'; end if;
  perform 1 from public.courses where id = target_course for update;
  if decision not in ('enrolled','rejected') or decision is null then raise exception 'Invalid decision.' using errcode = '23514'; end if;
  update public.course_enrollments set status = decision where course_id = target_course and student_id = target_student and status <> 'enrolled';
  if not found then raise exception 'Request not found or already enrolled.' using errcode = 'P0002'; end if;
end;
$$;

create function public.save_course_module(target_course uuid, target_module uuid, module_title text, module_document jsonb, expected_revision bigint) returns public.course_modules
language plpgsql security definer set search_path = '' as $$
declare result public.course_modules;
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode = '42501'; end if;
  if expected_revision = 0 then
    insert into public.course_modules(id, course_id, title, document) values (target_module, target_course, btrim(module_title), module_document)
      on conflict do nothing returning * into result;
  else
    update public.course_modules set title = btrim(module_title), document = module_document, revision = revision + 1
      where id = target_module and course_id = target_course and published_at is null and revision = expected_revision returning * into result;
  end if;
  if result.id is null then raise exception 'Module changed or is already published. Reload before editing.' using errcode = '40001'; end if;
  return result;
end;
$$;

create function public.publish_course_module(target_module uuid, expected_revision bigint) returns public.course_modules
language plpgsql security definer set search_path = '' as $$
declare result public.course_modules; source jsonb; concept jsonb; cleaned jsonb := '[]'; names text[] := '{}'; ids text[] := '{}'; level text; target integer; levels constant text[] := array['remember','understand','apply','analyze'];
begin
  select * into result from public.course_modules where id = target_module for update;
  if not public.course_instructor(result.course_id) then raise exception 'Instructor access required.' using errcode = '42501'; end if;
  if result.published_at is not null or result.revision <> expected_revision then raise exception 'Module changed. Reload before publishing.' using errcode = '40001'; end if;
  source := result.document->'session';
  if btrim(result.title) = '' or source->>'learningType' is null or source->>'learningType' not in ('theoretical','quantitative','experimental','design')
    or jsonb_typeof(source->'concepts') is distinct from 'array' then raise exception 'Complete the module setup.' using errcode = '23514'; end if;
  if jsonb_array_length(source->'concepts') not between 1 and 20 then raise exception 'Add 1 to 20 concepts.' using errcode = '23514'; end if;
  for concept in select value from jsonb_array_elements(source->'concepts') loop
    target := array_position(levels, concept->>'target');
    if coalesce(btrim(concept->>'name'), '') = '' or char_length(concept->>'name') > 300 or coalesce(concept->>'id','') = ''
      or lower(btrim(concept->>'name')) = any(names) or concept->>'id' = any(ids) or target is null then
      raise exception 'Enter distinct concepts and valid targets.' using errcode = '23514';
    end if;
    foreach level in array levels[1:target] loop
      if jsonb_typeof(concept->'rubric'->level) is distinct from 'string' or btrim(concept->'rubric'->>level) = '' or char_length(concept->'rubric'->>level) > 1000 then
        raise exception 'Complete the rubric through each target.' using errcode = '23514';
      end if;
    end loop;
    names := array_append(names, lower(btrim(concept->>'name'))); ids := array_append(ids, concept->>'id');
    cleaned := cleaned || jsonb_build_array(jsonb_build_object('id',concept->>'id','name',btrim(concept->>'name'),'target',concept->>'target','rubric',jsonb_build_object('remember',coalesce(concept->'rubric'->>'remember',''),'understand',coalesce(concept->'rubric'->>'understand',''),'apply',coalesce(concept->'rubric'->>'apply',''),'analyze',coalesce(concept->'rubric'->>'analyze',''))));
  end loop;
  -- Published rows contain only assignment configuration, never source files or instructor work.
  update public.course_modules set document = jsonb_build_object('version',1,'session',jsonb_build_object('title',result.title,'learningType',source->>'learningType','concepts',cleaned)),
    published_at = now(), revision = revision + 1 where id = target_module returning * into result;
  return result;
end;
$$;

create function public.start_course_module(target_module uuid) returns public.learning_sessions
language plpgsql security definer set search_path = '' as $$
declare module public.course_modules; course public.courses; result public.learning_sessions; existing uuid; concepts jsonb; assignment jsonb;
begin
  select * into module from public.course_modules where id = target_module;
  if module.published_at is null or not public.course_student(module.course_id) then raise exception 'Course enrollment required.' using errcode = '42501'; end if;
  -- Serializes starts for this student, including starts on another device.
  perform 1 from public.profiles where id = auth.uid() for update;
  select session_id into existing from public.course_assignments where student_id = auth.uid() and module_id = target_module;
  if existing is not null then select * into result from public.learning_sessions where owner_id = auth.uid() and id = existing; return result; end if;
  select * into course from public.courses where id = module.course_id;
  assignment := jsonb_build_object('courseId',course.id,'courseName',course.name,'moduleId',module.id);
  select jsonb_agg(value || jsonb_build_object('passed',0,'stageStart',0,'messages',jsonb_build_array(jsonb_build_object('role','assistant','content','Teach me about ' || (value->>'name') || '.')),'draft','','assessment',null,'assessments','{}'::jsonb,'expression','attentive')) into concepts
    from jsonb_array_elements(module.document->'session'->'concepts');
  insert into public.learning_sessions(owner_id,id,title,document) values(auth.uid(),gen_random_uuid(),module.title,
    jsonb_build_object('version',1,'session',jsonb_build_object('title',module.title,'started',true,'learningType',module.document->'session'->>'learningType','concepts',concepts,'activeId',concepts->0->>'id','files','[]'::jsonb,'assignment',assignment))) returning * into result;
  update public.learning_sessions set document = jsonb_set(document,'{session,id}',to_jsonb(result.id::text)) where owner_id = auth.uid() and id = result.id returning * into result;
  insert into public.course_assignments values(auth.uid(),module.id,result.id);
  return result;
end;
$$;

-- Canonical fixed configuration for comparison during ordinary session saves.
create function public.assignment_configuration(session_data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('title',session_data->'title','learningType',session_data->'learningType','assignment',session_data->'assignment',
    'concepts',(select jsonb_agg(jsonb_build_object('id',value->'id','name',value->'name','target',value->'target','rubric',value->'rubric') order by ordinal)
    from jsonb_array_elements(session_data->'concepts') with ordinality as concepts(value,ordinal)));
$$;
create or replace function public.save_learning_session(session_id uuid, session_title text, session_document jsonb, expected_revision bigint)
returns public.learning_sessions language plpgsql security definer set search_path = '' as $$
declare result public.learning_sessions; original public.learning_sessions; linked uuid; concept jsonb;
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  select module_id into linked from public.course_assignments where student_id = auth.uid() and course_assignments.session_id = save_learning_session.session_id;
  if linked is not null then
    select * into original from public.learning_sessions where owner_id = auth.uid() and id = session_id;
    if not exists(select 1 from public.course_modules m where m.id = linked and public.course_student(m.course_id)) then raise exception 'Course enrollment required.' using errcode = '42501'; end if;
    if session_title is distinct from original.title or session_document->'session'->'started' is distinct from 'true'::jsonb
      or public.assignment_configuration(session_document->'session') is distinct from public.assignment_configuration(original.document->'session') then
      raise exception 'Assigned modules cannot be changed.' using errcode = '23514';
    end if;
    for concept in select value from jsonb_array_elements(session_document->'session'->'concepts') loop
      if jsonb_typeof(concept->'passed') is distinct from 'number' or (concept->>'passed') !~ '^[0-4]$' then
        raise exception 'Invalid assignment progress.' using errcode = '23514';
      end if;
      if (concept->>'passed')::integer > array_position(array['remember','understand','apply','analyze'],concept->>'target') then
        raise exception 'Invalid assignment progress.' using errcode = '23514';
      end if;
    end loop;
  elsif session_document->'session' ? 'assignment' then raise exception 'Invalid assignment link.' using errcode = '23514';
  end if;
  if expected_revision = 0 then
    insert into public.learning_sessions(owner_id,id,title,document) values(auth.uid(),session_id,session_title,session_document)
      on conflict do nothing returning * into result;
  else
    update public.learning_sessions set title = session_title, document = session_document, revision = revision + 1, updated_at = now()
      where owner_id = auth.uid() and id = session_id and revision = expected_revision returning * into result;
  end if;
  if result.id is null then raise exception 'Session changed on another device' using errcode = '40001'; end if;
  return result;
end;
$$;
create or replace function public.delete_learning_session(session_id uuid, expected_revision bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  if exists(select 1 from public.course_assignments where student_id = auth.uid() and course_assignments.session_id = delete_learning_session.session_id) then raise exception 'Assigned modules cannot be deleted.' using errcode = '23514'; end if;
  delete from public.learning_sessions where owner_id = auth.uid() and id = session_id and revision = expected_revision;
  if not found then raise exception 'Session changed on another device' using errcode = '40001'; end if;
end;
$$;

-- Narrow projection; instructors never receive student learning documents.
create function public.course_progress(target_course uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('studentId',p.id,'name',p.display_name,'email',p.email,'status',e.status,
    'modules',(select coalesce(jsonb_agg(jsonb_build_object('moduleId',m.id,'concepts',
      (select coalesce(jsonb_agg(jsonb_build_object('id',config->>'id','name',config->>'name','target',config->>'target','passed',coalesce(progress->'passed','0'::jsonb))), '[]'::jsonb)
        from jsonb_array_elements(m.document->'session'->'concepts') config
        left join lateral (select value as progress from jsonb_array_elements(coalesce(s.document->'session'->'concepts','[]'::jsonb)) where value->>'id' = config->>'id') cp on true),
      'started',a.session_id is not null) order by m.published_at,m.id),'[]'::jsonb)
      from public.course_modules m left join public.course_assignments a on a.module_id=m.id and a.student_id=p.id
      left join public.learning_sessions s on s.id=a.session_id and s.owner_id=p.id
      where m.course_id=target_course and m.published_at is not null and e.status='enrolled')) order by e.created_at,p.id),'[]'::jsonb) into result
    from public.course_enrollments e join public.profiles p on p.id=e.student_id where e.course_id=target_course;
  return result;
end;
$$;

-- RPC used with the caller's JWT by the chat API, never a service-role client.
create function public.assignment_chat_configuration(target_session uuid, target_concept text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object('learningType',m.document->'session'->>'learningType','concept',config) into result
    from public.course_assignments a join public.course_modules m on m.id=a.module_id
    cross join lateral jsonb_array_elements(m.document->'session'->'concepts') config
    where a.student_id=auth.uid() and a.session_id=target_session and config->>'id'=target_concept and public.course_student(m.course_id);
  if result is null then raise exception 'Assignment not found.' using errcode='42501'; end if;
  return result;
end;
$$;

-- No default PUBLIC execute on any new security-definer function.
revoke all on function public.course_instructor(uuid), public.course_student(uuid), public.course_requested(uuid), public.create_course(text,text), public.join_course(text), public.set_course_enrollment(uuid,text), public.decide_course_enrollment(uuid,uuid,text), public.save_course_module(uuid,uuid,text,jsonb,bigint), public.publish_course_module(uuid,bigint), public.start_course_module(uuid), public.assignment_configuration(jsonb), public.course_progress(uuid), public.assignment_chat_configuration(uuid,text) from public, anon;
grant execute on function public.course_instructor(uuid), public.course_student(uuid), public.course_requested(uuid), public.create_course(text,text), public.join_course(text), public.set_course_enrollment(uuid,text), public.decide_course_enrollment(uuid,uuid,text), public.save_course_module(uuid,uuid,text,jsonb,bigint), public.publish_course_module(uuid,bigint), public.start_course_module(uuid), public.course_progress(uuid), public.assignment_chat_configuration(uuid,text) to authenticated;
commit;
