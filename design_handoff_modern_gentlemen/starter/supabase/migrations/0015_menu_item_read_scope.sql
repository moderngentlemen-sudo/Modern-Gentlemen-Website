-- 0015 — Scope public reads of menu_items to menus the public can read.
--
-- 0007 gated `menus` on `status = 'published' or is_staff()` and then left
-- `menu_items` at `using (true)`. So a draft menu's own row is hidden while
-- every one of its labels stays readable: an unreleased navigation — next
-- season's categories, an unannounced section — is enumerable by anon with one
-- request. The parent's status is the item's status; nothing else about this
-- table decides who may see a row.
--
-- The gap was harmless while both tables held nothing. Phase 6b gives them
-- content and an editor, which is what arms it.
--
-- `menu_items_menu_idx` is on (menu_id, position), so the EXISTS lookup rides an
-- index that already exists.
--
-- Re-runnable, like every migration in this repo: Postgres has no
-- `create policy if not exists`, so the drop is what makes a replay safe. The
-- `Migrations are idempotent` CI step re-applies all of them on top of
-- themselves and fails if any statement complains.

drop policy if exists "menu_items: public read" on public.menu_items;
create policy "menu_items: public read" on public.menu_items for select using (
  exists (
    select 1
    from public.menus m
    where m.id = menu_items.menu_id
      and (m.status = 'published' or public.is_staff())
  )
);
