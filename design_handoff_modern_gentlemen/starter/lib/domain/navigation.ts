/**
 * Menus — the shape of a navigation tree, pure and free of data access.
 *
 * `0007_navigation_and_theme.sql` built `menu_items` as a self-referencing table
 * with two free `jsonb` columns, `options` and `visibility`. Postgres checks one
 * thing about a row (`menu_item_target_shape`: a URL link needs a `url`, every
 * other kind needs a `target_id`) and nothing at all about the two payloads.
 * This file is the rest of the contract, and the only place that knows how a
 * flat table becomes the tree the chrome renders.
 *
 * Three renderings read one tree. The header nav is the top level, the mega-menu
 * is a top-level item's children grouped into columns, and the drawer is those
 * same children flattened in order. `Drawer.tsx` has claimed since Track A that
 * it "can never drift apart" from the mega-menu; until this phase that was true
 * only because both lists were typed by hand.
 */

import { z } from "zod";
import {
  publicPathForArticle,
  publicPathForCategory,
  publicPathForPage,
  publicPathForProduct,
} from "./routes";

/** `menu_items.link_type` — the CHECK in `0007`. */
export const MENU_LINK_TYPES = [
  "page",
  "article",
  "category",
  "product",
  "collection",
  "url",
] as const;
export type MenuLinkType = (typeof MENU_LINK_TYPES)[number];

export function isMenuLinkType(value: string): value is MenuLinkType {
  return (MENU_LINK_TYPES as readonly string[]).includes(value);
}

/**
 * The link types an editor may choose.
 *
 * `collection` is in the database's CHECK and deliberately not offered: there is
 * no public collection route to resolve one to, so every such item would render
 * as a dead link. Leaving it in the constraint costs nothing and keeps the
 * schema ready; offering it in a form would only let someone build a menu entry
 * that cannot work.
 */
export const EDITABLE_MENU_LINK_TYPES = [
  "category",
  "page",
  "article",
  "product",
  "url",
] as const satisfies readonly MenuLinkType[];

/** `menus.status` — the CHECK in `0007`. Only `published` is publicly readable. */
export const MENU_STATUSES = ["draft", "published", "archived"] as const;
export type MenuStatus = (typeof MENU_STATUSES)[number];

// ---------------------------------------------------------------------------
// The two jsonb payloads
// ---------------------------------------------------------------------------

/**
 * The mega-menu's feature card, as `MegaMenu.tsx` has always rendered it.
 *
 * `href` is a plain path rather than a second polymorphic target: the card is
 * one editorial promotion per nav entry, and giving it a `link_type` of its own
 * would double the resolution logic to buy an editor nothing they cannot get by
 * pasting the path they are already looking at.
 */
export const menuFeatureSchema = z.object({
  tag: z.string().min(1),
  title: z.string().min(1),
  image: z.string().min(1),
  href: z.string().min(1),
});
export type MenuFeature = z.infer<typeof menuFeatureSchema>;

/**
 * `menu_items.options`.
 *
 * `group` is the mega-menu column heading a child sits under — "Categories",
 * "Guides". It is a string on the child rather than a row of its own because
 * `menu_item_target_shape` refuses a row holding neither a `url` nor a
 * `target_id`, and a heading is neither. Modelling headings as items would mean
 * writing `url: "#"` to satisfy the constraint: a lie in the data, bought to
 * gain a shape the renderer does not need.
 *
 * Unknown keys pass through rather than being stripped. The admin is the only
 * writer today, and a schema that quietly discards what it does not recognise
 * turns "another feature added a key" into silent data loss on the next save.
 */
export const menuItemOptionsSchema = z
  .object({
    group: z.string().min(1).optional(),
    feature: menuFeatureSchema.optional(),
  })
  .passthrough();
export type MenuItemOptions = z.infer<typeof menuItemOptionsSchema>;

export const NAVIGATION_DEVICES = ["mobile", "tablet", "desktop"] as const;
export type NavigationDevice = (typeof NAVIGATION_DEVICES)[number];

/** `menu_items.visibility`, evaluated by the public client chrome. */
export const menuItemVisibilitySchema = z
  .object({
    auth: z.enum(["any", "in", "out"]).optional(),
    member: z.boolean().nullable().optional(),
    devices: z.array(z.enum(NAVIGATION_DEVICES)).min(1).optional(),
    startsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.startsAt && value.endsAt && Date.parse(value.startsAt) >= Date.parse(value.endsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "The visibility end must be after its start",
      });
    }
  });
export type MenuItemVisibility = z.infer<typeof menuItemVisibilitySchema>;

/** Forgiving on the way out of the database: a malformed payload must not blank
 *  the site's navigation. An unparseable object reads as an empty one, which is
 *  what every row starts life holding anyway. */
export function parseMenuItemOptions(value: unknown): MenuItemOptions {
  const parsed = menuItemOptionsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function parseMenuItemVisibility(value: unknown): MenuItemVisibility {
  const parsed = menuItemVisibilitySchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export interface NavigationViewer {
  auth: "unknown" | "in" | "out";
  member: boolean | null;
  device: NavigationDevice | null;
  now: number | null;
}

/** Pure visibility decision shared by header, drawer, mega-menu and footer. */
export function isMenuItemVisible(
  visibility: MenuItemVisibility | undefined,
  viewer: NavigationViewer
): boolean {
  if (!visibility) return true;
  if ((visibility.startsAt || visibility.endsAt) && viewer.now === null) return false;
  if (visibility.startsAt && viewer.now! < Date.parse(visibility.startsAt)) return false;
  if (visibility.endsAt && viewer.now! >= Date.parse(visibility.endsAt)) return false;
  if (visibility.devices && (!viewer.device || !visibility.devices.includes(viewer.device))) {
    return false;
  }
  if (visibility.auth && visibility.auth !== "any") {
    if (viewer.auth === "unknown" || viewer.auth !== visibility.auth) return false;
  }
  if (visibility.member !== null && visibility.member !== undefined) {
    if (viewer.member === null || viewer.member !== visibility.member) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------

export interface MenuItem {
  id: string;
  parentId: string | null;
  label: string;
  linkType: MenuLinkType;
  targetId: string | null;
  url: string | null;
  options: MenuItemOptions;
  visibility: MenuItemVisibility;
  position: number;
}

export interface MenuItemNode extends MenuItem {
  children: MenuItemNode[];
}

export interface Menu {
  key: string;
  name: string;
  location: string | null;
  status: MenuStatus;
  items: MenuItemNode[];
}

/**
 * Ordering is `position`, then label, then id.
 *
 * The two tie-breaks are not decoration. `position` defaults to 0, so a menu
 * built by anything that does not set it — a seed, a hand-written insert — has
 * every row tied, and an untied ordering is a bug that only shows up sometimes:
 * Phase 7c lost a day to exactly that when two articles shared an issue number.
 * `id` is the final tie-break because it is the one value that is always present
 * and always distinct.
 */
function compareItems(a: MenuItem, b: MenuItem): number {
  if (a.position !== b.position) return a.position - b.position;
  if (a.label !== b.label) return a.label < b.label ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

/**
 * Flat rows → nested nodes.
 *
 * Anything not reachable from a root is dropped. `menu_items.parent_id` carries
 * `on delete cascade`, so an orphan cannot arise through the schema; what this
 * guards is a cycle introduced by hand in SQL, which would otherwise be an
 * infinite walk. Building the tree by index rather than by recursion makes that
 * structurally impossible rather than caught.
 */
export function buildMenuTree(items: MenuItem[]): MenuItemNode[] {
  const nodes = new Map<string, MenuItemNode>();
  for (const item of items) nodes.set(item.id, { ...item, children: [] });

  const roots: MenuItemNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId === null ? null : nodes.get(node.parentId);
    if (parent) parent.children.push(node);
    else if (node.parentId === null) roots.push(node);
  }

  const sortDeep = (list: MenuItemNode[]): MenuItemNode[] => {
    list.sort(compareItems);
    for (const node of list) sortDeep(node.children);
    return list;
  };

  return sortDeep(roots);
}

export interface Column<T> {
  heading: string | null;
  items: T[];
}

/**
 * Group into columns by heading, in the order the headings first appear.
 *
 * Generic because the same grouping runs twice on two different shapes: over
 * domain nodes in the admin, where the heading is `options.group`, and over the
 * resolved `NavLink`s the mega-menu renders, where it is `group`. One rule, and
 * the order columns appear in is the order an editor put them in.
 */
export function groupByHeading<T>(items: T[], headingOf: (item: T) => string | null): Column<T>[] {
  const columns: Column<T>[] = [];
  const byHeading = new Map<string | null, Column<T>>();

  for (const item of items) {
    const heading = headingOf(item);
    let column = byHeading.get(heading);
    if (!column) {
      column = { heading, items: [] };
      byHeading.set(heading, column);
      columns.push(column);
    }
    column.items.push(item);
  }

  return columns;
}

export type MenuColumn = Column<MenuItemNode>;

/**
 * The mega-menu's columns: children grouped by `options.group`. Children with no
 * group collect under a single heading-less column, which is what a nav entry
 * with a flat link list renders as.
 */
export function groupChildren(children: MenuItemNode[]): MenuColumn[] {
  return groupByHeading(children, (child) => child.options.group ?? null);
}

/** The drawer's flattened sub-list — the same children, columns ignored. */
export function flattenChildren(children: MenuItemNode[]): MenuItemNode[] {
  return children.flatMap((child) => [child, ...flattenChildren(child.children)]);
}

/** The same flattening over resolved links, for the drawer's accordion. */
export function flattenNavLinks(links: NavLink[]): NavLink[] {
  return links.flatMap((link) => [link, ...flattenNavLinks(link.children)]);
}

/** The mega-menu's columns over resolved links. */
export function navColumns(links: NavLink[]): Column<NavLink>[] {
  return groupByHeading(links, (link) => link.group ?? null);
}

// ---------------------------------------------------------------------------
// Resolving a link
// ---------------------------------------------------------------------------

/** Slugs for the entities a menu can point at, keyed by id. The public read
 *  service fills this from one query per link type actually used. */
export type SlugsById = Partial<Record<MenuLinkType, ReadonlyMap<string, string>>>;

/**
 * Where an item points, or `null` if it points nowhere resolvable.
 *
 * A target is resolved to its **slug at read time** rather than to a path frozen
 * at authoring time — the reason `menu_items` carries a `link_type` and a
 * `target_id` instead of a single `href` column. Renaming a category's slug
 * moves every menu entry that points at it, with nothing to update by hand.
 *
 * `null` means the target has been deleted, or is a `collection` (no public
 * route exists). The renderer drops the item rather than emitting a link to
 * nowhere: a nav entry that 404s is worse than one that is absent.
 */
export function hrefForItem(item: MenuItem, slugs: SlugsById): string | null {
  if (item.linkType === "url") return item.url ?? null;
  if (!item.targetId) return null;

  const slug = slugs[item.linkType]?.get(item.targetId);
  if (!slug) return null;

  switch (item.linkType) {
    case "page":
      return publicPathForPage(slug);
    case "article":
      return publicPathForArticle(slug);
    case "category":
      return publicPathForCategory(slug);
    case "product":
      return publicPathForProduct(slug);
    default:
      return null;
  }
}

/**
 * What the chrome actually renders: a label, a resolved href, and the children
 * beneath it.
 *
 * Deliberately *not* `MenuItemNode`. The header, drawer and footer are client
 * components and this crosses the server boundary to reach them; they need
 * somewhere to point, not a link type and a target id. Resolving before the
 * boundary is also what keeps an item whose target has been deleted from ever
 * reaching a renderer.
 *
 * It lives here, in the leaf, rather than in the service that builds it —
 * `components/**` may not import `lib/services/*`, and a type both sides need is
 * exactly what a leaf is for.
 */
export interface NavLink {
  id: string;
  label: string;
  href: string;
  /** The mega-menu column heading this child sits under, if any. */
  group?: string;
  feature?: MenuFeature;
  visibility?: MenuItemVisibility;
  children: NavLink[];
}

/** The four menus the site chrome mounts, by `menus.key`. */
export const CHROME_MENU_KEYS = {
  header: "header-primary",
  footer: "footer-primary",
  footerLegal: "footer-legal",
  drawerSecondary: "drawer-secondary",
} as const;

/** The table a `link_type` resolves against. `url` resolves against nothing and
 *  `collection` has no public route, so neither has an entry. */
export const SLUG_SOURCE_TABLES = {
  page: "pages",
  article: "articles",
  category: "categories",
  product: "products",
} as const satisfies Partial<Record<MenuLinkType, string>>;

/** The link types that resolve against a table — every editable one but `url`. */
export type LinkTargetKind = keyof typeof SLUG_SOURCE_TABLES;

export function isLinkTargetKind(value: MenuLinkType): value is LinkTargetKind {
  return value in SLUG_SOURCE_TABLES;
}

/** `menus.status` is a text column with a CHECK; this is the narrowing at the
 *  boundary. An unrecognised value reads as a draft — the safe direction, since
 *  only `published` is publicly visible. */
export function toMenuStatus(value: string): MenuStatus {
  return (MENU_STATUSES as readonly string[]).includes(value) ? (value as MenuStatus) : "draft";
}
