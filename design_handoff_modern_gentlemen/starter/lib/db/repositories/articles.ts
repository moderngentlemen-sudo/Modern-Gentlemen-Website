/**
 * Article creation and the article-shaped columns.
 *
 * Everything an article shares with the other versioned entities — drafts,
 * versions, status, history, publishing — is already served by `documents.ts`
 * and needs nothing here. This file holds only what is genuinely article-shaped:
 * the editorial metadata that sits *outside* the block tree, and the tag join.
 *
 * The same split `pages.ts` makes, for the same reason.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";
import type { DocumentSummary } from "./documents";

type Db = SupabaseClient<Database>;

/**
 * An empty article. Note the four keys: `sections` is the block tree the
 * builder edits (`BLOCK_TREE_KEY.article`), and `hero` / `body` / `seo` are
 * carried through untouched by every save — the builder route strips the tree
 * key out and puts the rest back, so nothing it does not understand is lost.
 */
export const EMPTY_ARTICLE_PAYLOAD: Json = { hero: {}, body: [], sections: [], seo: {} };

/** The columns that are not the document. `null` throughout — an article starts bare. */
export interface ArticleMetaRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  template: string;
  category_id: string | null;
  author_id: string | null;
  featured_asset_id: string | null;
  reading_minutes: number | null;
  issue_no: string | null;
}

const META_COLUMNS =
  "id, slug, title, subtitle, excerpt, template, category_id, author_id, " +
  "featured_asset_id, reading_minutes, issue_no";

const LIST_COLUMNS =
  "id, title, slug, status, version, published_at, scheduled_for, created_at, updated_at";
const SEARCH_FALLBACK_BATCH = 500;

export interface ArticleListOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ArticleListResult {
  articles: DocumentSummary[];
  total: number;
}

type SearchFallbackRow = DocumentSummary & {
  subtitle: string | null;
  excerpt: string | null;
};

/** Temporary compatibility path for a deployment whose database trails code migration 0030. */
export function articleMatchesFallbackSearch(
  row: Pick<SearchFallbackRow, "title" | "slug" | "subtitle" | "excerpt">,
  term: string
): boolean {
  const words = term.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return false;
  const haystack = [row.title, row.subtitle, row.excerpt, row.slug.replaceAll("-", " ")]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
}

function searchVectorIsMissing(error: { code?: string; message: string }): boolean {
  const missingColumnCode = error.code === "42703" || error.code === "PGRST204";
  return (
    missingColumnCode &&
    /search_vector.*(?:does not exist|schema cache)|(?:does not exist|schema cache).*search_vector/i.test(
      error.message
    )
  );
}

async function listArticlesWithoutSearchVector(
  db: Db,
  term: string,
  limit: number,
  offset: number
): Promise<ArticleListResult> {
  const rows: SearchFallbackRow[] = [];

  for (let start = 0; ; start += SEARCH_FALLBACK_BATCH) {
    const { data, error } = await db
      .from("articles")
      .select(`${LIST_COLUMNS}, subtitle, excerpt`)
      .order("updated_at", { ascending: false })
      .range(start, start + SEARCH_FALLBACK_BATCH - 1);
    if (error) throw new Error(`Could not list the articles: ${error.message}`);
    const batch = (data ?? []) as unknown as SearchFallbackRow[];
    rows.push(...batch);
    if (batch.length < SEARCH_FALLBACK_BATCH) break;
  }

  const matches = rows.filter((row) => articleMatchesFallbackSearch(row, term));
  return {
    articles: matches.slice(offset, offset + limit).map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      version: row.version,
      published_at: row.published_at,
      scheduled_for: row.scheduled_for,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    total: matches.length,
  };
}

/**
 * The admin article index, including an exact result count for pagination.
 *
 * Search targets a generated tsvector rather than interpolating editor input
 * into PostgREST's raw `or` syntax. Besides using the GIN index, that keeps
 * punctuation in a title as data rather than filter grammar.
 */
export async function listArticles(
  db: Db,
  { search, limit = 25, offset = 0 }: ArticleListOptions = {}
): Promise<ArticleListResult> {
  let query = db
    .from("articles")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const term = search?.trim();
  if (term) {
    query = query.textSearch("search_vector", term, { type: "websearch", config: "english" });
  }

  const { data, error, count } = await query;
  if (error) {
    if (term && searchVectorIsMissing(error)) {
      return listArticlesWithoutSearchVector(db, term, limit, offset);
    }
    throw new Error(`Could not list the articles: ${error.message}`);
  }

  return {
    articles: (data ?? []) as unknown as DocumentSummary[],
    total: count ?? 0,
  };
}

export async function createArticle(
  db: Db,
  input: { slug: string; title: string; template?: string; createdBy: string }
): Promise<{ id: string }> {
  return unwrap(
    "createArticle",
    await db
      .from("articles")
      .insert({
        slug: input.slug,
        title: input.title,
        // The column defaults to 'Feature'; naming it explicitly keeps the
        // create dialog and the database from disagreeing about the default.
        template: input.template ?? "Feature",
        draft_data: EMPTY_ARTICLE_PAYLOAD,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select("id")
      .single()
  ) as { id: string };
}

export async function getArticleMeta(db: Db, id: string): Promise<ArticleMetaRow | null> {
  return (
    (unwrap(
      "getArticleMeta",
      await db.from("articles").select(META_COLUMNS).eq("id", id).maybeSingle()
    ) as ArticleMetaRow | null) ?? null
  );
}

/**
 * Where an article shows up on the public site: its own path, and the category
 * page whose lead and grid are bound to the `articles` table.
 *
 * One query rather than a metadata read followed by a taxonomy lookup, because
 * this runs on every publish and the only thing it is for is a cache hint.
 */
export async function getArticleRouting(
  db: Db,
  id: string
): Promise<{ slug: string; categorySlug: string | null } | null> {
  const row = unwrap(
    "getArticleRouting",
    await db.from("articles").select("slug, categories(slug)").eq("id", id).maybeSingle()
  ) as { slug: string; categories: { slug: string } | null } | null;

  return row ? { slug: row.slug, categorySlug: row.categories?.slug ?? null } : null;
}

export interface ArticleMetaPatch {
  title?: string;
  slug?: string;
  subtitle?: string | null;
  excerpt?: string | null;
  template?: string;
  categoryId?: string | null;
  authorId?: string | null;
  featuredAssetId?: string | null;
  readingMinutes?: number | null;
  issueNo?: string | null;
  updatedBy: string;
}

/**
 * Only the keys the caller supplied are written — the same rule the media
 * metadata patch follows, and for the same reason: an absent key and a cleared
 * one are different intentions, and a form that sends six fields must not blank
 * the four it does not show.
 */
export async function updateArticleMeta(
  db: Db,
  id: string,
  patch: ArticleMetaPatch
): Promise<ArticleMetaRow> {
  const update: Database["public"]["Tables"]["articles"]["Update"] = {
    updated_by: patch.updatedBy,
  };

  if (patch.title !== undefined) update.title = patch.title;
  if (patch.slug !== undefined) update.slug = patch.slug;
  if (patch.subtitle !== undefined) update.subtitle = patch.subtitle;
  if (patch.excerpt !== undefined) update.excerpt = patch.excerpt;
  if (patch.template !== undefined) update.template = patch.template;
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
  if (patch.authorId !== undefined) update.author_id = patch.authorId;
  if (patch.featuredAssetId !== undefined) update.featured_asset_id = patch.featuredAssetId;
  if (patch.readingMinutes !== undefined) update.reading_minutes = patch.readingMinutes;
  if (patch.issueNo !== undefined) update.issue_no = patch.issueNo;

  return unwrap(
    "updateArticleMeta",
    await db.from("articles").update(update).eq("id", id).select(META_COLUMNS).single()
  ) as ArticleMetaRow;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function tagIdsForArticle(db: Db, articleId: string): Promise<string[]> {
  const rows = (unwrap(
    "tagIdsForArticle",
    await db.from("article_tags").select("tag_id").eq("article_id", articleId)
  ) ?? []) as { tag_id: string }[];

  return rows.map((row) => row.tag_id);
}

/**
 * Set an article's tags to exactly `tagIds`.
 *
 * Insert-then-prune, the same ordering as the media usage reconciliation —
 * though the stakes are lower here, since a stale tag is a wrong listing rather
 * than an asset nobody can delete. Consistency is the point: two reconciliation
 * routines that behave differently under partial failure is how a codebase
 * grows a subtle class of bug.
 */
export async function setArticleTags(db: Db, articleId: string, tagIds: string[]): Promise<void> {
  const wanted = [...new Set(tagIds)];

  if (wanted.length > 0) {
    unwrap(
      "setArticleTags/upsert",
      await db.from("article_tags").upsert(
        wanted.map((tagId) => ({ article_id: articleId, tag_id: tagId })),
        { onConflict: "article_id,tag_id", ignoreDuplicates: true }
      )
    );
  }

  const existing = await tagIdsForArticle(db, articleId);
  const stale = existing.filter((tagId) => !wanted.includes(tagId));

  if (stale.length > 0) {
    unwrap(
      "setArticleTags/prune",
      await db.from("article_tags").delete().eq("article_id", articleId).in("tag_id", stale)
    );
  }
}

// ---------------------------------------------------------------------------
// Related articles — KEEP READING
// ---------------------------------------------------------------------------

/**
 * The curated related list, in the editor's order.
 *
 * Ordered by `position`, which is the column's only job: the join carries no
 * meaning beyond "these three, in this sequence".
 */
export async function relatedIdsForArticle(db: Db, articleId: string): Promise<string[]> {
  const rows = (unwrap(
    "relatedIdsForArticle",
    await db
      .from("article_relations")
      .select("related_id, position")
      .eq("article_id", articleId)
      .order("position", { ascending: true })
  ) ?? []) as { related_id: string }[];

  return rows.map((row) => row.related_id);
}

/**
 * Set an article's related list to exactly `relatedIds`, in that order.
 *
 * Insert-then-prune, like `setArticleTags` — deliberately the same shape, since
 * two reconciliation routines that behave differently under partial failure is
 * how a codebase grows a subtle class of bug.
 *
 * ⚠️ **One difference, and it is not cosmetic: this upsert must not ignore
 * duplicates.** `setArticleTags` passes `ignoreDuplicates: true` because a tag
 * row carries nothing beyond its own existence. Here the conflicting row holds
 * `position`, and reordering an already-curated list writes the *same* pairs
 * with different positions — the whole update. `ignoreDuplicates` would make
 * every reorder a silent no-op: the save succeeds, the toast says "Saved", and
 * the order is unchanged.
 */
export async function setArticleRelations(
  db: Db,
  articleId: string,
  relatedIds: string[]
): Promise<void> {
  if (relatedIds.length > 0) {
    unwrap(
      "setArticleRelations/upsert",
      await db.from("article_relations").upsert(
        relatedIds.map((relatedId, position) => ({
          article_id: articleId,
          related_id: relatedId,
          position,
        })),
        { onConflict: "article_id,related_id" }
      )
    );
  }

  const existing = await relatedIdsForArticle(db, articleId);
  const stale = existing.filter((relatedId) => !relatedIds.includes(relatedId));

  if (stale.length > 0) {
    unwrap(
      "setArticleRelations/prune",
      await db
        .from("article_relations")
        .delete()
        .eq("article_id", articleId)
        .in("related_id", stale)
    );
  }
}
