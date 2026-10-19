begin;

-- Administration stays behind the authenticated backend. These read-only RPCs
-- do not grant admins instructor permissions or access to student sessions.
create function public.admin_list_courses(actor_id uuid, page_number integer default 1, search_text text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; total bigint;
begin
  if not exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id where r.user_id = actor_id and r.role = 'admin' and p.approved) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if page_number is null or page_number < 1 or page_number > 100000 or search_text is null or char_length(search_text) > 200 then
    raise exception 'Invalid page or search.' using errcode = '22023';
  end if;
  select count(*) into total from public.courses c join public.profiles p on p.id = c.instructor_id
    where search_text = '' or position(lower(search_text) in lower(c.name || ' ' || c.code || ' ' || p.display_name || ' ' || p.email)) > 0;
  select coalesce(jsonb_agg(row order by row.created_at desc, row.id), '[]'::jsonb) into result from (
    select c.id, c.name, c.code, c.enrollment_mode, c.created_at,
      jsonb_build_object('id', p.id, 'name', p.display_name, 'email', p.email) as instructor,
      (select count(*) from public.course_modules m where m.course_id = c.id) as module_count
    from public.courses c join public.profiles p on p.id = c.instructor_id
    where search_text = '' or position(lower(search_text) in lower(c.name || ' ' || c.code || ' ' || p.display_name || ' ' || p.email)) > 0
    order by c.created_at desc, c.id limit 25 offset (page_number - 1) * 25
  ) row;
  return jsonb_build_object('courses', result, 'total', total, 'page', page_number, 'pageSize', 25);
end;
$$;

create function public.admin_view_course(actor_id uuid, target_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare course jsonb; modules jsonb;
begin
  if not exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id where r.user_id = actor_id and r.role = 'admin' and p.approved) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select jsonb_build_object('id', c.id, 'name', c.name, 'code', c.code, 'enrollment_mode', c.enrollment_mode, 'created_at', c.created_at,
    'instructor', jsonb_build_object('id', p.id, 'name', p.display_name, 'email', p.email)) into course
    from public.courses c join public.profiles p on p.id = c.instructor_id where c.id = target_course;
  if course is null then raise exception 'Course not found.' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'title', m.title, 'revision', m.revision, 'created_at', m.created_at, 'published_at', m.published_at,
    'learningType', m.document->'session'->>'learningType',
    'concepts', (select coalesce(jsonb_agg(jsonb_build_object('id', concept->>'id', 'name', concept->>'name', 'target', concept->>'target',
      'rubric', jsonb_build_object('remember', concept->'rubric'->>'remember', 'understand', concept->'rubric'->>'understand', 'apply', concept->'rubric'->>'apply', 'analyze', concept->'rubric'->>'analyze')) order by position), '[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(m.document->'session'->'concepts') = 'array' then m.document->'session'->'concepts' else '[]'::jsonb end) with ordinality as items(concept, position))
    ) order by m.created_at, m.id), '[]'::jsonb) into modules from public.course_modules m where m.course_id = target_course;
  return jsonb_build_object('course', course, 'modules', modules);
end;
$$;

revoke all on function public.admin_list_courses(uuid, integer, text), public.admin_view_course(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_list_courses(uuid, integer, text), public.admin_view_course(uuid, uuid) to service_role;

commit;
