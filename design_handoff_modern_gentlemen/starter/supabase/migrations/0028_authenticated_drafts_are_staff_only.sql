-- 0028 — a signed-in account without a staff role cannot read CMS drafts.
--
-- `0020` removed `draft_data` from the anonymous role's column grants, but
-- `authenticated` deliberately retained it because every admin screen reads a
-- draft through the editor's own session. The published-row policies were
-- still written without a `to` clause, however, so they applied to PUBLIC:
--
--   status = 'published' or is_staff()
--
-- A signed-in account holding no role therefore matched the first half and,
-- because PostgreSQL grants columns separately from rows, received every
-- authenticated column — including `draft_data`.
--
-- The boundary is smaller than routing every admin read through a
-- security-definer function. Public rendering already uses createPublicClient,
-- which carries the `anon` database role, while admin reads use a session client
-- carrying `authenticated`. Scope the published-row policy to `anon`, then give
-- authenticated callers an explicit policy tied to the resource's read
-- permission. The existing write policies continue to admit writers; these new
-- policies are what admit read-only staff such as the viewer role.
--
-- Ordinary signed-in site members do not query these base tables with their
-- session. Public content is intentionally fetched through the anonymous client
-- and account state through `profiles`, so denying the CMS tables to a role-less
-- JWT changes no public route. A caller can still omit its JWT and receive the
-- published columns granted to `anon`; it cannot combine that row visibility
-- with authenticated's broader column grant.
--
-- Re-runnable: every policy is dropped before it is recreated.

drop policy if exists "pages: public read published" on public.pages;
create policy "pages: public read published" on public.pages
  for select to anon using (status = 'published');
drop policy if exists "pages: permitted staff read" on public.pages;
create policy "pages: permitted staff read" on public.pages
  for select to authenticated using (public.has_permission('page.read'));

drop policy if exists "templates: public read published" on public.templates;
create policy "templates: public read published" on public.templates
  for select to anon using (status = 'published');
drop policy if exists "templates: permitted staff read" on public.templates;
create policy "templates: permitted staff read" on public.templates
  for select to authenticated using (public.has_permission('template.read'));

drop policy if exists "patterns: public read published" on public.patterns;
create policy "patterns: public read published" on public.patterns
  for select to anon using (status = 'published');
drop policy if exists "patterns: permitted staff read" on public.patterns;
create policy "patterns: permitted staff read" on public.patterns
  for select to authenticated using (public.has_permission('pattern.read'));

drop policy if exists "articles: public read published" on public.articles;
create policy "articles: public read published" on public.articles
  for select to anon using (status = 'published');
drop policy if exists "articles: permitted staff read" on public.articles;
create policy "articles: permitted staff read" on public.articles
  for select to authenticated using (public.has_permission('article.read'));

drop policy if exists "products: public read published" on public.products;
create policy "products: public read published" on public.products
  for select to anon using (status = 'published');
drop policy if exists "products: permitted staff read" on public.products;
create policy "products: permitted staff read" on public.products
  for select to authenticated using (public.has_permission('product.read'));

drop policy if exists "categories: public read published" on public.categories;
create policy "categories: public read published" on public.categories
  for select to anon using (status = 'published');
drop policy if exists "categories: permitted staff read" on public.categories;
create policy "categories: permitted staff read" on public.categories
  for select to authenticated using (public.has_permission('category.read'));

drop policy if exists "theme_settings: public read" on public.theme_settings;
create policy "theme_settings: public read" on public.theme_settings
  for select to anon using (status = 'published');
drop policy if exists "theme_settings: permitted staff read" on public.theme_settings;
create policy "theme_settings: permitted staff read" on public.theme_settings
  for select to authenticated using (public.has_permission('theme.read'));
