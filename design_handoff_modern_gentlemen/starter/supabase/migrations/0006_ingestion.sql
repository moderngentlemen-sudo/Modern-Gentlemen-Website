-- 0006 — Ingestion: field mapping, import runs, staged items.
--
-- XML feeds and Shopify both funnel through this. `import_items` is a staging
-- area, so a run can be reviewed and approved before anything reaches the live
-- catalogue, and so one malformed row fails alone instead of failing the run.

create table if not exists public.feed_field_mappings (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references public.product_sources(id) on delete cascade,
  -- Column in our model, e.g. 'name', 'price_pence', 'affiliate.merchant_url'.
  target_field text not null,
  -- Path in the provider payload, e.g. 'item/title' or '@_sku'.
  source_path  text not null,
  -- Named transform applied after extraction (see lib/integrations/commerce).
  transform    text,
  fallback     text,
  is_required  boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (source_id, target_field)
);

create table if not exists public.import_jobs (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references public.product_sources(id) on delete cascade,
  trigger       text not null default 'manual' check (trigger in ('manual','scheduled','webhook')),
  status        text not null default 'queued'
                  check (status in ('queued','running','review','completed','failed','cancelled')),

  total_count     integer not null default 0,
  created_count   integer not null default 0,
  updated_count   integer not null default 0,
  unchanged_count integer not null default 0,
  failed_count    integer not null default 0,

  error_summary text,
  started_at    timestamptz,
  finished_at   timestamptz,
  requested_by  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists import_jobs_source_idx on public.import_jobs(source_id, created_at desc);
create index if not exists import_jobs_status_idx on public.import_jobs(status);

create table if not exists public.import_items (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.import_jobs(id) on delete cascade,
  external_id  text,
  -- 'create' | 'update' | 'unchanged' | 'failed' — decided by change detection.
  action       text not null check (action in ('create','update','unchanged','failed')),
  status       text not null default 'pending'
                 check (status in ('pending','approved','rejected','applied')),

  raw_payload        jsonb,
  normalised_payload jsonb,
  content_hash       text,
  -- Field-level before/after, so a reviewer sees exactly what would change.
  diff         jsonb,
  error        text,

  product_id   uuid references public.products(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists import_items_job_idx    on public.import_items(job_id);
create index if not exists import_items_status_idx on public.import_items(job_id, status);

-- Scheduled work (feed syncs, publishing scheduled content) and its run log.
create table if not exists public.scheduled_jobs (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  kind        text not null,
  cron        text not null,
  payload     jsonb not null default '{}'::jsonb,
  enabled     boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.job_runs (
  id           uuid primary key default gen_random_uuid(),
  job_key      text not null,
  status       text not null check (status in ('running','ok','failed')),
  detail       jsonb not null default '{}'::jsonb,
  error        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index if not exists job_runs_key_idx on public.job_runs(job_key, started_at desc);

create trigger scheduled_jobs_touch before update on public.scheduled_jobs
  for each row execute function public.touch_updated_at();

alter table public.feed_field_mappings enable row level security;
alter table public.import_jobs         enable row level security;
alter table public.import_items        enable row level security;
alter table public.scheduled_jobs      enable row level security;
alter table public.job_runs            enable row level security;

-- Nothing here is public: imports are entirely an admin concern.
create policy "feed_field_mappings: staff read" on public.feed_field_mappings
  for select using (public.has_permission('integration.read'));
create policy "feed_field_mappings: write" on public.feed_field_mappings for all
  using (public.has_permission('integration.write'))
  with check (public.has_permission('integration.write'));

create policy "import_jobs: staff read" on public.import_jobs
  for select using (public.has_permission('integration.read'));
create policy "import_jobs: write" on public.import_jobs for all
  using (public.has_permission('integration.run'))
  with check (public.has_permission('integration.run'));

create policy "import_items: staff read" on public.import_items
  for select using (public.has_permission('integration.read'));
create policy "import_items: write" on public.import_items for all
  using (public.has_permission('integration.run'))
  with check (public.has_permission('integration.run'));

create policy "scheduled_jobs: staff read" on public.scheduled_jobs
  for select using (public.has_permission('integration.read'));
create policy "scheduled_jobs: write" on public.scheduled_jobs for all
  using (public.has_permission('integration.write'))
  with check (public.has_permission('integration.write'));

create policy "job_runs: staff read" on public.job_runs
  for select using (public.has_permission('integration.read'));
create policy "job_runs: write" on public.job_runs for all
  using (public.has_permission('integration.run'))
  with check (public.has_permission('integration.run'));
