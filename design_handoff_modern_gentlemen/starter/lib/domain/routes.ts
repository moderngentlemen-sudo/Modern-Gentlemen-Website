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
} as const satisfies Record<DocumentType, string>;

export function adminPathForDocument(type: DocumentType, id: string): string {
  return `/admin/${ADMIN_SEGMENT[type]}/${id}`;
}
