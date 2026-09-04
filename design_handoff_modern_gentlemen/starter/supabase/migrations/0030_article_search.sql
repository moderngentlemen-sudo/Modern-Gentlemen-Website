-- Give the admin article index a parameterised, indexed full-text search.
-- The public site already had an equivalent expression index; materialising
-- the vector lets supabase-js address it directly without building a raw
-- PostgREST `or` expression from editor input.
alter table public.articles
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(subtitle, '') || ' ' ||
      coalesce(excerpt, '') || ' ' ||
      replace(slug, '-', ' ')
    )
  ) stored;

-- 0004 used this name for the equivalent expression index. Replacing it keeps
-- one search index rather than paying the write/storage cost twice. Replaying
-- all migrations is safe: 0004 skips the name, then this migration rebuilds it.
drop index if exists public.articles_search_idx;
create index articles_search_idx on public.articles using gin (search_vector);
