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

/**
 * Staff: `page.write` **and** `page.delete`.
 *
 * The positive half of `0022`. Without an actor that holds the delete
 * permission, every assertion about the new restrictive policies would be
 * satisfied just as well by a policy that refuses everybody — which is the
 * failure mode a blanket `using (false)` would sail through.
 */
let pageDeleterDb: Db;

/**
 * Staff: may write four document types and delete none of them.
 *
 * One actor rather than four, because the shape under test is identical on
 * every table and the interesting variable is the table, not the role.
 */
let writerNoDeleteDb: Db;

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

  const pageDeleterRole = await fixtures.createRole(["page.read", "page.write", "page.delete"]);
  const pageDeleter = await fixtures.createUser([pageDeleterRole]);
  pageDeleterDb = await fixtures.signIn(pageDeleter.email, pageDeleter.password);

  const writerNoDeleteRole = await fixtures.createRole([
    "article.read",
    "article.write",
    "product.read",
    "product.write",
    "template.read",
    "template.write",
    "pattern.read",
    "pattern.write",
  ]);
  const writerNoDelete = await fixtures.createUser([writerNoDeleteRole]);
  writerNoDeleteDb = await fixtures.signIn(writerNoDelete.email, writerNoDelete.password);

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

/** A bare media asset, with no product behind it. `0022`'s media fixture. */
async function makeAsset(): Promise<{ id: string }> {
  const { data, error } = await db
    .from("media_assets")
    .insert({
      storage_path: prefixed("rls/asset.jpg"),
      kind: "image",
      mime_type: "image/jpeg",
      file_name: "asset.jpg",
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`makeAsset: ${error?.message}`);
  fixtures.track("media_assets", data.id);
  return data;
}

/** `kind` is CHECK-constrained; `page` is the least surprising member. */
async function makeTemplate(): Promise<{ id: string }> {
  const { data, error } = await db
    .from("templates")
    .insert({ key: prefixed("rls-template"), kind: "page", name: "RLS fixture template" })
    .select("id")
    .single();

  if (error || !data) throw new Error(`makeTemplate: ${error?.message}`);
  fixtures.track("templates", data.id);
  return data;
}

async function makePattern(): Promise<{ id: string }> {
  const { data, error } = await db
    .from("patterns")
    .insert({ key: prefixed("rls-pattern"), name: "RLS fixture pattern" })
    .select("id")
    .single();

  if (error || !data) throw new Error(`makePattern: ${error?.message}`);
  fixtures.track("patterns", data.id);
  return data;
}

async function makeCategory(): Promise<{ id: string }> {
  const { data, error } = await db
    .from("categories")
    .insert({ slug: prefixed("rls-category"), name: "RLS fixture category" })
    .select("id")
    .single();

  if (error || !data) throw new Error(`makeCategory: ${error?.message}`);
  fixtures.track("categories", data.id);
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

/**
 * `0024`. **The only table in this schema an anonymous visitor may write to**,
 * which inverts every other block in this file: the interesting assertions are
 * that the write is allowed and that nothing else is.
 *
 * The defect it closes was not an RLS bug at all — both sign-up bands discarded
 * the address and claimed success on seven live pages. But the table it needed
 * is the first public write surface here, so the policy shape is new and worth
 * pinning: a subscriber list `anon` can read is a subscriber list that has
 * leaked, and PostgREST is a public endpoint.
 */
/**
 * `0025`. Two unrelated defects found in the same audit pass.
 *
 * The `site_settings` half is the cheap kind of security fix — a table nobody
 * reads, empty, and world-readable since `0001`. The mappings half is a real
 * data-loss bug that had been showing up as E2E flakiness.
 */
describe("0025: site_settings is not world-readable", () => {
  it("refuses anon the settings table", async () => {
    // `for select using (true)` since `0001`. A table named "settings" is the
    // kind that acquires an operational value nobody meant to publish, and the
    // policy was written before anyone knew what would go in it.
    const { data, error } = await anon.from("site_settings").select("*");

    // Empty rather than 42501: the grant is intact, the policy now returns no
    // rows. Both are a refusal; asserting emptiness is what survives either.
    expect(error, "the read itself is not a privilege error").toBeNull();
    expect(data ?? [], "anon must see no settings").toHaveLength(0);
  });
});

describe("0025: replacing feed mappings is atomic", () => {
  async function makeSource(): Promise<{ id: string }> {
    const { data, error } = await db
      .from("product_sources")
      .insert({ name: prefixed("rls-source"), kind: "xml_feed", config: {} as never })
      .select("id")
      .single();
    if (error || !data) throw new Error(`makeSource: ${error?.message}`);
    fixtures.track("product_sources", data.id);
    return data;
  }

  it("swaps the whole set in one call", async () => {
    const source = await makeSource();
    await db.from("feed_field_mappings").insert([
      { source_id: source.id, target_field: "name", source_path: "/old/a", is_required: true },
      { source_id: source.id, target_field: "slug", source_path: "/old/b", is_required: false },
    ]);

    const { error } = await db.rpc("replace_feed_mappings", {
      p_source_id: source.id,
      p_mappings: [
        { target_field: "name", source_path: "/new/n", is_required: true },
        { target_field: "description", source_path: "/new/d", is_required: false },
      ] as never,
    });
    expect(error, "a valid replace succeeds").toBeNull();

    const { data } = await db
      .from("feed_field_mappings")
      .select("target_field, source_path")
      .eq("source_id", source.id)
      .order("target_field");

    expect(data?.map((m) => m.target_field)).toEqual(["description", "name"]);
    expect(data?.every((m) => m.source_path.startsWith("/new/"))).toBe(true);
  });

  /**
   * ⚠️ **The assertion the whole migration exists for.** The old
   * delete-then-insert was two PostgREST round trips: a failure in the second
   * left the source with **zero** mappings and surfaced no error to the editor.
   * The count after a failed replace is therefore the regression test — if this
   * ever reads 0 again, atomicity has been lost.
   */
  it("leaves the previous set intact when the new one is invalid", async () => {
    const source = await makeSource();
    await db.from("feed_field_mappings").insert([
      { source_id: source.id, target_field: "name", source_path: "/keep/a", is_required: true },
      { source_id: source.id, target_field: "slug", source_path: "/keep/b", is_required: false },
    ]);

    // `target_field` is NOT NULL, so this fails on the insert half — after the
    // delete half has already run inside the function's transaction.
    const { error } = await db.rpc("replace_feed_mappings", {
      p_source_id: source.id,
      p_mappings: [{ target_field: null, source_path: "/bad", is_required: false }] as never,
    });
    expect(error?.code, "an invalid payload must fail loudly").toBe("23502");

    const { count } = await db
      .from("feed_field_mappings")
      .select("*", { count: "exact", head: true })
      .eq("source_id", source.id);

    expect(count, "the delete must have rolled back with the insert").toBe(2);
  });

  it("treats an empty array as `clear them`", async () => {
    const source = await makeSource();
    await db
      .from("feed_field_mappings")
      .insert([
        { source_id: source.id, target_field: "name", source_path: "/a", is_required: true },
      ]);

    const { error } = await db.rpc("replace_feed_mappings", {
      p_source_id: source.id,
      p_mappings: [] as never,
    });
    expect(error, "an empty payload is legitimate, not an error").toBeNull();

    const { count } = await db
      .from("feed_field_mappings")
      .select("*", { count: "exact", head: true })
      .eq("source_id", source.id);
    expect(count).toBe(0);
  });

  it("still runs as the caller, so RLS decides", async () => {
    // `security invoker` is the design: a `security definer` function would
    // bypass the editor's RLS and break this repo's oldest standing rule. An
    // actor without `integration.write` must be refused.
    const source = await makeSource();

    const { error } = await outsiderDb.rpc("replace_feed_mappings", {
      p_source_id: source.id,
      p_mappings: [{ target_field: "name", source_path: "/x", is_required: true }] as never,
    });

    // The delete matches no rows it may see and the insert is refused by the
    // policy — either way nothing is written.
    const { count } = await db
      .from("feed_field_mappings")
      .select("*", { count: "exact", head: true })
      .eq("source_id", source.id);

    expect(error ?? count, "a role-less account must not write mappings").toBeTruthy();
    expect(count, "and must leave the table alone").toBe(0);
  });
});

describe("newsletter: anon may write and may not read", () => {
  const address = () => `zz-rls-${crypto.randomUUID()}@example.test`;

  it("lets an anonymous visitor sign up", async () => {
    const email = address();

    const { error } = await anon
      .from("newsletter_subscribers")
      .insert({ email, source: "newsletter" });
    expect(error, "anon must be able to subscribe").toBeNull();

    const { count } = await db
      .from("newsletter_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("email", email);
    expect(count, "the row is really there").toBe(1);
  });

  it("refuses anon the list it just wrote to", async () => {
    // The assertion that matters most. A read here would mean the whole
    // subscriber list is downloadable with the publishable key that ships in
    // the client bundle.
    const { data, error } = await anon.from("newsletter_subscribers").select("email");

    expect(error?.code, "selecting subscribers as anon must be refused").toBe(DENIED);
    expect(data, "and must not arrive by another route").toBeNull();
  });

  it("refuses anon a forged `confirmed` status", async () => {
    // `anon` holds an INSERT grant on (id, email, source) and no other column,
    // so this is refused by the grant rather than by application validation —
    // which is what makes it true of a hand-rolled PostgREST call too.
    // ⚠️ **This type-checks, and that is the point.** `database.types.ts` is
    // generated from the schema and cannot express a column-level grant, so
    // TypeScript believes `status` is insertable by anyone. Only the database
    // knows better — which is exactly why the gate belongs there and not in a
    // Zod schema a caller could bypass.
    const { error } = await anon
      .from("newsletter_subscribers")
      .insert({ email: address(), source: "newsletter", status: "confirmed" });

    expect(error, "anon must not be able to set status").not.toBeNull();
  });

  it("stores a new sign-up as pending, never as subscribed", async () => {
    // Nothing sends a confirmation email yet, so a row claiming otherwise would
    // be the same untruth the button used to tell, merely stored.
    const email = address();
    await anon.from("newsletter_subscribers").insert({ email, source: "ctaBand" });

    const { data } = await db
      .from("newsletter_subscribers")
      .select("status, confirmed_at, source")
      .eq("email", email)
      .single();

    expect(data?.status).toBe("pending");
    expect(data?.confirmed_at).toBeNull();
    expect(data?.source).toBe("ctaBand");
  });

  it("surfaces a repeat address as 23505, which the repository treats as success", async () => {
    // ⚠️ **An upsert cannot be used here and this test is where that is
    // pinned.** PostgREST's upsert path needs SELECT on the table — which is
    // exactly what this table's grants withhold — so the repository does a
    // plain insert and tolerates the unique violation instead. Asserting the
    // *code* rather than "no error" is what stops someone reinstating
    // `.upsert()` and getting a 42501 on every sign-up.
    const email = address();

    await anon.from("newsletter_subscribers").insert({ email, source: "newsletter" });
    const { error } = await anon
      .from("newsletter_subscribers")
      .insert({ email, source: "ctaBand" });

    expect(error?.code, "a repeat sign-up is a unique violation").toBe("23505");

    const { count } = await db
      .from("newsletter_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("email", email);
    expect(count, "and creates no second row").toBe(1);
  });

  it("refuses an address that is not already lowercased", async () => {
    // The CHECK is what makes a plain `unique (email)` case-insensitive: no
    // other casing can exist, so two spellings of one mailbox cannot both be
    // stored. Normalisation is the domain's job, and this is what makes it a
    // property of the data rather than a habit of one caller.
    const { error } = await anon
      .from("newsletter_subscribers")
      .insert({ email: "ZZ-Upper@Example.test", source: "newsletter" });

    expect(error?.code, "mixed case must be refused at the database").toBe("23514");
  });

  it("lets staff read the list", async () => {
    // The positive half. Every assertion above is satisfied just as well by a
    // table nobody can touch at all.
    const email = address();
    await anon.from("newsletter_subscribers").insert({ email, source: "newsletter" });

    const { data, error } = await editorDb
      .from("newsletter_subscribers")
      .select("email")
      .eq("email", email);

    expect(error, "staff read is ordinary work").toBeNull();
    expect(data ?? [], "staff can see the sign-up").toHaveLength(1);
  });

  it("refuses a signed-in account that holds no role", async () => {
    // `authenticated` carries the table grant, so RLS is the only thing
    // separating a staff member from any visitor who happens to have an account.
    const { data } = await outsiderDb.from("newsletter_subscribers").select("email");
    expect(data ?? [], "a role-less account sees nothing").toHaveLength(0);
  });
});

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

  it("cannot combine published-row visibility with authenticated draft privileges", async () => {
    const live = await makePage("published");

    const { data, error } = await outsiderDb
      .from("pages")
      .select("slug, status, draft_data, published_data")
      .eq("id", live.id);

    // `0020` cannot revoke this column from all of `authenticated`: the builder
    // is authenticated too. `0028` instead scopes published-row visibility to
    // anon and grants authenticated reads by permission, so a role-less JWT
    // cannot combine a public row with authenticated's wider column grant.
    expect(
      error,
      "RLS hides the row rather than exposing a distinguishable column error"
    ).toBeNull();
    expect(data ?? [], "a role-less account must receive no CMS document row").toHaveLength(0);
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

    // `pageDeleterDb`, not `pageWriterDb`. Until `0022` this assertion used the
    // write-only actor and passed — which was the point: it was the
    // characterisation test for finding #2, proving `page.delete` granted
    // rather than restricted. `0022` makes the delete permission real, so the
    // narrowness of `0018`'s guard now has to be shown by an actor that holds
    // it. Both restrictive policies are AND-ed, and this actor passes both.
    await pageDeleterDb.from("pages").delete().eq("id", ordinary.id);

    const { count } = await db
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("id", ordinary.id);

    expect(count, "a non-system page is still deletable by a page.delete holder").toBe(0);
  });

  it("refuses even a page.delete holder a system page, so the two guards stack", async () => {
    const system = await makePage("published", { isSystem: true });

    await pageDeleterDb.from("pages").delete().eq("id", system.id);

    const { count } = await db
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("id", system.id);

    // `0018` and `0022` are both RESTRICTIVE on the same command, so they are
    // AND-ed with each other as well as with the permissive set. Holding the
    // delete permission satisfies one and not the other.
    expect(count, "`0018` must still bind an actor that clears `0022`").toBe(1);
  });
});

/**
 * `0022`. The third characterisation test in this file to complete the full
 * cycle — asserted as the wrong-but-current behaviour, cited to justify a
 * migration, then inverted in the same commit as the fix. The one that moved is
 * directly above: "still allows deleting an ordinary page" used to run as the
 * write-only actor.
 *
 * The defect: a `for all` permissive write policy covers DELETE, and permissive
 * policies are OR-ed, so `x.write OR x.delete` made every delete permission
 * additive. It could grant and never refuse.
 *
 * Every one of these actors could delete the row before `0022`. The service
 * layer refused them all — `deleteDocument`, `lib/services/media.ts` and
 * `lib/services/products.ts` each call `requirePermission` with the right
 * `x.delete` — but PostgREST is a public endpoint and a signed-in author holds
 * a real JWT, so the service layer is not in that path. RLS is.
 */
describe("delete permissions are real gates", () => {
  it("refuses an article.write holder without article.delete", async () => {
    const article = await makeArticle("published");

    // Editing it is allowed, which is what makes the refusal specific: this
    // actor reaches the row perfectly well and is stopped only at DELETE.
    const { error: editError } = await writerNoDeleteDb
      .from("articles")
      .update({ title: "Edited, which is allowed" })
      .eq("id", article.id);
    expect(editError, "editing is ordinary article.write work").toBeNull();

    await writerNoDeleteDb.from("articles").delete().eq("id", article.id);

    const { count } = await db
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("id", article.id);

    expect(count, "article.write alone must no longer delete").toBe(1);
  });

  it("refuses a product.write holder without product.delete", async () => {
    const product = await makeProduct("published");

    await writerNoDeleteDb.from("products").delete().eq("id", product.id);

    const { count } = await db
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("id", product.id);

    expect(count, "product.write alone must no longer delete").toBe(1);
  });

  it("refuses a media.write holder without media.delete", async () => {
    const asset = await makeAsset();

    await mediaWriterDb.from("media_assets").delete().eq("id", asset.id);

    const { count } = await db
      .from("media_assets")
      .select("*", { count: "exact", head: true })
      .eq("id", asset.id);

    // The asymmetry this closes is worth naming: `0013` already gated the
    // storage object on `media.delete` with a per-command policy, so this actor
    // could delete the catalogue row and not the file it points at, leaving an
    // orphan in the bucket.
    expect(count, "media.write alone must no longer delete").toBe(1);
  });

  it("refuses template.write and pattern.write holders their own tables", async () => {
    const template = await makeTemplate();
    const pattern = await makePattern();

    await writerNoDeleteDb.from("templates").delete().eq("id", template.id);
    await writerNoDeleteDb.from("patterns").delete().eq("id", pattern.id);

    const { count: templateCount } = await db
      .from("templates")
      .select("*", { count: "exact", head: true })
      .eq("id", template.id);
    const { count: patternCount } = await db
      .from("patterns")
      .select("*", { count: "exact", head: true })
      .eq("id", pattern.id);

    expect(templateCount, "template.write alone must no longer delete").toBe(1);
    expect(patternCount, "pattern.write alone must no longer delete").toBe(1);
  });

  it("still lets the editor role delete all four, so none of this is a blanket refusal", async () => {
    const article = await makeArticle("published");
    const product = await makeProduct("published");
    const asset = await makeAsset();
    const pattern = await makePattern();

    await editorDb.from("articles").delete().eq("id", article.id);
    await editorDb.from("products").delete().eq("id", product.id);
    await editorDb.from("media_assets").delete().eq("id", asset.id);
    await editorDb.from("patterns").delete().eq("id", pattern.id);

    for (const [table, id] of [
      ["articles", article.id],
      ["products", product.id],
      ["media_assets", asset.id],
      ["patterns", pattern.id],
    ] as const) {
      const { count } = await db
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("id", id);
      expect(count, `the editor role holds the delete permission for ${table}`).toBe(0);
    }
  });

  /**
   * ⚠️ **INVERTED — the third characterisation test in this file to complete the
   * full cycle**, after `is_system` for `0018` and `draft_data` for `0020`.
   *
   * It read "KNOWN GAP: taxonomy.write still deletes a category, because 0022
   * excluded it" and asserted `count` was 0. `0022`'s header named the
   * prerequisite — reconciling the two service paths — as a product decision
   * rather than a policy repair. That decision was taken: deleting a category
   * destroys a layout document as well as a label, so both routes now require
   * `category.delete`, and `0023` is the restrictive policy that became
   * possible. The row survives and `count` is 1.
   */
  it("refuses a taxonomy.write holder a category, now that 0023 gates it", async () => {
    const taxonomyWriterRole = await fixtures.createRole(["taxonomy.write"]);
    const taxonomyWriter = await fixtures.createUser([taxonomyWriterRole]);
    const taxonomyWriterDb = await fixtures.signIn(taxonomyWriter.email, taxonomyWriter.password);

    const category = await makeCategory();

    // Renaming first, for the reason the article case gives: it proves the
    // actor reaches the row perfectly well and is stopped only at DELETE,
    // rather than having lost access to `categories` altogether.
    const { error: editError } = await taxonomyWriterDb
      .from("categories")
      .update({ name: "Renamed, which is still allowed" })
      .eq("id", category.id);
    expect(editError, "renaming is ordinary taxonomy.write work").toBeNull();

    await taxonomyWriterDb.from("categories").delete().eq("id", category.id);

    const { count } = await db
      .from("categories")
      .select("*", { count: "exact", head: true })
      .eq("id", category.id);

    expect(count, "taxonomy.write alone must no longer delete a category").toBe(1);
  });

  /**
   * The positive half, and the one that stops a `using (false)` policy passing.
   * Every negative assertion above is satisfied just as well by a policy that
   * refuses everybody.
   */
  it("still lets a category.delete holder delete one", async () => {
    const category = await makeCategory();

    await editorDb.from("categories").delete().eq("id", category.id);

    const { count } = await db
      .from("categories")
      .select("*", { count: "exact", head: true })
      .eq("id", category.id);

    expect(count, "the editor role holds category.delete").toBe(0);
  });
});

/**
 * `0020`. This block used to be `known gaps` and asserted the **wrong**
 * behaviour on purpose: that `anon` could read `draft_data` on a published row.
 * That is the second characterisation test in this file to go through the full
 * cycle — asserted as a gap, used to justify a migration, then inverted in the
 * same commit as the fix, exactly as the `is_system` one was for `0018`.
 *
 * RLS is row-level, so the fix is not a policy: `0012` granted table-level
 * SELECT to `anon`, and a table-level grant covers every column. `0020` revokes
 * it and re-grants the columns individually, minus the draft.
 */
describe("anon reads: the draft column is not public", () => {
  it("refuses anon the draft_data column on a published page", async () => {
    const live = await makePage("published");

    const { data, error } = await anon
      .from("pages")
      .select("draft_data")
      .eq("id", live.id)
      .maybeSingle();

    // PostgREST surfaces a missing column privilege as 42501, the same code a
    // refused row carries — the request never reaches the data.
    expect(error?.code, "selecting draft_data as anon must be refused").toBe(DENIED);
    expect(data, "and it must not arrive by another route").toBeNull();
  });

  it("serves the published columns of that same row", async () => {
    const live = await makePage("published");

    const { data, error } = await anon
      .from("pages")
      .select("slug, title, status, published_data")
      .eq("id", live.id)
      .single();

    // The half that stops the fix from being "revoke everything": a revoke with
    // no re-grant would satisfy the assertion above and take the public site
    // down with it.
    expect(error, "the published columns must still be readable").toBeNull();
    expect(data?.slug).toBe(live.slug);
  });

  it("refuses the draft column on every table that carries one", async () => {
    const article = await makeArticle("published");
    const product = await makeProduct("published");

    for (const [table, id] of [
      ["articles", article.id],
      ["products", product.id],
    ] as const) {
      const { error } = await anon.from(table).select("draft_data").eq("id", id).maybeSingle();
      expect(error?.code, `${table}.draft_data must be refused`).toBe(DENIED);
    }
  });

  it("keeps draft_data readable by staff, because the admin is built on it", async () => {
    const draft = await makePage("draft");

    const { data, error } = await editorDb
      .from("pages")
      .select("draft_data")
      .eq("id", draft.id)
      .single();

    // `0020` is a column *grant* change and grants cannot distinguish staff from
    // non-staff — `authenticated` keeps the column, which is what makes the
    // builder work and is also the documented remainder of this gap.
    expect(error, "an editor must still read a draft").toBeNull();
    expect((data?.draft_data as { seo?: { title?: string } })?.seo?.title).toBe("draft title");
  });
});
