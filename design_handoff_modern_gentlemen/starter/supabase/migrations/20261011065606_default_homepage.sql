-- One homepage selection, independent of the page's slug or draft payload.
create table if not exists public.homepage_settings (
  singleton boolean primary key default true check (singleton),
  page_id uuid references public.pages(id) on delete restrict,
  updated_at timestamptz not null default now()
);

-- A null selection preserves the existing published page with slug "home".
-- Fresh CI databases are seeded after migrations, so do not require it here.
insert into public.homepage_settings (singleton) values (true)
on conflict (singleton) do nothing;

alter table public.homepage_settings enable row level security;
revoke all on public.homepage_settings from anon, authenticated;
grant select on public.homepage_settings to anon, authenticated;
grant update (page_id) on public.homepage_settings to authenticated;
grant all on public.homepage_settings to service_role;

drop policy if exists "homepage: public read" on public.homepage_settings;
create policy "homepage: public read" on public.homepage_settings
  for select to anon, authenticated using (true);
drop policy if exists "homepage: page publishers choose" on public.homepage_settings;
create policy "homepage: page publishers choose" on public.homepage_settings
  for update to authenticated
  using (public.has_permission('page.write') and public.has_permission('page.publish'))
  with check (public.has_permission('page.write') and public.has_permission('page.publish'));

create or replace function public.validate_homepage_selection()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- SHARE locks serialize selection with status changes/deletion of the target.
  -- RLS still applies through the editor's own session; no privileged RPC.
  perform 1 from public.pages
    where (id = new.page_id or (new.page_id is null and slug = 'home'))
      and status = 'published' and published_data is not null
    for share;
  if not found then
    raise exception 'Publish this page before setting it as the homepage.' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_homepage_selection on public.homepage_settings;
create trigger validate_homepage_selection before update on public.homepage_settings
  for each row execute function public.validate_homepage_selection();

create or replace function public.protect_homepage_page()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status = 'published' then return new; end if;
  if exists (
    select 1 from public.homepage_settings where singleton
      and (page_id = old.id or (page_id is null and old.slug = 'home'))
  ) then
    raise exception 'Set another published page as the homepage first.' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_homepage_page on public.pages;
create trigger protect_homepage_page before delete or update of status on public.pages
  for each row execute function public.protect_homepage_page();

revoke all on function public.validate_homepage_selection() from public;
revoke all on function public.protect_homepage_page() from public;
grant execute on function public.validate_homepage_selection() to authenticated, service_role;
grant execute on function public.protect_homepage_page() to authenticated, service_role;
