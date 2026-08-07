-- 0004 — Editorial: articles, authors, categories, tags.
--
-- Articles follow the same draft/published convention as pages (see 0003).
-- `template` names one of the 20 hero×body combinations in lib/articles.ts;
-- `template_id` optionally overrides it with a builder-composed layout, which
-- is how an article moves from the fixed template system to a custom design
-- without a schema change.

create table if not exists public.authors (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  role        text,
  bio         text,
  avatar_id   uuid references public.media_assets(id) on delete set null,
  links       jsonb not null default '{}'::jsonb,
  -- Optional link to a login, so an author can edit their own work.
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  intro       text,
  position    integer not null default 0,
  hero_asset_id uuid references public.media_assets(id) on delete set null,
  template_id uuid references public.templates(id) on delete set null,
  status      text not null default 'published'
                check (status in ('draft','published','archived')),
  draft_data     jsonb not null default '{"sections":[],"seo":{}}'::jsonb,
  published_data jsonb,
  version     integer not null default 0,
  published_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tags (
  id    uuid primary key default gen_random_uuid(),
  slug  text unique not null,
  label text not null
);

create table if not exists public.articles (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  title          text not null,
  subtitle       text,
  excerpt        text,

  -- The named template from the 20-template library.
  template       text not null default 'Feature',
  -- A builder layout that supersedes the named template when set.
  template_id    uuid references public.templates(id) on delete set null,

  category_id    uuid references public.categories(id) on delete set null,
  author_id      uuid references public.authors(id) on delete set null,
  featured_asset_id uuid references public.media_assets(id) on delete set null,

  reading_minutes integer,
  issue_no        text,

  status         text not null default 'draft'
                   check (status in ('draft','published','scheduled','archived')),
  draft_data     jsonb not null default '{"hero":{},"body":[],"sections":[],"seo":{}}'::jsonb,
  published_data jsonb,
  version        integer not null default 0,
  published_at   timestamptz,
  scheduled_for  timestamptz,

  created_by     uuid references auth.users(id) on delete set null,
  updated_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists articles_category_idx  on public.articles(category_id);
create index if not exists articles_author_idx    on public.articles(author_id);
create index if not exists articles_status_idx    on public.articles(status);
create index if not exists articles_published_idx on public.articles(published_at desc)
  where status = 'published';
create index if not exists articles_scheduled_idx on public.articles(scheduled_for)
  where status = 'scheduled';
create index if not exists articles_search_idx on public.articles
  using gin (to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(subtitle,'') || ' ' || coalesce(excerpt,'')));

create table if not exists public.article_tags (
  article_id uuid not null references public.articles(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

-- Manual curation of "related content", ordered by the editor.
create table if not exists public.article_relations (
  article_id  uuid not null references public.articles(id) on delete cascade,
  related_id  uuid not null references public.articles(id) on delete cascade,
  position    integer not null default 0,
  primary key (article_id, related_id),
  constraint article_relation_not_self check (article_id <> related_id)
);

drop trigger if exists authors_touch on public.authors;
create trigger authors_touch    before update on public.authors
  for each row execute function public.touch_updated_at();
drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
drop trigger if exists articles_touch on public.articles;
create trigger articles_touch   before update on public.articles
  for each row execute function public.touch_updated_at();

alter table public.authors           enable row level security;
alter table public.categories        enable row level security;
alter table public.tags              enable row level security;
alter table public.articles          enable row level security;
alter table public.article_tags      enable row level security;
alter table public.article_relations enable row level security;

drop policy if exists "authors: public read" on public.authors;
create policy "authors: public read" on public.authors for select using (true);
drop policy if exists "authors: write" on public.authors;
create policy "authors: write" on public.authors for all
  using (public.has_permission('taxonomy.write'))
  with check (public.has_permission('taxonomy.write'));

drop policy if exists "categories: public read published" on public.categories;
create policy "categories: public read published" on public.categories
  for select using (status = 'published' or public.is_staff());
drop policy if exists "categories: write" on public.categories;
create policy "categories: write" on public.categories for all
  using (public.has_permission('taxonomy.write'))
  with check (public.has_permission('taxonomy.write'));

drop policy if exists "tags: public read" on public.tags;
create policy "tags: public read" on public.tags for select using (true);
drop policy if exists "tags: write" on public.tags;
create policy "tags: write" on public.tags for all
  using (public.has_permission('taxonomy.write'))
  with check (public.has_permission('taxonomy.write'));

drop policy if exists "articles: public read published" on public.articles;
create policy "articles: public read published" on public.articles
  for select using (status = 'published' or public.is_staff());
drop policy if exists "articles: write" on public.articles;
create policy "articles: write" on public.articles for all
  using (public.has_permission('article.write'))
  with check (public.has_permission('article.write'));
drop policy if exists "articles: delete" on public.articles;
create policy "articles: delete" on public.articles
  for delete using (public.has_permission('article.delete'));

drop policy if exists "article_tags: public read" on public.article_tags;
create policy "article_tags: public read" on public.article_tags for select using (true);
drop policy if exists "article_tags: write" on public.article_tags;
create policy "article_tags: write" on public.article_tags for all
  using (public.has_permission('article.write'))
  with check (public.has_permission('article.write'));

drop policy if exists "article_relations: public read" on public.article_relations;
create policy "article_relations: public read" on public.article_relations for select using (true);
drop policy if exists "article_relations: write" on public.article_relations;
create policy "article_relations: write" on public.article_relations for all
  using (public.has_permission('article.write'))
  with check (public.has_permission('article.write'));
