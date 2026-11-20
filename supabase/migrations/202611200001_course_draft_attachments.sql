begin;

-- A topic draft's source files live in the folder of the teacher who added them
-- (<teacher>/<module>/<hash>). Let every teacher of the course read the files the
-- draft still references, so co-teachers can open, edit, and publish it. Saving
-- copies the files into the editing teacher's own folder.
create function public.course_draft_attachment(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_modules m
    where m.id::text = (storage.foldername(object_name))[2] and m.published_at is null
      and public.course_instructor(m.course_id)
      and m.document->'session'->'files' @> jsonb_build_array(jsonb_build_object('path', object_name))
  );
$$;
revoke all on function public.course_draft_attachment(text) from public, anon;
grant execute on function public.course_draft_attachment(text) to authenticated;

create policy course_draft_attachments on storage.objects for select to authenticated
  using (bucket_id = 'learning-attachments' and public.course_draft_attachment(name));

commit;
