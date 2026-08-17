/**
 * The generic rename, against a real Postgres.
 *
 * `renameDocument` writes the columns named in `DOCUMENT_TABLES` — `title`/`slug`
 * on a page, `name`/`key` on a pattern — so the one thing worth proving is that
 * it addresses the *right* columns for each type. That cannot be checked by
 * types: `from()` casts the table away precisely because a run-time table name
 * defeats the generated row types, which is the same reason
 * `productMedia.test.ts` and the document suite exist at all. A rename that
 * wrote `title` on `patterns` would raise 42703, and nothing before this would
 * have said so.
 *
 * Both types are covered rather than one, because a single type passing would
 * prove only that the lookup works for the type whose columns happen to match
 * the vocabulary.
 *
 * Requires a stack — CI starts one (`.github/workflows/ci.yml`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDocument, renameDocument } from "@/lib/db/repositories/documents";
import { Fixtures, adminClient, prefixed } from "../support/fixtures";

const db = adminClient();
const fixtures = new Fixtures(db);

let pageId = "";
let patternId = "";
let otherPatternKey = "";
let otherPatternId = "";
/**
 * A real one. `updated_by` is `references auth.users(id)`, so a made-up uuid
 * comes back as 23503 and every assertion here would fail for a reason that has
 * nothing to do with renaming.
 */
let actorId = "";

beforeAll(async () => {
  actorId = (await fixtures.createUser(["editor"])).id;

  const pageSlug = prefixed("rename-page");
  const { data: page, error: pageError } = await db
    .from("pages")
    .insert({ slug: pageSlug, title: "Fixture page" })
    .select("id")
    .single();
  if (pageError) throw new Error(`fixture page: ${pageError.message}`);
  pageId = page.id;

  const patternKey = prefixed("rename-pattern");
  const { data: pattern, error: patternError } = await db
    .from("patterns")
    .insert({ key: patternKey, name: "Fixture pattern" })
    .select("id")
    .single();
  if (patternError) throw new Error(`fixture pattern: ${patternError.message}`);
  patternId = pattern.id;

  otherPatternKey = prefixed("rename-pattern-taken");
  const { data: other, error: otherError } = await db
    .from("patterns")
    .insert({ key: otherPatternKey, name: "Fixture pattern two" })
    .select("id")
    .single();
  if (otherError) throw new Error(`fixture pattern two: ${otherError.message}`);
  otherPatternId = other.id;
}, 60_000);

afterAll(async () => {
  if (pageId) await db.from("pages").delete().eq("id", pageId);
  for (const id of [patternId, otherPatternId]) {
    if (id) await db.from("patterns").delete().eq("id", id);
  }
  await fixtures.cleanup();
});

describe("renameDocument addresses each type's own columns", () => {
  it("renames a page through title and slug", async () => {
    const slug = prefixed("rename-page-new");
    // `updatedBy` is written unconditionally, which is what `saveDraft` and
    // `setStatus` already rely on generically — every document table has the
    // column, and it is a foreign key, so the actor has to be real.
    await renameDocument(db, "page", pageId, { title: "Renamed page", slug, updatedBy: actorId });

    const row = await getDocument(db, "page", pageId);
    expect(row?.title).toBe("Renamed page");
    expect(row?.slug).toBe(slug);
  });

  it("renames a pattern, whose columns are name and key rather than title and slug", async () => {
    const key = prefixed("rename-pattern-new");
    await renameDocument(db, "pattern", patternId, {
      title: "Renamed pattern",
      slug: key,
      updatedBy: actorId,
    });

    // `getDocument` aliases them back, so this reads the same shape a page does
    // — which is the property that let one control serve both.
    const row = await getDocument(db, "pattern", patternId);
    expect(row?.title).toBe("Renamed pattern");
    expect(row?.slug).toBe(key);
  });

  it("changes only what it is given", async () => {
    const before = await getDocument(db, "pattern", patternId);
    await renameDocument(db, "pattern", patternId, {
      title: "Renamed again",
      updatedBy: actorId,
    });

    const after = await getDocument(db, "pattern", patternId);
    expect(after?.title).toBe("Renamed again");
    // The key is untouched: a title edit must not move an identifier other
    // things refer to.
    expect(after?.slug).toBe(before?.slug);
  });

  it("surfaces a key collision as 23505, which the service turns into a sentence", async () => {
    await expect(
      renameDocument(db, "pattern", patternId, { slug: otherPatternKey, updatedBy: actorId })
    ).rejects.toMatchObject({ code: "23505" });
  });
});
