begin;

-- Messages sent from the public landing page's contact form. Only the backend's
-- secret key reads or writes them; visitors never see where they are delivered.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index contact_messages_created_at on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from public, anon, authenticated;

commit;
