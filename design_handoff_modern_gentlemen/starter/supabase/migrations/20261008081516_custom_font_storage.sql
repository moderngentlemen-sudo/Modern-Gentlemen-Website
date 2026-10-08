-- Theme fonts have their own permission boundary. The media library cannot
-- delete a font that is still referenced by a published theme or an old revision.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fonts', 'fonts', true, 5242880,
  array['font/woff', 'font/woff2', 'font/ttf', 'font/otf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fonts: public read" on storage.objects;
create policy "fonts: public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'fonts');

drop policy if exists "fonts: theme writer insert" on storage.objects;
create policy "fonts: theme writer insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fonts'
    and public.has_permission('theme.write')
    and name ~ '^custom-[a-f0-9]{32}\.(woff2?|ttf|otf)$'
  );

-- Deliberately no UPDATE or DELETE grant: unique paths and upsert=false keep
-- published themes and rollback history stable. Unused objects can be reclaimed
-- by a separate privileged storage audit after checking all theme revisions.
