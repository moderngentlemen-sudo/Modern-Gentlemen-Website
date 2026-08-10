/**
 * The theme, read the way an anonymous visitor reads it — and published the way
 * `0017` now allows.
 *
 * Two things live here that cannot live anywhere else in the suite.
 *
 * **The RLS assertion.** `0007` shipped this table with `using (true)`, so an
 * unpublished draft theme was readable by anon; `0017` scopes it to
 * `status = 'published' or is_staff()`. Only a real stack with real policies can
 * show that, and the `menu_items` test next door is the idiom: query the same
 * row with both clients and assert who sees it.
 *
 * **The publish gate.** This is the test that proves `document_table('theme')`
 * actually resolves — that the one-line SQL change works, that `revisions` and
 * `publish_events` accept an entity type with no CHECK constraint behind it, and
 * that `publish_document` refuses an actor holding `theme.write` but not
 * `theme.publish`. That last combination is one no seeded role has, which is
 * exactly why `Fixtures.createRole` exists.
 *
 * Everything destructive runs against a throwaway row. The `key='default'` row
 * is never touched: the visual suite reads its published payload from the same
 * project, and a failed test that left a stamped colour behind would move all 16
 * baselines and look like a CSS regression.
 *
 * Requires a seeded stack — CI's `Seed content` step provides one.
 */

import { afterAll, describe, expect, it } from "vitest";

import { getPublishedThemeColors } from "@/lib/services/publicTheme";
import { DEMO_THEME } from "@/lib/demo/theme";
import { DEFAULT_THEME_COLORS, THEME_KEY, parseThemeColors } from "@/lib/domain/theme";
import { Fixtures, adminClient, anonClient, prefixed } from "../support/fixtures";

const fixtures = new Fixtures(adminClient());

afterAll(async () => {
  await fixtures.cleanup();
});

/** A throwaway theme row, tracked for teardown. Never `key='default'`. */
async function createTheme(status: "draft" | "published") {
  const db = adminClient();
  const key = prefixed("theme");

  const { data, error } = await db
    .from("theme_settings")
    .insert({
      key,
      name: `Fixture theme ${key}`,
      status,
      draft_data: DEMO_THEME as never,
      published_data: status === "published" ? (DEMO_THEME as never) : null,
    })
    .select("id, key")
    .single();

  if (error || !data) throw new Error(`fixture createTheme: ${error?.message}`);
  fixtures.track("theme_settings", data.key, "key");
  return data;
}

describe("the published theme", () => {
  it("seeds the payload the demo module describes", async () => {
    const db = adminClient();
    const { data } = await db
      .from("theme_settings")
      .select("status, published_data")
      .eq("key", THEME_KEY)
      .maybeSingle();

    expect(data?.status, "the default theme is published").toBe("published");
    expect(data?.published_data).toEqual(DEMO_THEME);
  });

  it("serves those colours through the anonymous client", async () => {
    // A real assertion rather than a tautology, for the reason the navigation
    // and editorial suites give: `lib/demo/theme.ts` is seed *input*. This reads
    // the row back through the app's own code path and the real policies.
    expect(await getPublishedThemeColors()).toEqual(DEFAULT_THEME_COLORS);
  });
});

describe("theme read scope", () => {
  it("hides a draft theme from anon and shows it to staff", async () => {
    const theme = await createTheme("draft");

    const { data: toService } = await adminClient()
      .from("theme_settings")
      .select("id")
      .eq("key", theme.key);
    expect(toService ?? [], "the row exists").toHaveLength(1);

    const { data: toAnon } = await anonClient()
      .from("theme_settings")
      .select("id")
      .eq("key", theme.key);
    expect(toAnon ?? [], "and anon cannot see it").toHaveLength(0);
  });

  it("shows it once it is published", async () => {
    const theme = await createTheme("draft");

    await adminClient().from("theme_settings").update({ status: "published" }).eq("id", theme.id);

    const { data: toAnon } = await anonClient()
      .from("theme_settings")
      .select("id")
      .eq("key", theme.key);
    expect(toAnon ?? []).toHaveLength(1);
  });
});

describe("publishing a theme", () => {
  it("refuses an editor who may write but not publish", async () => {
    const theme = await createTheme("draft");

    const role = await fixtures.createRole(["theme.read", "theme.write"]);
    const user = await fixtures.createUser([role]);
    const db = await fixtures.signIn(user.email, user.password);

    const { error } = await db.rpc("publish_document", {
      p_entity_type: "theme",
      p_entity_id: theme.id,
    });

    // 0010 raises 42501 for its own permission check, which is what
    // `rpcError` maps to ForbiddenError.
    expect(error?.code, "publish_document asserts theme.publish itself").toBe("42501");
  });

  it("publishes for an editor who holds theme.publish, and records the history", async () => {
    const theme = await createTheme("draft");

    const role = await fixtures.createRole(["theme.read", "theme.write", "theme.publish"]);
    const user = await fixtures.createUser([role]);
    const db = await fixtures.signIn(user.email, user.password);

    const { data: version, error } = await db.rpc("publish_document", {
      p_entity_type: "theme",
      p_entity_id: theme.id,
    });

    // The assertion that `document_table('theme')` resolves: without 0017 this
    // raises "not a publishable entity type".
    expect(error, error?.message).toBeNull();
    expect(version, "version advances from 0").toBe(1);

    const service = adminClient();

    const { data: row } = await service
      .from("theme_settings")
      .select("status, published_data, version")
      .eq("id", theme.id)
      .single();
    expect(row?.status).toBe("published");
    expect(parseThemeColors(row?.published_data)).toEqual(DEFAULT_THEME_COLORS);

    // The polymorphic tables take an entity type they have no CHECK for.
    const { data: revisions } = await service
      .from("revisions")
      .select("version, reason")
      .eq("entity_type", "theme")
      .eq("entity_id", theme.id);
    expect(revisions ?? []).toEqual([{ version: 1, reason: "publish" }]);

    const { data: events } = await service
      .from("publish_events")
      .select("action, from_version, to_version")
      .eq("entity_type", "theme")
      .eq("entity_id", theme.id);
    expect(events ?? []).toEqual([{ action: "publish", from_version: 0, to_version: 1 }]);
  });

  it("takes it off the site again, keeping the payload", async () => {
    const theme = await createTheme("published");

    const role = await fixtures.createRole(["theme.read", "theme.write", "theme.publish"]);
    const user = await fixtures.createUser([role]);
    const db = await fixtures.signIn(user.email, user.password);

    const { error } = await db.rpc("unpublish_document", {
      p_entity_type: "theme",
      p_entity_id: theme.id,
    });
    expect(error, error?.message).toBeNull();

    const { data: row } = await adminClient()
      .from("theme_settings")
      .select("status, published_at, published_data")
      .eq("id", theme.id)
      .single();

    // 0010 sets status back to 'draft' and clears published_at, but keeps
    // `published_data` deliberately so re-publishing is one step. The status is
    // what 0017's policy reads, so the anonymous client stops seeing the row and
    // the site falls back to the built-in tokens rather than to no colours.
    expect(row?.status).toBe("draft");
    expect(row?.published_at).toBeNull();
    expect(
      row?.published_data,
      "the payload survives, so re-publishing is one step"
    ).not.toBeNull();

    const { data: toAnon } = await anonClient()
      .from("theme_settings")
      .select("id")
      .eq("id", theme.id);
    expect(toAnon ?? [], "and anon no longer sees it").toHaveLength(0);
  });
});
