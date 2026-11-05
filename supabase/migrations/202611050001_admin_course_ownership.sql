begin;

-- Admins can teach their own courses under the existing ownership policies.
create or replace function public.course_instructor(target_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.account_allowed() and exists (
    select 1 from public.courses c join public.user_roles r on r.user_id = c.instructor_id
    where c.id = target_course and c.instructor_id = auth.uid() and r.role in ('instructor', 'admin')
  );
$$;

create or replace function public.create_course(course_name text, enrollment text default 'open') returns public.courses
language plpgsql security definer set search_path = '' as $$
declare result public.courses; candidate text; alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; random_bits bytea;
begin
  if not public.account_allowed() or not exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('instructor', 'admin')) then
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

commit;
