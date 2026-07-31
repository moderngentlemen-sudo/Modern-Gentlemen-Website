-- 0008 — Revisions, publishing audit, and preview sessions.
--
-- One polymorphic revisions table serves pages, templates, patterns, articles,
-- products, menus and theme settings. A per-entity revision table for each
-- would mean seven copies of the same rollback and diff logic; this way
-- RevisionService is written once and every entity that registers as
-- revisionable gets history, snapshots, rollback and compare for free.
--
-- Revisions are immutable: rollback COPIES an old payload forward into
-- draft_data rather than deleting anything, so history is never destroyed by
-- an undo.

create table if not exists public.revisions (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  version      integer not null,

  -- The complete entity payload at this version.
  data         jsonb not null,
  -- Optional editor-supplied name: "before homepage redesign".
  label        text,
  -- 'autosave' | 'publish' | 'snapshot' | 'restore'
  reason       text not null default 'publish'
                 check (reason in ('autosave','publish','snapshot','restore')),
  note         text,

  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),

  unique (entity_type, entity_id, version)
);

create index if not exists revisions_entity_idx
  on public.revisions(entity_type, entity_id, created_at desc);
create index if not exists revisions_snapshot_idx
  on public.revisions(entity_type, entity_id) where reason = 'snapshot';

-- Append-only record of every publish/unpublish/rollback. This is the audit
-- trail an editor consults when asking "who changed the homepage on Friday?".
create table if not exists public.publish_events (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  action       text not null
                 check (action in ('publish','unpublish','schedule','rollback','restore')),
  from_version integer,
  to_version   integer,
  note         text,
  actor_id     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists publish_events_entity_idx
  on public.publish_events(entity_type, entity_id, created_at desc);
create index if not exists publish_events_recent_idx
  on public.publish_events(created_at desc);

-- Broader than publishing: role grants, deletions, integration runs.
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_recent_idx on public.audit_log(created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log(entity_type, entity_id);

-- A preview session is a capability: holding the token grants read access to
-- draft content for one target, until it expires. Tokens are random and short
-- lived so a shared preview link cannot become a permanent back door.
create table if not exists public.preview_sessions (
  id           uuid primary key default gen_random_uuid(),
  token        text unique not null,
  entity_type  text not null,
  entity_id    uuid,
  -- Preview a template against a specific record: { articleId, productId, ... }
  context      jsonb not null default '{}'::jsonb,
  device       text not null default 'desktop' check (device in ('desktop','tablet','mobile')),
  created_by   uuid references auth.users(id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '4 hours'),
  created_at   timestamptz not null default now()
);

create index if not exists preview_sessions_token_idx   on public.preview_sessions(token);
create index if not exists preview_sessions_expiry_idx  on public.preview_sessions(expires_at);

alter table public.revisions        enable row level security;
alter table public.publish_events   enable row level security;
alter table public.audit_log        enable row level security;
alter table public.preview_sessions enable row level security;

-- History is staff-only; nothing here is ever public.
create policy "revisions: staff read" on public.revisions
  for select using (public.has_permission('revision.read'));
create policy "revisions: staff write" on public.revisions
  for insert with check (public.is_staff());

create policy "publish_events: staff read" on public.publish_events
  for select using (public.is_staff());
create policy "publish_events: staff write" on public.publish_events
  for insert with check (public.is_staff());

create policy "audit_log: admin read" on public.audit_log
  for select using (public.has_permission('user.read'));
create policy "audit_log: staff write" on public.audit_log
  for insert with check (public.is_staff());

create policy "preview_sessions: owner read" on public.preview_sessions
  for select using (created_by = auth.uid() or public.is_staff());
create policy "preview_sessions: create" on public.preview_sessions
  for insert with check (public.has_permission('preview.create'));
create policy "preview_sessions: owner delete" on public.preview_sessions
  for delete using (created_by = auth.uid() or public.is_admin());

-- Housekeeping for expired preview tokens; called by the scheduled job runner.
create or replace function public.purge_expired_preview_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.preview_sessions where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;
