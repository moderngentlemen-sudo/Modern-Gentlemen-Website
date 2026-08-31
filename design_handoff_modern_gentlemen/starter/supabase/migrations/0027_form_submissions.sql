-- 0027 — bounded public form submissions for the native builder Form element.

create or replace function public.valid_form_payload(p_payload jsonb)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select jsonb_typeof(p_payload) = 'object'
    and (select count(*) from jsonb_object_keys(p_payload)) between 1 and 20
    and octet_length(p_payload::text) <= 32000
    and not exists (
      select 1
      from jsonb_each(p_payload) as entry(key, value)
      where entry.key !~ '^[a-z][a-z0-9_]{0,63}$'
         or entry.key in ('__proto__', 'constructor', 'prototype')
         or jsonb_typeof(entry.value) not in ('string', 'boolean')
         or (
           jsonb_typeof(entry.value) = 'string'
           and char_length(entry.value #>> '{}') > 5000
         )
    );
$$;

revoke all on function public.valid_form_payload(jsonb) from public;
grant execute on function public.valid_form_payload(jsonb) to anon, authenticated, service_role;

create table if not exists public.form_submissions (
  id          uuid primary key default gen_random_uuid(),
  form_key    text not null,
  payload     jsonb not null,
  page_path   text,
  status      text not null default 'new'
                check (status in ('new', 'read', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint form_submissions_key_check
    check (char_length(form_key) between 1 and 80 and form_key ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  constraint form_submissions_payload_check
    check (public.valid_form_payload(payload)),
  constraint form_submissions_page_path_check
    check (page_path is null or char_length(page_path) <= 500)
);

comment on table public.form_submissions is
  'Bounded submissions from builder Form elements. Anonymous visitors may insert but never read.';

create index if not exists form_submissions_inbox_idx
  on public.form_submissions (status, created_at desc);
create index if not exists form_submissions_form_idx
  on public.form_submissions (form_key, created_at desc);

alter table public.form_submissions enable row level security;

revoke all on public.form_submissions from anon, authenticated;
grant insert (form_key, payload, page_path) on public.form_submissions to anon;
grant select, insert, update, delete on public.form_submissions to authenticated;

drop policy if exists "forms: anyone may submit" on public.form_submissions;
create policy "forms: anyone may submit" on public.form_submissions
  for insert to anon with check (true);

drop policy if exists "forms: staff insert" on public.form_submissions;
create policy "forms: staff insert" on public.form_submissions
  for insert to authenticated with check (public.is_staff());

drop policy if exists "forms: staff read" on public.form_submissions;
create policy "forms: staff read" on public.form_submissions
  for select to authenticated using (public.is_staff());

drop policy if exists "forms: staff manage" on public.form_submissions;
create policy "forms: staff manage" on public.form_submissions
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "forms: staff delete" on public.form_submissions;
create policy "forms: staff delete" on public.form_submissions
  for delete to authenticated using (public.is_staff());

drop trigger if exists form_submissions_touch on public.form_submissions;
create trigger form_submissions_touch before update on public.form_submissions
  for each row execute function public.touch_updated_at();
