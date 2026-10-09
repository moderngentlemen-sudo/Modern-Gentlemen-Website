-- AI design suggestions: one row per request, for the per-user daily limit.
-- Written and read only by the suggest-layout edge function (service role).
-- Re-runnable.

create table if not exists public.ai_requests (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);

create index if not exists ai_requests_owner_at on public.ai_requests (owner, at);

alter table public.ai_requests enable row level security;

-- No policies: users can neither read nor write this table directly.
revoke all on public.ai_requests from anon, authenticated;
