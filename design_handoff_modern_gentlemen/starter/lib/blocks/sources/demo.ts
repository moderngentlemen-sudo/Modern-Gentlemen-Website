/**
 * Binding sources over the demo modules.
 *
 * These exist so the binding contract is exercised against real content now,
 * rather than shipped as an untested interface. `lib/editorial.ts`,
 * `lib/demo/catalog.ts` and `lib/articles.ts` are pure data with no I/O, so reading
 * them keeps `lib/blocks` a leaf.
 *
 * Phase 7 adds `sources/supabase.ts` implementing the same `BindingSource`
 * interface over the `articles`, `categories` and `products` tables, and swaps
 * the map the site passes in. Nothing in `binding.ts` changes.
 */

import { categorySlugs, getCategory, slugify, type CategoryData } from "@/lib/editorial";
import { allProducts } from "@/lib/demo/catalog";
import { shapeRows, type BindingQuery, type BindingSource, type BindingSources } from "../binding";

/** Rows are flat and string-keyed so `filter`, `sort` and `map` work uniformly. */
type Row = Record<string, unknown>;

function categories(): CategoryData[] {
  return categorySlugs
    .map((slug) => getCategory(slug))
    .filter((c): c is CategoryData => c !== null);
}

/**
 * Every category card and lead, flattened. The field names match what the
 * editorial blocks want — `tag`, `title`, `read`, `image`, `href` — so the
 * common case needs no `map` at all.
 */
function articleRows(): Row[] {
  const rows: Row[] = [];

  for (const category of categories()) {
    rows.push({
      category: category.slug,
      categoryName: category.name,
      kicker: `${category.name.toUpperCase()} · ${category.lead.no}`,
      tag: `${category.name.toUpperCase()} · ${category.lead.no}`,
      title: category.lead.title,
      dek: category.lead.dek,
      author: category.lead.author,
      read: category.lead.read,
      image: category.lead.image,
      href: `/article/${slugify(category.lead.title)}`,
      lead: true,
    });

    for (const card of category.cards) {
      rows.push({
        category: category.slug,
        categoryName: category.name,
        kicker: card.tag,
        tag: card.tag,
        title: card.title,
        read: card.read,
        image: card.image,
        href: `/article/${slugify(card.title)}`,
        lead: false,
      });
    }
  }

  return rows;
}

function categoryRows(): Row[] {
  return categories().map((category) => ({
    slug: category.slug,
    name: category.name,
    title: category.name,
    kicker: category.sectionNo,
    body: category.blurb,
    blurb: category.blurb,
    image: category.heroImage,
    href: `/${category.slug}`,
  }));
}

function productRows(): Row[] {
  return allProducts().map((product) => ({
    slug: product.slug,
    title: product.name,
    name: product.name,
    // Pounds, as the catalog stores them. Any pence conversion belongs to
    // lib/domain/money.ts at the point of use, never here.
    price: product.price,
    group: product.cat,
    image: product.images[0],
    href: `/product/${product.slug}`,
  }));
}

/** Equality-only matching. Enough for the demo; the Supabase source will push filters into SQL. */
function applyFilter(rows: Row[], filter: BindingQuery["filter"]): Row[] {
  if (!filter) return rows;
  return rows.filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value));
}

function sourceOver(load: () => Row[]): BindingSource {
  return { fetch: (query) => shapeRows(applyFilter(load(), query.filter), query) };
}

export const demoBindingSources: BindingSources = Object.freeze({
  articles: sourceOver(articleRows),
  categories: sourceOver(categoryRows),
  products: sourceOver(productRows),
});
