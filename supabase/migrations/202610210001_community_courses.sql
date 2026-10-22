begin;

alter table public.courses add column is_public boolean not null default false,
  add column subject text not null default 'General STEM'
  check (subject in ('General STEM','Mathematics','Physics','Chemistry','Biology','Computer Science','Electrical Engineering','Mechanical Engineering','Civil Engineering','Chemical Engineering','Biomedical Engineering','Aerospace Engineering','Materials Science','Environmental Science','Earth Science','Astronomy','Statistics','Data Science','Robotics','Other'));
create index community_courses on public.courses(subject, created_at desc) where is_public;

create function public.course_public(target_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.account_allowed() and exists(select 1 from public.courses where id=target_course and is_public);
$$;
-- Keep course codes and membership private. The library uses a narrow projection.
create function public.community_courses() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'instructor_id',c.instructor_id,'name',c.name,'code','','enrollment_mode',c.enrollment_mode,
    'created_at',c.created_at,'banner',c.banner,'appearance_revision',c.appearance_revision,
    'is_public',c.is_public,'subject',c.subject) order by c.created_at desc),'[]'::jsonb)
    from public.courses c where c.is_public);
end;
$$;
create policy public_course_topics on public.course_modules for select to authenticated
  using (published_at is not null and public.course_public(course_id));
create or replace function public.course_banner_access(object_name text, editing boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare course_id uuid;
begin
  if split_part(object_name,'/',1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  course_id := split_part(object_name,'/',1)::uuid;
  return public.course_instructor(course_id) or (not editing and (public.course_requested(course_id) or public.course_public(course_id)));
end;
$$;
create function public.set_course_sharing(target_course uuid, shared boolean, course_subject text, expected_revision bigint) returns public.courses
language plpgsql security definer set search_path = '' as $$
declare result public.courses;
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode='42501'; end if;
  select * into result from public.courses where id=target_course for update;
  if expected_revision is null or result.appearance_revision<>expected_revision then
    raise exception 'Course changed on another device. Reload before saving.' using errcode='40001';
  end if;
  update public.courses set is_public=shared, subject=course_subject, appearance_revision=appearance_revision+1 where id=target_course returning * into result;
  return result;
end;
$$;

create function public.create_community_course(course_name text, enrollment text, shared boolean, course_subject text) returns public.courses
language plpgsql security definer set search_path = '' as $$
declare result public.courses;
begin
  result := public.create_course(course_name,enrollment);
  return public.set_course_sharing(result.id,shared,course_subject,result.appearance_revision);
end;
$$;
revoke all on function public.create_community_course(text,text,boolean,text) from public,anon;
grant execute on function public.create_community_course(text,text,boolean,text) to authenticated;

create table public.course_stars (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  primary key (user_id, course_id)
);
create index course_stars_course on public.course_stars(course_id);
alter table public.course_stars enable row level security;
create policy own_stars on public.course_stars for select to authenticated using (user_id=auth.uid() and public.account_allowed());
revoke all on public.course_stars from public, anon, authenticated;
grant select on public.course_stars to authenticated;
grant all on public.course_stars to service_role;
create function public.set_course_star(target_course uuid, starred boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.courses where id=target_course for update;
  if not (public.course_public(target_course) or public.course_instructor(target_course) or public.course_requested(target_course)) then
    raise exception 'Course access required.' using errcode='42501';
  end if;
  if starred is null then raise exception 'Choose a valid star setting.' using errcode='23514'; end if;
  if starred then insert into public.course_stars values(auth.uid(),target_course) on conflict do nothing;
  else delete from public.course_stars where user_id=auth.uid() and course_id=target_course; end if;
end;
$$;
create function public.course_star_counts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(id::text,total),'{}'::jsonb) from (
    select c.id,count(s.user_id) as total from public.courses c left join public.course_stars s on s.course_id=c.id
    where public.course_public(c.id) or public.course_instructor(c.id) or public.course_requested(c.id) group by c.id
  ) counts;
$$;

-- Personal copies never enter course_assignments, so teachers cannot see them.
-- Deleting a source topic removes only the link; the personal session survives.
create table public.community_topic_copies (
  owner_id uuid not null,
  module_id uuid not null references public.course_modules(id) on delete cascade,
  session_id uuid not null,
  primary key(owner_id,module_id),
  foreign key(owner_id,session_id) references public.learning_sessions(owner_id,id) on delete cascade
);
alter table public.community_topic_copies enable row level security;
create policy own_topic_copies on public.community_topic_copies for select to authenticated using(owner_id=auth.uid() and public.account_allowed());
revoke all on public.community_topic_copies from public,anon,authenticated;
grant select on public.community_topic_copies to authenticated;
grant all on public.community_topic_copies to service_role;
create function public.take_community_topic(target_module uuid) returns public.learning_sessions
language plpgsql security definer set search_path = '' as $$
declare module public.course_modules; result public.learning_sessions; concepts jsonb; source_course uuid;
begin
  select course_id into source_course from public.course_modules where id=target_module;
  -- Match course deletion's lock order, then serialize starts for this account.
  perform 1 from public.courses where id=source_course for update;
  select * into module from public.course_modules where id=target_module for update;
  if module.published_at is null or not public.course_public(module.course_id) then
    raise exception 'Public topic required.' using errcode='42501';
  end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  select s.* into result from public.community_topic_copies c join public.learning_sessions s
    on s.owner_id=c.owner_id and s.id=c.session_id where c.owner_id=auth.uid() and c.module_id=target_module;
  if result.id is not null then return result; end if;
  select jsonb_agg(value || jsonb_build_object('passed',0,'stageStart',0,'messages',jsonb_build_array(jsonb_build_object('role','assistant','content','Teach me about ' || (value->>'name') || '.')),'draft','','assessment',null,'assessments','{}'::jsonb,'expression','attentive')) into concepts
    from jsonb_array_elements(module.document->'session'->'concepts');
  insert into public.learning_sessions(owner_id,id,title,document) values(auth.uid(),gen_random_uuid(),module.title,
    jsonb_build_object('version',1,'session',jsonb_build_object('title',module.title,'started',true,'learningType',module.document->'session'->>'learningType','concepts',concepts,'activeId',concepts->0->>'id','files','[]'::jsonb))) returning * into result;
  update public.learning_sessions set document=jsonb_set(document,'{session,id}',to_jsonb(result.id::text)) where owner_id=auth.uid() and id=result.id returning * into result;
  insert into public.community_topic_copies values(auth.uid(),module.id,result.id);
  return result;
end;
$$;

revoke all on function public.course_public(uuid), public.community_courses(), public.set_course_sharing(uuid,boolean,text,bigint), public.set_course_star(uuid,boolean), public.course_star_counts(), public.take_community_topic(uuid) from public,anon;
grant execute on function public.course_public(uuid), public.community_courses(), public.set_course_sharing(uuid,boolean,text,bigint), public.set_course_star(uuid,boolean), public.course_star_counts(), public.take_community_topic(uuid) to authenticated;
create or replace function public.set_course_pin(target_course uuid, pinned boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.courses where id = target_course for update;
  if not (public.course_instructor(target_course) or public.course_requested(target_course) or public.course_public(target_course)) then
    raise exception 'Course access required.' using errcode = '42501';
  end if;
  if pinned is null then raise exception 'Choose a valid pin setting.' using errcode = '23514'; end if;
  if pinned then
    insert into public.course_pins(user_id, course_id) values (auth.uid(), target_course) on conflict do nothing;
  else
    delete from public.course_pins where user_id = auth.uid() and course_id = target_course;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
