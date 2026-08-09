/**
 * The site's menus, read the way an anonymous visitor reads them.
 *
 * Same technique as `publicEditorial.test.ts` and for the same reason: this is a
 * real assertion rather than a tautology only because `lib/demo/navigation.ts`
 * is seed **input**. `scripts/seed.ts` reads it to write rows; this file reads
 * the rows back through the anonymous client and the real RLS policies, resolves
 * every target's slug, and compares the result to the module the chrome used to
 * hold as constants.
 *
 * What that catches: a link type that stopped resolving, a `parent_id` that did
 * not survive the two-pass insert, a lost column heading, an ordering that only
 * happens to be right. None of those would fail a screenshot — the header would
 * simply be wrong in a way that looks deliberate.
 *
 * Requires a seeded stack — CI's `Seed content` step provides one.
 */

import { describe, expect, it } from "vitest";

import { getPublishedMenu } from "@/lib/services/publicNavigation";
import { DEMO_MENUS, type DemoMenuItem } from "@/lib/demo/navigation";
import { adminClient, anonClient, prefixed } from "../support/fixtures";

/** The path each demo link should have resolved to. Category links follow their
 *  category's slug, which is what `hrefForItem` reconstructs from the id. */
function expectedHref(item: DemoMenuItem): string {
  return item.link.type === "url" ? item.link.url : `/${item.link.slug}`;
}

describe("the published menus", () => {
  it("publishes every menu the demo content describes", async () => {
    const db = adminClient();
    const { data } = await db.from("menus").select("key, status");

    const published = (data ?? []).filter((m) => m.status === "published").map((m) => m.key);
    for (const menu of DEMO_MENUS) expect(published).toContain(menu.key);
  });

  it.each(DEMO_MENUS.map((menu) => [menu.key, menu] as const))(
    "resolves %s to the tree the chrome used to hold as constants",
    async (_key, menu) => {
      const links = await getPublishedMenu(menu.key);

      expect(links.map((l) => l.label)).toEqual(menu.items.map((i) => i.label));
      expect(links.map((l) => l.href)).toEqual(menu.items.map(expectedHref));

      links.forEach((link, index) => {
        const source = menu.items[index];
        const children = source.children ?? [];

        expect(
          link.children.map((c) => c.label),
          source.label
        ).toEqual(children.map((c) => c.label));
        expect(
          link.children.map((c) => c.href),
          source.label
        ).toEqual(children.map(expectedHref));
        // The column headings are what turn one child list into the mega-menu's
        // two columns; losing them would render one heading-less column and
        // still look plausible.
        expect(
          link.children.map((c) => c.group ?? null),
          source.label
        ).toEqual(children.map((c) => c.group ?? null));

        expect(link.feature ?? null, source.label).toEqual(source.feature ?? null);
      });
    }
  );

  it("keeps a draft menu's items unreadable by anon, not merely its row", async () => {
    // What 0015 exists for, asserted against the policy rather than against the
    // service. Before it, `menu_items` was `using (true)` while `menus` was
    // gated on status — so an unreleased navigation's labels were readable by
    // anon even though the menu row itself was hidden. Querying `menu_items`
    // directly with the anonymous client is the only way to tell the difference:
    // `getPublishedMenu` would return `[]` either way, because it checks the
    // status in application code before it ever reads an item.
    const db = adminClient();
    const key = prefixed("draft-menu");

    const { data: menu } = await db
      .from("menus")
      .insert({ key, name: "Draft menu", status: "draft" })
      .select("id")
      .single();

    if (!menu) throw new Error("could not create the draft menu");

    try {
      await db.from("menu_items").insert({
        menu_id: menu.id,
        label: "Unreleased section",
        link_type: "url",
        url: "/unreleased",
      });

      const { data: visibleToAdmin } = await db
        .from("menu_items")
        .select("id")
        .eq("menu_id", menu.id);
      expect(visibleToAdmin ?? [], "the row exists").toHaveLength(1);

      const { data: visibleToAnon } = await anonClient()
        .from("menu_items")
        .select("id")
        .eq("menu_id", menu.id);
      expect(visibleToAnon ?? [], "and anon cannot see it").toHaveLength(0);

      expect(await getPublishedMenu(key)).toEqual([]);
    } finally {
      // `menu_items.menu_id` cascades, so the items go with the menu.
      await db.from("menus").delete().eq("id", menu.id);
    }
  });
});
