begin;

create table public.ai_model_settings (
  singleton boolean primary key default true check (singleton),
  model text not null check (model = '' or model ~ '^claude-[a-z0-9-]{1,120}$')
);
alter table public.ai_model_settings enable row level security;
revoke all on public.ai_model_settings from public, anon, authenticated;
grant select, insert, update on public.ai_model_settings to service_role;

commit;
