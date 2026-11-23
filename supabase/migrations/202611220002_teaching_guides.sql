-- Publishing keeps each concept's teaching checklist. It is student-facing
-- guidance written from the rubric while the topic is prepared, so every
-- student starts with the same checklist instead of generating their own.
-- The checklist is not part of the fixed assignment configuration or the
-- rubric version: assignment_configuration still compares only the rubric.
-- Edits the deployed function so earlier rewrites of it are kept.
do $migration$
declare
  definition text;
  cleaned constant text := $$coalesce(concept->'rubric'->>'analyze',''))));$$;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'publish_course_module';
  if definition is null or position(cleaned in definition) = 0 then
    raise exception 'publish_course_module has changed; update this migration.';
  end if;
  -- An oversized or malformed checklist is dropped; the app prepares a new one.
  execute replace(definition, cleaned, $$coalesce(concept->'rubric'->>'analyze','')))
      || case when jsonb_typeof(concept->'guide') = 'object' and char_length((concept->'guide')::text) <= 20000 then jsonb_build_object('guide', concept->'guide') else '{}'::jsonb end);$$);
end;
$migration$;
