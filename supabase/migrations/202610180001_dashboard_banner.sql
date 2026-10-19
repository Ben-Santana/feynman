begin;

alter table public.user_customizations
  add column dashboard_banner jsonb not null default '{"type":"preset","preset":"meadow"}'::jsonb,
  add column dashboard_banner_revision bigint not null default 0,
  add constraint dashboard_banner_valid check (coalesce(
    dashboard_banner->>'type' = 'none'
    or (dashboard_banner->>'type' = 'preset' and dashboard_banner->>'preset' in ('meadow','dusk','terracotta','blueprint','sand','ink'))
    or (dashboard_banner->>'type' = 'image' and dashboard_banner->>'path' ~ ('^' || user_id::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$')),
    false));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('dashboard-banners','dashboard-banners',false,5000000,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5000000, allowed_mime_types=excluded.allowed_mime_types;

create policy read_dashboard_banners on storage.objects for select to authenticated
  using (bucket_id='dashboard-banners' and public.account_allowed() and split_part(name,'/',1)=auth.uid()::text);
create policy upload_dashboard_banners on storage.objects for insert to authenticated
  with check (bucket_id='dashboard-banners' and public.account_allowed() and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$'));
-- A referenced image survives cleanup if a successful save response is lost.
create policy delete_unused_dashboard_banners on storage.objects for delete to authenticated
  using (bucket_id='dashboard-banners' and public.account_allowed() and split_part(name,'/',1)=auth.uid()::text
    and not exists(select 1 from public.user_customizations c where c.dashboard_banner->>'path'=storage.objects.name));

create function public.save_dashboard_banner(target_banner jsonb, expected_revision bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_customization public.user_customizations; next_banner jsonb; owner_id uuid := auth.uid();
begin
  if not public.account_allowed() then raise exception 'Sign in to customize your dashboard.' using errcode='42501'; end if;
  insert into public.user_customizations(user_id,appearance) values(owner_id,'{}') on conflict(user_id) do nothing;
  select * into current_customization from public.user_customizations where user_id=owner_id for update;
  if expected_revision is null or current_customization.dashboard_banner_revision<>expected_revision then
    raise exception 'Your banner changed on another device. Reload before saving.' using errcode='40001';
  end if;
  if target_banner->>'type'='none' then next_banner := '{"type":"none"}';
  elsif target_banner->>'type'='preset' and target_banner->>'preset' in ('meadow','dusk','terracotta','blueprint','sand','ink') then
    next_banner := jsonb_build_object('type','preset','preset',target_banner->>'preset');
  elsif target_banner->>'type'='image'
    and target_banner->>'path' ~ ('^' || owner_id::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$')
    and exists(select 1 from storage.objects where bucket_id='dashboard-banners' and name=target_banner->>'path') then
    next_banner := jsonb_build_object('type','image','path',target_banner->>'path');
  else raise exception 'Choose a valid dashboard banner.' using errcode='23514';
  end if;
  update public.user_customizations set dashboard_banner=next_banner, dashboard_banner_revision=dashboard_banner_revision+1
    where user_id=owner_id returning * into current_customization;
  return jsonb_build_object('banner',current_customization.dashboard_banner,'revision',current_customization.dashboard_banner_revision);
end;
$$;
revoke all on function public.save_dashboard_banner(jsonb,bigint) from public,anon;
grant execute on function public.save_dashboard_banner(jsonb,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
