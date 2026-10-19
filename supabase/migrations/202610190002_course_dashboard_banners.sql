begin;

alter table public.courses drop constraint course_banner_valid;

-- Match existing presets to their dashboard color family.
update public.courses set banner = jsonb_build_object('type', 'preset', 'preset',
  case banner->>'preset'
    when 'meadow' then 'mint'
    when 'dusk' then 'lavender'
    when 'terracotta' then 'coral'
    when 'blueprint' then 'sky'
    when 'sand' then 'butter'
    when 'ink' then 'graphite'
  end), appearance_revision = appearance_revision + 1
where banner->>'type' = 'preset';

alter table public.courses
  alter column banner set default '{"type":"preset","preset":"mint"}'::jsonb,
  add constraint course_banner_valid check (coalesce(
    banner->>'type' = 'none'
    or (banner->>'type' = 'preset' and banner->>'preset' in ('red','coral','peach','butter','mint','sky','lavender','rose','graphite'))
    or (banner->>'type' = 'image' and banner->>'path' ~ ('^' || id::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$')),
    false));

create or replace function public.update_course_details(target_course uuid, course_name text, course_banner jsonb, enrollment text, expected_revision bigint)
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
    elsif course_banner->>'type'='preset' and course_banner->>'preset' in ('red','coral','peach','butter','mint','sky','lavender','rose','graphite') then
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

notify pgrst, 'reload schema';
commit;
