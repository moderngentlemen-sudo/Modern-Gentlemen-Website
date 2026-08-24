import type { DocumentType } from "./documents";

/**
 * Where a document appears on the public site — pure, no I/O.
 *
 * This exists so that "publishing a page updates the live site" has exactly one
 * definition. The publish, unpublish and rollback actions all need to know
 * which path to revalidate, and three copies of the same `slug === "home"`
 * special case is how one of them ends up wrong and a page silently stops
 * updating.
 */

/**
 * The homepage is the one page whose slug is not its path.
 *
 * `pages.slug` is `"home"` because a slug column that allowed `""` would make
 * every uniqueness and lookup question awkward, and because `/admin/pages`
 * needs something to print. The site still serves it at `/`.
 */
export const HOME_PAGE_SLUG = "home";

export function publicPathForPage(slug: string): string {
  return slug === HOME_PAGE_SLUG ? "/" : `/${slug}`;
}

export function publicPathForArticle(slug: string): string {
  return `/article/${slug}`;
}

/**
 * A category's landing page sits at the root, one segment deep — `/style`, not
 * `/category/style`. Which is why publishing an article has to revalidate two
 * paths: its own, and this one, because the category page's lead and grid are
 * bound to the `articles` table and go stale the moment one is published.
 */
export function publicPathForCategory(slug: string): string {
  return `/${slug}`;
}

export function publicPathForProduct(slug: string): string {
  return `/product/${slug}`;
}

/**
 * Where a document is edited in the admin.
 *
 * The builder is shared by every document type, but `PublishBar` hard-coded
 * `/admin/pages/${doc.id}/history` — correct while `page` was the only type with
 * a builder route, and a 404 for the first type that got one. Deriving the
 * segment from the document's own type is what makes the shared builder
 * genuinely type-agnostic, and it is here rather than in the component so there
 * is one definition rather than one per screen that needs it.
 *
 * `product` is listed for completeness; the products admin has its own editor
 * and does not reach the builder today.
 */
export const ADMIN_SEGMENT = {
  page: "pages",
  template: "templates",
  pattern: "patterns",
  article: "articles",
  product: "products",
  // Categories are edited from the taxonomy screen, which owns the list; this
  // is the builder route the shared PublishBar links its History button to.
  category: "categories",
} as const satisfies Record<DocumentType, string>;

export function adminPathForDocument(type: DocumentType, id: string): string {
  return `/admin/${ADMIN_SEGMENT[type]}/${id}`;
}

/**
 * What to call a document in a sentence an editor reads.
 *
 * The builder's publish dialog said "the live version of the page" whichever
 * type it was looking at — correct while `page` was the only type with a
 * builder route, and quietly wrong for the five that followed. A vocabulary
 * here rather than a ternary in the component, for the same reason
 * `ADMIN_SEGMENT` is here: the next screen that needs the noun should find it
 * rather than invent a second one.
 */
export const DOCUMENT_NOUN = {
  page: "page",
  template: "template",
  pattern: "pattern",
  article: "article",
  product: "product",
  category: "category page",
} as const satisfies Record<DocumentType, string>;

/**
 * Where a document is served, or `null` when it is not served anywhere.
 *
 * **The null is the point.** A template and a pattern have a `slug` column like
 * everything else, but neither has a URL: a template frames the documents
 * assigned to it and a pattern is composed into the pages that use it. The
 * publish dialog printed `/{slug}` regardless, so publishing a pattern called
 * `editorial-trio` advertised a page at `/editorial-trio` that has never
 * existed and cannot be made to.
 *
 * `product` and `category` are included because both are real public routes and
 * both reach this dialog — a category through the builder, a product through
 * the same shared bar.
 */
export function publicPathForDocument(type: DocumentType, slug: string): string | null {
  switch (type) {
    case "page":
      return publicPathForPage(slug);
    case "article":
      return publicPathForArticle(slug);
    case "category":
      return publicPathForCategory(slug);
    case "product":
      return publicPathForProduct(slug);
    // A template frames other documents; a pattern is composed into them.
    // Neither is reachable by URL, and saying so is the whole reason this
    // returns null rather than a best guess.
    case "template":
    case "pattern":
      return null;
  }
}
