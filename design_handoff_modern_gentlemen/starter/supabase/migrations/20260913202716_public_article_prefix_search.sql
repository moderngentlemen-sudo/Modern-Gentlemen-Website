-- Public type-ahead needs literal words, including short English stop words.
-- Keep the existing English vector for admin search; this separate GIN index
-- supports word prefixes without scanning every published article on each key.
-- Derive it only from columns already readable by anonymous visitors.
alter table public.articles
  add column if not exists search_prefix_vector tsvector
  generated always as (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' ||
      coalesce(subtitle, '') || ' ' ||
      coalesce(excerpt, '') || ' ' ||
      replace(slug, '-', ' ')
    )
  ) stored;

create index if not exists articles_search_prefix_idx
  on public.articles using gin (search_prefix_vector);

-- 0020 uses explicit public-column grants. Grant this derived column only;
-- the existing RLS policy still hides drafts and draft_data remains private.
grant select (search_prefix_vector) on public.articles to anon;
