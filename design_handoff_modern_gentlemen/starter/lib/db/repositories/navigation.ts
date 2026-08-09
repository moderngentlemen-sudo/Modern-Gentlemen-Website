/**
 * Menus and their items.
 *
 * A menu is **not** a document. `0007` gave `menus` a `status` and a `version`
 * but no `draft_data`/`published_data`, and `document_table()` in `0010` does
 * not list `'menu'` — so publish, snapshot and rollback do not apply here and
 * this file deliberately does not invent a second publishing path. Item writes
 * are live rows: `status` gates whether the public can read the menu at all,
 * and `revalidatePath` is what makes an edit visible.
 *
 * Client-first like every other repository, so the caller decides whether RLS
 * applies: the admin passes the editor's own session, the public read passes the
 * anonymous client, and the seeder passes the service-role one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

export interface MenuRow {
  id: string;
  key: string;
  name: string;
  location: string | null;
  status: string;
}

export interface MenuItemRow {
  id: string;
  menu_id: string;
  parent_id: string | null;
  label: string;
  link_type: string;
  target_id: string | null;
  url: string | null;
  options: unknown;
  visibility: unknown;
  position: number;
}

const MENU_COLUMNS = "id, key, name, location, status";
const ITEM_COLUMNS =
  "id, menu_id, parent_id, label, link_type, target_id, url, options, visibility, position";

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

export async function listMenus(db: Db): Promise<MenuRow[]> {
  return (unwrap(
    "listMenus",
    await db.from("menus").select(MENU_COLUMNS).order("key", { ascending: true })
  ) ?? []) as MenuRow[];
}

/** `null` rather than a throw: a menu key that is absent, archived or still a
 *  draft is all the same answer from outside RLS, and the caller decides what
 *  an absent menu means. */
export async function getMenuByKey(db: Db, key: string): Promise<MenuRow | null> {
  return unwrap(
    "getMenuByKey",
    await db.from("menus").select(MENU_COLUMNS).eq("key", key).maybeSingle()
  ) as MenuRow | null;
}

export async function updateMenu(
  db: Db,
  id: string,
  patch: { name?: string; location?: string | null; status?: string }
): Promise<MenuRow> {
  return unwrap(
    "updateMenu",
    await db.from("menus").update(patch).eq("id", id).select(MENU_COLUMNS).single()
  ) as MenuRow;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** Every item of one menu, flat. `lib/domain/navigation.ts#buildMenuTree` is
 *  what turns this into a tree — one walker, not one per caller. */
export async function listMenuItems(db: Db, menuId: string): Promise<MenuItemRow[]> {
  return (unwrap(
    "listMenuItems",
    await db
      .from("menu_items")
      .select(ITEM_COLUMNS)
      .eq("menu_id", menuId)
      .order("position", { ascending: true })
  ) ?? []) as MenuItemRow[];
}

export interface MenuItemInput {
  menu_id: string;
  parent_id?: string | null;
  label: string;
  link_type: string;
  target_id?: string | null;
  url?: string | null;
  options?: Record<string, unknown>;
  visibility?: Record<string, unknown>;
  position?: number;
}

export async function createMenuItem(db: Db, input: MenuItemInput): Promise<MenuItemRow> {
  return unwrap(
    "createMenuItem",
    await db
      .from("menu_items")
      .insert({
        menu_id: input.menu_id,
        parent_id: input.parent_id ?? null,
        label: input.label,
        link_type: input.link_type,
        target_id: input.target_id ?? null,
        url: input.url ?? null,
        options: (input.options ?? {}) as never,
        visibility: (input.visibility ?? {}) as never,
        position: input.position ?? 0,
      })
      .select(ITEM_COLUMNS)
      .single()
  ) as MenuItemRow;
}

export async function updateMenuItem(
  db: Db,
  id: string,
  patch: {
    label?: string;
    link_type?: string;
    target_id?: string | null;
    url?: string | null;
    options?: Record<string, unknown>;
    visibility?: Record<string, unknown>;
    parent_id?: string | null;
    position?: number;
  }
): Promise<MenuItemRow> {
  return unwrap(
    "updateMenuItem",
    await db
      .from("menu_items")
      .update(patch as never)
      .eq("id", id)
      .select(ITEM_COLUMNS)
      .single()
  ) as MenuItemRow;
}

/** Children go with it — `menu_items.parent_id` carries `on delete cascade`. */
export async function deleteMenuItem(db: Db, id: string): Promise<void> {
  unwrap("deleteMenuItem", await db.from("menu_items").delete().eq("id", id));
}

/**
 * Reorder within one level.
 *
 * Written as one update per row rather than an upsert of the whole list: an
 * upsert would need every column of every row, and a row that lost a column on
 * the way through would be silently rewritten. Positions are small integers and
 * a menu level is a handful of rows.
 */
export async function setMenuItemPositions(
  db: Db,
  positions: { id: string; position: number }[]
): Promise<void> {
  for (const { id, position } of positions) {
    unwrap("setMenuItemPositions", await db.from("menu_items").update({ position }).eq("id", id));
  }
}

// ---------------------------------------------------------------------------
// Link targets
// ---------------------------------------------------------------------------

/**
 * Slugs for a set of ids in one table.
 *
 * Menus point at four tables and a menu holds a few dozen rows, so this runs
 * once per link type actually used rather than once per item — the N+1 a
 * navigation read would otherwise do on every page of the site.
 */
export async function slugsByIds(
  db: Db,
  table: "pages" | "articles" | "categories" | "products",
  ids: string[]
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const rows = (unwrap(
    `slugsByIds(${table})`,
    await db.from(table).select("id, slug").in("id", ids)
  ) ?? []) as { id: string; slug: string }[];

  return new Map(rows.map((row) => [row.id, row.slug]));
}

export interface LinkTarget {
  id: string;
  slug: string;
  label: string;
}

/**
 * The admin picker's options — id, slug and a human label per table.
 *
 * The label column differs by table (`title` for pages and articles, `name` for
 * categories and products), so each branch names its own columns rather than
 * building a select string: an interpolated column list is not something the
 * generated `Database` types can check.
 */
export async function listLinkTargets(
  db: Db,
  table: "pages" | "articles" | "categories" | "products"
): Promise<LinkTarget[]> {
  const order = { ascending: true } as const;

  switch (table) {
    case "pages": {
      const rows =
        unwrap(
          "listLinkTargets(pages)",
          await db.from("pages").select("id, slug, title").order("slug", order)
        ) ?? [];
      return rows.map((r) => ({ id: r.id, slug: r.slug, label: r.title }));
    }
    case "articles": {
      const rows =
        unwrap(
          "listLinkTargets(articles)",
          await db.from("articles").select("id, slug, title").order("slug", order)
        ) ?? [];
      return rows.map((r) => ({ id: r.id, slug: r.slug, label: r.title }));
    }
    case "categories": {
      const rows =
        unwrap(
          "listLinkTargets(categories)",
          await db.from("categories").select("id, slug, name").order("slug", order)
        ) ?? [];
      return rows.map((r) => ({ id: r.id, slug: r.slug, label: r.name }));
    }
    case "products": {
      const rows =
        unwrap(
          "listLinkTargets(products)",
          await db.from("products").select("id, slug, name").order("slug", order)
        ) ?? [];
      return rows.map((r) => ({ id: r.id, slug: r.slug, label: r.name }));
    }
  }
}
