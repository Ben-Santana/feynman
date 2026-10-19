begin;

-- Existing accounts retain access. New accounts must sign before using the app.
alter table public.profiles add column consent_required boolean not null default false;
alter table public.profiles alter column consent_required set default true;

-- Keep the actual PDF and its audit record together in one atomic, private write.
create table public.signed_consents (
  user_id uuid primary key references public.profiles(id),
  agreement_version text not null,
  agreement_sha256 text not null check (agreement_sha256 ~ '^[0-9a-f]{64}$'),
  signature text not null check (char_length(signature) between 1 and 100),
  email text not null,
  signed_at timestamptz not null,
  electronic_consent text not null,
  pdf_base64 text not null check (length(pdf_base64) between 100 and 2000000),
  pdf_sha256 text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$')
);
alter table public.signed_consents enable row level security;
revoke all on public.signed_consents from public, anon, authenticated, service_role;
grant select, insert on public.signed_consents to service_role;

create function public.has_signed_consent() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.account_signed_in() and exists (
    select 1 from public.signed_consents where user_id = auth.uid()
  );
$$;
revoke all on function public.has_signed_consent() from public, anon;
grant execute on function public.has_signed_consent() to authenticated;

create or replace function public.account_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.account_signed_in() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.approved
      and (not p.consent_required or exists (select 1 from public.signed_consents c where c.user_id = p.id))
  );
$$;
commit;
