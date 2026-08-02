-- 0013 — The `media` storage bucket, and the policies over its objects.
--
-- 0002_media.sql built the catalogue and defaulted every asset's `bucket` to
-- 'media'. The bucket itself was never created: `storage.buckets` was empty on
-- the live project when Phase 5 started, so nothing could have been uploaded
-- and every catalogue row would have pointed at an object that could not exist.
-- This migration closes that gap and nothing else — the catalogue tables, their
-- RLS and their indexes all stay where 0002 put them.
--
-- The bucket is public-read on purpose, matching `media_assets`' own
-- "public read" policy. Published pages render these URLs to anonymous
-- visitors, and putting the bytes behind signed URLs while the catalogue row
-- describing them is world-readable would buy nothing. Writes are staff-only,
-- gated on the same `media.write` / `media.delete` permissions the catalogue
-- uses, so one permission change moves both halves together.
--
-- Deliberately absent, exactly as in 0012: any statement about function
-- privileges. Postgres grants EXECUTE to PUBLIC on creation, which is why
-- 0009-0011 close by revoking it; a blanket grant here would undo them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  52428800, -- 50 MB. Editorial video lives on a CDN; this bucket is stills and short clips.
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm',
    'audio/mpeg',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- RLS on the objects themselves.
--
-- `storage.objects` already has RLS enabled by Supabase's own bootstrap, and it
-- carries policies for other buckets we do not own. Every policy below is
-- therefore scoped by `bucket_id = 'media'` and dropped by name first, so
-- re-running this file cannot leave a stale duplicate behind. Postgres has no
-- `create policy if not exists`.
-- ---------------------------------------------------------------------------

drop policy if exists "media objects: public read" on storage.objects;
create policy "media objects: public read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media objects: staff insert" on storage.objects;
create policy "media objects: staff insert" on storage.objects
  for insert with check (bucket_id = 'media' and public.has_permission('media.write'));

-- `update` needs both: `using` decides which rows are visible to the statement,
-- `with check` decides what they may become. Without the check an editor could
-- move an object out of `media` into a bucket they hold no permission on.
drop policy if exists "media objects: staff update" on storage.objects;
create policy "media objects: staff update" on storage.objects
  for update using (bucket_id = 'media' and public.has_permission('media.write'))
  with check (bucket_id = 'media' and public.has_permission('media.write'));

drop policy if exists "media objects: staff delete" on storage.objects;
create policy "media objects: staff delete" on storage.objects
  for delete using (bucket_id = 'media' and public.has_permission('media.delete'));
