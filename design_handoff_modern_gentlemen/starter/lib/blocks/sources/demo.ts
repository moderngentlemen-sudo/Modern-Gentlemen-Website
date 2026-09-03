/**
 * Binding sources over the demo modules.
 *
 * These exist so the binding contract is exercised against real content without
 * a database. `lib/demo/editorial.ts` and `lib/demo/catalog.ts` are pure data
 * with no I/O, so reading them keeps `lib/blocks` a leaf.
 *
 * **The database-backed sibling is `lib/services/bindingSources.ts`, not
 * `sources/supabase.ts`** — this header promised the latter for three phases and
 * it could never have existed: ESLint bars `lib/blocks/**` from importing
 * `@/lib/db/*`, which is the whole point of the leaf. The row shapes below and
 * the ones that service emits are kept identical field for field, so a `$bind`
 * descriptor means the same thing whichever map the site passes in.
 */

import { categorySlugs, getCategory, slugify, type CategoryData } from "@/lib/demo/editorial";
import { readingTimes } from "@/lib/domain/articles";
import { allProducts } from "@/lib/demo/catalog";
import { filterRows, shapeRows, type BindingSource, type BindingSources } from "../binding";

/** Rows are flat and string-keyed so `filter`, `sort` and `map` work uniformly. */
type Row = Record<string, unknown>;

function categories(): CategoryData[] {
  return categorySlugs
    .map((slug) => getCategory(slug))
    .filter((c): c is CategoryData => c !== null);
}

/**
 * The two forms the design prints a reading time in: a grid card says "5 MIN",
 * a lead card says "7 MIN READ" — or "12 MIN FILM", since a film is watched
 * rather than read. The demo data carries whichever form it was transcribed
 * with, so the suffix is stripped and re-applied through the same domain rule
 * `lib/services/bindingSources.ts` uses. Stripping only "READ" here left the
 * film lead as "12 MIN FILM READ"; nothing rendered it, so nothing caught it.
 */
function readingTimesOf(value: string, categorySlug: string): ReturnType<typeof readingTimes> {
  const minutes = value.match(/(\d+)/)?.[1];
  return readingTimes(minutes === undefined ? null : Number(minutes), categorySlug);
}

/** The issue number a card's tag ends with, e.g. "TAILORING · 040" → "040". */
const issueOf = (tag: string) => tag.match(/(\d+)\s*$/)?.[1] ?? "";

/**
 * Every category card and lead, flattened. The field names match what the
 * editorial blocks want — `tag`, `title`, `read`, `image`, `href` — so the
 * common case needs no `map` at all.
 */
function articleRows(): Row[] {
  const rows: Row[] = [];

  for (const category of categories()) {
    const leadTag = `${category.name.toUpperCase()} · ${category.lead.no}`;
    rows.push({
      category: category.slug,
      categoryName: category.name,
      issue: category.lead.no,
      kicker: leadTag,
      tag: leadTag,
      title: category.lead.title,
      dek: category.lead.dek,
      author: category.lead.author,
      ...readingTimesOf(category.lead.read, category.slug),
      image: category.lead.image,
      href: `/article/${slugify(category.lead.title)}`,
      lead: true,
    });

    for (const card of category.cards) {
      rows.push({
        category: category.slug,
        categoryName: category.name,
        issue: issueOf(card.tag),
        kicker: `${category.name.toUpperCase()} · ${issueOf(card.tag)}`,
        tag: card.tag,
        title: card.title,
        ...readingTimesOf(card.read, category.slug),
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

function sourceOver(load: () => Row[]): BindingSource {
  return { fetch: (query) => shapeRows(filterRows(load(), query), query) };
}

export const demoBindingSources: BindingSources = Object.freeze({
  articles: sourceOver(articleRows),
  categories: sourceOver(categoryRows),
  products: sourceOver(productRows),
});
