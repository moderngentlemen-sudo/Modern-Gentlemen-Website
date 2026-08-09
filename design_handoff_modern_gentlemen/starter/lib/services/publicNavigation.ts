/**
 * Public navigation read — the chrome's menus.
 *
 * The fourth public read service, after `publicContent.ts` (pages),
 * `publicCatalog.ts` (products) and `publicEditorial.ts` (editorial), and it
 * takes their stance for their reasons:
 *
 * **No `requirePermission`.** `createPublicClient()` is anonymous and `0007`'s
 * policy is `using (status = 'published' or is_staff())`, so a draft menu cannot
 * come back through here even if a query asked for one. The database is the
 * enforcement; this file is the shape.
 *
 * **No fallback to `lib/demo/navigation.ts`.** A silent fallback would render a
 * plausible header from a broken read, and the header is on every page — the
 * failure would be invisible for a week. Static rendering already provides what
 * a fallback reaches for: the chrome is built once, and if a later revalidation
 * fails Next keeps serving the last good output.
 *
 * **No cookies.** This is why it goes through `lib/db/public.ts`. The chrome
 * wraps every public route, so a `cookies()` call here would opt the *entire*
 * public site out of static rendering — no error, no failing test, just a slower
 * site. It is also why `visibility.auth` is stored and not applied: honouring it
 * would require exactly that session read.
 */

import { createPublicClient } from "@/lib/db/public";
import * as repo from "@/lib/db/repositories/navigation";
import {
  buildMenuTree,
  hrefForItem,
  isMenuLinkType,
  parseMenuItemOptions,
  parseMenuItemVisibility,
  SLUG_SOURCE_TABLES,
  type MenuItem,
  type MenuItemNode,
  type MenuLinkType,
  type NavLink,
  type SlugsById,
} from "@/lib/domain/navigation";

export type { NavLink };

function toDomainItem(row: repo.MenuItemRow): MenuItem | null {
  // A link_type outside the vocabulary cannot come from the CHECK, but the
  // column is text and this is the boundary — narrowing here keeps the domain
  // free of a cast it cannot justify.
  if (!isMenuLinkType(row.link_type)) return null;

  return {
    id: row.id,
    parentId: row.parent_id,
    label: row.label,
    linkType: row.link_type,
    targetId: row.target_id,
    url: row.url,
    options: parseMenuItemOptions(row.options),
    visibility: parseMenuItemVisibility(row.visibility),
    position: row.position,
  };
}

/**
 * Resolve every target in the tree with one query per table used.
 *
 * A menu of thirty items pointing at one table is one round trip, not thirty.
 * The lookups run against the same anonymous client, so RLS applies to them
 * too: an item pointing at a *draft* page finds no slug and is dropped, which is
 * the behaviour you want — a public menu should not link to something the public
 * cannot read.
 */
async function resolveSlugs(
  db: ReturnType<typeof createPublicClient>,
  items: MenuItem[]
): Promise<SlugsById> {
  const idsByType = new Map<MenuLinkType, Set<string>>();

  for (const item of items) {
    if (item.linkType === "url" || !item.targetId) continue;
    if (!(item.linkType in SLUG_SOURCE_TABLES)) continue;

    const ids = idsByType.get(item.linkType) ?? new Set<string>();
    ids.add(item.targetId);
    idsByType.set(item.linkType, ids);
  }

  const slugs: SlugsById = {};
  await Promise.all(
    [...idsByType].map(async ([linkType, ids]) => {
      const table = SLUG_SOURCE_TABLES[linkType as keyof typeof SLUG_SOURCE_TABLES];
      slugs[linkType] = await repo.slugsByIds(db, table, [...ids]);
    })
  );

  return slugs;
}

function toNavLinks(nodes: MenuItemNode[], slugs: SlugsById): NavLink[] {
  return nodes.flatMap((node) => {
    const href = hrefForItem(node, slugs);
    if (href === null) return [];

    const link: NavLink = {
      id: node.id,
      label: node.label,
      href,
      children: toNavLinks(node.children, slugs),
    };
    if (node.options.group) link.group = node.options.group;
    if (node.options.feature) link.feature = node.options.feature;

    return [link];
  });
}

/**
 * One published menu, resolved.
 *
 * Returns `[]` for a menu that is absent, archived or still a draft — the same
 * answer RLS gives, and the chrome renders an empty nav rather than failing. An
 * empty header is a visible, recoverable state; a thrown error in a layout is
 * every page of the site at once.
 */
export async function getPublishedMenu(key: string): Promise<NavLink[]> {
  const db = createPublicClient();

  const menu = await repo.getMenuByKey(db, key);
  if (!menu || menu.status !== "published") return [];

  const rows = await repo.listMenuItems(db, menu.id);
  const items = rows.map(toDomainItem).filter((item): item is MenuItem => item !== null);
  const slugs = await resolveSlugs(db, items);

  return toNavLinks(buildMenuTree(items), slugs);
}

/**
 * The chrome's four menus in one call, so the site layout makes one pass.
 *
 * Which of them may legitimately be empty is the *layout's* call, not this
 * file's — the same division `publicContent.ts` keeps, where the service returns
 * `null` for a missing page and the route is what throws. `header` and `footer`
 * are the two `0007` seeds and the two the design cannot render without; the
 * other two are additions this phase made and a site may reasonably ship without.
 */
export async function getChromeNavigation(keys: {
  header: string;
  footer: string;
  footerLegal: string;
  drawerSecondary: string;
}): Promise<{
  header: NavLink[];
  footer: NavLink[];
  footerLegal: NavLink[];
  drawerSecondary: NavLink[];
}> {
  const [header, footer, footerLegal, drawerSecondary] = await Promise.all([
    getPublishedMenu(keys.header),
    getPublishedMenu(keys.footer),
    getPublishedMenu(keys.footerLegal),
    getPublishedMenu(keys.drawerSecondary),
  ]);

  return { header, footer, footerLegal, drawerSecondary };
}
