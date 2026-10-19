begin;

create type public.account_role as enum ('student', 'instructor', 'admin');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);
create table public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.account_role not null default 'student'
);
create table public.user_customizations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  appearance jsonb not null check (jsonb_typeof(appearance) = 'object'),
  updated_at timestamptz not null default now()
);
create table public.learning_sessions (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  id uuid not null,
  title text not null check (char_length(title) <= 500),
  document jsonb not null check (jsonb_typeof(document) = 'object' and document @> '{"version":1}'::jsonb and document ? 'session' and jsonb_typeof(document->'session') = 'object'),
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create index learning_sessions_owner_updated on public.learning_sessions(owner_id, updated_at desc);
create table public.role_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  target_id uuid not null,
  old_role public.account_role not null,
  new_role public.account_role not null,
  changed_at timestamptz not null default now()
);

-- Auth provider configuration must restrict Azure to WPI's tenant. This check
-- also protects data if someone accidentally enables another signup provider.
create function public.account_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u where u.id = auth.uid()
      and u.email ~* '^[^@[:space:]]+@wpi[.]edu$'
      and u.email_confirmed_at is not null
      and u.raw_app_meta_data->>'provider' = 'azure'
      and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'azure')
  );
$$;
revoke all on function public.account_allowed() from public, anon;
grant execute on function public.account_allowed() to authenticated;

create function public.before_wpi_user_created(event jsonb) returns jsonb
language plpgsql set search_path = '' as $$
begin
  if coalesce(event->'user'->>'email', '') !~* '^[^@[:space:]]+@wpi[.]edu$'
    or coalesce(event->'user'->'app_metadata'->>'provider', '') <> 'azure' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Use your WPI Microsoft account.'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.before_wpi_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_wpi_user_created(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;

create function public.sync_wpi_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.email, '') !~* '^[^@[:space:]]+@wpi[.]edu$' or coalesce(new.raw_app_meta_data->>'provider', '') <> 'azure' then
    raise exception 'Use your WPI Microsoft account.' using errcode = '23514';
  end if;
  insert into public.profiles(id, email, display_name, last_login_at)
  values (new.id, lower(new.email), left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)), 100), new.last_sign_in_at)
  on conflict (id) do update set email = excluded.email, last_login_at = excluded.last_login_at, updated_at = now();
  insert into public.user_roles(user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.sync_wpi_profile() from public, anon, authenticated;
create trigger wpi_profile_created after insert on auth.users for each row execute function public.sync_wpi_profile();
create trigger wpi_profile_updated after update of email, last_sign_in_at on auth.users for each row execute function public.sync_wpi_profile();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_customizations enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.role_audit enable row level security;
create policy own_profile on public.profiles for select to authenticated using (id = auth.uid() and public.account_allowed());
create policy edit_own_profile on public.profiles for update to authenticated using (id = auth.uid() and public.account_allowed()) with check (id = auth.uid() and public.account_allowed());
create policy own_role on public.user_roles for select to authenticated using (user_id = auth.uid() and public.account_allowed());
create policy own_customization on public.user_customizations for all to authenticated using (user_id = auth.uid() and public.account_allowed()) with check (user_id = auth.uid() and public.account_allowed());
create policy own_sessions on public.learning_sessions for select to authenticated using (owner_id = auth.uid() and public.account_allowed());
revoke all on public.profiles, public.user_roles, public.user_customizations, public.learning_sessions, public.role_audit from anon, authenticated;
grant select on public.profiles, public.user_roles, public.user_customizations, public.learning_sessions to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert(user_id, appearance), update(user_id, appearance), delete on public.user_customizations to authenticated;
grant all on public.profiles, public.user_roles, public.user_customizations, public.learning_sessions, public.role_audit to service_role;
grant usage, select on sequence public.role_audit_id_seq to service_role;

create function public.stamp_update() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.stamp_update() from public, anon, authenticated;
create trigger stamp_profile before update on public.profiles for each row execute function public.stamp_update();
create trigger stamp_customization before update on public.user_customizations for each row execute function public.stamp_update();

-- All session writes pass through an atomic compare-and-swap. Direct updates
-- are deliberately denied, including writes that forge owner or revision.
create function public.save_learning_session(session_id uuid, session_title text, session_document jsonb, expected_revision bigint)
returns public.learning_sessions language plpgsql security definer set search_path = '' as $$
declare result public.learning_sessions;
begin
  if not public.account_allowed() then raise exception 'WPI login required' using errcode = '42501'; end if;
  if expected_revision = 0 then
    insert into public.learning_sessions(owner_id, id, title, document)
      values (auth.uid(), session_id, session_title, session_document)
      on conflict do nothing returning * into result;
  else
    update public.learning_sessions set title = session_title, document = session_document,
      revision = revision + 1, updated_at = now()
      where owner_id = auth.uid() and id = session_id and revision = expected_revision returning * into result;
  end if;
  if result.id is null then raise exception 'Session changed on another device' using errcode = '40001'; end if;
  return result;
end;
$$;
create function public.delete_learning_session(session_id uuid, expected_revision bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_allowed() then raise exception 'WPI login required' using errcode = '42501'; end if;
  delete from public.learning_sessions where owner_id = auth.uid() and id = session_id and revision = expected_revision;
  if not found then raise exception 'Session changed on another device' using errcode = '40001'; end if;
end;
$$;
revoke all on function public.save_learning_session(uuid, text, jsonb, bigint), public.delete_learning_session(uuid, bigint) from public, anon;
grant execute on function public.save_learning_session(uuid, text, jsonb, bigint), public.delete_learning_session(uuid, bigint) to authenticated;

create function public.admin_list_users(actor_id uuid, page_number integer default 1, search_text text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; total bigint;
begin
  if not exists (select 1 from public.user_roles where user_id = actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if page_number < 1 or page_number > 100000 or char_length(search_text) > 200 then raise exception 'Invalid page'; end if;
  select count(*) into total from public.profiles p where search_text = '' or position(lower(search_text) in lower(p.email || ' ' || p.display_name)) > 0;
  select coalesce(jsonb_agg(row), '[]'::jsonb) into result from (
    select p.*, r.role from public.profiles p join public.user_roles r on r.user_id = p.id
    where search_text = '' or position(lower(search_text) in lower(p.email || ' ' || p.display_name)) > 0
    order by p.created_at desc, p.id limit 25 offset (page_number - 1) * 25
  ) row;
  return jsonb_build_object('users', result, 'total', total, 'page', page_number, 'pageSize', 25);
end;
$$;
create function public.admin_set_role(actor_id uuid, target_id uuid, new_role public.account_role)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.account_role;
begin
  -- Serializes role changes so simultaneous demotions cannot remove all admins.
  perform pg_advisory_xact_lock(6767001);
  if not exists (select 1 from public.user_roles where user_id = actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  select role into previous from public.user_roles where user_id = target_id for update;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
  if previous = 'admin' and new_role <> 'admin' and (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'Cannot remove final admin' using errcode = '23514';
  end if;
  if previous <> new_role then
    update public.user_roles set role = new_role where user_id = target_id;
    insert into public.role_audit(actor_id, target_id, old_role, new_role) values (actor_id, target_id, previous, new_role);
  end if;
  return jsonb_build_object('id', target_id, 'role', new_role);
end;
$$;
revoke all on function public.admin_list_users(uuid, integer, text), public.admin_set_role(uuid, uuid, public.account_role) from public, anon, authenticated;
grant execute on function public.admin_list_users(uuid, integer, text), public.admin_set_role(uuid, uuid, public.account_role) to service_role;

insert into storage.buckets(id, name, public, file_size_limit) values ('learning-attachments', 'learning-attachments', false, 5000000);
create policy own_learning_attachments on storage.objects for all to authenticated
using (bucket_id = 'learning-attachments' and (storage.foldername(name))[1] = auth.uid()::text and public.account_allowed())
with check (bucket_id = 'learning-attachments' and (storage.foldername(name))[1] = auth.uid()::text and public.account_allowed());

commit;
