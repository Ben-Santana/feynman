begin;

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles(id) on delete set null,
  feature text not null,
  operation text not null,
  provider text not null,
  model text not null,
  input_tokens bigint not null check (input_tokens >= 0),
  output_tokens bigint not null check (output_tokens >= 0),
  cache_read_tokens bigint not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens bigint not null default 0 check (cache_write_tokens >= 0),
  cost_usd numeric(18, 10) check (cost_usd >= 0),
  usage_reported boolean not null
);
create index ai_usage_events_created_at on public.ai_usage_events(created_at);
create index ai_usage_events_user_time on public.ai_usage_events(user_id, created_at);
alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from public, anon, authenticated;
grant select, insert on public.ai_usage_events to service_role;

create function public.admin_usage_analytics(actor_id uuid, window_days integer default 30, target_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id where r.user_id = actor_id and r.role = 'admin' and p.approved) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if window_days not in (7, 30, 90) then raise exception 'Choose a valid date range.'; end if;
  with base as (
    select *, input_tokens + output_tokens + cache_read_tokens + cache_write_tokens as tokens
    from public.ai_usage_events where created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') - (window_days - 1) * interval '1 day'
  ), scoped as (
    select * from base where target_user is null or user_id = target_user
  ), daily as (
    select day::date as date, sum(e.cost_usd) as cost, coalesce(sum(e.tokens), 0) as tokens, count(e.id) as calls
    from generate_series((now() at time zone 'UTC')::date - (window_days - 1), (now() at time zone 'UTC')::date, interval '1 day') day
    left join scoped e on (e.created_at at time zone 'UTC')::date = day::date group by day
  ), features as (
    select feature as name, sum(cost_usd) as cost, sum(tokens) as tokens, count(*) as calls from scoped group by feature
  ), users as (
    select e.user_id as id, coalesce(p.display_name, 'Deleted account') as name, p.email,
      sum(e.cost_usd) as cost, sum(e.tokens) as tokens, count(*) as calls
    from base e left join public.profiles p on p.id = e.user_id group by e.user_id, p.display_name, p.email
  )
  select jsonb_build_object(
    'days', window_days, 'generatedAt', now(),
    'totals', (select jsonb_build_object('cost', sum(cost_usd), 'tokens', coalesce(sum(tokens), 0), 'calls', count(*), 'users', count(distinct user_id), 'unpriced', count(*) filter (where cost_usd is null), 'unreported', count(*) filter (where not usage_reported)) from scoped),
    'daily', (select coalesce(jsonb_agg(daily order by date), '[]'::jsonb) from daily),
    'features', (select coalesce(jsonb_agg(features order by cost desc nulls last, tokens desc, name), '[]'::jsonb) from features),
    'users', (select coalesce(jsonb_agg(users order by cost desc nulls last, tokens desc, id), '[]'::jsonb) from users)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_usage_analytics(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.admin_usage_analytics(uuid, integer, uuid) to service_role;
commit;
