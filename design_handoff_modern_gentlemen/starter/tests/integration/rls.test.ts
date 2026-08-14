/**
 * RLS, asserted rather than assumed.
 *
 * This is the Phase 1 leftover the handoff has carried since the beginning: the
 * deepest of the three authorisation layers, and the only one with no empirical
 * check. The last one predates products, media, articles, navigation, theme and
 * ingestion — six phases of tables whose policies have never been exercised by
 * anything except the code that was written alongside them.
 *
 * Two properties make these assertions worth having, and neither survives a
 * unit test:
 *
 *   1. **RLS is the only barrier.** `0012` grants full DML on every public table
 *      to `anon` and `authenticated`. Nothing is protected by a missing GRANT —
 *      if a policy is wrong, the table is open. A mocked client proves nothing
 *      about that.
 *   2. **The negative half is the half that matters.** Every suite next door
 *      asserts that the right actor can do the right thing. What has never been
 *      asserted is that the wrong actor cannot, and that is the assertion an
 *      RLS regression breaks first.
 *
 * The actor that is easiest to forget has its own describe block: a signed-in
 * user holding **no roles at all**. `authenticated` carries exactly the same
 * grants as `anon`, so every policy keyed on `is_staff()` — not on being logged
 * in — is what stands between a bare account and the admin's data.
 *
 * Everything here runs against throwaway, run-prefixed rows and is removed in
 * teardown. Nothing touches a seeded row: the visual baselines and the public
 * read suites read the same project, so a stray edit would surface as a CSS
 * regression somewhere else entirely.
 *
 * Requires a stack — CI starts and seeds one (`.github/workflows/ci.yml`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Fixtures, adminClient, anonClient, prefixed, type Db } from "../support/fixtures";

const db = adminClient();
const fixtures = new Fixtures(db);
const anon = anonClient();

/** PostgREST surfaces both a missing GRANT and an RLS refusal as 42501. */
const DENIED = "42501";

/** Signed in, but holding no role at all — so `is_staff()` is false for them. */
let outsiderDb: Db;
let outsider: { id: string; email: string; password: string };

/** Staff: can edit a page, and that is all. Used for the escalation tests. */
let pageWriterDb: Db;

/** Staff: read-only over media. The negative half of the media.write gate. */
let mediaReaderDb: Db;

/** Staff: may write media. The positive half. */
let mediaWriterDb: Db;

/** Holds the seeded editor set, so it can actually publish. */
let editorDb: Db;

beforeAll(async () => {
  outsider = await fixtures.createUser([]);
  outsiderDb = await fixtures.signIn(outsider.email, outsider.password);

  const pageWriterRole = await fixtures.createRole(["page.read", "page.write"]);
  const pageWriter = await fixtures.createUser([pageWriterRole]);
  pageWriterDb = await fixtures.signIn(pageWriter.email, pageWriter.password);

  const mediaReaderRole = await fixtures.createRole(["media.read"]);
  const mediaReader = await fixtures.createUser([mediaReaderRole]);
  mediaReaderDb = await fixtures.signIn(mediaReader.email, mediaReader.password);

  const mediaWriterRole = await fixtures.createRole(["media.read", "media.write"]);
  const mediaWriter = await fixtures.createUser([mediaWriterRole]);
  mediaWriterDb = await fixtures.signIn(mediaWriter.email, mediaWriter.password);

  const editor = await fixtures.createUser(["editor"]);
  editorDb = await fixtures.signIn(editor.email, editor.password);
}, 120_000);

afterAll(async () => {
  await fixtures.cleanup();
});

/* ------------------------------------------------------------------ helpers */

/** A page in a chosen state. `createPage` only makes drafts. */
async function makePage(
  status: "draft" | "published",
  overrides: { isSystem?: boolean } = {}
): Promise<{ id: string; slug: string }> {
  const slug = prefixed("rls-page");
  const draft = { sections: [], seo: { title: "draft title" } };

  const { data, error } = await db
    .from("pages")
    .insert({
      slug,
      title: "RLS fixture page",
      is_system: overrides.isSystem ?? false,
      status,
      draft_data: draft as never,
      published_data: (status === "published" ? { sections: [], seo: {} } : null) as never,
    })
    .select("id, slug")
    .single();

  if (error || !data) throw new Error(`makePage: ${error?.message}`);
  fixtures.track("pages", data.id);
  return data;
}

async function makeArticle(status: "draft" | "published"): Promise<{ id: string; slug: string }> {
  const slug = prefixed("rls-article");
  const { data, error } = await db
    .from("articles")
    .insert({
      slug,
      title: "RLS fixture article",
      status,
      published_data: (status === "published" ? { sections: [] } : null) as never,
    })
    .select("id, slug")
    .single();

  if (error || !data) throw new Error(`makeArticle: ${error?.message}`);
  fixtures.track("articles", data.id);
  return data;
}

async function makeProduct(status: "draft" | "published"): Promise<{ id: string; slug: string }> {
  const slug = prefixed("rls-product");
  const { data, error } = await db
    .from("products")
    .insert({
      slug,
      name: "RLS fixture product",
      price_pence: 1234,
      status,
      published_data: (status === "published" ? { sections: [] } : null) as never,
    })
    .select("id, slug")
    .single();

  if (error || !data) throw new Error(`makeProduct: ${error?.message}`);
  fixtures.track("products", data.id);
  return data;
}

async function makeMenuWithItem(
  status: "draft" | "published"
): Promise<{ menuId: string; itemId: string }> {
  const key = prefixed("rls-menu");
  const { data: menu, error } = await db
    .from("menus")
    .insert({ key, name: "RLS fixture menu", status })
    .select("id")
    .single();
  if (error || !menu) throw new Error(`makeMenu: ${error?.message}`);
  fixtures.track("menus", menu.id);

  const { data: item, error: itemError } = await db
    .from("menu_items")
    .insert({ menu_id: menu.id, label: "Fixture item", link_type: "url", url: "/fixture" })
    .select("id")
    .single();
  if (itemError || !item) throw new Error(`makeMenuItem: ${itemError?.message}`);
  fixtures.track("menu_items", item.id);

  return { menuId: menu.id, itemId: item.id };
}

/* ------------------------------------------------- anonymous read behaviour */

describe("anon reads: unpublished documents are invisible", () => {
  it("hides a draft page and shows a published one", async () => {
    const draft = await makePage("draft");
    const live = await makePage("published");

    const { data: hidden } = await anon.from("pages").select("id").eq("id", draft.id);
    expect(hidden ?? [], "a draft page").toHaveLength(0);

    const { data: shown } = await anon.from("pages").select("id").eq("id", live.id);
    expect(shown ?? [], "a published page").toHaveLength(1);
  });

  it("hides a draft article", async () => {
    const draft = await makeArticle("draft");
    const live = await makeArticle("published");

    const { data: hidden } = await anon.from("articles").select("id").eq("id", draft.id);
    expect(hidden ?? []).toHaveLength(0);

    const { data: shown } = await anon.from("articles").select("id").eq("id", live.id);
    expect(shown ?? []).toHaveLength(1);
  });

  it("hides a draft product", async () => {
    const draft = await makeProduct("draft");
    const live = await makeProduct("published");

    const { data: hidden } = await anon.from("products").select("id").eq("id", draft.id);
    expect(hidden ?? []).toHaveLength(0);

    const { data: shown } = await anon.from("products").select("id").eq("id", live.id);
    expect(shown ?? []).toHaveLength(1);
  });

  it("hides the items of a draft menu, because the item policy joins its parent", async () => {
    const draft = await makeMenuWithItem("draft");
    const live = await makeMenuWithItem("published");

    const { data: hiddenItems } = await anon.from("menu_items").select("id").eq("id", draft.itemId);
    expect(hiddenItems ?? [], "items of an unpublished menu").toHaveLength(0);

    const { data: shownItems } = await anon.from("menu_items").select("id").eq("id", live.itemId);
    expect(shownItems ?? [], "items of a published menu").toHaveLength(1);
  });
});

describe("anon reads: staff-only tables leak nothing", () => {
  it("hides revisions and publish events created by a real publish", async () => {
    const page = await fixtures.createPage();

    const { error } = await editorDb.rpc("publish_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
      p_note: "rls fixture publish",
    });
    expect(error, "the publish itself must succeed or this proves nothing").toBeNull();

    const { count: revisionsToService } = await db
      .from("revisions")
      .select("*", { count: "exact", head: true })
      .eq("entity_id", page.id);
    expect(revisionsToService, "the revision exists").toBe(1);

    const { data: revisionsToAnon } = await anon
      .from("revisions")
      .select("id")
      .eq("entity_id", page.id);
    expect(revisionsToAnon ?? [], "and anon cannot read it").toHaveLength(0);

    const { data: eventsToAnon } = await anon
      .from("publish_events")
      .select("id")
      .eq("entity_id", page.id);
    expect(eventsToAnon ?? []).toHaveLength(0);
  });

  it("hides preview session tokens", async () => {
    const page = await fixtures.createPage();
    const token = prefixed("rls-token");
    await fixtures.createPreviewSession({ token, entityId: page.id });

    const { data } = await anon.from("preview_sessions").select("id").eq("token", token);
    expect(data ?? [], "a preview token is a bearer credential").toHaveLength(0);
  });

  it("hides accounts, roles and grants", async () => {
    const { data: profiles } = await anon.from("profiles").select("id").eq("id", outsider.id);
    expect(profiles ?? []).toHaveLength(0);

    const { data: userRoles } = await anon
      .from("user_roles")
      .select("user_id")
      .eq("user_id", outsider.id);
    expect(userRoles ?? []).toHaveLength(0);

    const { data: roles } = await anon.from("roles").select("key");
    expect(roles ?? [], "the role catalogue is staff-only").toHaveLength(0);

    const { data: grants } = await anon.from("role_permissions").select("role_key");
    expect(grants ?? []).toHaveLength(0);
  });
});

/* ------------------------------------------------ anonymous write behaviour */

describe("anon writes: refused everywhere", () => {
  // Run-prefixed even though every one of these is expected to be refused: if a
  // policy ever regresses, the insert lands, and a fixed slug would then make
  // the *next* run fail on a unique index instead of on the policy.
  it.each([
    ["pages", { slug: prefixed("rls-anon-page"), title: "nope" }],
    ["articles", { slug: prefixed("rls-anon-article"), title: "nope" }],
    ["products", { slug: prefixed("rls-anon-product"), name: "nope", price_pence: 1 }],
    ["menus", { key: prefixed("rls-anon-menu"), name: "nope" }],
    [
      "media_assets",
      {
        storage_path: `${prefixed("rls-anon-asset")}.jpg`,
        kind: "image",
        mime_type: "image/jpeg",
        file_name: "nope.jpg",
      },
    ],
  ])("cannot insert into %s", async (table, payload) => {
    const { error } = await anon
      .from(table as "pages")
      .insert(payload as never)
      .select();

    expect(error?.code, `${table} accepted an anonymous insert`).toBe(DENIED);
  });

  it("cannot edit a published page", async () => {
    const live = await makePage("published");

    // The row is readable — which is what makes this a test of the write path
    // rather than of visibility.
    const { data: visible } = await anon.from("pages").select("id").eq("id", live.id);
    expect(visible ?? []).toHaveLength(1);

    await anon.from("pages").update({ title: "defaced" }).eq("id", live.id);

    const { data: row } = await db.from("pages").select("title").eq("id", live.id).single();
    expect(row?.title, "the title must be untouched").toBe("RLS fixture page");
  });

  it("cannot delete a published page", async () => {
    const live = await makePage("published");

    await anon.from("pages").delete().eq("id", live.id);

    const { count } = await db
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("id", live.id);
    expect(count, "the page must still exist").toBe(1);
  });
});

/* ------------------------------------------- the signed-in-but-nobody actor */

describe("an authenticated user holding no roles is not staff", () => {
  it("sees no more than anon does", async () => {
    const draft = await makePage("draft");

    const { data } = await outsiderDb.from("pages").select("id").eq("id", draft.id);
    expect(data ?? [], "being logged in is not being staff").toHaveLength(0);

    const { data: revisions } = await outsiderDb.from("revisions").select("id").limit(1);
    expect(revisions ?? []).toHaveLength(0);

    const { data: sources } = await outsiderDb.from("product_sources").select("id").limit(1);
    expect(sources ?? [], "feed configuration is staff-only").toHaveLength(0);
  });

  it("cannot write any document table", async () => {
    const { error } = await outsiderDb
      .from("pages")
      .insert({ slug: prefixed("rls-outsider"), title: "nope" })
      .select();
    expect(error?.code).toBe(DENIED);
  });

  it("can read its own profile and not another account's", async () => {
    const { data: own } = await outsiderDb.from("profiles").select("id").eq("id", outsider.id);
    expect(own ?? [], "own profile").toHaveLength(1);

    const other = await fixtures.createUser([]);
    const { data: theirs } = await outsiderDb.from("profiles").select("id").eq("id", other.id);
    expect(theirs ?? [], "somebody else's profile").toHaveLength(0);
  });
});

/* ------------------------------------------------------ per-permission gates */

describe("permission gates", () => {
  it("lets media.write insert an asset and refuses media.read", async () => {
    const path = `${prefixed("rls-asset")}.jpg`;

    const { error: refused } = await mediaReaderDb
      .from("media_assets")
      .insert({
        storage_path: path,
        kind: "image",
        mime_type: "image/jpeg",
        file_name: "fixture.jpg",
      })
      .select();
    expect(refused?.code, "media.read must not imply media.write").toBe(DENIED);

    const { data: created, error: allowed } = await mediaWriterDb
      .from("media_assets")
      .insert({
        storage_path: path,
        kind: "image",
        mime_type: "image/jpeg",
        file_name: "fixture.jpg",
      })
      .select("id")
      .single();

    expect(allowed, "media.write must be able to write").toBeNull();
    if (created) fixtures.track("media_assets", created.id);
  });

  it("refuses a page writer the product table", async () => {
    const { error } = await pageWriterDb
      .from("products")
      .insert({ slug: prefixed("rls-x-product"), name: "nope", price_pence: 1 })
      .select();

    expect(error?.code, "one resource's write permission is not another's").toBe(DENIED);
  });

  it("lets a page writer edit a page", async () => {
    const draft = await makePage("draft");

    const { error } = await pageWriterDb
      .from("pages")
      .update({ title: "Edited by the page writer" })
      .eq("id", draft.id);

    expect(error, "the positive half — otherwise the refusals above prove nothing").toBeNull();
  });
});

/* -------------------------------------------------- privilege escalation */

describe("a staff account cannot widen its own access", () => {
  it("cannot grant itself a role", async () => {
    const { error } = await pageWriterDb
      .from("user_roles")
      .insert({ user_id: outsider.id, role_key: "admin" })
      .select();

    expect(error?.code, "granting roles needs user.write").toBe(DENIED);
  });

  it("cannot add a permission to a role it holds", async () => {
    const { error } = await pageWriterDb
      .from("role_permissions")
      .insert({ role_key: "author", permission_key: "user.write" })
      .select();

    expect(error?.code).toBe(DENIED);
  });

  it("cannot invent a permission", async () => {
    const { error } = await pageWriterDb
      .from("permissions")
      .insert({ key: "everything.always", resource: "everything", action: "always" })
      .select();

    expect(error?.code).toBe(DENIED);
  });
});

/* ------------------------------------------------------------- known gaps */

/**
 * These two record behaviour this suite found and did NOT fix. They assert what
 * the database does today, so the facts are executable rather than only written
 * down — and so that closing either gap turns this file red and forces the
 * assertion to be inverted deliberately.
 *
 * Both are described in PROGRESS.md under "Known issues"; neither is fixed here
 * because both want a migration and their own decision.
 */
describe("known gaps — these assert current behaviour, not desired behaviour", () => {
  it("KNOWN GAP: anon can read draft_data on a published row", async () => {
    const live = await makePage("published");

    const { data } = await anon.from("pages").select("draft_data").eq("id", live.id).single();

    // RLS is row-level; `0012` grants the whole row, column included. Today the
    // seeded rows carry no divergent draft, so nothing unpublished is actually
    // exposed — but the moment an editor starts an edit on a live page, its
    // unpublished text is served to anyone who asks for this column.
    expect(
      (data?.draft_data as { seo?: { title?: string } })?.seo?.title,
      "if this is undefined the gap has been closed — invert this test"
    ).toBe("draft title");
  });

  it("KNOWN GAP: page.write alone can delete a system page", async () => {
    const system = await makePage("published", { isSystem: true });

    await pageWriterDb.from("pages").delete().eq("id", system.id);

    const { count } = await db
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("id", system.id);

    // `pages: delete` guards `not is_system`, but `pages: write` is a PERMISSIVE
    // policy with cmd=ALL, and permissive policies are OR-ed — so the guard only
    // binds an actor who lacks page.write, which no page-deleting actor is.
    expect(count, "if this is 1 the guard now binds — invert this test").toBe(0);
  });
});
