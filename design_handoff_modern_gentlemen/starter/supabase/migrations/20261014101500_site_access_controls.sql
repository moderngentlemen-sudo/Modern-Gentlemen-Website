-- Site access & launch controls. The operational mode is NOT theme design data.
-- Reuse the existing staff-managed site_settings table and its settings.write
-- RLS gate. Only this one safe, non-secret key may be read anonymously.
-- The 'inherit' row preserves environment-based legacy behavior until a staff
-- member explicitly selects a mode. Existing production defaults remain locked.
--
-- Idempotent both on deploy and in the CI migrations-reapply verification.
insert into public.site_settings (key, value)
values (
  'site-access-control',
  '{"mode":"inherit","scheduledPublicAt":null,"version":0}'::jsonb
)
on conflict (key) do nothing;

drop policy if exists "site_settings: public site access read" on public.site_settings;
create policy "site_settings: public site access read" on public.site_settings
  for select to anon, authenticated
  using (key = 'site-access-control');

-- The pre-existing "site_settings: write" policy still requires settings.write.
-- Do not expose other rows, or replace the broad staff-only read policy.
