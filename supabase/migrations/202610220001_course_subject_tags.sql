begin;

-- Preserve the original subject for clients using the single-subject RPCs.
alter table public.courses add column subjects text[] not null default array['General STEM'];
update public.courses set subjects=array[subject];
alter table public.courses add constraint course_subjects_valid check (
  cardinality(subjects) between 1 and 20
  and array_position(subjects,null) is null
  and subjects <@ array['General STEM','Mathematics','Physics','Chemistry','Biology','Computer Science','Electrical Engineering','Mechanical Engineering','Civil Engineering','Chemical Engineering','Biomedical Engineering','Aerospace Engineering','Materials Science','Environmental Science','Earth Science','Astronomy','Statistics','Data Science','Robotics','Other']::text[]
);
create index course_subject_tags on public.courses using gin(subjects) where is_public;

create function public.set_course_subjects(target_course uuid, shared boolean, course_subjects text[], expected_revision bigint) returns public.courses
language plpgsql security definer set search_path = '' as $$
declare result public.courses; tags text[];
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode='42501'; end if;
  select * into result from public.courses where id=target_course for update;
  if expected_revision is null or result.appearance_revision<>expected_revision then
    raise exception 'Course changed on another device. Reload before saving.' using errcode='40001';
  end if;
  if shared is null or course_subjects is null or cardinality(course_subjects) not between 1 and 20 or array_position(course_subjects,null) is not null then
    raise exception 'Choose at least one valid subject.' using errcode='23514';
  end if;
  select array_agg(tag order by first_position) into tags from (
    select tag,min(position) as first_position from unnest(course_subjects) with ordinality as choices(tag,position) group by tag
  ) distinct_tags;
  update public.courses set is_public=shared, subjects=tags, subject=tags[1], appearance_revision=appearance_revision+1
    where id=target_course returning * into result;
  return result;
end;
$$;
create or replace function public.set_course_sharing(target_course uuid, shared boolean, course_subject text, expected_revision bigint) returns public.courses
language sql security definer set search_path = '' as $$
  select public.set_course_subjects(target_course,shared,array[course_subject],expected_revision);
$$;
create function public.create_tagged_course(course_name text, enrollment text, shared boolean, course_subjects text[]) returns public.courses
language plpgsql security definer set search_path = '' as $$
declare result public.courses;
begin
  result := public.create_course(course_name,enrollment);
  return public.set_course_subjects(result.id,shared,course_subjects,result.appearance_revision);
end;
$$;

create or replace function public.community_courses() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'instructor_id',c.instructor_id,'name',c.name,'code','','enrollment_mode',c.enrollment_mode,
    'created_at',c.created_at,'banner',c.banner,'appearance_revision',c.appearance_revision,
    'is_public',c.is_public,'subject',c.subject,'subjects',c.subjects) order by c.created_at desc),'[]'::jsonb)
    from public.courses c where c.is_public);
end;
$$;

-- Stars are available only while the course is public. Existing stars remain
-- dormant if a teacher makes a course private, and return if it is republished.
alter policy own_stars on public.course_stars using (user_id=auth.uid() and public.course_public(course_id));
create or replace function public.set_course_star(target_course uuid, starred boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.courses where id=target_course for update;
  if not public.course_public(target_course) then raise exception 'Only public courses can be starred.' using errcode='42501'; end if;
  if starred is null then raise exception 'Choose a valid star setting.' using errcode='23514'; end if;
  if starred then insert into public.course_stars values(auth.uid(),target_course) on conflict do nothing;
  else delete from public.course_stars where user_id=auth.uid() and course_id=target_course; end if;
end;
$$;
create or replace function public.course_star_counts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(id::text,total),'{}'::jsonb) from (
    select c.id,count(s.user_id) as total from public.courses c left join public.course_stars s on s.course_id=c.id
    where public.course_public(c.id) group by c.id
  ) counts;
$$;

revoke all on function public.set_course_subjects(uuid,boolean,text[],bigint), public.create_tagged_course(text,text,boolean,text[]) from public,anon;
grant execute on function public.set_course_subjects(uuid,boolean,text[],bigint), public.create_tagged_course(text,text,boolean,text[]) to authenticated;
notify pgrst, 'reload schema';
commit;
