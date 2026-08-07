/**
 * Binding sources over Supabase — the implementation `lib/blocks/binding.ts` has
 * been designed around since Phase 2 and deliberately gone without until now.
 *
 * **It lives here and not at `lib/blocks/sources/supabase.ts`**, which this
 * repo's own notes promised for three phases. `lib/blocks` is a pure leaf and
 * ESLint bars it from importing `@/lib/db/*`; the rule's message states the
 * resolution outright — *binding sources are injected*. The interface belongs in
 * the leaf, a database-backed implementation belongs in a service. Nothing in
 * `binding.ts` changed to make this possible.
 *
 * The row shapes mirror `lib/blocks/sources/demo.ts` field for field, so one
 * `$bind` descriptor resolves identically against either source. That is not
 * tidiness: it is what lets `tests/integration/publicEditorial.test.ts` compare
 * a database-resolved section tree against the demo composition and call a
 * difference a bug.
 *
 * Anonymous throughout, like `publicContent.ts` and `publicCatalog.ts`, and for
 * the same reason: `0004`'s policy is `using (status = 'published' or
 * is_staff())`, an anonymous caller is not staff, and so a draft article cannot
 * reach a public page even if a descriptor asked for one.
 */

import { createPublicClient } from "@/lib/db/public";
import { supabaseUrl } from "@/lib/db/env";
import {
  shapeRows,
  type BindingQuery,
  type BindingSource,
  type BindingSources,
} from "@/lib/blocks/binding";
import { composeCardTag } from "@/lib/domain/articles";
import { resolveAssetUrl } from "@/lib/domain/media";
import { publicPathForArticle, publicPathForCategory } from "@/lib/domain/routes";
import { listPublishedProducts } from "./publicCatalog";

/** Rows are flat and string-keyed so `filter`, `sort` and `map` work uniformly. */
type Row = Record<string, unknown>;

/** The embedded asset, in the one shape `resolveAssetUrl` wants. */
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

interface ArticleRow {
  slug: string;
  title: string;
  excerpt: string | null;
  issue_no: string | null;
  reading_minutes: number | null;
  categories: { slug: string; name: string } | null;
  authors: { name: string } | null;
  media_assets: AssetRow | null;
  article_tags: { tags: { label: string } | null }[] | null;
}

/**
 * One string literal, not a concatenation: supabase-js infers the row type by
 * parsing this at the type level, and `string` carries nothing to parse. Split
 * it and every field below degrades to `GenericStringError`.
 */
const ARTICLE_SELECT =
  "slug, title, excerpt, issue_no, reading_minutes, categories(slug, name), authors(name), media_assets(bucket, storage_path, external_url), article_tags(tags(label))";

/**
 * The two forms the design prints a reading time in.
 *
 * A grid card says "5 MIN"; the lead card's byline says "7 MIN READ". Both come
 * from one integer column, and which one a block wants is a fact about the
 * block, so the source offers both and the descriptor picks with `map`. Emitting
 * only one and appending at the call site would put presentation in the renderer
 * — and getting it wrong is a visible text change on a pixel-verified page.
 */
function readingTimes(minutes: number | null): { read: string; readLong: string } {
  const read = minutes === null ? "" : `${minutes} MIN`;
  return { read, readLong: read ? `${read} READ` : "" };
}

/**
 * A card's tag is its *subcategory* — "TAILORING · 040", not "STYLE · 040" —
 * which is what the article's tag carries. An article with no tag (the lead of
 * each category is the case) falls back to its category's name, which is exactly
 * what the design shows there.
 */
function tagLabel(row: ArticleRow): string {
  const first = row.article_tags?.find((join) => join.tags)?.tags?.label;
  return first ?? row.categories?.name ?? "";
}

function articleRow(row: ArticleRow, isLead: boolean): Row {
  const issue = row.issue_no ?? "";
  const categoryName = row.categories?.name ?? "";
  const { read, readLong } = readingTimes(row.reading_minutes);

  return {
    // Filterable facts. `project()` in binding.ts trims these off before the
    // value reaches a block, so carrying them costs the rendered page nothing.
    category: row.categories?.slug ?? "",
    categoryName,
    issue,
    lead: isLead,

    // What the editorial blocks render.
    kicker: composeCardTag(categoryName, issue),
    tag: composeCardTag(tagLabel(row), issue),
    title: row.title,
    dek: row.excerpt ?? undefined,
    author: row.authors?.name ?? "",
    read,
    readLong,
    image: assetUrl(row.media_assets),
    href: publicPathForArticle(row.slug),
  };
}

/**
 * `lead` cannot be read off a column — it means "the newest story in this
 * category", which is a fact about the set rather than the row. Computed here,
 * after ordering, so the flag means the same thing it does in the demo source.
 */
async function articleRows(): Promise<Row[]> {
  const db = createPublicClient();

  const { data, error } = await db
    .from("articles")
    .select(ARTICLE_SELECT)
    .eq("status", "published")
    .order("issue_no", { ascending: false });

  if (error) throw new Error(`Could not read the published articles: ${error.message}`);

  const seen = new Set<string>();
  return ((data ?? []) as unknown as ArticleRow[]).map((row) => {
    const slug = row.categories?.slug;
    const isLead = slug !== undefined && !seen.has(slug);
    if (slug !== undefined) seen.add(slug);
    return articleRow(row, isLead);
  });
}

interface CategoryRow {
  slug: string;
  name: string;
  intro: string | null;
  media_assets: AssetRow | null;
}

/**
 * No `kicker` here, unlike the demo source. Its value was the section number
 * ("SEC. 01"), which is a design constant with no column behind it — it lives in
 * the literal eyebrow of each category's own hero block. Emitting an empty
 * string under that name would be worse than not offering it: a binding would
 * appear to work and quietly print nothing.
 */
async function categoryRows(): Promise<Row[]> {
  const db = createPublicClient();

  const { data, error } = await db
    .from("categories")
    .select("slug, name, intro, media_assets(bucket, storage_path, external_url)")
    .eq("status", "published")
    .order("position", { ascending: true });

  if (error) throw new Error(`Could not read the published categories: ${error.message}`);

  return ((data ?? []) as unknown as CategoryRow[]).map((row) => ({
    slug: row.slug,
    name: row.name,
    title: row.name,
    body: row.intro ?? "",
    blurb: row.intro ?? "",
    image: assetUrl(row.media_assets),
    href: publicPathForCategory(row.slug),
  }));
}

/**
 * Reads through `listPublishedProducts` rather than querying `products` again,
 * so a bound product block and the store itself cannot disagree about price,
 * badge or which photograph comes first.
 */
async function productRows(): Promise<Row[]> {
  return (await listPublishedProducts()).map((product) => ({
    slug: product.slug,
    title: product.name,
    name: product.name,
    // Pounds, as the store's components expect them. Any pence conversion
    // belongs to lib/domain/money.ts at the point of use, never here.
    price: product.price,
    group: product.cat,
    image: product.images[0],
    href: `/product/${product.slug}`,
  }));
}

/** Equality-only matching, exactly as the demo source does it. */
function applyFilter(rows: Row[], filter: BindingQuery["filter"]): Row[] {
  if (!filter) return rows;
  return rows.filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value));
}

function sourceOver(load: () => Promise<Row[]>): BindingSource {
  return { fetch: async (query) => shapeRows(applyFilter(await load(), query.filter), query) };
}

export const supabaseBindingSources: BindingSources = Object.freeze({
  articles: sourceOver(articleRows),
  categories: sourceOver(categoryRows),
  products: sourceOver(productRows),
});
