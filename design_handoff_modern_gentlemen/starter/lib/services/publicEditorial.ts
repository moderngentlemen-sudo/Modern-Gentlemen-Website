/**
 * Public editorial reads — the category landing pages and the article pages.
 *
 * The third of the public read services, after `publicContent.ts` (pages) and
 * `publicCatalog.ts` (products), and it takes their stance for their reasons:
 * **no `requirePermission` call**, because `createPublicClient()` is anonymous
 * and `0004`'s policies are `using (status = 'published' or is_staff())` — an
 * anonymous caller is not staff, so a draft cannot come back through here even
 * if a query asked for one. The database is the enforcement; this file is the
 * shape.
 *
 * And **no fallback to the demo modules**. A silent fallback would render a
 * plausible page from a broken read and nobody would find out for a week. What
 * a fallback was reaching for, static rendering already provides: these pages
 * are built once, and if a later revalidation fails Next keeps serving the last
 * good output.
 *
 * `getPublishedArticle` returns the same `ResolvedArticle` the demo module
 * produces — deliberately, and `tests/integration/publicEditorial.test.ts`
 * asserts it article for article. That is what makes the switch off
 * `lib/demo/articles.ts` a change of source and nothing else: every hero, body
 * and related grid keeps the contract it was pixel-verified against.
 */

import { createPublicClient } from "@/lib/db/public";
import { supabaseUrl } from "@/lib/db/env";
import type { BlockTree } from "@/lib/blocks/types";
import type { Json } from "@/lib/db/database.types";
import {
  authorInitial,
  articleFeaturedMediaOf,
  articlePresentationOf,
  composeByline,
  composeCardTag,
  composeKicker,
  layoutFor,
  FALLBACK_RELATED_IMAGE,
  KEEP_READING_COUNT,
  type ArticleDoc,
  type RelatedItem,
  type ResolvedArticle,
} from "@/lib/domain/articles";
import { resolveAssetUrl } from "@/lib/domain/media";
import { publicPathForArticle } from "@/lib/domain/routes";

// ---------------------------------------------------------------------------
// Shared payload and asset reading
// ---------------------------------------------------------------------------

interface AssetRow {
  bucket: string;
  storage_path: string;
  external_url: string | null;
}

const assetUrl = (asset: AssetRow | null): string | undefined =>
  asset
    ? resolveAssetUrl(supabaseUrl(), {
        bucket: asset.bucket,
        storagePath: asset.storage_path,
        externalUrl: asset.external_url,
      })
    : undefined;

/**
 * `published_data`, never `draft_data`.
 *
 * The two columns exist so an editor mid-edit does not ship half-finished work,
 * and reading the wrong one here would quietly undo the whole of Phase 3. RLS
 * would not catch it: a published row's draft is readable by anyone who can read
 * the row.
 */
function payloadObject(payload: Json | null, key: string): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const value = (payload as Record<string, unknown>)[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sectionsOf(payload: Json | null): BlockTree {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const sections = (payload as Record<string, unknown>).sections;
  return Array.isArray(sections) ? (sections as BlockTree) : [];
}

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** A category's published layout, as the renderer wants it. */
export interface PublishedCategory {
  /**
   * Needed by `composePublishedCategory`: an entry-scoped assignment keys on it.
   *
   * Added when `archive` templates landed, for exactly the reason `PublishedPage`
   * carries one. It is deliberately not in the fixture comparisons — those assert
   * `sections` and `intro` field by field rather than deep-equalling the whole
   * object, which is what makes adding a field here safe.
   */
  id: string;
  slug: string;
  name: string;
  /** The standfirst, and the only prose the row carries — so it is also what
   *  `/[category]`'s meta description is built from. */
  intro: string | null;
  sections: BlockTree;
}

export async function listPublishedCategorySlugs(): Promise<string[]> {
  const db = createPublicClient();

  const { data, error } = await db
    .from("categories")
    .select("slug")
    .eq("status", "published")
    .order("position", { ascending: true });

  if (error) throw new Error(`Could not list the published categories: ${error.message}`);
  return (data ?? []).map((row) => row.slug);
}

/**
 * Returns null for an unknown or unpublished slug rather than throwing. Unlike
 * the homepage — where a missing row is a broken deployment — a category that
 * is not there genuinely is a missing resource, and the route answers with a
 * 404, exactly as it did when the five slugs were a hardcoded list.
 */
export async function getPublishedCategory(slug: string): Promise<PublishedCategory | null> {
  const db = createPublicClient();

  const { data, error } = await db
    .from("categories")
    .select("id, slug, name, intro, published_data, status")
    .eq("slug", slug.toLowerCase())
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read the published category "${slug}": ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    intro: data.intro,
    sections: sectionsOf(data.published_data),
  };
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  template: string;
  excerpt: string | null;
  issue_no: string | null;
  reading_minutes: number | null;
  category_id: string | null;
  published_data: Json | null;
  categories: { slug: string; name: string } | null;
  authors: { name: string } | null;
  media_assets: AssetRow | null;
}

/** One string literal — supabase-js parses this at the type level. */
const ARTICLE_SELECT =
  "id, slug, title, template, excerpt, issue_no, reading_minutes, category_id, published_data, categories(slug, name), authors(name), media_assets(bucket, storage_path, external_url)";

const CARD_SELECT =
  "slug, title, issue_no, published_data, categories(name), media_assets(bucket, storage_path, external_url)";

export async function listPublishedArticleSlugs(): Promise<string[]> {
  const db = createPublicClient();

  const { data, error } = await db.from("articles").select("slug").eq("status", "published");

  if (error) throw new Error(`Could not list the published articles: ${error.message}`);
  return (data ?? []).map((row) => row.slug);
}

/**
 * The display label an article's kicker prints.
 *
 * Stored on the payload for every article, because only the filed ones have a
 * category row to derive it from — the twenty template showcases are labelled
 * "The Debrief", "Motoring", "Opinion" and are deliberately filed under nothing.
 * The join is the fallback so an article created in the admin, which has no such
 * payload key, still prints its category.
 */
function categoryLabel(row: {
  published_data: Json | null;
  categories: { name: string } | null;
}): string {
  return (
    optionalString(payloadObject(row.published_data, "hero").category) ?? row.categories?.name ?? ""
  );
}

function docOf(row: ArticleRow): ArticleDoc {
  const hero = payloadObject(row.published_data, "hero");
  const featuredMedia = articleFeaturedMediaOf(row.published_data);
  const storedHero = payloadObject(row.published_data, "hero");
  const hasPresentation =
    storedHero.presentation !== null &&
    typeof storedHero.presentation === "object" &&
    !Array.isArray(storedHero.presentation);

  return {
    slug: row.slug,
    title: row.title,
    template: row.template,
    category: categoryLabel(row),
    issue: row.issue_no ?? "",
    author: row.authors?.name ?? "",
    read: row.reading_minutes === null ? "" : `${row.reading_minutes} MIN`,
    dek: row.excerpt ?? undefined,
    heroImage: assetUrl(row.media_assets),
    videoUrl: featuredMedia?.video?.url ?? optionalString(hero.videoUrl),
    ...(featuredMedia ? { featuredMedia } : {}),
    ...(hasPresentation ? { presentation: articlePresentationOf(row.published_data) } : {}),
  };
}

interface CardRow {
  slug: string;
  title: string;
  issue_no: string | null;
  published_data: Json | null;
  categories: { name: string } | null;
  media_assets: AssetRow | null;
}

const cardOf = (row: CardRow): RelatedItem => ({
  tag: composeCardTag(categoryLabel(row), row.issue_no ?? ""),
  title: row.title,
  image: assetUrl(row.media_assets) ?? FALLBACK_RELATED_IMAGE,
  href: publicPathForArticle(row.slug),
});

/**
 * KEEP READING: the curated list if there is one, siblings if there is not.
 *
 * `article_relations` is ordered and explicit, and every seeded article has
 * three rows in it — which is what reproduces the demo's own ordering, module
 * insertion order, that no column could express. An article with no curated list
 * falls back to the newest stories filed alongside it rather than showing an
 * empty rail. Both paths are capped at `KEEP_READING_COUNT`, shared with the
 * admin's picker so the two cannot drift.
 *
 * ⚠️ **A relation to a *draft* article disappears on its own, and that is RLS
 * doing it rather than this query.** The select below does not filter the joined
 * article's status — `0019` scoped `article_relations` so a row is readable only
 * when **both** ends are published or the caller is staff. So an editor may
 * curate an unpublished piece, see it in the admin, and have the public page
 * simply not show it until it goes live. Adding a status filter here would be
 * redundant with the policy and would hide where the rule actually lives.
 */
async function relatedFor(row: ArticleRow): Promise<RelatedItem[]> {
  const db = createPublicClient();

  // The join has two foreign keys to `articles` — the article and the related
  // article — so PostgREST cannot pick one for us. Named explicitly; without the
  // hint the request fails rather than guessing, which is the right behaviour
  // and an unhelpful error to meet at runtime.
  const { data: curated, error: curatedError } = await db
    .from("article_relations")
    .select(`position, articles!article_relations_related_id_fkey(${CARD_SELECT})`)
    .eq("article_id", row.id)
    .order("position", { ascending: true })
    .limit(KEEP_READING_COUNT);

  if (curatedError) {
    throw new Error(`Could not read related articles for "${row.slug}": ${curatedError.message}`);
  }

  const cards = ((curated ?? []) as unknown as { articles: CardRow | null }[])
    .flatMap((join) => (join.articles ? [join.articles] : []))
    .map(cardOf);

  if (cards.length > 0) return cards;

  // No curated list. Newest siblings, or — for an article filed under nothing —
  // the newest stories on the site, which is the demo's own fallback.
  let query = db
    .from("articles")
    .select(CARD_SELECT)
    .eq("status", "published")
    .neq("slug", row.slug)
    .order("issue_no", { ascending: false })
    .limit(KEEP_READING_COUNT);

  if (row.category_id) query = query.eq("category_id", row.category_id);

  const { data: siblings, error: siblingError } = await query;
  if (siblingError) {
    throw new Error(`Could not read related articles for "${row.slug}": ${siblingError.message}`);
  }

  return ((siblings ?? []) as unknown as CardRow[]).map(cardOf);
}

/**
 * Null for an unknown or unpublished slug — the route answers 404, as it did
 * when the article set was a hardcoded map.
 */
export async function getPublishedArticle(slug: string): Promise<ResolvedArticle | null> {
  const db = createPublicClient();

  const { data, error } = await db
    .from("articles")
    .select(ARTICLE_SELECT)
    .eq("slug", slug.toLowerCase())
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read the published article "${slug}": ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as ArticleRow;
  const doc = docOf(row);

  return {
    ...doc,
    ...layoutFor(doc.template),
    kicker: composeKicker(doc),
    byline: composeByline(doc),
    authorInitial: authorInitial(doc.author),
    related: await relatedFor(row),
  };
}

/** Article identity and builder tree, separate from the legacy deep-equal view model. */
export async function getPublishedArticleBuilder(
  slug: string
): Promise<{ id: string; sections: BlockTree } | null> {
  const db = createPublicClient();
  const { data, error } = await db
    .from("articles")
    .select("id, published_data")
    .eq("slug", slug.toLowerCase())
    .eq("status", "published")
    .maybeSingle();

  if (error) throw new Error(`Could not read the article builder content: ${error.message}`);
  return data ? { id: data.id, sections: sectionsOf(data.published_data) } : null;
}
