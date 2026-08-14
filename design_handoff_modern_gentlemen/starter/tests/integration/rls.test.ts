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

/**
 * An article with one tag attached. The join row cascades with the article, so
 * only the tag itself needs tracking.
 */
async function makeTaggedArticle(
  status: "draft" | "published"
): Promise<{ articleId: string; tagId: string }> {
  const article = await makeArticle(status);

  const { data: tag, error } = await db
    .from("tags")
    .insert({ slug: prefixed("rls-tag"), label: "RLS fixture tag" })
    .select("id")
    .single();
  if (error || !tag) throw new Error(`makeTag: ${error?.message}`);
  fixtures.track("tags", tag.id);

  const { error: linkError } = await db
    .from("article_tags")
    .insert({ article_id: article.id, tag_id: tag.id });
  if (linkError) throw new Error(`makeArticleTag: ${linkError.message}`);

  return { articleId: article.id, tagId: tag.id };
}

/** Two articles and the relation between them, each end independently staged. */
async function makeRelatedArticles(
  ownerStatus: "draft" | "published",
  relatedStatus: "draft" | "published"
): Promise<{ ownerId: string; relatedId: string }> {
  const owner = await makeArticle(ownerStatus);
  const related = await makeArticle(relatedStatus);

  const { error } = await db
    .from("article_relations")
    .insert({ article_id: owner.id, related_id: related.id });
  if (error) throw new Error(`makeArticleRelation: ${error.message}`);

  return { ownerId: owner.id, relatedId: related.id };
}

/** A product carrying the two children that would disclose its pricing. */
async function makeProductWithChildren(
  status: "draft" | "published"
): Promise<{ productId: string; variantId: string; assetId: string }> {
  const product = await makeProduct(status);

  const { data: variant, error } = await db
    .from("product_variants")
    .insert({ product_id: product.id, title: "RLS fixture variant", sku: prefixed("rls-sku") })
    .select("id")
    .single();
  if (error || !variant) throw new Error(`makeVariant: ${error?.message}`);

  const { data: asset, error: assetError } = await db
    .from("media_assets")
    .insert({
      storage_path: prefixed("rls/child.jpg"),
      kind: "image",
      mime_type: "image/jpeg",
      file_name: "child.jpg",
    })
    .select("id")
    .single();
  if (assetError || !asset) throw new Error(`makeAsset: ${assetError?.message}`);
  fixtures.track("media_assets", asset.id);

  const { error: linkError } = await db
    .from("product_media")
    .insert({ product_id: product.id, asset_id: asset.id });
  if (linkError) throw new Error(`makeProductMedia: ${linkError.message}`);

  return { productId: product.id, variantId: variant.id, assetId: asset.id };
}

/** A collection membership, with each end independently staged. */
async function makeCollectionItem(
  collectionStatus: "draft" | "published",
  productStatus: "draft" | "published"
): Promise<{ collectionId: string; productId: string }> {
  const { data: collection, error } = await db
    .from("product_collections")
    .insert({
      slug: prefixed("rls-collection"),
      name: "RLS fixture collection",
      status: collectionStatus,
    })
    .select("id")
    .single();
  if (error || !collection) throw new Error(`makeCollection: ${error?.message}`);
  fixtures.track("product_collections", collection.id);

  const product = await makeProduct(productStatus);

  const { error: linkError } = await db
    .from("product_collection_items")
    .insert({ collection_id: collection.id, product_id: product.id });
  if (linkError) throw new Error(`makeCollectionItem: ${linkError.message}`);

  return { collectionId: collection.id, productId: product.id };
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

/**
 * `0019`. Five child tables shipped `using (true)` while their parents were
 * scoped to published-or-staff, so a draft parent hid itself and disclosed its
 * children — a draft product's sku and price_pence being the sharpest case,
 * because ingestion creates imported products as drafts.
 *
 * Each test asserts both halves. The positive half is what stops the fix from
 * being "deny everything", which would pass every negative assertion here and
 * empty the PDP gallery in production.
 */
describe("anon reads: a child row follows its parent's publish state", () => {
  it("hides the tags of a draft article", async () => {
    const draft = await makeTaggedArticle("draft");
    const live = await makeTaggedArticle("published");

    const { data: hidden } = await anon
      .from("article_tags")
      .select("tag_id")
      .eq("article_id", draft.articleId);
    expect(hidden ?? [], "tags of an unpublished article").toHaveLength(0);

    const { data: shown } = await anon
      .from("article_tags")
      .select("tag_id")
      .eq("article_id", live.articleId);
    expect(shown ?? [], "tags of a published article").toHaveLength(1);
  });

  it("hides a relation whose other end is still a draft", async () => {
    const bothLive = await makeRelatedArticles("published", "published");
    const relatedIsDraft = await makeRelatedArticles("published", "draft");
    const ownerIsDraft = await makeRelatedArticles("draft", "published");

    const { data: shown } = await anon
      .from("article_relations")
      .select("related_id")
      .eq("article_id", bothLive.ownerId);
    expect(shown ?? [], "both ends published").toHaveLength(1);

    // The published owner is readable, so only the far end's check can hide
    // this row — which is the half a one-sided policy would have missed.
    const { data: hiddenFarEnd } = await anon
      .from("article_relations")
      .select("related_id")
      .eq("article_id", relatedIsDraft.ownerId);
    expect(hiddenFarEnd ?? [], "a published article related to a draft").toHaveLength(0);

    const { data: hiddenOwner } = await anon
      .from("article_relations")
      .select("related_id")
      .eq("article_id", ownerIsDraft.ownerId);
    expect(hiddenOwner ?? [], "relations belonging to a draft article").toHaveLength(0);
  });

  it("hides the variants of a draft product — the sku and price case", async () => {
    const draft = await makeProductWithChildren("draft");
    const live = await makeProductWithChildren("published");

    const { data: hidden } = await anon
      .from("product_variants")
      .select("sku, price_pence")
      .eq("id", draft.variantId);
    expect(hidden ?? [], "variants of an unpublished product").toHaveLength(0);

    const { data: shown } = await anon
      .from("product_variants")
      .select("sku, price_pence")
      .eq("id", live.variantId);
    expect(shown ?? [], "variants of a published product").toHaveLength(1);
  });

  it("hides the gallery of a draft product", async () => {
    const draft = await makeProductWithChildren("draft");
    const live = await makeProductWithChildren("published");

    const { data: hidden } = await anon
      .from("product_media")
      .select("asset_id")
      .eq("product_id", draft.productId);
    expect(hidden ?? [], "gallery of an unpublished product").toHaveLength(0);

    const { data: shown } = await anon
      .from("product_media")
      .select("asset_id")
      .eq("product_id", live.productId);
    expect(shown ?? [], "gallery of a published product").toHaveLength(1);
  });

  it("hides a collection membership when either end is a draft", async () => {
    const bothLive = await makeCollectionItem("published", "published");
    const draftProduct = await makeCollectionItem("published", "draft");
    const draftCollection = await makeCollectionItem("draft", "published");

    const { data: shown } = await anon
      .from("product_collection_items")
      .select("product_id")
      .eq("collection_id", bothLive.collectionId);
    expect(shown ?? [], "both ends published").toHaveLength(1);

    const { data: hiddenProduct } = await anon
      .from("product_collection_items")
      .select("product_id")
      .eq("collection_id", draftProduct.collectionId);
    expect(hiddenProduct ?? [], "a draft product inside a published collection").toHaveLength(0);

    const { data: hiddenCollection } = await anon
      .from("product_collection_items")
      .select("product_id")
      .eq("collection_id", draftCollection.collectionId);
    expect(hiddenCollection ?? [], "membership of an unpublished collection").toHaveLength(0);
  });

  it("still shows all five to staff, because the policies keep is_staff()", async () => {
    const article = await makeTaggedArticle("draft");
    const product = await makeProductWithChildren("draft");

    const { data: tags } = await editorDb
      .from("article_tags")
      .select("tag_id")
      .eq("article_id", article.articleId);
    expect(tags ?? [], "an editor must still see a draft article's tags").toHaveLength(1);

    const { data: variants } = await editorDb
      .from("product_variants")
      .select("id")
      .eq("product_id", product.productId);
    expect(variants ?? [], "and a draft product's variants").toHaveLength(1);
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
 * `is_system` is enforced by `0018`, and this is the test that says so.
 *
 * It was written as a characterisation test asserting the opposite — a
 * `page.write` holder deleting a system page — because the bypass was found by
 * reading the policy catalogue and had never been demonstrated. It passed,
 * which is what promoted the finding from inference to fact and justified the
 * migration. This is that same test, inverted: the mechanism it guards is
 * subtle enough (permissive policies OR, so a guard living in one of them
 * constrains nothing) that a future policy could reopen it without anybody
 * noticing.
 */
describe("system pages", () => {
  it("refuses to let a page.write holder delete one", async () => {
    const system = await makePage("published", { isSystem: true });

    // The actor can edit it — so the refusal below is about `is_system`
    // specifically, and not about reaching the row at all.
    const { error: editError } = await pageWriterDb
      .from("pages")
      .update({ title: "Edited, which is allowed" })
      .eq("id", system.id);
    expect(editError, "editing a system page is ordinary page.write work").toBeNull();

    await pageWriterDb.from("pages").delete().eq("id", system.id);

    const { count } = await db
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("id", system.id);

    expect(count, "`0018`'s restrictive policy must survive the permissive OR").toBe(1);
  });

  it("still allows deleting an ordinary page, so the guard is not a blanket refusal", async () => {
    const ordinary = await makePage("published");

    // The same actor as above, holding page.write and NOT page.delete — and it
    // deletes this one, because `pages: write` is a cmd=ALL permissive policy
    // that covers DELETE. That is finding #2 in PROGRESS.md: `page.delete`
    // grants rather than restricts. `0018` deliberately did not touch it, so
    // this assertion is the proof that the restrictive policy is narrow —
    // scoped to `is_system` and nothing else.
    await pageWriterDb.from("pages").delete().eq("id", ordinary.id);

    const { count } = await db
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("id", ordinary.id);

    expect(count, "a non-system page is still deletable").toBe(0);
  });
});

/**
 * Records behaviour this suite found and did NOT fix. It asserts what the
 * database does today, so the fact is executable rather than only written down
 * — and so that closing the gap turns this file red and forces the assertion to
 * be inverted deliberately, which is exactly what happened to the `is_system`
 * test above.
 *
 * Described in PROGRESS.md under "Known issues"; not fixed here because it
 * spans six tables and wants its own decision.
 */
describe("known gaps — this asserts current behaviour, not desired behaviour", () => {
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
});
