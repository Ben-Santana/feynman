begin;

drop function public.admin_list_courses(uuid, integer, text);

create function public.admin_list_courses(actor_id uuid, page_number integer default 1, search_text text default '', subject_filters text[] default '{}')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; total bigint;
begin
  if not exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id where r.user_id = actor_id and r.role = 'admin' and p.approved) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if page_number is null or page_number < 1 or page_number > 100000 or search_text is null or char_length(search_text) > 200
      or subject_filters is null or cardinality(subject_filters) > 20 then
    raise exception 'Invalid page or search.' using errcode = '22023';
  end if;
  select count(*) into total from public.courses c join public.profiles p on p.id = c.instructor_id
    where (search_text = '' or position(lower(search_text) in lower(c.name || ' ' || c.code || ' ' || p.display_name || ' ' || p.email)) > 0)
      and (cardinality(subject_filters) = 0 or c.subjects && subject_filters);
  select coalesce(jsonb_agg(row order by row.created_at desc, row.id), '[]'::jsonb) into result from (
    select c.id, c.instructor_id, c.name, c.code, c.enrollment_mode, c.created_at, c.banner, c.is_public, c.subjects,
      jsonb_build_object('id', p.id, 'name', p.display_name, 'email', p.email) as instructor,
      (select count(*) from public.course_modules m where m.course_id = c.id) as module_count
    from public.courses c join public.profiles p on p.id = c.instructor_id
    where (search_text = '' or position(lower(search_text) in lower(c.name || ' ' || c.code || ' ' || p.display_name || ' ' || p.email)) > 0)
      and (cardinality(subject_filters) = 0 or c.subjects && subject_filters)
    order by c.created_at desc, c.id limit 25 offset (page_number - 1) * 25
  ) row;
  return jsonb_build_object('courses', result, 'total', total, 'page', page_number, 'pageSize', 25);
end;
$$;

revoke all on function public.admin_list_courses(uuid, integer, text, text[]) from public, anon, authenticated;
grant execute on function public.admin_list_courses(uuid, integer, text, text[]) to service_role;

commit;
