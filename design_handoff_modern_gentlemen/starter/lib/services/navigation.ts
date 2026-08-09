/**
 * Navigation service — the admin's side of `menus` and `menu_items`.
 *
 * `0001` seeded `navigation.read`, `.write` and `.publish` and nothing has ever
 * asserted them; this is where they start meaning something. Reads gate on
 * `navigation.read` and writes on `navigation.write`, which is what `0007`'s RLS
 * policies require — the service check is the readable refusal, RLS is the one
 * that cannot be bypassed.
 *
 * `navigation.publish` gates the one act that changes what the public can see: a
 * menu's `status`. Item edits are live rows inside whatever the menu's status
 * already permits, so they need no separate publish step — see the note in the
 * repository about menus not being documents.
 *
 * Writes go through `lib/db/server.ts`, the editor's own session, never the
 * service-role client. An ESLint rule enforces that and this file has no reason
 * to be the exception.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/navigation";
import {
  buildMenuTree,
  isMenuLinkType,
  parseMenuItemOptions,
  parseMenuItemVisibility,
  type MenuItem,
  type MenuItemNode,
  type MenuStatus,
  toMenuStatus,
} from "@/lib/domain/navigation";
import { requirePermission } from "./auth";

export type { LinkTarget, MenuRow } from "@/lib/db/repositories/navigation";

export interface MenuView {
  id: string;
  key: string;
  name: string;
  location: string | null;
  status: MenuStatus;
  items: MenuItemNode[];
}

function toDomainItem(row: repo.MenuItemRow): MenuItem {
  return {
    id: row.id,
    parentId: row.parent_id,
    label: row.label,
    // The column is text and the CHECK is the only thing narrowing it. A row
    // holding something outside the vocabulary would be a database written to by
    // hand; reading it as a URL link keeps the admin able to open the menu and
    // fix it, which throwing would not.
    linkType: isMenuLinkType(row.link_type) ? row.link_type : "url",
    targetId: row.target_id,
    url: row.url,
    options: parseMenuItemOptions(row.options),
    visibility: parseMenuItemVisibility(row.visibility),
    position: row.position,
  };
}

export async function listMenus(): Promise<repo.MenuRow[]> {
  await requirePermission("navigation.read");
  const db = await createClient();
  return repo.listMenus(db);
}

/** One menu and its whole tree — the editor screen's single read. */
export async function getMenu(key: string): Promise<MenuView | null> {
  await requirePermission("navigation.read");
  const db = await createClient();

  const menu = await repo.getMenuByKey(db, key);
  if (!menu) return null;

  const rows = await repo.listMenuItems(db, menu.id);

  return {
    id: menu.id,
    key: menu.key,
    name: menu.name,
    location: menu.location,
    status: toMenuStatus(menu.status),
    items: buildMenuTree(rows.map(toDomainItem)),
  };
}

/** Everything a menu item can point at, for the link picker. */
export async function listLinkTargets(): Promise<{
  categories: repo.LinkTarget[];
  pages: repo.LinkTarget[];
  articles: repo.LinkTarget[];
  products: repo.LinkTarget[];
}> {
  await requirePermission("navigation.read");
  const db = await createClient();

  const [categories, pages, articles, products] = await Promise.all([
    repo.listLinkTargets(db, "categories"),
    repo.listLinkTargets(db, "pages"),
    repo.listLinkTargets(db, "articles"),
    repo.listLinkTargets(db, "products"),
  ]);

  return { categories, pages, articles, products };
}

export interface MenuItemWrite {
  menuId: string;
  parentId?: string | null;
  label: string;
  linkType: string;
  targetId?: string | null;
  url?: string | null;
  options?: Record<string, unknown>;
  visibility?: Record<string, unknown>;
  position?: number;
}

export async function createMenuItem(input: MenuItemWrite) {
  await requirePermission("navigation.write");
  const db = await createClient();

  return repo.createMenuItem(db, {
    menu_id: input.menuId,
    parent_id: input.parentId ?? null,
    label: input.label,
    link_type: input.linkType,
    target_id: input.targetId ?? null,
    url: input.url ?? null,
    options: input.options,
    visibility: input.visibility,
    position: input.position,
  });
}

export async function updateMenuItem(
  id: string,
  patch: {
    label?: string;
    linkType?: string;
    targetId?: string | null;
    url?: string | null;
    options?: Record<string, unknown>;
    visibility?: Record<string, unknown>;
    parentId?: string | null;
    position?: number;
  }
) {
  await requirePermission("navigation.write");
  const db = await createClient();

  return repo.updateMenuItem(db, id, {
    label: patch.label,
    link_type: patch.linkType,
    target_id: patch.targetId,
    url: patch.url,
    options: patch.options,
    visibility: patch.visibility,
    parent_id: patch.parentId,
    position: patch.position,
  });
}

export async function deleteMenuItem(id: string): Promise<void> {
  await requirePermission("navigation.write");
  const db = await createClient();
  await repo.deleteMenuItem(db, id);
}

export async function reorderMenuItems(
  positions: { id: string; position: number }[]
): Promise<void> {
  await requirePermission("navigation.write");
  const db = await createClient();
  await repo.setMenuItemPositions(db, positions);
}

/**
 * Renaming a menu is a `navigation.write`; changing its status is a
 * `navigation.publish`.
 *
 * The distinction is the same one `publish_document` makes for pages: editing
 * and making-visible are different acts, and the second is the higher one. A
 * menu carries no payload to publish, so status *is* the publish.
 */
export async function updateMenu(
  id: string,
  patch: { name?: string; location?: string | null; status?: MenuStatus }
) {
  await requirePermission("navigation.write");
  if (patch.status !== undefined) await requirePermission("navigation.publish");

  const db = await createClient();
  return repo.updateMenu(db, id, patch);
}
