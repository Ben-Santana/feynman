-- PostgREST treats SQLSTATE 40001 as a transient serialization failure and
-- retries the transaction forever, so one stale save pinned the database CPU.
-- Revision conflicts are permanent, so report them as HTTP 409 instead.
-- Rewrites the deployed functions so every current definition is covered.
do $migration$
declare
  target record;
begin
  for target in
    select pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosrc ~ $$errcode\s*=\s*'40001'$$
  loop
    execute regexp_replace(target.definition, $$errcode\s*=\s*'40001'$$, $$errcode = 'PT409'$$, 'g');
  end loop;
end;
$migration$;
