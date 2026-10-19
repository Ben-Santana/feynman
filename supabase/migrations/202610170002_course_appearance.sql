begin;

alter table public.courses
  add column banner jsonb not null default '{"type":"preset","preset":"meadow"}'::jsonb,
  add column appearance_revision bigint not null default 1,
  add constraint course_banner_valid check (coalesce(
    banner->>'type' = 'none'
    or (banner->>'type' = 'preset' and banner->>'preset' in ('meadow','dusk','terracotta','blueprint','sand','ink'))
    or (banner->>'type' = 'image' and banner->>'path' ~ ('^' || id::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$')),
    false));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('course-banners','course-banners',false,5000000,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5000000, allowed_mime_types=excluded.allowed_mime_types;

create function public.course_banner_access(object_name text, editing boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare course_id uuid;
begin
  if split_part(object_name,'/',1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  course_id := split_part(object_name,'/',1)::uuid;
  return public.course_instructor(course_id) or (not editing and public.course_requested(course_id));
end;
$$;
create policy read_course_banners on storage.objects for select to authenticated
  using (bucket_id='course-banners' and public.course_banner_access(name,false));
create policy upload_course_banners on storage.objects for insert to authenticated
  with check (bucket_id='course-banners' and public.course_banner_access(name,true));
-- Referenced images are immutable. This also protects a successful save whose
-- response was lost when the client tries to clean up an upload after an error.
create policy delete_unused_course_banners on storage.objects for delete to authenticated
  using (bucket_id='course-banners' and public.course_banner_access(name,true)
    and not exists(select 1 from public.courses c where c.banner->>'path'=storage.objects.name));

create function public.update_course_details(target_course uuid, course_name text, course_banner jsonb, enrollment text, expected_revision bigint)
returns public.courses language plpgsql security definer set search_path = '' as $$
declare result public.courses; next_banner jsonb;
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode='42501'; end if;
  select * into result from public.courses where id=target_course for update;
  if expected_revision is null or result.appearance_revision<>expected_revision then
    raise exception 'Course changed on another device. Reload before saving.' using errcode='40001';
  end if;
  if course_name is not null and char_length(btrim(course_name)) not between 1 and 120 then
    raise exception 'Enter a course name between 1 and 120 characters.' using errcode='23514';
  end if;
  if enrollment is not null and enrollment not in ('open','approval') then raise exception 'Choose a valid enrollment setting.' using errcode='23514'; end if;
  next_banner := result.banner;
  if course_banner is not null then
    if course_banner->>'type'='none' then next_banner := '{"type":"none"}';
    elsif course_banner->>'type'='preset' and course_banner->>'preset' in ('meadow','dusk','terracotta','blueprint','sand','ink') then
      next_banner := jsonb_build_object('type','preset','preset',course_banner->>'preset');
    elsif course_banner->>'type'='image'
      and course_banner->>'path' ~ ('^' || target_course::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$')
      and exists(select 1 from storage.objects where bucket_id='course-banners' and name=course_banner->>'path') then
      next_banner := jsonb_build_object('type','image','path',course_banner->>'path');
    else raise exception 'Choose a valid course banner.' using errcode='23514';
    end if;
  end if;
  update public.courses set name=coalesce(btrim(course_name),name), banner=next_banner,
    enrollment_mode=coalesce(enrollment,enrollment_mode), appearance_revision=appearance_revision+1
    where id=target_course returning * into result;
  if enrollment='open' then update public.course_enrollments set status='enrolled' where course_id=target_course and status='pending'; end if;
  return result;
end;
$$;

-- Preserve the original enrollment RPC while participating in revision checks.
create or replace function public.set_course_enrollment(target_course uuid, enrollment text) returns public.courses
language plpgsql security definer set search_path = '' as $$
declare current_revision bigint;
begin
  if not public.course_instructor(target_course) then raise exception 'Instructor access required.' using errcode='42501'; end if;
  select appearance_revision into current_revision from public.courses where id=target_course for update;
  return public.update_course_details(target_course,null,null,enrollment,current_revision);
end;
$$;
revoke all on function public.course_banner_access(text,boolean), public.update_course_details(uuid,text,jsonb,text,bigint) from public,anon;
grant execute on function public.course_banner_access(text,boolean), public.update_course_details(uuid,text,jsonb,text,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
