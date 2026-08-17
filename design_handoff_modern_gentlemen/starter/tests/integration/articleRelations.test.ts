/**
 * KEEP READING's storage, against a real Postgres.
 *
 * `setArticleRelations` reconciles a join table the same way `setArticleTags`
 * does — insert-then-prune — with one difference that no unit test can reach:
 * the conflicting row here carries `position`, so an **upsert that ignores
 * duplicates would make every reorder a silent no-op.** The save would succeed,
 * the toast would say "Saved", and the order would be exactly as before. That
 * is the assertion this file exists for; everything else is the surrounding
 * contract.
 *
 * The other two are constraints the table enforces and the domain normalizes
 * for, asserted here as *what the database would do* so the reason for
 * `normalizeRelatedIds` stays visible: a self-reference is `23514`, a repeat is
 * `23505`.
 *
 * Fixtures are created here rather than assumed from the seed, so this runs on
 * any database with the migrations applied.
 *
 * Requires a stack — CI starts one (`.github/workflows/ci.yml`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { relatedIdsForArticle, setArticleRelations } from "@/lib/db/repositories/articles";
import { normalizeRelatedIds } from "@/lib/domain/articles";
import { adminClient, prefixed } from "../support/fixtures";

const db = adminClient();

let articleId = "";
const relatedIds: string[] = [];

async function makeArticle(label: string): Promise<string> {
  const slug = prefixed(`relations-${label}`);
  const { data, error } = await db
    .from("articles")
    .insert({ slug, title: `Fixture ${slug}`, template: "Feature" })
    .select("id")
    .single();
  if (error) throw new Error(`fixture article: ${error.message}`);
  return data.id;
}

beforeAll(async () => {
  articleId = await makeArticle("subject");
  for (const label of ["one", "two", "three", "four"]) {
    relatedIds.push(await makeArticle(label));
  }
}, 60_000);

afterAll(async () => {
  // `article_relations` cascades from either end, so deleting the articles is
  // enough — which is also why the admin picker can trust that a curated id
  // always resolves to a row.
  for (const id of [articleId, ...relatedIds]) {
    if (id) await db.from("articles").delete().eq("id", id);
  }
});

describe("curating KEEP READING", () => {
  it("stores the list in the order given", async () => {
    const [a, b, c] = relatedIds;
    await setArticleRelations(db, articleId, [a, b, c]);

    expect(await relatedIdsForArticle(db, articleId)).toEqual([a, b, c]);
  });

  it("reorders an unchanged set — the case an ignore-duplicates upsert silently drops", async () => {
    const [a, b, c] = relatedIds;
    // Exactly the same three articles, so every row conflicts on
    // `(article_id, related_id)` and nothing is inserted or pruned. The only
    // thing that can change is `position`.
    await setArticleRelations(db, articleId, [c, a, b]);

    expect(await relatedIdsForArticle(db, articleId)).toEqual([c, a, b]);
  });

  it("swaps one out, keeping the rest in place", async () => {
    const [a, , c, d] = relatedIds;
    await setArticleRelations(db, articleId, [c, a, d]);

    expect(await relatedIdsForArticle(db, articleId)).toEqual([c, a, d]);
  });

  it("clears the list, which is what restores the derived fallback", async () => {
    await setArticleRelations(db, articleId, []);

    expect(await relatedIdsForArticle(db, articleId)).toEqual([]);
  });

  it("refuses a self-reference at the database, which is why the domain drops it first", async () => {
    const { error } = await db
      .from("article_relations")
      .insert({ article_id: articleId, related_id: articleId, position: 0 });

    // 23514 — `article_relation_not_self`.
    expect(error?.code).toBe("23514");
    expect(normalizeRelatedIds(articleId, [articleId])).toEqual([]);
  });

  it("refuses a duplicate pair at the database, for the same reason", async () => {
    const [a] = relatedIds;
    const { error } = await db.from("article_relations").insert([
      { article_id: articleId, related_id: a, position: 0 },
      { article_id: articleId, related_id: a, position: 1 },
    ]);

    // 23505 — the `(article_id, related_id)` primary key.
    expect(error?.code).toBe("23505");
    expect(normalizeRelatedIds(articleId, [a, a])).toEqual([a]);

    // The failed insert wrote nothing, so the fixture is left as the previous
    // test set it: empty.
    expect(await relatedIdsForArticle(db, articleId)).toEqual([]);
  });
});
