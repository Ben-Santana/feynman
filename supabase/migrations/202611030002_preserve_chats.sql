begin;

-- Retain sessions even when deletion is requested by an older client, a
-- security-definer course RPC, or an account foreign-key cascade.
create function public.prevent_learning_session_deletion() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Chats are retained and cannot be deleted.' using errcode = '42501';
end;
$$;

create trigger preserve_learning_sessions
before delete on public.learning_sessions
for each row execute function public.prevent_learning_session_deletion();

create trigger preserve_learning_sessions_truncate
before truncate on public.learning_sessions
for each statement execute function public.prevent_learning_session_deletion();

revoke all on function public.prevent_learning_session_deletion() from public, anon, authenticated;
revoke execute on function public.delete_learning_session(uuid, bigint) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
